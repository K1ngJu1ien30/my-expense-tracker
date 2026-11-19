import localforage from "localforage";
import {
  getUserDataCacheKey,
  getUserRecentTransactionsCacheKey,
  getUserTransactionsCacheKey,
} from "./cacheKeys";
import type { Transaction } from "./types";

export const RECENT_TX_SLICE_SIZE = 100;

export type LocalTxMutationRecord = {
  id: string;
  tx?: Transaction;
  deletedAt?: string;
  epoch: number;
  inFlight: boolean;
};

export type LocalTxTracker = {
  getEpoch: () => number;
  recordStart: (id: string, data: { tx?: Transaction; deletedAt?: string; inFlight: boolean }) => number;
  recordSettled: (id: string, epoch: number, update?: { tx?: Transaction; deletedAt?: string; remove?: boolean }) => void;
  clear: () => void;
  applyOverrides: (
    cloudRows: Transaction[],
    sinceEpoch: number,
    pruneSettled?: boolean
  ) => { rows: Transaction[]; appliedCount: number };
};

/**
 * Creates a mutable, React-Compiler-friendly coordinator that protects
 * optimistic local mutations from being clobbered by in-flight `refreshData()`.
 */
export function createLocalTxTracker(): LocalTxTracker {
  const map = new Map<string, LocalTxMutationRecord>();
  let epochCounter = 0;

  return {
    getEpoch: () => epochCounter,
    recordStart: (id, data) => {
      const epoch = ++epochCounter;
      map.set(id, {
        id,
        tx: data.tx,
        deletedAt: data.deletedAt,
        epoch,
        inFlight: data.inFlight,
      });
      return epoch;
    },
    recordSettled: (id, epoch, update) => {
      const current = map.get(id);
      if (!current || current.epoch !== epoch) return;
      if (update?.remove) {
        map.delete(id);
        return;
      }
      map.set(id, {
        ...current,
        ...(update?.tx ? { tx: update.tx, deletedAt: undefined } : {}),
        ...(update?.deletedAt ? { deletedAt: update.deletedAt, tx: undefined } : {}),
        inFlight: false,
      });
    },
    clear: () => {
      map.clear();
    },
    applyOverrides: (cloudRows, sinceEpoch, pruneSettled = true) => {
      if (map.size === 0) {
        return { rows: cloudRows, appliedCount: 0 };
      }

      let appliedCount = 0;
      const toOverride: LocalTxMutationRecord[] = [];
      const toPrune: string[] = [];

      map.forEach((rec, id) => {
        if (rec.inFlight || rec.epoch > sinceEpoch) {
          toOverride.push(rec);
        } else if (pruneSettled) {
          toPrune.push(id);
        }
      });

      if (pruneSettled) {
        for (const id of toPrune) map.delete(id);
      }

      if (toOverride.length === 0) {
        return { rows: cloudRows, appliedCount: 0 };
      }

      const byId = new Map<string, Transaction>();
      for (const row of cloudRows) {
        if (row.id && !row.deleted_at) byId.set(row.id, row);
      }

      for (const rec of toOverride) {
        appliedCount++;
        if (rec.deletedAt) {
          byId.delete(rec.id);
        } else if (rec.tx && !rec.tx.deleted_at) {
          byId.set(rec.id, rec.tx);
        }
      }

      const merged = Array.from(byId.values());
      merged.sort(compareTransactionsDesc);
      return { rows: merged, appliedCount };
    },
  };
}

/**
 * Convenience helper delegating to `tracker.applyOverrides(...)`.
 */
export function applyLocalTxOverrides(
  cloudRows: Transaction[],
  tracker: LocalTxTracker | undefined,
  sinceEpoch: number,
  pruneSettled: boolean = true
): { rows: Transaction[]; appliedCount: number } {
  if (!tracker) return { rows: cloudRows, appliedCount: 0 };
  return tracker.applyOverrides(cloudRows, sinceEpoch, pruneSettled);
}

/**
 * Deterministic comparator matching Postgres `ORDER BY date DESC, id DESC`.
 */
export function compareTransactionsDesc(a: Transaction, b: Transaction): number {
  const ta = Date.parse(a.date);
  const tb = Date.parse(b.date);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return tb - ta;
  }
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  return b.id.localeCompare(a.id);
}

/**
 * Insert or replace a single transaction while maintaining descending
 * `(date DESC, id DESC)` order without sorting the entire array.
 */
export function upsertTransactionSorted(list: Transaction[], tx: Transaction): Transaction[] {
  const withoutExisting = list.some((t) => t.id === tx.id)
    ? list.filter((t) => t.id !== tx.id)
    : list;

  // Fast path: newest transaction belongs at the very top (common case)
  if (withoutExisting.length === 0 || compareTransactionsDesc(tx, withoutExisting[0]) <= 0) {
    return [tx, ...withoutExisting];
  }

  // Find insertion index in descending order
  let idx = 1;
  while (idx < withoutExisting.length && compareTransactionsDesc(tx, withoutExisting[idx]) > 0) {
    idx++;
  }
  const next = withoutExisting.slice();
  next.splice(idx, 0, tx);
  return next;
}

/**
 * Merge a batch of incoming server transactions (upsert or delta sync) into an
 * existing list. Rows with a non-null `deleted_at` are removed so cross-device
 * soft deletes propagate cleanly.
 */
export function mergeTransactionsWithDeletes(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, Transaction>();
  for (const tx of existing) {
    if (tx.id && !tx.deleted_at) byId.set(tx.id, tx);
  }
  for (const row of incoming) {
    if (!row?.id) continue;
    if (row.deleted_at) {
      byId.delete(row.id);
    } else {
      byId.set(row.id, row);
    }
  }
  const merged = Array.from(byId.values());
  merged.sort(compareTransactionsDesc);
  return merged;
}

// Single-flight serializer per user so overlapping write-through updates never
// overwrite newer cache mutations with stale reads.
const cacheWriteChains = new Map<string, Promise<unknown>>();

function enqueueCacheWrite(userId: string, op: () => Promise<void>): Promise<void> {
  const prev = cacheWriteChains.get(userId) ?? Promise.resolve();
  const next = prev.then(op).catch(() => {});
  cacheWriteChains.set(userId, next);
  return next;
}

/**
 * Read the small top-100 recent transaction slice for instant cold-boot paint.
 */
export async function readRecentCachedTransactions(userId: string): Promise<Transaction[] | null> {
  if (!userId) return null;
  try {
    const recent = await localforage.getItem<Transaction[]>(
      getUserRecentTransactionsCacheKey(userId)
    );
    return Array.isArray(recent) && recent.length > 0 ? recent : null;
  } catch {
    return null;
  }
}

/**
 * Read the full cached active transaction list for a user, with automatic
 * fallback to the legacy monolithic `tracker_data_cache_<userId>.transactions`
 * key so upgrades from v3.5.0 preserve cached history seamlessly.
 */
export async function readFullCachedTransactions(
  userId: string,
  legacyBlob?: { transactions?: Transaction[] } | null
): Promise<Transaction[] | null> {
  if (!userId) return null;
  try {
    const dedicated = await localforage.getItem<Transaction[]>(
      getUserTransactionsCacheKey(userId)
    );
    if (Array.isArray(dedicated)) return dedicated;

    if (legacyBlob && Array.isArray(legacyBlob.transactions)) {
      return legacyBlob.transactions;
    }

    const blob = await localforage.getItem<{ transactions?: Transaction[] }>(
      getUserDataCacheKey(userId)
    );
    if (blob && Array.isArray(blob.transactions)) {
      return blob.transactions;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Persist the full transaction list and its lightweight top-100 recent slice
 * to dedicated user-scoped IndexedDB keys.
 */
export function writeCachedTransactions(userId: string, txs: Transaction[]): Promise<void> {
  if (!userId) return Promise.resolve();
  const activeOnly = txs.filter((t) => !t.deleted_at).sort(compareTransactionsDesc);
  const recentSlice = activeOnly.slice(0, RECENT_TX_SLICE_SIZE);
  return enqueueCacheWrite(userId, async () => {
    await Promise.all([
      localforage.setItem(getUserRecentTransactionsCacheKey(userId), recentSlice),
      localforage.setItem(getUserTransactionsCacheKey(userId), activeOnly),
    ]);
  });
}

/**
 * Incrementally upsert one or more transactions into the dedicated IndexedDB
 * transaction caches (write-through after optimistic save/edit/sync).
 */
export function upsertCachedTransactions(userId: string, incoming: Transaction[]): Promise<void> {
  if (!userId || incoming.length === 0) return Promise.resolve();
  return enqueueCacheWrite(userId, async () => {
    const existing = (await readFullCachedTransactions(userId)) ?? [];
    const next = mergeTransactionsWithDeletes(existing, incoming);
    const recentSlice = next.slice(0, RECENT_TX_SLICE_SIZE);
    await Promise.all([
      localforage.setItem(getUserRecentTransactionsCacheKey(userId), recentSlice),
      localforage.setItem(getUserTransactionsCacheKey(userId), next),
    ]);
  });
}

/**
 * Remove a soft-deleted or rolled-back transaction ID from the dedicated
 * IndexedDB transaction caches.
 */
export function removeCachedTransactionById(userId: string, id: string): Promise<void> {
  if (!userId || !id) return Promise.resolve();
  return enqueueCacheWrite(userId, async () => {
    const existing = await readFullCachedTransactions(userId);
    if (!existing) return;
    const next = existing.filter((t) => t.id !== id);
    const recentSlice = next.slice(0, RECENT_TX_SLICE_SIZE);
    await Promise.all([
      localforage.setItem(getUserRecentTransactionsCacheKey(userId), recentSlice),
      localforage.setItem(getUserTransactionsCacheKey(userId), next),
    ]);
  });
}
