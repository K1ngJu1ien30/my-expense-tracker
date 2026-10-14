import localforage from "localforage";

export const LEGACY_DATA_CACHE_KEY = "tracker_data_cache";
export const LEGACY_PREDICTOR_KEY = "category_predictor_v1";
export const LEGACY_PIN_KEY = "app_lock_pin";

export function getUserDataCacheKey(userId?: string): string {
  return userId ? `tracker_data_cache_${userId}` : LEGACY_DATA_CACHE_KEY;
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
        console.log(`[cacheKeys] Migrated legacy IndexedDB cache to user ${userId}`);
      }
    }
  } catch (err) {
    console.warn("[cacheKeys] IndexedDB cache migration failed:", err);
  }

  // 2. localStorage migration
  if (typeof window !== "undefined") {
    try {
      const userLs = localStorage.getItem(userKey);
      if (!userLs) {
        const legacyLs = localStorage.getItem(LEGACY_DATA_CACHE_KEY);
        if (legacyLs) {
          localStorage.setItem(userKey, legacyLs);
          localStorage.removeItem(LEGACY_DATA_CACHE_KEY);
          console.log(`[cacheKeys] Migrated legacy localStorage cache to user ${userId}`);
        }
      }
    } catch (err) {
      console.warn("[cacheKeys] localStorage cache migration failed:", err);
    }
  }
}
