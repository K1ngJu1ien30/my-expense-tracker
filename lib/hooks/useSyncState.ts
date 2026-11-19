"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import { migrateAccounts } from "./useAccountsState";
import { loadModel, rebuildFromHistory } from "../categoryPredictor";
import {
  getOfflineQueueForUser,
  quarantineOfflineTx,
  removeAcknowledgedOfflineTxs,
  stripOfflineQueueMeta,
  type OfflineQueuedTx,
} from "../offlineQueue";
import {
  getUserDataCacheKey,
  getUserMetaCacheKey,
  getUserSyncWatermarkKey,
  migrateLegacyCacheToUser,
} from "../cacheKeys";
import {
  extractMaxUpdatedAt,
  fetchDeltaTransactions,
  fetchPaginatedTransactions,
} from "../transactionPagination";
import {
  applyLocalTxOverrides,
  compareTransactionsDesc,
  mergeTransactionsWithDeletes,
  readFullCachedTransactions,
  readRecentCachedTransactions,
  upsertCachedTransactions,
  writeCachedTransactions,
  type LocalTxTracker,
} from "../txCache";
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
  /** Shared optimistic mutation tracker so refreshData never clobbers local edits. */
  localTxTracker?: LocalTxTracker;
  /** Optional hook invoked when connectivity returns (e.g. flush offline statements). */
  onOnlineReconnect?: () => void;
};

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

/**
 * Merge local queued offline items (adds, edits, and soft-delete tombstones)
 * on top of a cloud/cached transaction array in deterministic descending order.
 */
function overlayOfflineQueue(
  base: Transaction[],
  offlineQueue: OfflineQueuedTx[] | null | undefined,
  userId: string
): { merged: Transaction[]; hasPendingOverlay: boolean } {
  if (!offlineQueue || offlineQueue.length === 0) {
    return { merged: base, hasPendingOverlay: false };
  }
  const byId = new Map<string, Transaction>();
  for (const tx of base) {
    if (tx.id && !tx.deleted_at) byId.set(tx.id, tx);
  }
  let hasPendingOverlay = false;
  offlineQueue.forEach((raw, idx) => {
    const clean = stripOfflineQueueMeta(raw);
    const id = clean.id || `offline-${Date.now()}-${idx}`;
    if (clean.deleted_at) {
      if (byId.delete(id)) hasPendingOverlay = true;
    } else {
      byId.set(id, { ...clean, id, user_id: userId } as Transaction);
      hasPendingOverlay = true;
    }
  });
  if (!hasPendingOverlay) {
    return { merged: base, hasPendingOverlay: false };
  }
  const merged = Array.from(byId.values());
  merged.sort(compareTransactionsDesc);
  return { merged, hasPendingOverlay: true };
}

export function useSyncState(session: Session | null, setters: SyncSetters) {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [isSyncing, setIsSyncing] = useState(false);

  /** Ref-counted sync activity so overlapping queue/refresh ops never prematurely clear isSyncing. */
  const activeSyncOpsRef = useRef(0);
  const beginSyncOp = useCallback(() => {
    activeSyncOpsRef.current += 1;
    setIsSyncing(true);
  }, []);
  const endSyncOp = useCallback(() => {
    activeSyncOpsRef.current = Math.max(0, activeSyncOpsRef.current - 1);
    if (activeSyncOpsRef.current === 0) setIsSyncing(false);
  }, []);

  /** Re-entrancy guard for offline queue sync. */
  const isSyncingRef = useRef(false);
  /** Single-flight lock + trailing queue for refreshData. */
  const refreshInFlightRef = useRef(false);
  const pendingRefreshUserRef = useRef<{ id: string; user_metadata?: Record<string, unknown> } | null>(null);

  /** Tracks the currently active user ID to prevent stale cross-user commits. */
  const activeUserIdRef = useRef<string | null>(session?.user?.id ?? null);
  useEffect(() => {
    activeUserIdRef.current = session?.user?.id ?? null;
  }, [session?.user?.id]);

  /** Tracks which user has already been hydrated from local cache. */
  const hydratedUserIdRef = useRef<string | null>(null);
  /** In-memory baseline of full hydrated cloud transactions for delta sync. */
  const cachedCloudTransactionsRef = useRef<{ userId: string; rows: Transaction[] } | null>(null);

  /** Tracks previous offline state reliably across web & Capacitor listeners. */
  const wasOfflineRef = useRef(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  // Keep setters in a ref so effects don't need them in the dep array and
  // don't tear down+rebuild on every provider re-render.
  const settersRef = useRef(setters);
  useEffect(() => {
    settersRef.current = setters;
  }, [setters]);

  // ─── Fast local-first cache hydration (non-network) ────────────────────
  // Two-stage read:
  //   1. Reads the tiny top-100 recent slice + non-tx collections + offline
  //      queue in parallel so History & Dashboard become interactive in <15ms.
  //   2. Loads the full dedicated transactions cache in parallel / right after
  //      (with automatic fallback to legacy monolithic cache from v3.5.0).
  const hydrateFromCache = useCallback(
    async (currentUser: { id: string; user_metadata?: Record<string, unknown> }): Promise<boolean> => {
      const s = settersRef.current;
      const fallbackAccounts = migrateAccounts(
        currentUser.user_metadata?.custom_accounts || ["Bank", "Cash", "eWallet"]
      );

      try {
        await migrateLegacyCacheToUser(currentUser.id);
        const userCacheKey = getUserDataCacheKey(currentUser.id);
        const [recentSlice, data, offlineQueue] = await Promise.all([
          readRecentCachedTransactions(currentUser.id),
          localforage.getItem<CachedAppPayload>(userCacheKey),
          getOfflineQueueForUser(currentUser.id),
        ]);

        // Abort if user logged out or switched accounts while IndexedDB read was in flight
        if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) {
          return false;
        }

        const mergeOffline = (base: Transaction[]): Transaction[] =>
          overlayOfflineQueue(base, offlineQueue, currentUser.id).merged;

        if (data) {
          s.setGoals(data.goals ?? []);
          s.setSubscriptions(data.subscriptions ?? []);
          s.setFixedBills(data.fixedBills ?? []);
          s.setUtilities(data.utilities ?? []);
          s.setPlannerItems(data.plannerItems ?? []);
          s.setAssets(data.assets ?? []);
          s.setAccountObjects(data.accounts ? migrateAccounts(data.accounts) : fallbackAccounts);
          if (data.categories?.length) s.setCategoriesRaw(data.categories);
        } else {
          s.setAccountObjects(fallbackAccounts);
        }

        // Fast paint with tiny top-100 slice if available
        if (recentSlice && recentSlice.length > 0) {
          s.setTransactions(mergeOffline(recentSlice));
        }

        // Load full dedicated transactions cache (falls back to legacy data.transactions)
        const fullCachedTxs = await readFullCachedTransactions(currentUser.id, data);
        if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) {
          return false;
        }

        if (fullCachedTxs) {
          cachedCloudTransactionsRef.current = {
            userId: currentUser.id,
            rows: fullCachedTxs,
          };
          const combined = mergeOffline(fullCachedTxs);
          s.setTransactions(combined);
          hydratedUserIdRef.current = currentUser.id;
          debugLog("[hydrateFromCache] Local hydration complete.", {
            tx: combined.length,
            goals: (data?.goals ?? []).length,
          });
          return true;
        }

        // No cache yet — still seed any pending offline items
        cachedCloudTransactionsRef.current = null;
        if (offlineQueue && offlineQueue.length > 0) {
          s.setTransactions(mergeOffline([]));
        }
        debugLog("[hydrateFromCache] No local transaction cache found for user.");
        return Boolean(data);
      } catch (cacheErr) {
        console.error("[hydrateFromCache] Local cache hydration failed:", cacheErr);
        s.setAccountObjects(fallbackAccounts);
        return false;
      }
    },
    []
  );

  // Ref for invoking syncOfflineQueue from inside refreshData without circular deps
  const syncOfflineQueueRef = useRef<(explicitUserId?: string) => Promise<void>>(async () => {});

  // ─── refreshData (delta-first background network sync) ─────────────────
  const refreshData = useCallback(
    async (currentUser: { id: string; user_metadata?: Record<string, unknown> }) => {
      if (refreshInFlightRef.current) {
        pendingRefreshUserRef.current = currentUser;
        debugLog("[refreshData] Already in flight — queued trailing refresh");
        return;
      }
      refreshInFlightRef.current = true;
      const s = settersRef.current;
      beginSyncOp();

      // Fallback from user_metadata (old APK compatibility). If the new
      // user_accounts table fetch succeeds below, we'll override this.
      let savedAccounts = migrateAccounts(
        currentUser.user_metadata?.custom_accounts || ["Bank", "Cash", "eWallet"]
      );

      try {
        debugLog("[refreshData] Fetching live data...");

        // Flush any offline transactions queued in a previous session before
        // pulling cloud state (fixes offline-created items staying stuck on
        // launch when the app opens already online).
        if (!wasOfflineRef.current) {
          await syncOfflineQueueRef.current(currentUser.id);
        }

        // Snapshot mutation epoch BEFORE issuing cloud queries so any optimistic
        // add/edit/delete/restore made while this fetch is in flight is preserved.
        const refreshStartEpoch = s.localTxTracker?.getEpoch() ?? 0;

        const watermarkKey = getUserSyncWatermarkKey(currentUser.id);
        const rawCachedForUser =
          cachedCloudTransactionsRef.current?.userId === currentUser.id
            ? cachedCloudTransactionsRef.current.rows
            : null;
        const cachedForUser = rawCachedForUser
          ? applyLocalTxOverrides(rawCachedForUser, s.localTxTracker, 0, false).rows
          : null;
        const storedWatermark = cachedForUser
          ? await localforage.getItem<string>(watermarkKey).catch(() => null)
          : null;

        // Build transaction fetch strategy:
        //   1. Warm start with cache + watermark → try ultra-fast delta sync
        //      (0–5 rows, ~100ms, requires Migration 015 `updated_at`).
        //   2. Fallback (first login / Migration 015 not applied / overflow) →
        //      keyset pagination with progressive first-page commit (200 rows)
        //      on cold login so History paints immediately.
        const fetchTransactionsSmart = async (): Promise<{
          rows: Transaction[];
          mode: "delta" | "full";
          changedCount: number;
          nextWatermark: string | null;
        }> => {
          if (cachedForUser && storedWatermark) {
            const parsedMs = Date.parse(storedWatermark);
            if (!Number.isNaN(parsedMs)) {
              // 2-second safety overlap absorbs clock skew & in-flight commits
              const sinceIso = new Date(parsedMs - 2000).toISOString();
              const delta = await fetchDeltaTransactions(currentUser.id, sinceIso);
              if (delta.supported && !delta.overflow) {
                const merged =
                  delta.rows.length > 0
                    ? mergeTransactionsWithDeletes(cachedForUser, delta.rows)
                    : cachedForUser;
                return {
                  rows: merged,
                  mode: "delta",
                  changedCount: delta.rows.length,
                  nextWatermark: delta.latestUpdatedAt || storedWatermark,
                };
              }
            }
          }

          const hasLocalTxs = Boolean(cachedForUser && cachedForUser.length > 0);
          const allRows = await fetchPaginatedTransactions(currentUser.id, {
            firstPageSize: hasLocalTxs ? undefined : 200,
            onFirstPage: hasLocalTxs
              ? undefined
              : (firstBatch) => {
                  if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) return;
                  const withLocal = applyLocalTxOverrides(
                    firstBatch,
                    s.localTxTracker,
                    refreshStartEpoch,
                    false
                  ).rows;
                  s.setTransactions(withLocal);
                },
          });

          const maxUpdated = extractMaxUpdatedAt(allRows);
          return {
            rows: allRows,
            mode: "full",
            changedCount: allRows.length,
            nextWatermark: maxUpdated,
          };
        };

        const [txSyncResult, gls, subs, plannerRes, assetsRes, accountsRes, categoriesRes, cardDetailsRes] =
          await Promise.all([
            fetchTransactionsSmart(),
            supabase.from("goals").select("id,user_id,title,current_amount,target_amount,is_pinned,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("subscriptions").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("salary_planner").select("id,user_id,category,item_name,amount,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("asset_vault").select("id,user_id,name,category,emoji_icon,purchase_date,purchase_price,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            // Migration 002 tables — tolerant of missing table / RLS issues.
            supabase.from("user_accounts").select("*").eq("user_id", currentUser.id).order("sort_order", { ascending: true }),
            supabase.from("user_categories").select("name").eq("user_id", currentUser.id).order("sort_order", { ascending: true }),
            supabase.from("credit_card_details").select("account_id,user_id,issuer,card_last_four,statement_day,grace_period_days,due_day,apr,card_color,reminder_days_before,created_at,updated_at").eq("user_id", currentUser.id),
          ]);

        const parsedTransactions = txSyncResult.rows;

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
          mode: txSyncResult.mode,
          tx: parsedTransactions.length,
          deltaChanged: txSyncResult.changedCount,
          goals: parsedGoals.length,
          subs: parsedSubscriptions.length,
          utils: parsedUtilities.length,
          planner: parsedPlanner.length,
          assets: parsedAssets.length,
        });

        // ─── Commit to state ──────────────────────────────────────────────
        // Overlay any optimistic local mutations (adds/edits/deletes/restores)
        // that are in-flight or happened after this refresh started so an older
        // network snapshot can NEVER clobber newer user actions.
        const { rows: reconciledTransactions, appliedCount: localOverridesApplied } =
          applyLocalTxOverrides(parsedTransactions, s.localTxTracker, refreshStartEpoch, true);

        cachedCloudTransactionsRef.current = {
          userId: currentUser.id,
          rows: reconciledTransactions,
        };

        // Merge any uncommitted offline queue items (adds, edits, tombstones)
        const pendingOffline = await getOfflineQueueForUser(currentUser.id);
        if (activeUserIdRef.current && activeUserIdRef.current !== currentUser.id) {
          return;
        }
        const { merged: finalTransactions, hasPendingOverlay } = overlayOfflineQueue(
          reconciledTransactions,
          pendingOffline,
          currentUser.id
        );

        // On zero-change delta sync with no local/offline deltas, skip re-setting
        // `transactions` so heavy pages skip unnecessary recalculations.
        if (
          txSyncResult.mode === "full" ||
          txSyncResult.changedCount > 0 ||
          localOverridesApplied > 0 ||
          hasPendingOverlay
        ) {
          s.setTransactions(finalTransactions);
        }
        s.setGoals(parsedGoals);
        s.setSubscriptions(parsedSubscriptions);
        s.setFixedBills(parsedFixedBills);
        s.setUtilities(parsedUtilities);
        s.setPlannerItems(parsedPlanner);
        s.setAssets(parsedAssets);
        s.setAccountObjects(savedAccounts);
        hydratedUserIdRef.current = currentUser.id;

        // ─── Background post-commit work (non-blocking) ───────────────────
        const nonTxCachePayload: CachedAppPayload = {
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

        void localforage
          .setItem(userCacheKey, nonTxCachePayload)
          .catch(storageErr => console.warn("[refreshData] localforage.setItem failed:", storageErr));

        if (txSyncResult.mode === "full" || txSyncResult.changedCount > 0 || localOverridesApplied > 0) {
          void writeCachedTransactions(currentUser.id, reconciledTransactions);
        }
        if (txSyncResult.nextWatermark) {
          void localforage.setItem(watermarkKey, txSyncResult.nextWatermark).catch(() => {});
        }

        // Category predictor bootstrap (detached, never blocks UI)
        if (reconciledTransactions.length > 0) {
          const scheduleIdle =
            typeof window !== "undefined" && "requestIdleCallback" in window
              ? (cb: () => void) =>
                  (window as unknown as { requestIdleCallback: (fn: () => void) => void }).requestIdleCallback(cb)
              : (cb: () => void) => setTimeout(cb, 0);
          scheduleIdle(() => {
            void loadModel(currentUser.id)
              .then(existing => {
                if (Object.keys(existing).length === 0) {
                  return rebuildFromHistory(reconciledTransactions, currentUser.id);
                }
              })
              .catch(() => {
                /* predictor is a pure enhancement — never fail refresh over it */
              });
          });
        }
      } catch (err) {
        debugLog("[refreshData] Network error caught:", err);
        if (hydratedUserIdRef.current !== currentUser.id) {
          await hydrateFromCache(currentUser);
        }
      } finally {
        refreshInFlightRef.current = false;
        endSyncOp();
        const queued = pendingRefreshUserRef.current;
        if (queued) {
          pendingRefreshUserRef.current = null;
          void refreshData(queued);
        }
      }
    },
    [hydrateFromCache, beginSyncOp, endSyncOp]
  );

  // ─── syncOfflineQueue (batched idempotent upserts + incremental merge) ─
  const syncOfflineQueue = useCallback(async (explicitUserId?: string) => {
    if (isSyncingRef.current) {
      debugLog("[syncOfflineQueue] Already syncing — skipping duplicate run");
      return;
    }
    const userId = explicitUserId || activeUserIdRef.current || session?.user?.id;
    if (!userId) {
      debugLog("[syncOfflineQueue] No active session — skipping sync until authenticated");
      return;
    }
    isSyncingRef.current = true;
    beginSyncOp();
    try {
      const queue = await getOfflineQueueForUser(userId);
      if (!queue || queue.length === 0) return;

      const validItems = queue.filter((tx): tx is OfflineQueuedTx & { id: string } => Boolean(tx && tx.id));
      if (validItems.length === 0) return;

      const acknowledgedIds = new Set<string>();
      const expectedRevs = new Map<string, number>();
      let quarantinedCount = 0;
      const syncedRows: Transaction[] = [];
      let hitNetworkError = false;

      const markAck = (tx: OfflineQueuedTx & { id: string }) => {
        acknowledgedIds.add(tx.id);
        if (tx._queueRev !== undefined) expectedRevs.set(tx.id, tx._queueRev);
      };

      // Helper: per-item fallback when a batch fails due to a single malformed row
      const syncItemsIndividually = async (items: Array<OfflineQueuedTx & { id: string }>) => {
        for (const tx of items) {
          try {
            const payload = { ...stripOfflineQueueMeta(tx), user_id: userId };
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
                  markAck(tx);
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
              // Non-network permanent rejection (malformed/RLS/constraint):
              // quarantine out of the active queue so it doesn't loop forever.
              await quarantineOfflineTx(tx, error.message || error.code || "Rejected by database");
              quarantinedCount++;
            } else {
              markAck(tx);
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
        const payloads = batch.map(tx => ({ ...stripOfflineQueueMeta(tx), user_id: userId }));

        try {
          const { data, error } = await supabase
            .from("transactions")
            .upsert(payloads, { onConflict: "id" })
            .select();

          if (!error) {
            batch.forEach(markAck);
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
              batch.forEach(markAck);
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

          debugLog("[syncOfflineQueue] Batch error (non-network) — isolating per item:", error);
          await syncItemsIndividually(batch);
        } catch (netErr) {
          console.warn("[syncOfflineQueue] Batch network exception:", netErr);
          hitNetworkError = true;
          break;
        }
      }

      if (acknowledgedIds.size > 0) {
        const removed = await removeAcknowledgedOfflineTxs(acknowledgedIds, expectedRevs);
        const remaining = validItems.length - acknowledgedIds.size - quarantinedCount;

        if (quarantinedCount > 0) {
          settersRef.current.triggerToast(
            `${removed} synced; ${quarantinedCount} rejected item${quarantinedCount > 1 ? "s" : ""} skipped`
          );
        } else if (remaining <= 0) {
          settersRef.current.triggerToast(
            `${removed} offline transaction${removed > 1 ? "s" : ""} synced to cloud!`
          );
        } else {
          settersRef.current.triggerToast(
            `${removed} synced, ${remaining} pending retry`
          );
        }

        if (syncedRows.length > 0 && activeUserIdRef.current === userId) {
          settersRef.current.setTransactions(prev => mergeTransactionsWithDeletes(prev, syncedRows));
          if (cachedCloudTransactionsRef.current?.userId === userId) {
            cachedCloudTransactionsRef.current = {
              userId,
              rows: mergeTransactionsWithDeletes(cachedCloudTransactionsRef.current.rows, syncedRows),
            };
          }
          void upsertCachedTransactions(userId, syncedRows);
        }
      } else if (quarantinedCount > 0) {
        settersRef.current.triggerToast(
          `⚠️ ${quarantinedCount} offline item${quarantinedCount > 1 ? "s" : ""} rejected by server and skipped`
        );
      }
    } catch (err) {
      console.error("[syncOfflineQueue] Process failed:", err);
    } finally {
      isSyncingRef.current = false;
      endSyncOp();
    }
  }, [session?.user?.id, beginSyncOp, endSyncOp]);

  useEffect(() => {
    syncOfflineQueueRef.current = syncOfflineQueue;
  }, [syncOfflineQueue]);

  // ─── Network & App-Resume listeners ────────────────────────────────────
  useEffect(() => {
    const initialOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
    wasOfflineRef.current = initialOffline;
    setIsOffline(initialOffline);

    const handleReconnect = () => {
      wasOfflineRef.current = false;
      setIsOffline(false);
      void syncOfflineQueue();
      settersRef.current.onOnlineReconnect?.();
    };
    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOffline(true);
    };
    window.addEventListener("online", handleReconnect);
    window.addEventListener("offline", handleOffline);

    // Capacitor native Network + App foreground resume listeners
    let cancelled = false;
    let listenerFired = false;
    let nativeNetHandle: { remove: () => Promise<void> } | null = null;
    let nativeAppHandle: { remove: () => Promise<void> } | null = null;

    try {
      type NetStatus = { connected: boolean; connectionType?: string };
      import("@capacitor/network")
        .then(async ({ Network }) => {
          const listener = await Network.addListener("networkStatusChange", (status: NetStatus) => {
            listenerFired = true;
            const wasOffline = wasOfflineRef.current;
            const offlineNow = !status.connected;
            wasOfflineRef.current = offlineNow;
            setIsOffline(offlineNow);
            if (status.connected && wasOffline) {
              void syncOfflineQueue();
              settersRef.current.onOnlineReconnect?.();
            }
          });
          if (cancelled) {
            listener.remove().catch(() => {});
          } else {
            nativeNetHandle = listener;
          }

          Network.getStatus()
            .then((status: NetStatus) => {
              if (cancelled || listenerFired) return;
              const offlineNow = !status.connected;
              wasOfflineRef.current = offlineNow;
              setIsOffline(offlineNow);
            })
            .catch(() => {});
        })
        .catch(() => {});

      import("@capacitor/app")
        .then(async ({ App }) => {
          const appListener = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive && !wasOfflineRef.current) {
              void syncOfflineQueue();
              settersRef.current.onOnlineReconnect?.();
            }
          });
          if (cancelled) {
            appListener.remove().catch(() => {});
          } else {
            nativeAppHandle = appListener;
          }
        })
        .catch(() => {});
    } catch {
      /* ignore — web build */
    }

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleReconnect);
      window.removeEventListener("offline", handleOffline);
      nativeNetHandle?.remove().catch(() => {});
      nativeAppHandle?.remove().catch(() => {});
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
