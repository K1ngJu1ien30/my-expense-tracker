import localforage from "localforage";
import type { Transaction } from "./types";

const OFFLINE_QUEUE_KEY = "offline_tx_queue";

/**
 * Single-flight serializer lock for offline transaction queue operations.
 * Ensures that reading, enqueuing, and acknowledging items never race against each other,
 * preventing silent data loss when items are added while a sync is in flight.
 */
let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(op: () => Promise<T>): Promise<T> {
  const next = queueLock.then(op);
  queueLock = next.catch(() => {});
  return next;
}

/**
 * Enqueue a transaction to the offline queue with serialized read-modify-write.
 * Rejects if IndexedDB storage fails so callers know persistence did not succeed.
 */
export async function enqueueOfflineTx(tx: Partial<Transaction>): Promise<void> {
  return withQueueLock(async () => {
    const existing = (await localforage.getItem<Partial<Transaction>[]>(OFFLINE_QUEUE_KEY)) || [];
    existing.push(tx);
    await localforage.setItem(OFFLINE_QUEUE_KEY, existing);
  });
}

/**
 * Retrieve the current offline queue items without modifying them.
 */
export async function getOfflineQueue(): Promise<Partial<Transaction>[]> {
  return withQueueLock(async () => {
    return (await localforage.getItem<Partial<Transaction>[]>(OFFLINE_QUEUE_KEY)) || [];
  });
}

/**
 * Retrieve offline transactions belonging specifically to the given user.
 * If legacy transactions exist without a user_id, they are safely claimed
 * by the current user so they are not lost.
 */
export async function getOfflineQueueForUser(userId: string): Promise<Partial<Transaction>[]> {
  if (!userId) return [];
  return withQueueLock(async () => {
    const queue = (await localforage.getItem<Partial<Transaction>[]>(OFFLINE_QUEUE_KEY)) || [];
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
 * Any transactions added concurrently during sync, or transactions that failed to upload,
 * remain securely in the queue.
 *
 * Returns the number of items removed.
 */
export async function removeAcknowledgedOfflineTxs(acknowledgedIds: Set<string>): Promise<number> {
  if (acknowledgedIds.size === 0) return 0;
  return withQueueLock(async () => {
    const currentQueue = (await localforage.getItem<Partial<Transaction>[]>(OFFLINE_QUEUE_KEY)) || [];
    const remaining = currentQueue.filter(tx => !tx.id || !acknowledgedIds.has(tx.id));
    const removedCount = currentQueue.length - remaining.length;
    if (remaining.length === 0) {
      await localforage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      await localforage.setItem(OFFLINE_QUEUE_KEY, remaining);
    }
    return removedCount;
  });
}
