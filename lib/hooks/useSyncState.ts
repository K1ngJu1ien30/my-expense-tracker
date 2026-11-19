"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import { migrateAccounts } from "./useAccountsState";
import { loadModel, rebuildFromHistory } from "../categoryPredictor";
import { getOfflineQueueForUser, removeAcknowledgedOfflineTxs } from "../offlineQueue";
import { getUserDataCacheKey, getUserMetaCacheKey, migrateLegacyCacheToUser } from "../cacheKeys";
import { fetchPaginatedTransactions } from "../transactionPagination";
import { debugLog } from "../debugLog";
import type {
  Account,
  Asset,
  CreditCardDetails,
  Goal,
  PlannerItem,
  Subscription,
  Transaction,
  RawCreditCardDetailsRow,
  RawGoalRow,
  RawSubscriptionRow,
  RawUserAccountRow,
  RawUserCategoryRow,
} from "../types";

/**
 * Collection of setters the provider passes in — allows useSyncState to
 * orchestrate cross-domain state updates without owning the state itself.
 * This keeps each domain hook free to own its own state while still letting
 * a single network fetch populate everything atomically.
 */
export type SyncSetters = {
  setTransactions: (val: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  setGoals: (val: Goal[]) => void;
  setSubscriptions: (val: Subscription[]) => void;
  setFixedBills: (val: Subscription[]) => void;
  setUtilities: (val: Subscription[]) => void;
  setPlannerItems: (val: PlannerItem[]) => void;
  setAssets: (val: Asset[]) => void;
  setAccountObjects: (val: Account[]) => void;
  setCategoriesRaw: (val: string[]) => void;
  setCategories: (val: string[]) => void;
  triggerToast: (msg: string) => void;
  /** Ref used to write the current category list into the cache payload. */
  categoriesRef: React.MutableRefObject<string[]>;
};

/**
 * useSyncState — owns network/online state, the offline transaction queue,
 * and the master `refreshData` orchestrator that populates all the domain
 * collections after a successful Supabase fetch.
 *
 * Why a "setters parameter" instead of owning the state here?
 *   Each domain (transactions, goals, subs, etc.) already owns its state
 *   in its dedicated hook / provider slot. If this hook duplicated that
 *   ownership, we'd have to sync two sources of truth. Instead, the provider
 *   passes its setters in and we just call them.
 */
type CachedAppPayload = {
  transactions?: Transaction[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  fixedBills?: Subscription[];
  utilities?: Subscription[];
  plannerItems?: PlannerItem[];
  assets?: Asset[];
  accounts?: unknown;
  categories?: string[];
};

const OFFLINE_SYNC_BATCH_SIZE = 25;

function isNetworkFailureError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    !error.code ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    error.code.startsWith("08") ||
    error.code.startsWith("XX")
  );
}

function stripMigration007Columns(tx: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...tx };
  delete copy.credit_card_tx_type;
  delete copy.statement_id;
  return copy;
}

function mergeTransactionsById(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  if (incoming.length === 0) return existing;
  const incomingMap = new Map<string, Transaction>();
  for (const row of incoming) {
    if (row.id) incomingMap.set(row.id, row);
  }
  const seen = new Set<string>();
  const merged: Transaction[] = [];
  for (const tx of existing) {
    if (tx.id && incomingMap.has(tx.id)) {
      merged.push(incomingMap.get(tx.id)!);
      seen.add(tx.id);
    } else {
      merged.push(tx);
      if (tx.id) seen.add(tx.id);
    }
  }
  for (const row of incoming) {
    if (row.id && !seen.has(row.id)) {
      merged.unshift(row);
      seen.add(row.id);
    }
  }
  merged.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });
  return merged;
}

export function useSyncState(session: Session | null, setters: SyncSetters) {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Re-entrancy guard: both the browser `online` event AND the Capacitor
   * Network listener can fire simultaneously. Without this we'd double-upload.
   */
  const isSyncingRef = useRef(false);

  /** Tracks the currently active user ID to prevent stale cross-user commits. */
  const activeUserIdRef = useRef<string | null>(session?.user?.id ?? null);
  useEffect(() => {
    activeUserIdRef.current = session?.user?.id ?? null;
  }, [session?.user?.id]);

  /** Tracks which user has already been hydrated from local cache. */
  const hydratedUserIdRef = useRef<string | null>(null);

  /** Tracks previous offline state reliably across web & Capacitor listeners. */
  const wasOfflineRef = useRef(false);

  // Keep setters in a ref so effects don't need them in the dep array and
  // don't tear down+rebuild on every provider re-render.
  const settersRef = useRef(setters);
  useEffect(() => {
    settersRef.current = setters;
  }, [setters]);

  // ─── Fast local-first cache hydration (non-network) ────────────────────
  const hydrateFromCache = useCallback(
    async (currentUser: { id: string; user_metadata?: Record<string, unknown> }): Promise<boolean> => {
      const s = settersRef.current;
      const fallbackAccounts = migrateAccounts(
        currentUser.user_metadata?.custom_accounts || ["Bank", "Cash", "eWallet"]
      );

      try {
        await migrateLegacyCacheToUser(currentUser.id);
        const userCacheKey = getUserDataCacheKey(currentUser.id);
        const [data, offlineQueue] = await Promise.all([
          localforage.getItem<CachedAppPayload>(userCacheKey),
          getOfflineQueueForUser(currentUser.id),
        ]);

        // Abort if user logged out or switched accounts while IndexedDB read was in flight
        if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) {
          return false;
        }

        if (data) {
          debugLog("[hydrateFromCache] Cache found! Hydrating state...");
          let cachedTx = (data.transactions ?? []) as Transaction[];

          if (offlineQueue && offlineQueue.length > 0) {
            const cachedIds = new Set(cachedTx.map(t => t.id));
            const offlineTxs = offlineQueue
              .filter(tx => !tx.id || !cachedIds.has(tx.id))
              .map((tx, i) => ({
                ...tx,
                id: tx.id || `offline-${Date.now()}-${i}`,
                user_id: currentUser.id,
              })) as Transaction[];
            if (offlineTxs.length > 0) {
              cachedTx = [...offlineTxs, ...cachedTx];
              debugLog("[hydrateFromCache] Prepended", offlineTxs.length, "offline queue items.");
            }
          }

          s.setTransactions(cachedTx);
          s.setGoals(data.goals ?? []);
          s.setSubscriptions(data.subscriptions ?? []);
          s.setFixedBills(data.fixedBills ?? []);
          s.setUtilities(data.utilities ?? []);
          s.setPlannerItems(data.plannerItems ?? []);
          s.setAssets(data.assets ?? []);
          s.setAccountObjects(data.accounts ? migrateAccounts(data.accounts) : fallbackAccounts);
          if (data.categories?.length) s.setCategoriesRaw(data.categories);

          hydratedUserIdRef.current = currentUser.id;
          debugLog("[hydrateFromCache] Local hydration complete.", {
            tx: cachedTx.length,
            goals: (data.goals ?? []).length,
          });
          return true;
        }

        // No cache yet — still seed fallback accounts & any pending offline items
        s.setAccountObjects(fallbackAccounts);
        if (offlineQueue && offlineQueue.length > 0) {
          const offlineTxs = offlineQueue.map((tx, i) => ({
            ...tx,
            id: tx.id || `offline-${Date.now()}-${i}`,
            user_id: currentUser.id,
          })) as Transaction[];
          s.setTransactions(offlineTxs);
        }
        debugLog("[hydrateFromCache] No local cache found for user.");
        return false;
      } catch (cacheErr) {
        console.error("[hydrateFromCache] Local cache hydration failed:", cacheErr);
        s.setAccountObjects(fallbackAccounts);
        return false;
      }
    },
    []
  );

  // ─── refreshData (background network sync) ─────────────────────────────
  const refreshData = useCallback(
    async (currentUser: { id: string; user_metadata?: Record<string, unknown> }) => {
      const s = settersRef.current;
      setIsSyncing(true);

      // Fallback from user_metadata (old APK compatibility). If the new
      // user_accounts table fetch succeeds below, we'll override this.
      let savedAccounts = migrateAccounts(
        currentUser.user_metadata?.custom_accounts || ["Bank", "Cash", "eWallet"]
      );

      try {
        debugLog("[refreshData] Fetching live data...");
        const [parsedTransactions, gls, subs, plannerRes, assetsRes, accountsRes, categoriesRes, cardDetailsRes] =
          await Promise.all([
            fetchPaginatedTransactions(currentUser.id),
            supabase.from("goals").select("id,user_id,title,current_amount,target_amount,is_pinned,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("subscriptions").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("salary_planner").select("id,user_id,category,item_name,amount,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("asset_vault").select("id,user_id,name,category,emoji_icon,purchase_date,purchase_price,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            // Migration 002 tables — tolerant of missing table / RLS issues.
            supabase.from("user_accounts").select("*").eq("user_id", currentUser.id).order("sort_order", { ascending: true }),
            supabase.from("user_categories").select("name").eq("user_id", currentUser.id).order("sort_order", { ascending: true }),
            supabase.from("credit_card_details").select("account_id,user_id,issuer,card_last_four,statement_day,grace_period_days,due_day,apr,card_color,reminder_days_before,created_at,updated_at").eq("user_id", currentUser.id),
          ]);

        // Abort if user signed out or switched accounts while fetch was in flight
        if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) {
          return;
        }

        // Supabase select() does not throw on network failure — force it.
        // NOTE: we intentionally do NOT include accountsRes/categoriesRes
        // in this fatal-error check. If those are missing we fall back to
        // user_metadata (old-APK compatible).
        if (gls.error || subs.error || plannerRes.error || assetsRes.error) {
          debugLog("[refreshData] Supabase returned error objects:", {
            gls: gls.error, subs: subs.error,
            planner: plannerRes.error, assets: assetsRes.error,
          });
          throw new Error("Supabase fetch returned errors");
        }

        if (!parsedTransactions || !gls.data || !subs.data || !plannerRes.data || !assetsRes.data) {
          debugLog("[refreshData] Supabase returned null data arrays — treating as offline");
          throw new Error("Supabase returned null data");
        }

        // Map credit_card_details by account_id
        const cardDetailsMap = new Map<string, CreditCardDetails>();
        if (!cardDetailsRes.error && cardDetailsRes.data && cardDetailsRes.data.length > 0) {
          (cardDetailsRes.data as RawCreditCardDetailsRow[]).forEach(c => {
            cardDetailsMap.set(c.account_id, {
              accountId: c.account_id,
              userId: c.user_id,
              issuer: c.issuer || undefined,
              cardLastFour: c.card_last_four || undefined,
              statementDay: c.statement_day,
              gracePeriodDays: c.grace_period_days,
              dueDay: c.due_day,
              apr: c.apr !== null && c.apr !== undefined ? Number(c.apr) : null,
              cardColor: c.card_color || undefined,
              reminderDaysBefore: c.reminder_days_before ?? 3,
              createdAt: c.created_at,
              updatedAt: c.updated_at,
            });
          });
        }

        // ─── New-table-first account/category resolution (Migration 002) ──
        if (!accountsRes.error && accountsRes.data && accountsRes.data.length > 0) {
          savedAccounts = (accountsRes.data as RawUserAccountRow[]).map(a => {
            const cd = cardDetailsMap.get(a.id);
            return {
              id: a.id,
              name: a.name,
              currencyCode: a.currency_code || "RM",
              isArchived: a.is_archived || false,
              kind: a.kind || "bank",
              openingBalance: Number(a.opening_balance || 0),
              openingBalanceDate: a.opening_balance_date || undefined,
              creditLimit: a.credit_limit ? Number(a.credit_limit) : null,
              statementDay: cd?.statementDay ?? a.statement_day ?? null,
              dueDay: cd?.dueDay ?? a.due_day ?? null,
              cardDetails: cd,
            };
          });
          debugLog("[refreshData] Loaded", savedAccounts.length, "accounts from user_accounts table");
        } else {
          debugLog("[refreshData] user_accounts empty/unavailable — using user_metadata fallback");
        }

        let resolvedCategories = s.categoriesRef.current || [];
        if (!categoriesRes.error && categoriesRes.data && categoriesRes.data.length > 0) {
          const cloudCats = (categoriesRes.data as Pick<RawUserCategoryRow, "name">[]).map(c => c.name);
          // Merge strategy: preserve any local-only categories that haven't
          // been synced yet (e.g. added while the network was flaky or
          // before migration 002 was applied). Cloud order wins for the
          // cloud-known entries; local-only extras are appended at the end.
          const localCats = s.categoriesRef.current || [];
          const seen = new Set(cloudCats.map(c => c.toLowerCase()));
          const localOnly = localCats.filter(c => !seen.has(c.toLowerCase()));
          const merged = [...cloudCats, ...localOnly];
          resolvedCategories = merged;
          s.setCategoriesRaw(merged);
          debugLog(
            "[refreshData] Merged categories:",
            cloudCats.length, "cloud +",
            localOnly.length, "local-only =",
            merged.length, "total"
          );

          // If we found local-only categories, push them up to the cloud
          // in the background so the next device or next launch sees them.
          if (localOnly.length > 0) {
            supabase.from("user_categories").insert(
              localOnly.map((name, idx) => ({
                user_id: currentUser.id,
                name,
                sort_order: cloudCats.length + idx,
              }))
            ).then(({ error }) => {
              if (error) console.warn("[refreshData] backfill upload failed:", error);
              else debugLog("[refreshData] Backfilled", localOnly.length, "local-only categories to cloud");
            });
          }
        } else {
          debugLog("[refreshData] user_categories empty/unavailable — keeping local categories");
        }

        // ─── Parse responses ──────────────────────────────────────────────
        const parsedGoals: Goal[] = (gls.data as RawGoalRow[]).map(g => ({
          id: g.id,
          title: g.title,
          subtitle: "Goal",
          current: Number(g.current_amount),
          target: Number(g.target_amount),
          isPinned: g.is_pinned,
          color: "bg-emerald-500",
          bg: "bg-emerald-500/10",
          iconName: "Target",
          user_id: g.user_id,
        }));
        const subRows = subs.data as RawSubscriptionRow[];
        const parsedSubscriptions: Subscription[] = subRows
          .filter(sub => sub.type === "subscription" || !sub.type)
          .map(sub => ({
            id: sub.id, name: sub.name, cost: Number(sub.amount),
            billingDay: sub.billing_day, sourceAccount: sub.source_account,
            source_account_id: sub.source_account_id,
            autoDeduct: sub.auto_deduct, user_id: sub.user_id, type: "subscription",
            lastPaidMonth: sub.last_paid_month,
            icon: "MonitorPlay", bg: "bg-red-500/10", color: "text-red-500",
          }));
        const parsedFixedBills: Subscription[] = subRows
          .filter(sub => sub.type === "fixed_bill" || sub.type === "bill")
          .map(sub => ({
            id: sub.id, name: sub.name, cost: Number(sub.amount),
            billingDay: sub.billing_day, sourceAccount: sub.source_account,
            source_account_id: sub.source_account_id,
            autoDeduct: sub.auto_deduct, user_id: sub.user_id, type: "fixed_bill",
            lastPaidMonth: sub.last_paid_month,
            icon: "FileText", bg: "bg-purple-500/10", color: "text-purple-500",
          }));
        const parsedUtilities: Subscription[] = subRows
          .filter(sub => sub.type === "utility")
          .map(sub => ({
            id: sub.id, name: sub.name, cost: Number(sub.amount),
            billingDay: sub.billing_day, sourceAccount: sub.source_account,
            source_account_id: sub.source_account_id,
            autoDeduct: sub.auto_deduct, user_id: sub.user_id, type: "utility",
            lastPaidMonth: sub.last_paid_month,
            icon: "Zap", bg: "bg-yellow-500/10", color: "text-yellow-500",
          }));
        const parsedPlanner = plannerRes.data as PlannerItem[];
        const parsedAssets = assetsRes.data as Asset[];

        debugLog("[refreshData] Live data fetch successful.", {
          tx: parsedTransactions.length,
          goals: parsedGoals.length,
          subs: parsedSubscriptions.length,
          utils: parsedUtilities.length,
          planner: parsedPlanner.length,
          assets: parsedAssets.length,
        });

        // ─── Commit to state ──────────────────────────────────────────────
        // Merge any uncommitted offline queue items belonging to this user
        const pendingOffline = await getOfflineQueueForUser(currentUser.id);
        if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) {
          return;
        }
        const cloudIds = new Set(parsedTransactions.map(t => t.id));
        const uncommittedOffline = pendingOffline
          .filter(t => t.id && !cloudIds.has(t.id))
          .map((t, idx) => ({ ...t, id: t.id || `offline-${Date.now()}-${idx}`, user_id: currentUser.id })) as Transaction[];
        const finalTransactions = uncommittedOffline.length > 0 ? [...uncommittedOffline, ...parsedTransactions] : parsedTransactions;

        s.setTransactions(finalTransactions);
        s.setGoals(parsedGoals);
        s.setSubscriptions(parsedSubscriptions);
        s.setFixedBills(parsedFixedBills);
        s.setUtilities(parsedUtilities);
        s.setPlannerItems(parsedPlanner);
        s.setAssets(parsedAssets);
        s.setAccountObjects(savedAccounts);
        hydratedUserIdRef.current = currentUser.id;

        // ─── Background post-commit work (non-blocking) ───────────────────
        // Defer IndexedDB persistence and category-predictor bootstrap so
        // they never block UI availability or delay `isSyncing` completion.
        const cachePayload: CachedAppPayload = {
          transactions: parsedTransactions,
          goals: parsedGoals,
          subscriptions: parsedSubscriptions,
          fixedBills: parsedFixedBills,
          utilities: parsedUtilities,
          plannerItems: parsedPlanner,
          assets: parsedAssets,
          accounts: savedAccounts,
          categories: resolvedCategories,
        };
        const userCacheKey = getUserDataCacheKey(currentUser.id);
        const metaCacheKey = getUserMetaCacheKey(currentUser.id);

        // Lightweight metadata mirror in localStorage (tiny — no transactions)
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              metaCacheKey,
              JSON.stringify({ accounts: savedAccounts, categories: resolvedCategories })
            );
          } catch {
            /* ignore quota errors */
          }
        }

        // Primary persistent cache write in IndexedDB (detached)
        void localforage
          .setItem(userCacheKey, cachePayload)
          .then(() => debugLog("[refreshData] IndexedDB cache saved for user:", currentUser.id))
          .catch(storageErr => console.warn("[refreshData] localforage.setItem failed:", storageErr));

        // Category predictor bootstrap (detached, never blocks UI)
        if (parsedTransactions.length > 0) {
          const scheduleIdle =
            typeof window !== "undefined" && "requestIdleCallback" in window
              ? (cb: () => void) =>
                  (window as unknown as { requestIdleCallback: (fn: () => void) => void }).requestIdleCallback(cb)
              : (cb: () => void) => setTimeout(cb, 0);
          scheduleIdle(() => {
            void loadModel(currentUser.id)
              .then(existing => {
                if (Object.keys(existing).length === 0) {
                  return rebuildFromHistory(parsedTransactions, currentUser.id);
                }
              })
              .catch(() => {
                /* predictor is a pure enhancement — never fail refresh over it */
              });
          });
        }
      } catch (err) {
        debugLog("[refreshData] Network error caught:", err);
        // Only hydrate from cache on network failure if we haven't already
        // hydrated local state for this user (avoids clobbering optimistic
        // local edits made after startup).
        if (hydratedUserIdRef.current !== currentUser.id) {
          await hydrateFromCache(currentUser);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [hydrateFromCache]
  );

  // ─── syncOfflineQueue (batched idempotent upserts + incremental merge) ─
  const syncOfflineQueue = useCallback(async () => {
    if (isSyncingRef.current) {
      debugLog("[syncOfflineQueue] Already syncing — skipping duplicate run");
      return;
    }
    const userId = session?.user?.id;
    if (!userId) {
      debugLog("[syncOfflineQueue] No active session — skipping sync until authenticated");
      return;
    }
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const queue = await getOfflineQueueForUser(userId);
      if (!queue || queue.length === 0) return;

      const validItems = queue.filter((tx): tx is Partial<Transaction> & { id: string } => Boolean(tx && tx.id));
      if (validItems.length === 0) return;

      const acknowledgedIds = new Set<string>();
      const syncedRows: Transaction[] = [];
      let hitNetworkError = false;

      // Helper: per-item fallback when a batch fails due to a single malformed row
      const syncItemsIndividually = async (items: Array<Partial<Transaction> & { id: string }>) => {
        for (const tx of items) {
          try {
            const payload = { ...tx, user_id: userId };
            const { data, error } = await supabase
              .from("transactions")
              .upsert(payload, { onConflict: "id" })
              .select();

            if (error) {
              if (error.code === "42703") {
                const retry = await supabase
                  .from("transactions")
                  .upsert(stripMigration007Columns(payload), { onConflict: "id" })
                  .select();
                if (!retry.error) {
                  acknowledgedIds.add(tx.id);
                  if (Array.isArray(retry.data) && retry.data[0]) {
                    syncedRows.push({
                      ...(retry.data[0] as Transaction),
                      credit_card_tx_type: tx.credit_card_tx_type,
                      statement_id: tx.statement_id,
                    });
                  }
                  continue;
                }
              }
              console.warn(`[syncOfflineQueue] Failed to sync transaction ${tx.id}:`, error);
              if (isNetworkFailureError(error)) {
                hitNetworkError = true;
                break;
              }
              // Non-network / malformed record: skip and continue with remaining items
            } else {
              acknowledgedIds.add(tx.id);
              if (Array.isArray(data) && data[0]) {
                syncedRows.push(data[0] as Transaction);
              }
            }
          } catch (netErr) {
            console.warn(`[syncOfflineQueue] Network error for tx ${tx.id}:`, netErr);
            hitNetworkError = true;
            break;
          }
        }
      };

      // Process in safe idempotent batches of OFFLINE_SYNC_BATCH_SIZE
      for (let i = 0; i < validItems.length; i += OFFLINE_SYNC_BATCH_SIZE) {
        if (hitNetworkError) break;
        const batch = validItems.slice(i, i + OFFLINE_SYNC_BATCH_SIZE);
        const payloads = batch.map(tx => ({ ...tx, user_id: userId }));

        try {
          const { data, error } = await supabase
            .from("transactions")
            .upsert(payloads, { onConflict: "id" })
            .select();

          if (!error) {
            batch.forEach(tx => acknowledgedIds.add(tx.id));
            if (Array.isArray(data)) {
              syncedRows.push(...(data as Transaction[]));
            }
            continue;
          }

          if (error.code === "42703") {
            const fallbackPayloads = payloads.map(p => stripMigration007Columns(p));
            const retry = await supabase
              .from("transactions")
              .upsert(fallbackPayloads, { onConflict: "id" })
              .select();
            if (!retry.error) {
              batch.forEach(tx => acknowledgedIds.add(tx.id));
              if (Array.isArray(retry.data)) {
                const ccMetaById = new Map(
                  batch.map(tx => [tx.id, { credit_card_tx_type: tx.credit_card_tx_type, statement_id: tx.statement_id }])
                );
                for (const row of retry.data as Transaction[]) {
                  const meta = ccMetaById.get(row.id);
                  syncedRows.push(meta ? { ...row, ...meta } : row);
                }
              }
              continue;
            }
          }

          if (isNetworkFailureError(error)) {
            console.warn("[syncOfflineQueue] Network failure during batch upsert:", error);
            hitNetworkError = true;
            break;
          }

          // Non-network batch failure (e.g. one malformed item in the batch):
          // fall back to item-by-item for this batch so valid items still sync.
          debugLog("[syncOfflineQueue] Batch error (non-network) — isolating per item:", error);
          await syncItemsIndividually(batch);
        } catch (netErr) {
          console.warn("[syncOfflineQueue] Batch network exception:", netErr);
          hitNetworkError = true;
          break;
        }
      }

      // Safely remove only the successfully acknowledged transactions
      if (acknowledgedIds.size > 0) {
        const removed = await removeAcknowledgedOfflineTxs(acknowledgedIds);
        const remaining = validItems.length - acknowledgedIds.size;

        if (remaining === 0) {
          settersRef.current.triggerToast(
            `${removed} offline expense${removed > 1 ? "s" : ""} synced to cloud!`
          );
        } else {
          settersRef.current.triggerToast(
            `${removed} synced, ${remaining} pending retry`
          );
        }

        // Update local state and IndexedDB cache incrementally from the
        // canonical server upsert rows — avoids re-downloading the entire
        // transaction history after every offline sync.
        if (syncedRows.length > 0 && activeUserIdRef.current === userId) {
          settersRef.current.setTransactions(prev => mergeTransactionsById(prev, syncedRows));

          const userCacheKey = getUserDataCacheKey(userId);
          void localforage
            .getItem<CachedAppPayload>(userCacheKey)
            .then(cached => {
              if (!cached) return;
              const updatedTxs = mergeTransactionsById(cached.transactions ?? [], syncedRows);
              return localforage.setItem(userCacheKey, { ...cached, transactions: updatedTxs });
            })
            .catch(() => {
              /* non-fatal cache update */
            });
        }
      }
    } catch (err) {
      console.error("[syncOfflineQueue] Process failed:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [session?.user?.id]);

  // ─── Network listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const initialOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
    wasOfflineRef.current = initialOffline;
    setIsOffline(initialOffline);

    const handleOnline = () => {
      wasOfflineRef.current = false;
      setIsOffline(false);
      void syncOfflineQueue();
    };
    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOffline(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Capacitor native listener (opt-in — only if plugin is available)
    let cancelled = false;
    let nativeHandle: { remove: () => Promise<void> } | null = null;
    try {
      type NetStatus = { connected: boolean; connectionType?: string };
      import("@capacitor/network")
        .then(async ({ Network }) => {
          Network.getStatus()
            .then((status: NetStatus) => {
              if (cancelled) return;
              const offlineNow = !status.connected;
              wasOfflineRef.current = offlineNow;
              setIsOffline(offlineNow);
            })
            .catch(() => {});
          const listener = await Network.addListener("networkStatusChange", (status: NetStatus) => {
            const wasOffline = wasOfflineRef.current;
            const offlineNow = !status.connected;
            wasOfflineRef.current = offlineNow;
            setIsOffline(offlineNow);
            if (status.connected && wasOffline) void syncOfflineQueue();
          });
          if (cancelled) {
            listener.remove().catch(() => {});
          } else {
            nativeHandle = listener;
          }
        })
        .catch(() => {});
    } catch {
      /* ignore — web build */
    }

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      nativeHandle?.remove().catch(() => {});
    };
  }, [session?.user?.id, syncOfflineQueue]);

  return {
    isOffline,
    isSyncing,
    isSyncingRef,
    hydrateFromCache,
    refreshData,
    syncOfflineQueue,
  };
}
