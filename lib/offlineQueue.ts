import localforage from "localforage";
import type { RawCreditCardStatementRow, Transaction } from "./types";

const OFFLINE_QUEUE_KEY = "offline_tx_queue";
const OFFLINE_DEAD_LETTER_KEY = "offline_tx_dead_letter";
const OFFLINE_STATEMENT_QUEUE_KEY = "offline_statement_queue";

export type OfflineQueuedTx = Partial<Transaction> & {
  /** Monotonic local revision tag; stripped before sending to Supabase. */
  _queueRev?: number;
};

let revCounter = 0;
function nextQueueRev(): number {
  const now = Date.now();
  revCounter = now > revCounter ? now : revCounter + 1;
  return revCounter;
}

/**
 * Strip internal queue metadata before sending a transaction payload to Supabase.
 */
export function stripOfflineQueueMeta(tx: OfflineQueuedTx): Partial<Transaction> {
  const { _queueRev: _ignored, ...clean } = tx;
  void _ignored;
  return clean;
}

/**
 * Single-flight serializer lock for offline transaction queue operations.
 * Ensures that reading, enqueuing, and acknowledging items never race against each other,
 * preventing silent data loss when items are added while a sync is in flight.
 */
let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(op: () => Promise<T>): Promise<T> {
  const next = queueLock.then(op);
  queueLock = next.catch(() => { });
  return next;
}

/**
 * Enqueue (or supersede by id) a transaction in the offline queue with
 * serialized read-modify-write. Returns the stamped `_queueRev` so callers can
 * safely acknowledge only the exact snapshot they synced.
 */
export async function enqueueOfflineTx(tx: Partial<Transaction>): Promise<number> {
  return withQueueLock(async () => {
    const existing = (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
    const rev = nextQueueRev();
    const entry: OfflineQueuedTx = { ...stripOfflineQueueMeta(tx), _queueRev: rev };
    const filtered = tx.id ? existing.filter(item => item.id !== tx.id) : existing;
    filtered.push(entry);
    await localforage.setItem(OFFLINE_QUEUE_KEY, filtered);
    return rev;
  });
}

/**
 * Enqueue multiple transactions in a single IndexedDB read-modify-write.
 */
export async function enqueueOfflineTxBatch(txs: Partial<Transaction>[]): Promise<Map<string, number>> {
  const revs = new Map<string, number>();
  if (txs.length === 0) return revs;
  return withQueueLock(async () => {
    const existing = (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
    const incomingIds = new Set(txs.map(t => t.id).filter(Boolean) as string[]);
    const filtered = existing.filter(item => !item.id || !incomingIds.has(item.id));
    for (const tx of txs) {
      const rev = nextQueueRev();
      if (tx.id) revs.set(tx.id, rev);
      filtered.push({ ...stripOfflineQueueMeta(tx), _queueRev: rev });
    }
    await localforage.setItem(OFFLINE_QUEUE_KEY, filtered);
    return revs;
  });
}

/**
 * Retrieve the current offline queue items without modifying them.
 */
export async function getOfflineQueue(): Promise<OfflineQueuedTx[]> {
  return withQueueLock(async () => {
    return (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
  });
}

/**
 * Retrieve offline transactions belonging specifically to the given user.
 * If legacy transactions exist without a user_id, they are safely claimed
 * by the current user so they are not lost.
 */
export async function getOfflineQueueForUser(userId: string): Promise<OfflineQueuedTx[]> {
  if (!userId) return [];
  return withQueueLock(async () => {
    const queue = (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
    let updated = false;

    const userQueue = queue.filter(tx => {
      if (tx.user_id === userId) return true;
      if (!tx.user_id) {
        // Cautiously assign legacy un-owned offline transaction to current authenticated user
        tx.user_id = userId;
        updated = true;
        return true;
      }
      return false;
    });

    if (updated) {
      await localforage.setItem(OFFLINE_QUEUE_KEY, queue);
    }

    return userQueue;
  });
}

/**
 * Safely removes ONLY the successfully acknowledged transactions from the queue.
 * When `expectedRevs` is provided, an entry whose `_queueRev` changed while a
 * sync was in flight (e.g. edited offline mid-sync) is preserved for the next sync.
 *
 * Returns the number of items removed.
 */
export async function removeAcknowledgedOfflineTxs(
  acknowledgedIds: Set<string>,
  expectedRevs?: Map<string, number>
): Promise<number> {
  if (acknowledgedIds.size === 0) return 0;
  return withQueueLock(async () => {
    const currentQueue = (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
    const remaining = currentQueue.filter(tx => {
      if (!tx.id || !acknowledgedIds.has(tx.id)) return true;
      if (expectedRevs && expectedRevs.has(tx.id)) {
        const expected = expectedRevs.get(tx.id);
        if (tx._queueRev !== undefined && expected !== undefined && tx._queueRev !== expected) {
          return true; // Superseded by a newer local edit/delete — keep in queue
        }
      }
      return false;
    });
    const removedCount = currentQueue.length - remaining.length;
    if (remaining.length === 0) {
      await localforage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      await localforage.setItem(OFFLINE_QUEUE_KEY, remaining);
    }
    return removedCount;
  });
}

/**
 * Quarantine a permanently rejected (non-network) offline record out of the
 * active sync queue so it cannot cause infinite poison-pill retry loops.
 */
export async function quarantineOfflineTx(
  tx: OfflineQueuedTx,
  reason: string
): Promise<void> {
  return withQueueLock(async () => {
    const currentQueue = (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
    const remaining = tx.id ? currentQueue.filter(item => item.id !== tx.id) : currentQueue;
    if (remaining.length === 0) {
      await localforage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      await localforage.setItem(OFFLINE_QUEUE_KEY, remaining);
    }
    try {
      const deadLetter = (await localforage.getItem<Array<{ tx: Partial<Transaction>; reason: string; quarantinedAt: string }>>(OFFLINE_DEAD_LETTER_KEY)) || [];
      deadLetter.push({
        tx: stripOfflineQueueMeta(tx),
        reason,
        quarantinedAt: new Date().toISOString(),
      });
      await localforage.setItem(OFFLINE_DEAD_LETTER_KEY, deadLetter.slice(-50));
    } catch {
      /* ignore dead-letter write errors */
    }
  });
}

/**
 * Clear all queued offline transactions and statements belonging to a user
 * (used during full Clear Data reset so deleted records cannot resurrect).
 */
export async function clearOfflineQueueForUser(userId: string): Promise<void> {
  if (!userId) return;
  return withQueueLock(async () => {
    const txQueue = (await localforage.getItem<OfflineQueuedTx[]>(OFFLINE_QUEUE_KEY)) || [];
    const remainingTx = txQueue.filter(tx => tx.user_id && tx.user_id !== userId);
    if (remainingTx.length === 0) {
      await localforage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      await localforage.setItem(OFFLINE_QUEUE_KEY, remainingTx);
    }

    const stmtQueue = (await localforage.getItem<RawCreditCardStatementRow[]>(OFFLINE_STATEMENT_QUEUE_KEY)) || [];
    const remainingStmt = stmtQueue.filter(s => s.user_id && s.user_id !== userId);
    if (remainingStmt.length === 0) {
      await localforage.removeItem(OFFLINE_STATEMENT_QUEUE_KEY);
    } else {
      await localforage.setItem(OFFLINE_STATEMENT_QUEUE_KEY, remainingStmt);
    }
  });
}

/**
 * Enqueue a credit card statement to the durable offline statement queue.
 */
export async function enqueueOfflineStatement(stmt: RawCreditCardStatementRow): Promise<void> {
  return withQueueLock(async () => {
    const existing = (await localforage.getItem<RawCreditCardStatementRow[]>(OFFLINE_STATEMENT_QUEUE_KEY)) || [];
    // Prevent duplicate entries for the exact same statement id in queue
    const filtered = existing.filter(s => s.id !== stmt.id);
    filtered.push(stmt);
    await localforage.setItem(OFFLINE_STATEMENT_QUEUE_KEY, filtered);
  });
}

/**
 * Retrieve queued offline credit card statements for a specific user.
 */
export async function getOfflineStatementQueueForUser(userId: string): Promise<RawCreditCardStatementRow[]> {
  if (!userId) return [];
  return withQueueLock(async () => {
    const queue = (await localforage.getItem<RawCreditCardStatementRow[]>(OFFLINE_STATEMENT_QUEUE_KEY)) || [];
    return queue.filter(s => s.user_id === userId);
  });
}

/**
 * Safely removes acknowledged statements from the offline queue.
 */
export async function removeAcknowledgedOfflineStatements(acknowledgedIds: Set<string>): Promise<number> {
  if (acknowledgedIds.size === 0) return 0;
  return withQueueLock(async () => {
    const currentQueue = (await localforage.getItem<RawCreditCardStatementRow[]>(OFFLINE_STATEMENT_QUEUE_KEY)) || [];
    const remaining = currentQueue.filter(s => !s.id || !acknowledgedIds.has(s.id));
    const removedCount = currentQueue.length - remaining.length;
    if (remaining.length === 0) {
      await localforage.removeItem(OFFLINE_STATEMENT_QUEUE_KEY);
    } else {
      await localforage.setItem(OFFLINE_STATEMENT_QUEUE_KEY, remaining);
    }
    return removedCount;
  });
}

