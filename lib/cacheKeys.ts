import localforage from "localforage";
import { debugLog } from "./debugLog";

export const LEGACY_DATA_CACHE_KEY = "tracker_data_cache";
export const LEGACY_PREDICTOR_KEY = "category_predictor_v1";
export const LEGACY_PIN_KEY = "app_lock_pin";

export function getUserDataCacheKey(userId?: string): string {
  return userId ? `tracker_data_cache_${userId}` : LEGACY_DATA_CACHE_KEY;
}

/**
 * Lightweight user-scoped metadata cache key (accounts + categories only).
 * Stored in localStorage for instant synchronous cold-start paint without
 * duplicating or JSON-stringifying the entire transaction history.
 */
export function getUserMetaCacheKey(userId?: string): string {
  return userId ? `tracker_meta_cache_${userId}` : "tracker_meta_cache";
}

/** Dedicated IndexedDB key for the user's full active transaction ledger. */
export function getUserTransactionsCacheKey(userId?: string): string {
  return userId ? `tracker_txs_cache_${userId}` : "tracker_txs_cache";
}

/** Tiny IndexedDB slice of the newest 100 transactions for near-0ms cold paint. */
export function getUserRecentTransactionsCacheKey(userId?: string): string {
  return userId ? `tracker_recent_txs_${userId}` : "tracker_recent_txs";
}

/** Sync watermark (`lastSyncedAt`) used for incremental delta sync (Migration 015). */
export function getUserSyncWatermarkKey(userId?: string): string {
  return userId ? `tracker_tx_watermark_${userId}` : "tracker_tx_watermark";
}

export function getUserPredictorKey(userId?: string): string {
  return userId ? `category_predictor_v1_${userId}` : LEGACY_PREDICTOR_KEY;
}

export function getUserPinKey(userId?: string): string {
  return userId ? `app_lock_pin_${userId}` : LEGACY_PIN_KEY;
}

export function getUserCreditCardStatementsKey(userId?: string): string {
  return userId ? `tracker_cc_statements_${userId}` : "tracker_cc_statements_anon";
}

export function getUserCreditCardPaymentsKey(userId?: string): string {
  return userId ? `tracker_cc_payments_${userId}` : "tracker_cc_payments_anon";
}

export function getUserCreditCardAllocationsKey(userId?: string): string {
  return userId ? `tracker_cc_allocations_${userId}` : "tracker_cc_allocations_anon";
}

export function getUserCashbackConfigsKey(userId?: string): string {
  return userId ? `tracker_cc_cashback_configs_${userId}` : "tracker_cc_cashback_configs_anon";
}

export function getUserCashbackRecordsKey(userId?: string): string {
  return userId ? `tracker_cc_cashback_records_${userId}` : "tracker_cc_cashback_records_anon";
}

/**
 * Migrates legacy un-scoped cache data to the authenticated user's isolated key.
 * Ensures existing users do not lose their offline cache while preventing another
 * user on the same device from accessing or uploading old cached records.
 */
export async function migrateLegacyCacheToUser(userId: string): Promise<void> {
  if (!userId) return;

  const userKey = getUserDataCacheKey(userId);

  // 1. IndexedDB migration
  try {
    const userCache = await localforage.getItem(userKey);
    if (!userCache) {
      const legacyCache = await localforage.getItem(LEGACY_DATA_CACHE_KEY);
      if (legacyCache) {
        await localforage.setItem(userKey, legacyCache);
        await localforage.removeItem(LEGACY_DATA_CACHE_KEY);
        debugLog(`[cacheKeys] Migrated legacy IndexedDB cache to user ${userId}`);
      }
    }
  } catch (err) {
    console.warn("[cacheKeys] IndexedDB cache migration failed:", err);
  }

  // 2. Clean up oversized legacy localStorage mirror (IndexedDB is the primary
  //    store for transactions; only lightweight metadata belongs in localStorage).
  if (typeof window !== "undefined") {
    try {
      const legacyLs = localStorage.getItem(LEGACY_DATA_CACHE_KEY);
      if (legacyLs) {
        const metaKey = getUserMetaCacheKey(userId);
        if (!localStorage.getItem(metaKey)) {
          try {
            const parsed = JSON.parse(legacyLs);
            const meta = {
              accounts: parsed?.accounts,
              categories: parsed?.categories,
            };
            localStorage.setItem(metaKey, JSON.stringify(meta));
          } catch {
            /* ignore malformed legacy blob */
          }
        }
        localStorage.removeItem(LEGACY_DATA_CACHE_KEY);
        debugLog(`[cacheKeys] Migrated legacy localStorage metadata to user ${userId}`);
      }
      // Also prune any old oversized full-payload localStorage mirror for this user
      // after extracting its tiny metadata slice.
      const userFullLs = localStorage.getItem(userKey);
      if (userFullLs) {
        const metaKey = getUserMetaCacheKey(userId);
        if (!localStorage.getItem(metaKey)) {
          try {
            const parsed = JSON.parse(userFullLs);
            localStorage.setItem(
              metaKey,
              JSON.stringify({
                accounts: parsed?.accounts,
                categories: parsed?.categories,
              })
            );
          } catch {
            /* ignore */
          }
        }
        localStorage.removeItem(userKey);
      }
    } catch (err) {
      console.warn("[cacheKeys] localStorage cache migration failed:", err);
    }
  }
}
