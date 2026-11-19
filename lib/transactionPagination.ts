// ============================================================================
// lib/transactionPagination.ts
// Universal Expense Tracker — Keyset / Cursor Transaction Pagination
// ============================================================================
// Fetches all active (non-deleted) transactions for an authenticated user
// using deterministic keyset pagination ordered by (date DESC, id DESC).
//
// Why keyset instead of OFFSET / .range(from, to):
//   1. O(N) total DB work instead of O(N²) offset scans at thousands of rows.
//   2. Immune to duplicate/skipped rows under concurrent inserts or deletes.
//   3. Matches partial composite index:
//        ON transactions (user_id, date DESC, id DESC) WHERE deleted_at IS NULL
//   4. Filters soft-deleted rows at the database level (`deleted_at IS NULL`)
//      and avoids an expensive `{ count: "exact" }` full-table scan.
// ============================================================================

import { supabase } from "./supabase";
import { debugLog } from "./debugLog";
import type { Transaction } from "./types";

/**
 * Standard production page size. PostgREST's default max-rows is 1,000.
 */
export const DEFAULT_TRANSACTION_PAGE_SIZE = 1000;

/**
 * Storage key used to override the page size for manual validation or testing.
 */
export const TEST_PAGE_SIZE_STORAGE_KEY = "__test_transaction_page_size";

/**
 * Global window augmentation for testing helpers in browser / Capacitor.
 */
declare global {
  interface Window {
    __TEST_TRANSACTION_PAGE_SIZE?: number;
    __testTransactionPagination?: {
      setPageSize: (size: number | null) => void;
      getPageSize: () => number;
      resetPageSize: () => void;
      runTestFetch: (userId: string, testSize?: number) => Promise<PaginatedFetchResult>;
    };
  }
}

/**
 * Resolve the effective page size for the current environment.
 * In production, returns DEFAULT_TRANSACTION_PAGE_SIZE (1,000).
 * If a test override is set in window or localStorage, returns the override.
 */
export function getEffectivePageSize(): number {
  if (typeof window !== "undefined") {
    // 1. In-memory window override
    if (
      typeof window.__TEST_TRANSACTION_PAGE_SIZE === "number" &&
      window.__TEST_TRANSACTION_PAGE_SIZE > 0
    ) {
      return Math.floor(window.__TEST_TRANSACTION_PAGE_SIZE);
    }

    // 2. LocalStorage override
    try {
      const stored = localStorage.getItem(TEST_PAGE_SIZE_STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage access failures in restricted environments
    }
  }

  return DEFAULT_TRANSACTION_PAGE_SIZE;
}

/**
 * Sets or clears the test page size override for manual validation.
 * @param size A positive integer for testing (e.g. 5, 10, 20), or null to reset to default.
 */
export function setTestTransactionPageSize(size: number | null): void {
  if (typeof window === "undefined") return;

  if (size === null || size <= 0) {
    delete window.__TEST_TRANSACTION_PAGE_SIZE;
    try {
      localStorage.removeItem(TEST_PAGE_SIZE_STORAGE_KEY);
    } catch {}
    debugLog(`[Pagination] Reset transaction page size to default (${DEFAULT_TRANSACTION_PAGE_SIZE})`);
  } else {
    const valid = Math.floor(size);
    window.__TEST_TRANSACTION_PAGE_SIZE = valid;
    try {
      localStorage.setItem(TEST_PAGE_SIZE_STORAGE_KEY, String(valid));
    } catch {}
    debugLog(`[Pagination] Test transaction page size set to: ${valid}`);
  }
}

export type TransactionCursor = {
  date: string;
  id: string;
};

/**
 * Escapes a literal value for inclusion inside a PostgREST `.or(...)` filter
 * expression. Double-quoting preserves timestamps containing `:` and `+`
 * (e.g. `2026-04-12T10:30:00.123456+00:00`) verbatim.
 */
function quotePostgrestValue(val: string): string {
  return `"${val.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Builds the PostgREST keyset filter expression for `(date DESC, id DESC)`:
 *   date < cursor.date OR (date = cursor.date AND id < cursor.id)
 *
 * Uses the raw database timestamp string from `cursor.date` (without passing
 * through JS `Date`) so Postgres microsecond precision is preserved verbatim.
 */
export function buildKeysetOrFilter(cursor: TransactionCursor): string {
  const qDate = quotePostgrestValue(cursor.date);
  const qId = quotePostgrestValue(cursor.id);
  return `date.lt.${qDate},and(date.eq.${qDate},id.lt.${qId})`;
}

export type PaginatedFetchOptions = {
  pageSize?: number;
  onProgress?: (progress: {
    pageIndex: number;
    fetchedInBatch: number;
    cumulativeTotal: number;
    serverReportedTotal: number | null;
  }) => void;
};

export type PaginatedFetchResult = {
  transactions: Transaction[];
  totalBatches: number;
  totalTransactions: number;
  serverReportedTotal: number | null;
  duplicatesSkipped: number;
};

/**
 * Fetches the complete active transaction history for a user using keyset
 * pagination ordered by `date DESC, id DESC`, filtering `deleted_at IS NULL`
 * directly at the database level.
 *
 * Guarantees:
 * 1. Deterministic Ordering: Ordered by `date DESC, id DESC` (unique PK tiebreaker).
 * 2. Safe Under Concurrent Inserts: Keyset cursor anchors to `(lastDate, lastId)`,
 *    so new inserts at the top never shift subsequent pages.
 * 3. Deduplication & Loop Guard: Maintains a `seenIds` set and cursor progress
 *    check so pathological responses can never duplicate rows or loop forever.
 * 4. Atomic Reliability: Any network/DB error aborts and throws — never returns
 *    a truncated list that would overwrite a valid local cache.
 */
export async function fetchPaginatedTransactions(
  userId: string,
  options?: PaginatedFetchOptions
): Promise<Transaction[]> {
  const result = await fetchPaginatedTransactionsDetailed(userId, options);
  return result.transactions;
}

/**
 * Detailed variant of fetchPaginatedTransactions that returns diagnostics
 * and metrics for validation and auditing.
 */
export async function fetchPaginatedTransactionsDetailed(
  userId: string,
  options?: PaginatedFetchOptions
): Promise<PaginatedFetchResult> {
  if (!userId) {
    throw new Error("[fetchPaginatedTransactions] Cannot fetch transactions without a valid userId");
  }

  const pageSize = options?.pageSize ?? getEffectivePageSize();
  const transactions: Transaction[] = [];
  const seenIds = new Set<string>();

  let cursor: TransactionCursor | null = null;
  let pageIndex = 0;
  let duplicatesSkipped = 0;

  debugLog(
    `[fetchPaginatedTransactions] Starting keyset fetch for user ${userId.slice(0, 8)}... ` +
    `(Batch size: ${pageSize}${pageSize !== DEFAULT_TRANSACTION_PAGE_SIZE ? " [TEST OVERRIDE ACTIVE]" : ""})`
  );

  while (true) {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (cursor) {
      query = query.or(buildKeysetOrFilter(cursor));
    }

    const { data, error } = await query
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize);

    if (error) {
      console.error(
        `[fetchPaginatedTransactions] Fatal network/DB error on batch ${pageIndex + 1}:`,
        error
      );
      throw new Error(
        `Failed to fetch transactions batch ${pageIndex + 1}: ${error.message || error.code}`
      );
    }

    if (!data || !Array.isArray(data)) {
      console.error(
        `[fetchPaginatedTransactions] Invalid null/non-array response on batch ${pageIndex + 1}`
      );
      throw new Error(
        `Supabase returned invalid null/non-array data on transactions batch ${pageIndex + 1}`
      );
    }

    const batchRows = data as Transaction[];
    let newUniqueInBatch = 0;

    for (const row of batchRows) {
      if (!row || !row.id) continue;
      if (row.deleted_at) continue;
      if (seenIds.has(row.id)) {
        duplicatesSkipped++;
      } else {
        seenIds.add(row.id);
        transactions.push(row);
        newUniqueInBatch++;
      }
    }

    pageIndex++;

    if (options?.onProgress) {
      options.onProgress({
        pageIndex,
        fetchedInBatch: batchRows.length,
        cumulativeTotal: transactions.length,
        serverReportedTotal: null,
      });
    }

    debugLog(
      `[fetchPaginatedTransactions] Batch ${pageIndex}: ` +
      `received ${batchRows.length} rows (${newUniqueInBatch} new, cumulative: ${transactions.length})`
    );

    // Termination Condition 1:
    // Fewer rows returned than requested means we've reached the end.
    if (batchRows.length < pageSize) {
      break;
    }

    // Termination Condition 2:
    // Safety guard against infinite loops if a batch yields 0 new rows.
    if (newUniqueInBatch === 0) {
      console.warn(
        `[fetchPaginatedTransactions] Batch ${pageIndex} contained 0 new records out of ${batchRows.length} returned. ` +
        `Terminating to prevent infinite loop.`
      );
      break;
    }

    // Advance keyset cursor to the last row of this page (exact raw DB strings).
    const lastRow = batchRows[batchRows.length - 1];
    if (!lastRow?.date || !lastRow?.id) {
      break;
    }
    if (cursor && cursor.date === lastRow.date && cursor.id === lastRow.id) {
      break;
    }
    cursor = { date: lastRow.date, id: lastRow.id };
  }

  debugLog(
    `[fetchPaginatedTransactions] Completed successfully: ` +
    `${transactions.length} active transactions fetched in ${pageIndex} batch${pageIndex === 1 ? "" : "es"}. ` +
    `Duplicates filtered: ${duplicatesSkipped}.`
  );

  return {
    transactions,
    totalBatches: pageIndex,
    totalTransactions: transactions.length,
    serverReportedTotal: null,
    duplicatesSkipped,
  };
}

/**
 * Register testing helper on window object for manual browser/APK verification.
 */
if (typeof window !== "undefined") {
  window.__testTransactionPagination = {
    setPageSize: setTestTransactionPageSize,
    getPageSize: getEffectivePageSize,
    resetPageSize: () => setTestTransactionPageSize(null),
    runTestFetch: (userId: string, testSize?: number) => {
      return fetchPaginatedTransactionsDetailed(userId, { pageSize: testSize });
    },
  };
}

// ----------------------------------------------------------------------------
// Architectural Risk Analysis of Other Tables
// ----------------------------------------------------------------------------
export const TABLE_PAGINATION_RISK_AUDIT = [
  {
    table: "transactions",
    typicalGrowthRate: "High (3-10 records/day; 1,000-3,600/year)",
    estimatedTimeTo1kRows: "3-12 months",
    currentMitigation: "Keyset cursor pagination on (date DESC, id DESC) with DB-level deleted_at IS NULL filter",
    riskLevel: "CRITICAL (Addressed)",
  },
  {
    table: "credit_card_payment_allocations",
    typicalGrowthRate: "Medium (1-4 records per payment; 20-100/year)",
    estimatedTimeTo1kRows: "10-25 years",
    currentMitigation: "Scoped by user_id and statement_id in specialized queries",
    riskLevel: "LOW",
  },
  {
    table: "credit_card_payments",
    typicalGrowthRate: "Low-Medium (1-3 payments per card/month; 12-70/year)",
    estimatedTimeTo1kRows: "15-30 years",
    currentMitigation: "Scoped by user_id",
    riskLevel: "LOW",
  },
  {
    table: "credit_card_statements",
    typicalGrowthRate: "Low (1 statement per card/month; 12-60/year)",
    estimatedTimeTo1kRows: "20-50 years",
    currentMitigation: "Scoped by user_id",
    riskLevel: "LOW",
  },
  {
    table: "credit_card_cashback_records",
    typicalGrowthRate: "Low-Medium (1-5 records/month; 12-60/year)",
    estimatedTimeTo1kRows: "15-40 years",
    currentMitigation: "Scoped by user_id",
    riskLevel: "LOW",
  },
  {
    table: "subscriptions",
    typicalGrowthRate: "Negligible (Active subscriptions/bills; 10-50 records total)",
    estimatedTimeTo1kRows: "Practically never",
    currentMitigation: "Single select with user_id",
    riskLevel: "NEGLIGIBLE",
  },
  {
    table: "goals",
    typicalGrowthRate: "Negligible (Savings goals; 5-30 records total)",
    estimatedTimeTo1kRows: "Practically never",
    currentMitigation: "Single select with user_id",
    riskLevel: "NEGLIGIBLE",
  },
  {
    table: "salary_planner",
    typicalGrowthRate: "Negligible (Budget categories; 5-25 records total)",
    estimatedTimeTo1kRows: "Practically never",
    currentMitigation: "Single select with user_id",
    riskLevel: "NEGLIGIBLE",
  },
  {
    table: "asset_vault",
    typicalGrowthRate: "Negligible (Assets/properties; 5-50 records total)",
    estimatedTimeTo1kRows: "Practically never",
    currentMitigation: "Single select with user_id",
    riskLevel: "NEGLIGIBLE",
  },
  {
    table: "user_accounts",
    typicalGrowthRate: "Negligible (Financial accounts; 3-20 records total)",
    estimatedTimeTo1kRows: "Practically never",
    currentMitigation: "Single select with user_id",
    riskLevel: "NEGLIGIBLE",
  },
  {
    table: "user_categories",
    typicalGrowthRate: "Negligible (Categories; 10-50 records total)",
    estimatedTimeTo1kRows: "Practically never",
    currentMitigation: "Single select with user_id",
    riskLevel: "NEGLIGIBLE",
  },
] as const;
