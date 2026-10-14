// ============================================================================
// lib/transactionPagination.ts
// Universal Expense Tracker — Stage D: Supabase Transaction Pagination
// ============================================================================
// Fetches the complete transaction history for an authenticated user using
// safe, deterministic range pagination that respects Supabase / PostgREST
// per-request row limits (default 1,000 rows).
// ============================================================================

import { supabase } from "./supabase";
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
    console.log(`[Pagination] Reset transaction page size to default (${DEFAULT_TRANSACTION_PAGE_SIZE})`);
  } else {
    const valid = Math.floor(size);
    window.__TEST_TRANSACTION_PAGE_SIZE = valid;
    try {
      localStorage.setItem(TEST_PAGE_SIZE_STORAGE_KEY, String(valid));
    } catch {}
    console.log(`[Pagination] Test transaction page size set to: ${valid}`);
  }
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
 * Fetches the complete transaction history for a user across multiple pages.
 *
 * Guarantees:
 * 1. Deterministic Ordering: Ordered by `date DESC, id DESC`.
 *    Because `id` is the unique primary key, no two rows share identical sort values.
 * 2. Deduplication: Maintains a `seenIds` set across page fetches to absorb any
 *    offset shifts caused by concurrent inserts or deletions.
 * 3. Atomic Reliability: If any page request fails (network error, timeout, HTTP 5xx),
 *    the function aborts and throws an exception. It NEVER returns a partial list,
 *    preventing callers from overwriting valid local caches with incomplete data.
 * 4. Infinite Loop Protection: Stops if a page returns 0 new unique records.
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

  let from = 0;
  let pageIndex = 0;
  let serverReportedTotal: number | null = null;
  let duplicatesSkipped = 0;

  console.log(
    `[fetchPaginatedTransactions] Starting fetch for user ${userId.slice(0, 8)}... ` +
    `(Batch size: ${pageSize}${pageSize !== DEFAULT_TRANSACTION_PAGE_SIZE ? " [TEST OVERRIDE ACTIVE]" : ""})`
  );

  while (true) {
    const to = from + pageSize - 1;

    // Request total count on the first batch to provide progress diagnostics
    const query = supabase
      .from("transactions")
      .select("*", pageIndex === 0 ? { count: "exact" } : undefined)
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error(
        `[fetchPaginatedTransactions] Fatal network/DB error on batch ${pageIndex + 1} (range [${from}, ${to}]):`,
        error
      );
      throw new Error(
        `Failed to fetch transactions batch ${pageIndex + 1} [${from}..${to}]: ${error.message || error.code}`
      );
    }

    if (!data || !Array.isArray(data)) {
      console.error(
        `[fetchPaginatedTransactions] Invalid null/non-array response on batch ${pageIndex + 1} (range [${from}, ${to}])`
      );
      throw new Error(
        `Supabase returned invalid null/non-array data on transactions batch ${pageIndex + 1}`
      );
    }

    if (pageIndex === 0 && typeof count === "number") {
      serverReportedTotal = count;
    }

    const batchRows = data as Transaction[];
    let newUniqueInBatch = 0;

    for (const row of batchRows) {
      if (!row || !row.id) continue;
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
        serverReportedTotal,
      });
    }

    console.log(
      `[fetchPaginatedTransactions] Batch ${pageIndex} [${from}..${to}]: ` +
      `received ${batchRows.length} rows (${newUniqueInBatch} new, cumulative: ${transactions.length}` +
      `${serverReportedTotal !== null ? ` / ${serverReportedTotal}` : ""})`
    );

    // Termination Condition 1:
    // If the server returned fewer rows than requested in this page, we've reached the end of the table.
    if (batchRows.length < pageSize) {
      break;
    }

    // Termination Condition 2:
    // If the server count was exact and we have accumulated all records, finish.
    if (serverReportedTotal !== null && transactions.length >= serverReportedTotal) {
      break;
    }

    // Termination Condition 3:
    // Safety guard against infinite loops caused by pathological concurrent data shifting.
    if (newUniqueInBatch === 0 && batchRows.length > 0) {
      console.warn(
        `[fetchPaginatedTransactions] Batch ${pageIndex} contained 0 new records out of ${batchRows.length} returned. ` +
        `Terminating to prevent infinite loop.`
      );
      break;
    }

    from += pageSize;
  }

  // Final deterministic descending sort safety check:
  // Ensures exact sequence: date DESC, id DESC
  transactions.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.id.localeCompare(a.id);
  });

  console.log(
    `[fetchPaginatedTransactions] Completed successfully: ` +
    `${transactions.length} total transactions fetched in ${pageIndex} batch${pageIndex === 1 ? "" : "es"}. ` +
    `Duplicates filtered: ${duplicatesSkipped}.`
  );

  return {
    transactions,
    totalBatches: pageIndex,
    totalTransactions: transactions.length,
    serverReportedTotal,
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
    currentMitigation: "Stage D: Safe deterministic range pagination (fetchPaginatedTransactions)",
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
