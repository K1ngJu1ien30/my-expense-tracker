"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Transaction, Subscription, TransactionSaveResult } from "../types";
import type { DeletedItemCache } from "../types";
import { learnAndSaveAsync } from "../categoryPredictor";
import { enqueueOfflineTx } from "../offlineQueue";
import { roundCurrency } from "../utils";
import { debugLog } from "../debugLog";

/** Threshold above which an income/expense triggers the 🐋 whale alert. */
const WHALE_THRESHOLD = 5000;

/**
 * Cross-cutting dependencies that the CRUD functions need to wire into the
 * rest of the app. The provider supplies these so this hook can remain
 * focused purely on transactions / subscriptions / utilities.
 *
 * `isOfflineRef` is passed as a ref (not a value) to break the chicken-and-egg
 * problem where useSyncState owns `isOffline` and also needs setters from this
 * hook. By reading `isOfflineRef.current` lazily inside `addTransaction`, we
 * always see the latest network state without depending on render order.
 */
export type MoneyStateDeps = {
  session: Session | null;
  isOfflineRef: MutableRefObject<boolean>;
  triggerToast: (msg: string) => void;
  triggerWhaleAlert: () => void;
  /**
   * Presentational easter-egg hook — called with every expense amount.
   * The alert internally gates on time-of-day and amount range so this
   * callsite doesn't need to replicate the thresholds.
   */
  maybeTriggerPenguinAlert: (amount: number) => void;
  cacheDeletedItem: (type: DeletedItemCache["type"], item: unknown) => void;
};

/**
 * useMoneyState — owns the cash-flow collections and their CRUD functions:
 *   • transactions (with offline queueing + soft delete + whale alert)
 *   • subscriptions (recurring monthly charges)
 *   • utilities    (variable monthly bills)
 *
 * Subscriptions and utilities share the same `subscriptions` Supabase table
 * but are distinguished by the `type` column ("subscription" vs "utility").
 *
 * Soft delete: `deleteTransaction` writes a `deleted_at` timestamp instead of
 * physically removing the row, so cross-device sync conflicts can't resurrect
 * deleted items. The provider's transaction filter (`!t.deleted_at`) hides
 * them from consumers.
 *
 * The parent provider must call `setTransactions / setSubscriptions /
 * setUtilities` as part of `useSyncState`'s setters object so the master
 * `refreshData` orchestrator can populate these collections after a
 * successful Supabase fetch.
 */
/**
 * Strict financial and logical validation for transaction payloads.
 * Protects against zero/negative amounts, IEEE floating drift, invalid dates,
 * missing accounts, and invalid transfer source/destinations.
 */
export function validateTransactionInput(tx: Partial<Transaction>): { valid: boolean; error?: string } {
  if (tx.amount === undefined || tx.amount === null) {
    return { valid: false, error: "Amount is required." };
  }
  const numAmount = Number(tx.amount);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    return { valid: false, error: "Amount must be a valid positive number." };
  }
  if (numAmount > 999999999.99) {
    return { valid: false, error: "Amount exceeds maximum supported limit." };
  }

  const validTypes = ["Expense", "Income", "Transfer"];
  if (!tx.type || !validTypes.includes(tx.type)) {
    return { valid: false, error: "Invalid transaction type." };
  }

  if (!tx.account || typeof tx.account !== "string" || !tx.account.trim()) {
    return { valid: false, error: "An account must be selected." };
  }

  if (tx.type === "Transfer") {
    if (!tx.to_account || typeof tx.to_account !== "string" || !tx.to_account.trim()) {
      return { valid: false, error: "Destination account is required for transfers." };
    }
    if (tx.account.trim().toLowerCase() === tx.to_account.trim().toLowerCase()) {
      return { valid: false, error: "Source and destination accounts cannot be the same." };
    }
  }

  if (tx.type === "Expense") {
    if (!tx.category || typeof tx.category !== "string" || !tx.category.trim()) {
      return { valid: false, error: "A category must be selected for expenses." };
    }
  }

  if (tx.date) {
    const d = new Date(tx.date);
    if (isNaN(d.getTime())) {
      return { valid: false, error: "Invalid transaction date." };
    }
  }

  return { valid: true };
}

export function useMoneyState(deps: MoneyStateDeps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [fixedBills, setFixedBills] = useState<Subscription[]>([]);
  const [utilities, setUtilities] = useState<Subscription[]>([]);

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const { session, isOfflineRef, triggerWhaleAlert, maybeTriggerPenguinAlert, cacheDeletedItem } = deps;

  // ─── Transactions ──────────────────────────────────────────────────────

  const addTransaction = useCallback(
    async (tx: Partial<Transaction>): Promise<TransactionSaveResult> => {
      const validation = validateTransactionInput(tx);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || "Invalid transaction input",
        };
      }

      const sanitizedAmount = roundCurrency(Number(tx.amount));
      // Client-generated UUID makes the upsert idempotent — safe to retry.
      const clientId = crypto.randomUUID();
      const txWithId = {
        ...tx,
        amount: sanitizedAmount,
        id: clientId,
        date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
      };

      // Teach the category predictor asynchronously after any successful add.
      // Only expenses with a non-empty note contribute useful signal — never
      // blocks transaction saving and never throws.
      const teachPredictorAsync = () => {
        if (tx.type !== "Expense" || !tx.note || !tx.category) return;
        learnAndSaveAsync(tx.note, tx.category, session?.user?.id);
      };

      // Offline queue path: push to IndexedDB, then sync when network returns.
      // Read isOffline lazily via ref so we always see the latest network state.
      if (isOfflineRef.current) {
        const offlineTx = { ...txWithId, user_id: session?.user?.id } as Transaction;
        try {
          // Serialized read-modify-write — only acknowledge once IndexedDB persistence succeeds.
          await enqueueOfflineTx(offlineTx);
        } catch (err) {
          console.error("[addTransaction] IndexedDB persistence failed:", err);
          return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to save offline",
          };
        }
        setTransactions(prev => [offlineTx, ...prev]);
        teachPredictorAsync();
        NativeHaptics.successMedium();
        if (tx.type === "Expense") maybeTriggerPenguinAlert(Number(tx.amount));
        return { success: true, status: "pending_sync" };
      }

      // Online path: attempt insert directly to Supabase.
      try {
        const { data, error } = await supabase
          .from("transactions")
          .insert({ ...txWithId, user_id: session?.user?.id })
          .select()
          .single();

        if (!error && data) {
          setTransactions(prev => [data as Transaction, ...prev]);
          teachPredictorAsync();
          NativeHaptics.successMedium();
          if (Number(tx.amount) >= WHALE_THRESHOLD) triggerWhaleAlert();
          if (tx.type === "Expense") maybeTriggerPenguinAlert(Number(tx.amount));
          return { success: true, status: "synced" };
        }

        // Schema resilience: if migration 007 columns not yet added in Supabase (code 42703: undefined_column)
        if (error?.code === "42703") {
          console.warn("[addTransaction] Column undefined in cloud table — retrying with base schema:", error.message);
          const fallbackPayload: Record<string, unknown> = { ...txWithId, user_id: session?.user?.id };
          delete fallbackPayload.credit_card_tx_type;
          delete fallbackPayload.statement_id;
          const retryRes = await supabase.from("transactions").insert(fallbackPayload).select().single();
          if (!retryRes.error && retryRes.data) {
            const preservedTx = { ...retryRes.data, credit_card_tx_type: txWithId.credit_card_tx_type, statement_id: txWithId.statement_id };
            setTransactions(prev => [preservedTx as Transaction, ...prev]);
            teachPredictorAsync();
            NativeHaptics.successMedium();
            if (Number(tx.amount) >= WHALE_THRESHOLD) triggerWhaleAlert();
            if (tx.type === "Expense") maybeTriggerPenguinAlert(Number(tx.amount));
            return { success: true, status: "synced" };
          }
        }

        console.warn("[addTransaction] Cloud insert returned error:", error);

        // Check if this error indicates network/connectivity failure while the browser was ostensibly online
        const isNetworkFailure =
          !error?.code ||
          error.message?.toLowerCase().includes("failed to fetch") ||
          error.message?.toLowerCase().includes("network") ||
          error.message?.toLowerCase().includes("timeout") ||
          error.code.startsWith("08") ||
          error.code.startsWith("XX");

        if (isNetworkFailure) {
          debugLog("[addTransaction] Falling back to offline queue due to network/server failure");
          const offlineTx = { ...txWithId, user_id: session?.user?.id } as Transaction;
          try {
            await enqueueOfflineTx(offlineTx);
            setTransactions(prev => [offlineTx, ...prev]);
            teachPredictorAsync();
            NativeHaptics.successMedium();
            if (tx.type === "Expense") maybeTriggerPenguinAlert(Number(tx.amount));
            return { success: true, status: "pending_sync" };
          } catch (storageErr) {
            console.error("[addTransaction] Offline fallback also failed:", storageErr);
            return {
              success: false,
              error: "Network failed and local storage unavailable",
            };
          }
        }

        // Unrecoverable schema/RLS/constraint database error
        return {
          success: false,
          error: error?.message || "Failed to save transaction to database",
        };
      } catch (exception) {
        console.warn("[addTransaction] Exception during cloud insert — attempting offline fallback:", exception);
        try {
          const offlineTx = { ...txWithId, user_id: session?.user?.id } as Transaction;
          await enqueueOfflineTx(offlineTx);
          setTransactions(prev => [offlineTx, ...prev]);
          teachPredictorAsync();
          NativeHaptics.successMedium();
          if (tx.type === "Expense") maybeTriggerPenguinAlert(Number(tx.amount));
          return { success: true, status: "pending_sync" };
        } catch (storageErr) {
          console.error("[addTransaction] Offline fallback also failed:", storageErr);
          return {
            success: false,
            error: "Network failed and local storage unavailable",
          };
        }
      }
    },
    [session, isOfflineRef, triggerWhaleAlert, maybeTriggerPenguinAlert]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>): Promise<{ success: boolean; error?: string }> => {
      const cleanPatch = { ...patch };
      if (cleanPatch.amount !== undefined) {
        const num = Number(cleanPatch.amount);
        if (isNaN(num) || !isFinite(num) || num <= 0) {
          return { success: false, error: "Amount must be a valid positive number." };
        }
        if (num > 999999999.99) {
          return { success: false, error: "Amount exceeds maximum supported limit." };
        }
        cleanPatch.amount = roundCurrency(num);
      }
      if (cleanPatch.date !== undefined) {
        if (isNaN(new Date(cleanPatch.date).getTime())) {
          return { success: false, error: "Invalid transaction date." };
        }
        cleanPatch.date = new Date(cleanPatch.date).toISOString();
      }
      if (cleanPatch.type === "Transfer" && cleanPatch.account && cleanPatch.to_account) {
        if (cleanPatch.account.trim().toLowerCase() === cleanPatch.to_account.trim().toLowerCase()) {
          return { success: false, error: "Source and destination accounts cannot be the same." };
        }
      }

      try {
        const { data, error } = await supabase
          .from("transactions")
          .update(cleanPatch)
          .eq("id", id)
          .select()
          .single();
        if (error) {
          if (error.code === "42703") {
            const fallbackPatch: Record<string, unknown> = { ...cleanPatch };
            delete fallbackPatch.credit_card_tx_type;
            delete fallbackPatch.statement_id;
            const retryRes = await supabase.from("transactions").update(fallbackPatch).eq("id", id).select().single();
            if (!retryRes.error && retryRes.data) {
              const updated = { ...retryRes.data, credit_card_tx_type: cleanPatch.credit_card_tx_type, statement_id: cleanPatch.statement_id };
              setTransactions(prev => prev.map(t => (t.id === id ? (updated as Transaction) : t)));
              NativeHaptics.lightTick();
              return { success: true };
            }
          }
          console.error("[updateTransaction] Supabase error:", error);
          return { success: false, error: error.message };
        }
        if (data) {
          setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...data } : t)));
          NativeHaptics.lightTick();
          return { success: true };
        }
        return { success: false, error: "Record not found" };
      } catch (err) {
        console.error("[updateTransaction] Exception:", err);
        return { success: false, error: err instanceof Error ? err.message : "Update failed" };
      }
    },
    []
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      // Capture pre-delete copy via ref so deleteTransaction stays referentially stable.
      const item = transactionsRef.current.find(t => t.id === id);
      const now = new Date().toISOString();
      // Soft delete — never physically remove rows.
      const { error } = await supabase
        .from("transactions")
        .update({ deleted_at: now })
        .eq("id", id);
      if (!error) {
        setTransactions(prev => prev.map(t => (t.id === id ? { ...t, deleted_at: now } : t)));
        NativeHaptics.heavyDoubleThud();
        if (item) cacheDeletedItem("transaction", item);
      }
    },
    [cacheDeletedItem]
  );

  // ─── Subscriptions / Utilities (shared `subscriptions` table) ──────────

  /**
   * Build a row payload for the `subscriptions` Supabase table from the
   * client-side Subscription shape. Strips display-only fields and remaps
   * camelCase → snake_case columns.
   */
  type SubsPayload = {
    name?: string;
    amount?: number;
    billing_day?: number;
    source_account?: string;
    source_account_id?: string | null;
    auto_deduct?: boolean;
    type?: "subscription" | "fixed_bill" | "utility" | "bill";
    last_paid_month?: string;
    user_id?: string;
  };

  const buildSubsPayload = useCallback(
    (sub: Partial<Subscription>, kind: "subscription" | "fixed_bill" | "utility"): SubsPayload => {
      const { cost, billingDay, sourceAccount, source_account_id, autoDeduct, lastPaidMonth } = sub;
      return {
        name: sub.name,
        amount: cost,
        billing_day: billingDay,
        source_account: sourceAccount,
        source_account_id: source_account_id || null,
        auto_deduct: autoDeduct,
        last_paid_month: lastPaidMonth,
        type: kind,
        user_id: session?.user?.id,
      };
    },
    [session]
  );

  const buildSubsPatch = useCallback(
    (patch: Partial<Subscription>): SubsPayload => {
      const out: SubsPayload = {};
      if (patch.name !== undefined) out.name = patch.name;
      if (patch.cost !== undefined) out.amount = patch.cost;
      if (patch.billingDay !== undefined) out.billing_day = patch.billingDay;
      if (patch.sourceAccount !== undefined) out.source_account = patch.sourceAccount;
      if (patch.source_account_id !== undefined) out.source_account_id = patch.source_account_id;
      if (patch.autoDeduct !== undefined) out.auto_deduct = patch.autoDeduct;
      if (patch.lastPaidMonth !== undefined) out.last_paid_month = patch.lastPaidMonth;
      return out;
    },
    []
  );

  const addSubscription = useCallback(
    async (sub: Partial<Subscription>) => {
      // Strip caller's id (if any) without mutating the input object — the
      // caller may keep referencing `sub` after this call returns.
      const { id: _id, ...rest } = sub;
      const payload = buildSubsPayload(rest, "subscription");
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setSubscriptions(prev => [{ ...rest, id: data.id } as Subscription, ...prev]);
        NativeHaptics.successMedium();
      }
    },
    [buildSubsPayload]
  );

  const updateSubscription = useCallback(
    async (id: string, patch: Partial<Subscription>) => {
      const payload = buildSubsPatch(patch);
      const { data, error } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) {
        setSubscriptions(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
        NativeHaptics.lightTick();
      }
    },
    [buildSubsPatch]
  );

  const deleteSubscription = useCallback(async (id: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (!error) {
      setSubscriptions(prev => prev.filter(s => s.id !== id));
      setFixedBills(prev => prev.filter(s => s.id !== id));
      setUtilities(prev => prev.filter(s => s.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  const addFixedBill = useCallback(
    async (sub: Partial<Subscription>) => {
      const { id: _id, ...rest } = sub;
      const payload = buildSubsPayload(rest, "fixed_bill");
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setFixedBills(prev => [{ ...rest, id: data.id, type: "fixed_bill" } as Subscription, ...prev]);
        NativeHaptics.successMedium();
      }
    },
    [buildSubsPayload]
  );

  const updateFixedBill = useCallback(
    async (id: string, patch: Partial<Subscription>) => {
      const payload = buildSubsPatch(patch);
      const { data, error } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) {
        setFixedBills(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
        NativeHaptics.lightTick();
      }
    },
    [buildSubsPatch]
  );

  const deleteFixedBill = useCallback(async (id: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (!error) {
      setSubscriptions(prev => prev.filter(s => s.id !== id));
      setFixedBills(prev => prev.filter(s => s.id !== id));
      setUtilities(prev => prev.filter(s => s.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  const addUtility = useCallback(
    async (sub: Partial<Subscription>) => {
      // Same non-mutating strip pattern as addSubscription above.
      const { id: _id, ...rest } = sub;
      const payload = buildSubsPayload(rest, "utility");
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setUtilities(prev => [{ ...rest, id: data.id } as Subscription, ...prev]);
        NativeHaptics.successMedium();
      }
    },
    [buildSubsPayload]
  );

  const updateUtility = useCallback(
    async (id: string, patch: Partial<Subscription>) => {
      const payload = buildSubsPatch(patch);
      const { data, error } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) {
        setUtilities(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
        NativeHaptics.lightTick();
      }
    },
    [buildSubsPatch]
  );

  const deleteUtility = useCallback(async (id: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (!error) {
      setSubscriptions(prev => prev.filter(s => s.id !== id));
      setFixedBills(prev => prev.filter(s => s.id !== id));
      setUtilities(prev => prev.filter(s => s.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  return {
    // State
    transactions,
    setTransactions,
    subscriptions,
    setSubscriptions,
    fixedBills,
    setFixedBills,
    utilities,
    setUtilities,
    // Transaction CRUD
    addTransaction,
    updateTransaction,
    deleteTransaction,
    // Subscription CRUD
    addSubscription,
    updateSubscription,
    deleteSubscription,
    // Fixed Bill CRUD
    addFixedBill,
    updateFixedBill,
    deleteFixedBill,
    // Utility CRUD
    addUtility,
    updateUtility,
    deleteUtility,
  };
}
