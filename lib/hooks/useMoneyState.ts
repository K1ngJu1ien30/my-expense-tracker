"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Transaction, Subscription, TransactionSaveResult } from "../types";
import type { DeletedItemCache } from "../types";
import { learnAndSaveAsync } from "../categoryPredictor";
import {
  enqueueOfflineTx,
  enqueueOfflineTxBatch,
  removeAcknowledgedOfflineTxs,
} from "../offlineQueue";
import {
  mergeTransactionsWithDeletes,
  removeCachedTransactionById,
  upsertCachedTransactions,
  upsertTransactionSorted,
  type LocalTxTracker,
} from "../txCache";
import { parseLocalDateToIso, roundCurrency } from "../utils";
import { debugLog } from "../debugLog";

/** Threshold above which an income/expense triggers the 🐋 whale alert. */
const WHALE_THRESHOLD = 5000;

export type MoneyStateDeps = {
  session: Session | null;
  isOfflineRef: MutableRefObject<boolean>;
  localTxTracker?: LocalTxTracker;
  triggerToast: (msg: string) => void;
  triggerWhaleAlert: () => void;
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

export function useMoneyState(deps: MoneyStateDeps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [fixedBills, setFixedBills] = useState<Subscription[]>([]);
  const [utilities, setUtilities] = useState<Subscription[]>([]);

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Per-transaction serialization & version guards for background cloud writes.
  // Ensures rapid sequences on the same tx (e.g. Add -> immediate Edit/Delete)
  // execute against Supabase in strict user order and stale responses never
  // overwrite or resurrect a newer optimistic state.
  const txMutationChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const txMutationVersionRef = useRef<Map<string, number>>(new Map());

  const nextTxVersion = useCallback((id: string): number => {
    const next = (txMutationVersionRef.current.get(id) ?? 0) + 1;
    txMutationVersionRef.current.set(id, next);
    return next;
  }, []);

  const enqueueTxCloudOp = useCallback((id: string, task: () => Promise<void>) => {
    const prev = txMutationChainsRef.current.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    txMutationChainsRef.current.set(id, next);
    void next.finally(() => {
      if (txMutationChainsRef.current.get(id) === next) {
        txMutationChainsRef.current.delete(id);
      }
    });
  }, []);

  const {
    session,
    isOfflineRef,
    localTxTracker,
    triggerToast,
    triggerWhaleAlert,
    maybeTriggerPenguinAlert,
    cacheDeletedItem,
  } = deps;
  const userId = session?.user?.id;

  const trackMutationStart = useCallback(
    (id: string, data: { tx?: Transaction; deletedAt?: string; inFlight: boolean }): number => {
      if (!localTxTracker) return 0;
      return localTxTracker.recordStart(id, data);
    },
    [localTxTracker]
  );

  const trackMutationSettled = useCallback(
    (id: string, epoch: number, update?: { tx?: Transaction; deletedAt?: string; remove?: boolean }) => {
      if (!localTxTracker) return;
      localTxTracker.recordSettled(id, epoch, update);
    },
    [localTxTracker]
  );

  // ─── Transactions (Durable Optimistic Local-First Pipeline) ────────────

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
      const clientId = crypto.randomUUID();
      const txWithId = {
        ...tx,
        amount: sanitizedAmount,
        id: clientId,
        date: tx.date ? parseLocalDateToIso(tx.date) : new Date().toISOString(),
      };
      const optimisticTx = { ...txWithId, user_id: userId } as Transaction;

      // 1. Durable local persistence FIRST (~5-10ms in IndexedDB).
      let queueRev: number;
      try {
        queueRev = await enqueueOfflineTx(optimisticTx);
      } catch (err) {
        console.error("[addTransaction] IndexedDB durability write failed:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to save locally",
        };
      }

      // 2. Immediate optimistic UI commit (maintains date DESC, id DESC order)
      const myVersion = nextTxVersion(clientId);
      const myEpoch = trackMutationStart(clientId, {
        tx: optimisticTx,
        inFlight: !isOfflineRef.current,
      });
      setTransactions(prev => upsertTransactionSorted(prev, optimisticTx));

      // 3. Non-blocking local write-through cache + category predictor + alerts
      if (userId) {
        void upsertCachedTransactions(userId, [optimisticTx]);
      }
      if (tx.type === "Expense" && tx.note && tx.category) {
        learnAndSaveAsync(tx.note, tx.category, userId);
      }
      NativeHaptics.successMedium();
      if (sanitizedAmount >= WHALE_THRESHOLD) triggerWhaleAlert();
      if (tx.type === "Expense") maybeTriggerPenguinAlert(sanitizedAmount);

      // 4. Explicit offline mode: already safely enqueued in offline_tx_queue
      if (isOfflineRef.current) {
        return { success: true, status: "pending_sync" };
      }

      // 5. Online mode: push idempotently to Supabase in the background so
      // TransactionModal closes instantaneously without waiting for HTTP RTT.
      const expectedRevs = new Map([[clientId, queueRev]]);
      enqueueTxCloudOp(clientId, async () => {
        try {
          const { data, error } = await supabase
            .from("transactions")
            .upsert(optimisticTx, { onConflict: "id" })
            .select()
            .single();

          if (!error && data) {
            const canonical = data as Transaction;
            await removeAcknowledgedOfflineTxs(new Set([clientId]), expectedRevs);
            trackMutationSettled(clientId, myEpoch, { tx: canonical });
            if (txMutationVersionRef.current.get(clientId) === myVersion) {
              setTransactions(prev => upsertTransactionSorted(prev, canonical));
              if (userId) void upsertCachedTransactions(userId, [canonical]);
            }
            return;
          }

          // Schema resilience: migration 007 columns not yet present (42703)
          if (error?.code === "42703") {
            console.warn("[addTransaction] Column undefined in cloud table — retrying with base schema:", error.message);
            const fallbackPayload: Record<string, unknown> = { ...optimisticTx };
            delete fallbackPayload.credit_card_tx_type;
            delete fallbackPayload.statement_id;
            const retryRes = await supabase
              .from("transactions")
              .upsert(fallbackPayload, { onConflict: "id" })
              .select()
              .single();
            if (!retryRes.error && retryRes.data) {
              const preservedTx = {
                ...retryRes.data,
                credit_card_tx_type: txWithId.credit_card_tx_type,
                statement_id: txWithId.statement_id,
              } as Transaction;
              await removeAcknowledgedOfflineTxs(new Set([clientId]), expectedRevs);
              trackMutationSettled(clientId, myEpoch, { tx: preservedTx });
              if (txMutationVersionRef.current.get(clientId) === myVersion) {
                setTransactions(prev => upsertTransactionSorted(prev, preservedTx));
                if (userId) void upsertCachedTransactions(userId, [preservedTx]);
              }
              return;
            }
          }

          if (isNetworkFailureError(error)) {
            trackMutationSettled(clientId, myEpoch);
            debugLog("[addTransaction] Network drop during background sync; kept in offline queue");
            triggerToast("⏳ Connection dropped — saved locally for sync");
            return;
          }

          // Hard server rejection (RLS / constraint error): roll back optimistic entry
          console.error("[addTransaction] Cloud rejected transaction, rolling back:", error);
          await removeAcknowledgedOfflineTxs(new Set([clientId]), expectedRevs);
          trackMutationSettled(clientId, myEpoch, { remove: true });
          if (txMutationVersionRef.current.get(clientId) === myVersion) {
            setTransactions(prev => prev.filter(t => t.id !== clientId));
            if (userId) void removeCachedTransactionById(userId, clientId);
          }
          NativeHaptics.errorShake();
          triggerToast(`❌ Save rejected: ${error?.message || "Database error"}`);
        } catch (exception) {
          trackMutationSettled(clientId, myEpoch);
          debugLog("[addTransaction] Background sync exception; kept in offline queue:", exception);
          triggerToast("⏳ Connection dropped — saved locally for sync");
        }
      });

      return { success: true, status: "synced" };
    },
    [
      userId,
      isOfflineRef,
      triggerToast,
      triggerWhaleAlert,
      maybeTriggerPenguinAlert,
      nextTxVersion,
      enqueueTxCloudOp,
      trackMutationStart,
      trackMutationSettled,
    ]
  );

  /**
   * Bulk insert multiple transactions in a single IndexedDB write, single
   * React state update, single haptic pulse, and single batch Supabase upsert.
   * Used by Statement Import to avoid N× re-renders and haptic bursts.
   */
  const addTransactionsBatch = useCallback(
    async (
      items: Partial<Transaction>[]
    ): Promise<{ succeeded: number; failedIndices: number[]; errors: string[] }> => {
      const validRows: Array<{ index: number; tx: Transaction }> = [];
      const failedIndices: number[] = [];
      const errors: string[] = [];

      items.forEach((raw, idx) => {
        const validation = validateTransactionInput(raw);
        if (!validation.valid) {
          failedIndices.push(idx);
          errors.push(validation.error || "Invalid transaction");
          return;
        }
        const clientId = crypto.randomUUID();
        const tx: Transaction = {
          ...raw,
          amount: roundCurrency(Number(raw.amount)),
          id: clientId,
          user_id: userId,
          date: raw.date ? parseLocalDateToIso(raw.date) : new Date().toISOString(),
        } as Transaction;
        validRows.push({ index: idx, tx });
      });

      if (validRows.length === 0) {
        return { succeeded: 0, failedIndices, errors };
      }

      const txList = validRows.map(v => v.tx);
      const revMap = await enqueueOfflineTxBatch(txList);

      const epochById = new Map<string, number>();
      const versionById = new Map<string, number>();
      for (const tx of txList) {
        versionById.set(tx.id, nextTxVersion(tx.id));
        epochById.set(
          tx.id,
          trackMutationStart(tx.id, { tx, inFlight: !isOfflineRef.current })
        );
      }

      setTransactions(prev => mergeTransactionsWithDeletes(prev, txList));
      if (userId) void upsertCachedTransactions(userId, txList);
      NativeHaptics.successMedium();

      if (isOfflineRef.current) {
        return { succeeded: validRows.length, failedIndices, errors };
      }

      // Push in batches of 50 so Postgres stays snappy and partial failures
      // never discard valid rows.
      const BATCH_SIZE = 50;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const slice = validRows.slice(i, i + BATCH_SIZE);
        const payloads = slice.map(s => s.tx);
        try {
          const { data, error } = await supabase
            .from("transactions")
            .upsert(payloads, { onConflict: "id" })
            .select();

          if (!error && Array.isArray(data)) {
            const ackIds = new Set(payloads.map(p => p.id));
            await removeAcknowledgedOfflineTxs(ackIds, revMap);
            const canonicals = data as Transaction[];
            for (const c of canonicals) {
              trackMutationSettled(c.id, epochById.get(c.id) ?? 0, { tx: c });
            }
            setTransactions(prev => mergeTransactionsWithDeletes(prev, canonicals));
            if (userId) void upsertCachedTransactions(userId, canonicals);
            continue;
          }

          if (error?.code === "42703") {
            const fallback = payloads.map(p => {
              const copy: Record<string, unknown> = { ...p };
              delete copy.credit_card_tx_type;
              delete copy.statement_id;
              return copy;
            });
            const retry = await supabase
              .from("transactions")
              .upsert(fallback, { onConflict: "id" })
              .select();
            if (!retry.error && Array.isArray(retry.data)) {
              const ackIds = new Set(payloads.map(p => p.id));
              await removeAcknowledgedOfflineTxs(ackIds, revMap);
              const metaById = new Map(
                payloads.map(p => [p.id, { credit_card_tx_type: p.credit_card_tx_type, statement_id: p.statement_id }])
              );
              const preserved = (retry.data as Transaction[]).map(r => ({
                ...r,
                ...(metaById.get(r.id) || {}),
              }));
              for (const c of preserved) {
                trackMutationSettled(c.id, epochById.get(c.id) ?? 0, { tx: c });
              }
              setTransactions(prev => mergeTransactionsWithDeletes(prev, preserved));
              if (userId) void upsertCachedTransactions(userId, preserved);
              continue;
            }
          }

          if (isNetworkFailureError(error)) {
            for (const p of payloads) {
              trackMutationSettled(p.id, epochById.get(p.id) ?? 0);
            }
            continue; // Safely kept in offline_tx_queue
          }

          // Hard server rejection on batch: roll back this slice and report failed indices
          const rejectIds = new Set(payloads.map(p => p.id));
          await removeAcknowledgedOfflineTxs(rejectIds, revMap);
          for (const item of slice) {
            failedIndices.push(item.index);
            errors.push(error?.message || "Database rejected row");
            trackMutationSettled(item.tx.id, epochById.get(item.tx.id) ?? 0, { remove: true });
            if (userId) void removeCachedTransactionById(userId, item.tx.id);
          }
          setTransactions(prev => prev.filter(t => !rejectIds.has(t.id)));
        } catch {
          for (const p of payloads) {
            trackMutationSettled(p.id, epochById.get(p.id) ?? 0);
          }
        }
      }

      const succeeded = items.length - failedIndices.length;
      return { succeeded, failedIndices, errors };
    },
    [userId, isOfflineRef, nextTxVersion, trackMutationStart, trackMutationSettled]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>): Promise<{ success: boolean; error?: string }> => {
      const previousTx = transactionsRef.current.find(t => t.id === id);
      if (!previousTx) {
        return { success: false, error: "Record not found" };
      }

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
        const isoDate = parseLocalDateToIso(cleanPatch.date, previousTx.date);
        if (isNaN(new Date(isoDate).getTime())) {
          return { success: false, error: "Invalid transaction date." };
        }
        cleanPatch.date = isoDate;
      }
      if (cleanPatch.type === "Transfer" && cleanPatch.account && cleanPatch.to_account) {
        if (cleanPatch.account.trim().toLowerCase() === cleanPatch.to_account.trim().toLowerCase()) {
          return { success: false, error: "Source and destination accounts cannot be the same." };
        }
      }

      const optimisticUpdated: Transaction = {
        ...previousTx,
        ...cleanPatch,
        user_id: previousTx.user_id || userId,
      };
      const myVersion = nextTxVersion(id);
      const myEpoch = trackMutationStart(id, {
        tx: optimisticUpdated,
        inFlight: !isOfflineRef.current,
      });

      // 1. Immediate optimistic UI & local cache update
      setTransactions(prev =>
        cleanPatch.date !== undefined && cleanPatch.date !== previousTx.date
          ? upsertTransactionSorted(prev, optimisticUpdated)
          : prev.map(t => (t.id === id ? optimisticUpdated : t))
      );
      if (userId) void upsertCachedTransactions(userId, [optimisticUpdated]);
      NativeHaptics.lightTick();

      // 2. Offline mode: queue full edited row for idempotent upsert on reconnect
      if (isOfflineRef.current) {
        try {
          await enqueueOfflineTx(optimisticUpdated);
        } catch (err) {
          console.error("[updateTransaction] Failed to queue offline edit:", err);
          trackMutationSettled(id, myEpoch, { tx: previousTx });
          setTransactions(prev => upsertTransactionSorted(prev, previousTx));
          if (userId) void upsertCachedTransactions(userId, [previousTx]);
          return { success: false, error: "Failed to save edit locally." };
        }
        return { success: true };
      }

      // 3. Background Supabase update with offline fallback on network drop
      //    and automatic rollback on hard DB/RLS rejections
      enqueueTxCloudOp(id, async () => {
        try {
          const { data, error } = await supabase
            .from("transactions")
            .update(cleanPatch)
            .eq("id", id)
            .select()
            .single();

          if (!error && data) {
            const canonical = { ...optimisticUpdated, ...(data as Transaction) };
            trackMutationSettled(id, myEpoch, { tx: canonical });
            if (txMutationVersionRef.current.get(id) === myVersion) {
              setTransactions(prev => prev.map(t => (t.id === id ? canonical : t)));
              if (userId) void upsertCachedTransactions(userId, [canonical]);
            }
            return;
          }

          if (error?.code === "42703") {
            const fallbackPatch: Record<string, unknown> = { ...cleanPatch };
            delete fallbackPatch.credit_card_tx_type;
            delete fallbackPatch.statement_id;
            const retryRes = await supabase
              .from("transactions")
              .update(fallbackPatch)
              .eq("id", id)
              .select()
              .single();
            if (!retryRes.error && retryRes.data) {
              const updated = {
                ...retryRes.data,
                credit_card_tx_type: cleanPatch.credit_card_tx_type,
                statement_id: cleanPatch.statement_id,
              } as Transaction;
              trackMutationSettled(id, myEpoch, { tx: updated });
              if (txMutationVersionRef.current.get(id) === myVersion) {
                setTransactions(prev => prev.map(t => (t.id === id ? updated : t)));
                if (userId) void upsertCachedTransactions(userId, [updated]);
              }
              return;
            }
          }

          if (isNetworkFailureError(error)) {
            await enqueueOfflineTx(optimisticUpdated).catch(() => {});
            trackMutationSettled(id, myEpoch);
            triggerToast("⏳ Offline — edit saved locally for sync");
            return;
          }

          console.error("[updateTransaction] Supabase error, reverting:", error);
          trackMutationSettled(id, myEpoch, { tx: previousTx });
          if (txMutationVersionRef.current.get(id) === myVersion) {
            setTransactions(prev => upsertTransactionSorted(prev, previousTx));
            if (userId) void upsertCachedTransactions(userId, [previousTx]);
          }
          NativeHaptics.errorShake();
          triggerToast(`❌ Update failed: ${error?.message || "Changes reverted"}`);
        } catch (err) {
          debugLog("[updateTransaction] Network exception; queuing offline edit:", err);
          await enqueueOfflineTx(optimisticUpdated).catch(() => {});
          trackMutationSettled(id, myEpoch);
          triggerToast("⏳ Offline — edit saved locally for sync");
        }
      });

      return { success: true };
    },
    [userId, isOfflineRef, triggerToast, nextTxVersion, enqueueTxCloudOp, trackMutationStart, trackMutationSettled]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const item = transactionsRef.current.find(t => t.id === id);
      const now = new Date().toISOString();
      const myVersion = nextTxVersion(id);
      const myEpoch = trackMutationStart(id, {
        deletedAt: now,
        inFlight: !isOfflineRef.current,
      });

      // 1. Immediate optimistic soft-delete in state + IndexedDB cache
      setTransactions(prev => prev.map(t => (t.id === id ? { ...t, deleted_at: now } : t)));
      if (userId) void removeCachedTransactionById(userId, id);
      NativeHaptics.heavyDoubleThud();
      if (item) cacheDeletedItem("transaction", item);

      // Remove from pending offline queue first so deleting an unsynced offline
      // entry prevents it from resurrecting on next reconnect.
      const removedFromOfflineQueue = await removeAcknowledgedOfflineTxs(new Set([id]));

      // 2. Offline mode:
      //    - If it was only in offline_tx_queue (never synced), removing it above is complete.
      //    - If it already existed on the server, queue the soft-delete tombstone for reconnect!
      if (isOfflineRef.current) {
        if (removedFromOfflineQueue === 0 && item) {
          await enqueueOfflineTx({ ...item, user_id: item.user_id || userId, deleted_at: now }).catch(() => {});
        }
        return;
      }

      enqueueTxCloudOp(id, async () => {
        try {
          const { error } = await supabase
            .from("transactions")
            .update({ deleted_at: now })
            .eq("id", id);

          if (!error) {
            trackMutationSettled(id, myEpoch, { deletedAt: now });
            return;
          }

          if (isNetworkFailureError(error)) {
            // If the item had never reached Supabase (was still queued locally),
            // do NOT resurrect it as a ghost row; otherwise queue the tombstone.
            if (removedFromOfflineQueue === 0 && item) {
              await enqueueOfflineTx({ ...item, user_id: item.user_id || userId, deleted_at: now }).catch(() => {});
            }
            trackMutationSettled(id, myEpoch, { deletedAt: now });
            triggerToast("⏳ Offline — delete queued for sync");
            return;
          }

          console.error("[deleteTransaction] Cloud soft-delete failed, reverting:", error);
          if (item && txMutationVersionRef.current.get(id) === myVersion) {
            trackMutationSettled(id, myEpoch, { tx: item });
            setTransactions(prev => upsertTransactionSorted(prev, item));
            if (userId) void upsertCachedTransactions(userId, [item]);
          }
          NativeHaptics.errorShake();
          triggerToast(`❌ Delete failed: ${error.message}`);
        } catch (err) {
          debugLog("[deleteTransaction] Network exception; queuing soft-delete:", err);
          if (removedFromOfflineQueue === 0 && item) {
            await enqueueOfflineTx({ ...item, user_id: item.user_id || userId, deleted_at: now }).catch(() => {});
          }
          trackMutationSettled(id, myEpoch, { deletedAt: now });
          triggerToast("⏳ Offline — delete queued for sync");
        }
      });
    },
    [userId, isOfflineRef, cacheDeletedItem, triggerToast, nextTxVersion, enqueueTxCloudOp, trackMutationStart, trackMutationSettled]
  );

  /**
   * Restore a soft-deleted transaction (used by Shake-to-Undo).
   * Executes `UPDATE transactions SET deleted_at = NULL` serialized after any
   * in-flight delete so Migration 015's BEFORE UPDATE trigger stamps a fresh
   * `updated_at = NOW()` and propagates cleanly across delta-syncing devices.
   */
  const restoreDeletedTransaction = useCallback(
    async (item: Transaction): Promise<{ success: boolean; error?: string }> => {
      if (!item?.id) return { success: false, error: "Invalid transaction" };
      const restored: Transaction = { ...item, deleted_at: null, user_id: item.user_id || userId };
      const myVersion = nextTxVersion(item.id);
      const myEpoch = trackMutationStart(item.id, { tx: restored, inFlight: !isOfflineRef.current });

      setTransactions(prev => upsertTransactionSorted(prev, restored));
      if (userId) void upsertCachedTransactions(userId, [restored]);

      if (isOfflineRef.current) {
        await enqueueOfflineTx(restored).catch(() => {});
        return { success: true };
      }

      return new Promise(resolve => {
        enqueueTxCloudOp(item.id, async () => {
          try {
            const { data, error } = await supabase
              .from("transactions")
              .update({ deleted_at: null })
              .eq("id", item.id)
              .select()
              .maybeSingle();

            if (!error && data) {
              const canonical = data as Transaction;
              trackMutationSettled(item.id, myEpoch, { tx: canonical });
              if (txMutationVersionRef.current.get(item.id) === myVersion) {
                setTransactions(prev => upsertTransactionSorted(prev, canonical));
                if (userId) void upsertCachedTransactions(userId, [canonical]);
              }
              resolve({ success: true });
              return;
            }

            // If the original row never existed on the server (e.g. deleted while offline),
            // upsert it fresh without stale updated_at so delta sync sees it.
            if (!error && !data) {
              const { updated_at: _staleUpdatedAt, ...insertPayload } = restored;
              void _staleUpdatedAt;
              const upsertRes = await supabase
                .from("transactions")
                .upsert(insertPayload, { onConflict: "id" })
                .select()
                .single();
              if (!upsertRes.error && upsertRes.data) {
                const canonical = upsertRes.data as Transaction;
                trackMutationSettled(item.id, myEpoch, { tx: canonical });
                if (txMutationVersionRef.current.get(item.id) === myVersion) {
                  setTransactions(prev => upsertTransactionSorted(prev, canonical));
                  if (userId) void upsertCachedTransactions(userId, [canonical]);
                }
                resolve({ success: true });
                return;
              }
              resolve({ success: false, error: upsertRes.error?.message || "Restore failed" });
              return;
            }

            if (isNetworkFailureError(error)) {
              await enqueueOfflineTx(restored).catch(() => {});
              trackMutationSettled(item.id, myEpoch);
              resolve({ success: true });
              return;
            }

            trackMutationSettled(item.id, myEpoch, { remove: true });
            if (txMutationVersionRef.current.get(item.id) === myVersion) {
              setTransactions(prev => prev.filter(t => t.id !== item.id));
              if (userId) void removeCachedTransactionById(userId, item.id);
            }
            resolve({ success: false, error: error?.message || "Restore failed" });
          } catch (err) {
            await enqueueOfflineTx(restored).catch(() => {});
            trackMutationSettled(item.id, myEpoch);
            debugLog("[restoreDeletedTransaction] Network exception; queued offline:", err);
            resolve({ success: true });
          }
        });
      });
    },
    [userId, isOfflineRef, nextTxVersion, enqueueTxCloudOp, trackMutationStart, trackMutationSettled]
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
        user_id: userId,
      };
    },
    [userId]
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
      const { id: _id, ...rest } = sub;
      void _id;
      const payload = buildSubsPayload(rest, "subscription");
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setSubscriptions(prev => [
          {
            icon: "MonitorPlay",
            bg: "bg-red-500/10",
            color: "text-red-500",
            ...rest,
            id: data.id,
            user_id: userId,
            type: "subscription",
          } as Subscription,
          ...prev,
        ]);
        NativeHaptics.successMedium();
      } else if (error) {
        console.error("[addSubscription] failed:", error);
        triggerToast(`❌ Failed to add subscription: ${error.message}`);
      }
    },
    [buildSubsPayload, userId, triggerToast]
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
      } else if (error) {
        console.error("[updateSubscription] failed:", error);
        triggerToast(`❌ Failed to update subscription: ${error.message}`);
      }
    },
    [buildSubsPatch, triggerToast]
  );

  const deleteSubscription = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (!error) {
        setSubscriptions(prev => prev.filter(s => s.id !== id));
        setFixedBills(prev => prev.filter(s => s.id !== id));
        setUtilities(prev => prev.filter(s => s.id !== id));
        NativeHaptics.heavyDoubleThud();
      } else {
        console.error("[deleteSubscription] failed:", error);
        triggerToast(`❌ Failed to delete subscription: ${error.message}`);
      }
    },
    [triggerToast]
  );

  const addFixedBill = useCallback(
    async (sub: Partial<Subscription>) => {
      const { id: _id, ...rest } = sub;
      void _id;
      const payload = buildSubsPayload(rest, "fixed_bill");
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setFixedBills(prev => [
          {
            icon: "FileText",
            bg: "bg-purple-500/10",
            color: "text-purple-500",
            ...rest,
            id: data.id,
            user_id: userId,
            type: "fixed_bill",
          } as Subscription,
          ...prev,
        ]);
        NativeHaptics.successMedium();
      } else if (error) {
        console.error("[addFixedBill] failed:", error);
        triggerToast(`❌ Failed to add fixed bill: ${error.message}`);
      }
    },
    [buildSubsPayload, userId, triggerToast]
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
      } else if (error) {
        console.error("[updateFixedBill] failed:", error);
        triggerToast(`❌ Failed to update fixed bill: ${error.message}`);
      }
    },
    [buildSubsPatch, triggerToast]
  );

  const deleteFixedBill = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (!error) {
        setSubscriptions(prev => prev.filter(s => s.id !== id));
        setFixedBills(prev => prev.filter(s => s.id !== id));
        setUtilities(prev => prev.filter(s => s.id !== id));
        NativeHaptics.heavyDoubleThud();
      } else {
        console.error("[deleteFixedBill] failed:", error);
        triggerToast(`❌ Failed to delete fixed bill: ${error.message}`);
      }
    },
    [triggerToast]
  );

  const addUtility = useCallback(
    async (sub: Partial<Subscription>) => {
      const { id: _id, ...rest } = sub;
      void _id;
      const payload = buildSubsPayload(rest, "utility");
      const { data, error } = await supabase
        .from("subscriptions")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setUtilities(prev => [
          {
            icon: "Zap",
            bg: "bg-yellow-500/10",
            color: "text-yellow-500",
            ...rest,
            id: data.id,
            user_id: userId,
            type: "utility",
          } as Subscription,
          ...prev,
        ]);
        NativeHaptics.successMedium();
      } else if (error) {
        console.error("[addUtility] failed:", error);
        triggerToast(`❌ Failed to add utility: ${error.message}`);
      }
    },
    [buildSubsPayload, userId, triggerToast]
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
      } else if (error) {
        console.error("[updateUtility] failed:", error);
        triggerToast(`❌ Failed to update utility: ${error.message}`);
      }
    },
    [buildSubsPatch, triggerToast]
  );

  const deleteUtility = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (!error) {
        setSubscriptions(prev => prev.filter(s => s.id !== id));
        setFixedBills(prev => prev.filter(s => s.id !== id));
        setUtilities(prev => prev.filter(s => s.id !== id));
        NativeHaptics.heavyDoubleThud();
      } else {
        console.error("[deleteUtility] failed:", error);
        triggerToast(`❌ Failed to delete utility: ${error.message}`);
      }
    },
    [triggerToast]
  );

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
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,
    restoreDeletedTransaction,
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
