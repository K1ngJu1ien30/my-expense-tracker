"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import { migrateAccounts } from "./useAccountsState";
import { loadModel, rebuildFromHistory } from "../categoryPredictor";
import { getOfflineQueueForUser, removeAcknowledgedOfflineTxs } from "../offlineQueue";
import { getUserDataCacheKey, migrateLegacyCacheToUser } from "../cacheKeys";
import type {
  Account,
  Asset,
  Goal,
  PlannerItem,
  Subscription,
  Transaction,
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
export function useSyncState(session: Session | null, setters: SyncSetters) {
  const [isOffline, setIsOffline] = useState(false);

  /**
   * Re-entrancy guard: both the browser `online` event AND the Capacitor
   * Network listener can fire simultaneously. Without this we'd double-upload.
   */
  const isSyncingRef = useRef(false);

  // Keep setters in a ref so effects don't need them in the dep array and
  // don't tear down+rebuild on every provider re-render.
  const settersRef = useRef(setters);
  useEffect(() => {
    settersRef.current = setters;
  }, [setters]);

  // ─── refreshData ───────────────────────────────────────────────────────
  const refreshData = useCallback(
    async (currentUser: { id: string; user_metadata?: Record<string, unknown> }) => {
      const s = settersRef.current;

      // Fallback from user_metadata (old APK compatibility). If the new
      // user_accounts table fetch succeeds below, we'll override this.
      let savedAccounts = migrateAccounts(
        currentUser.user_metadata?.custom_accounts || ["Bank", "Cash", "eWallet"]
      );

      try {
        console.log("[refreshData] Fetching live data...");
        const [txs, gls, subs, plannerRes, assetsRes, accountsRes, categoriesRes] =
          await Promise.all([
            supabase.from("transactions").select("*").eq("user_id", currentUser.id).order("date", { ascending: false }),
            supabase.from("goals").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("subscriptions").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("salary_planner").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            supabase.from("asset_vault").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
            // Migration 002 tables — tolerant of missing table / RLS issues.
            supabase.from("user_accounts").select("*").eq("user_id", currentUser.id).order("sort_order", { ascending: true }),
            supabase.from("user_categories").select("name").eq("user_id", currentUser.id).order("sort_order", { ascending: true }),
          ]);

        // Supabase select() does not throw on network failure — force it.
        // NOTE: we intentionally do NOT include accountsRes/categoriesRes
        // in this fatal-error check. If those are missing we fall back to
        // user_metadata (old-APK compatible).
        if (txs.error || gls.error || subs.error || plannerRes.error || assetsRes.error) {
          console.log("[refreshData] Supabase returned error objects:", {
            txs: txs.error, gls: gls.error, subs: subs.error,
            planner: plannerRes.error, assets: assetsRes.error,
          });
          throw new Error("Supabase fetch returned errors");
        }

        if (!txs.data || !gls.data || !subs.data || !plannerRes.data || !assetsRes.data) {
          console.log("[refreshData] Supabase returned null data arrays — treating as offline");
          throw new Error("Supabase returned null data");
        }

        // ─── New-table-first account/category resolution (Migration 002) ──
        if (!accountsRes.error && accountsRes.data && accountsRes.data.length > 0) {
          savedAccounts = (accountsRes.data as RawUserAccountRow[]).map(a => ({
            name: a.name,
            currencyCode: a.currency_code || "RM",
            isArchived: a.is_archived || false,
          }));
          console.log("[refreshData] Loaded", savedAccounts.length, "accounts from user_accounts table");
        } else {
          console.log("[refreshData] user_accounts empty/unavailable — using user_metadata fallback");
        }

        if (!categoriesRes.error && categoriesRes.data && categoriesRes.data.length > 0) {
          const cloudCats = (categoriesRes.data as Pick<RawUserCategoryRow, "name">[]).map(c => c.name);
          // Merge strategy: preserve any local-only categories that haven't
          // been synced yet (e.g. added while the network was flaky or
          // before migration 002 was applied). Cloud order wins for the
          // cloud-known entries; local-only extras are appended at the end.
          // This is why "Misc" / "Personal Care" were vanishing on every
          // app launch — refreshData used to overwrite local with cloud.
          const localCats = s.categoriesRef.current || [];
          const seen = new Set(cloudCats.map(c => c.toLowerCase()));
          const localOnly = localCats.filter(c => !seen.has(c.toLowerCase()));
          const merged = [...cloudCats, ...localOnly];
          s.setCategoriesRaw(merged);
          console.log(
            "[refreshData] Merged categories:",
            cloudCats.length, "cloud +",
            localOnly.length, "local-only =",
            merged.length, "total"
          );

          // If we found local-only categories, push them up to the cloud
          // immediately so the next device or next launch sees them.
          // Best-effort — don't block refreshData on this.
          if (localOnly.length > 0) {
            supabase.from("user_categories").insert(
              localOnly.map((name, idx) => ({
                user_id: currentUser.id,
                name,
                sort_order: cloudCats.length + idx,
              }))
            ).then(({ error }) => {
              if (error) console.warn("[refreshData] backfill upload failed:", error);
              else console.log("[refreshData] Backfilled", localOnly.length, "local-only categories to cloud");
            });
          }
        } else {
          // Cloud table missing/empty — keep whatever the user has locally
          // (the fallback seed / localStorage hydration). Do NOT blow it
          // away.
          console.log("[refreshData] user_categories empty/unavailable — keeping local categories");
        }

        // ─── Parse responses ──────────────────────────────────────────────
        const parsedTransactions = txs.data as Transaction[];
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
            autoDeduct: sub.auto_deduct, user_id: sub.user_id, type: "subscription",
            lastPaidMonth: sub.last_paid_month,
            icon: "MonitorPlay", bg: "bg-red-500/10", color: "text-red-500",
          }));
        const parsedFixedBills: Subscription[] = subRows
          .filter(sub => sub.type === "fixed_bill" || sub.type === "bill")
          .map(sub => ({
            id: sub.id, name: sub.name, cost: Number(sub.amount),
            billingDay: sub.billing_day, sourceAccount: sub.source_account,
            autoDeduct: sub.auto_deduct, user_id: sub.user_id, type: "fixed_bill",
            lastPaidMonth: sub.last_paid_month,
            icon: "FileText", bg: "bg-purple-500/10", color: "text-purple-500",
          }));
        const parsedUtilities: Subscription[] = subRows
          .filter(sub => sub.type === "utility")
          .map(sub => ({
            id: sub.id, name: sub.name, cost: Number(sub.amount),
            billingDay: sub.billing_day, sourceAccount: sub.source_account,
            autoDeduct: sub.auto_deduct, user_id: sub.user_id, type: "utility",
            lastPaidMonth: sub.last_paid_month,
            icon: "Zap", bg: "bg-yellow-500/10", color: "text-yellow-500",
          }));
        const parsedPlanner = plannerRes.data as PlannerItem[];
        const parsedAssets = assetsRes.data as Asset[];

        console.log("[refreshData] Live data fetch successful. Saving to cache...", {
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

        // Bootstrap the category predictor on first run from the full
        // transaction history. Skipped if the model has already been seeded —
        // subsequent (note, category) pairs are learned incrementally inside
        // `useMoneyState.addTransaction`, so we only pay this cost once.
        try {
          const existing = await loadModel(currentUser.id);
          if (Object.keys(existing).length === 0 && parsedTransactions.length > 0) {
            await rebuildFromHistory(parsedTransactions, currentUser.id);
          }
        } catch {
          /* predictor is a pure enhancement — never fail refresh over it */
        }

        // ─── Cache ────────────────────────────────────────────────────────
        const cachePayload = {
          transactions: parsedTransactions,
          goals: parsedGoals,
          subscriptions: parsedSubscriptions,
          fixedBills: parsedFixedBills,
          utilities: parsedUtilities,
          plannerItems: parsedPlanner,
          assets: parsedAssets,
          accounts: savedAccounts,
          categories: s.categoriesRef.current,
        };
        const userCacheKey = getUserDataCacheKey(currentUser.id);
        try {
          await localforage.setItem(userCacheKey, cachePayload);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(userCacheKey, JSON.stringify(cachePayload));
            } catch {}
          }
          console.log("[refreshData] Cache saved successfully for user:", currentUser.id);
        } catch (storageErr) {
          console.warn("[refreshData] localforage.setItem failed:", storageErr);
        }
      } catch (err) {
        console.log("[refreshData] Network error caught. Attempting to read cache...", err);
        s.setAccountObjects(savedAccounts);

        // ─── Offline cold-boot hydration from user-scoped cache ──────────
        try {
          await migrateLegacyCacheToUser(currentUser.id);
          const userCacheKey = getUserDataCacheKey(currentUser.id);
          const data = (await localforage.getItem(userCacheKey)) as
            | {
                transactions?: Transaction[];
                goals?: Goal[];
                subscriptions?: Subscription[];
                fixedBills?: Subscription[];
                utilities?: Subscription[];
                plannerItems?: PlannerItem[];
                assets?: Asset[];
                accounts?: unknown;
                categories?: string[];
              }
            | null;
          if (data) {
            console.log("[refreshData] Cache found! Hydrating state...");
            let cachedTx = (data.transactions ?? []) as Transaction[];
            s.setGoals(data.goals ?? []);
            s.setSubscriptions(data.subscriptions ?? []);
            s.setFixedBills(data.fixedBills ?? []);
            s.setUtilities(data.utilities ?? []);
            s.setPlannerItems(data.plannerItems ?? []);
            s.setAssets(data.assets ?? []);
            if (data.accounts) s.setAccountObjects(migrateAccounts(data.accounts));
            if (data.categories?.length) s.setCategories(data.categories);

            // Prepend any pending offline transactions belonging to this user
            const offlineQueue = await getOfflineQueueForUser(currentUser.id);
            if (offlineQueue && offlineQueue.length > 0) {
              const offlineTxs = offlineQueue.map((tx, i) => ({
                ...tx,
                id: tx.id || `offline-${Date.now()}-${i}`,
                user_id: currentUser.id,
              })) as Transaction[];
              cachedTx = [...offlineTxs, ...cachedTx];
              console.log("[refreshData] Prepended", offlineTxs.length, "offline queue items to cached transactions.");
            }

            s.setTransactions(cachedTx);
            console.log("[refreshData] Cache hydration complete.", {
              tx: cachedTx.length,
              goals: (data.goals ?? []).length,
            });
          } else {
            console.log("[refreshData] Cache empty or missing!");
          }
        } catch (cacheErr) {
          console.error("[refreshData] Cache hydration failed:", cacheErr);
        }
      }
    },
    []
  );

  // ─── syncOfflineQueue ──────────────────────────────────────────────────
  const syncOfflineQueue = useCallback(async () => {
    if (isSyncingRef.current) {
      console.log("[syncOfflineQueue] Already syncing — skipping duplicate run");
      return;
    }
    if (!session?.user?.id) {
      console.log("[syncOfflineQueue] No active session — skipping sync until authenticated");
      return;
    }
    isSyncingRef.current = true;
    try {
      const queue = await getOfflineQueueForUser(session.user.id);
      if (!queue || queue.length === 0) return;

      const acknowledgedIds = new Set<string>();

      for (const tx of queue) {
        if (!tx.id) continue;
        try {
          // Idempotent upsert by client-generated ID
          const { error } = await supabase
            .from("transactions")
            .upsert({ ...tx, user_id: session.user.id }, { onConflict: "id" });

          if (error) {
            console.warn(`[syncOfflineQueue] Failed to sync transaction ${tx.id}:`, error);
            // Stop if this is a network failure to avoid hammering a dropped connection
            const isNetworkError =
              !error.code ||
              error.message?.toLowerCase().includes("failed to fetch") ||
              error.message?.toLowerCase().includes("network") ||
              error.code.startsWith("08");
            if (isNetworkError) break;
            // Otherwise skip this item and proceed with next so one malformed row doesn't block the entire queue
          } else {
            acknowledgedIds.add(tx.id);
          }
        } catch (netErr) {
          console.warn(`[syncOfflineQueue] Network error for tx ${tx.id}:`, netErr);
          break; // Stop loop on network disconnect
        }
      }

      // Safely remove only the successfully acknowledged transactions
      if (acknowledgedIds.size > 0) {
        const removed = await removeAcknowledgedOfflineTxs(acknowledgedIds);
        const remaining = queue.length - acknowledgedIds.size;

        if (remaining === 0) {
          settersRef.current.triggerToast(
            `${removed} offline expense${removed > 1 ? "s" : ""} synced to cloud!`
          );
        } else {
          settersRef.current.triggerToast(
            `${removed} synced, ${remaining} pending retry`
          );
        }

        // Post-sync: refresh state with live cloud state
        if (session.user) await refreshData(session.user);
      }
    } catch (err) {
      console.error("[syncOfflineQueue] Process failed:", err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [session, refreshData]);

  // ─── Network listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);

    // Capacitor native listener (opt-in — only if plugin is available)
    let nativeCleanup: (() => void) | undefined;
    try {
      type NetStatus = { connected: boolean; connectionType?: string };
      import("@capacitor/network")
        .then(({ Network }) => {
          Network.getStatus().then((status: NetStatus) => setIsOffline(!status.connected)).catch(() => {});
          Network.addListener("networkStatusChange", (status: NetStatus) => {
            const wasOffline = !navigator.onLine;
            setIsOffline(!status.connected);
            if (status.connected && wasOffline) syncOfflineQueue();
          });
          nativeCleanup = () => {
            Network.removeAllListeners().catch(() => {});
          };
        })
        .catch(() => {});
    } catch {
      /* ignore — web build */
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (nativeCleanup) nativeCleanup();
    };
  }, [session, syncOfflineQueue]);

  return {
    isOffline,
    isSyncingRef,
    refreshData,
    syncOfflineQueue,
  };
}
