/**
 * Monthly Recap data deriver.
 *
 * Pure function: given a transaction list + a target month, returns the
 * receipt payload. Kept separate from the rendering component so the same
 * data can power both the on-screen preview and any future exports (PDF,
 * email, etc.) without re-deriving.
 *
 * Month is addressed as `{ year, month }` where `month` is 0-indexed
 * (JavaScript convention) to match `Date`'s internals.
 */

import type { Transaction } from "./types";

export type ReceiptMonth = { year: number; month: number /* 0-indexed */ };

export type CategoryLine = {
  category: string;
  amount: number;
  /** Integer 0–100, rounded. */
  percent: number;
};

export type ReceiptPayload = {
  /** Display label, e.g. "April 2026". */
  label: string;
  /** Total days in the target month. */
  daysInMonth: number;
  /** Category breakdown, sorted descending by amount. */
  categories: CategoryLine[];
  /** Sum of all expense amounts in the month. */
  expenseTotal: number;
  /** Sum of all (cleared) income amounts in the month. */
  incomeTotal: number;
  /** Income minus expenses for the month. */
  netSaved: number;
  /** Highest single-expense amount in the month. */
  biggestSplurge: number;
  /** Longest consecutive stretch of days in the month with zero expenses. */
  quietDayStreak: number;
  /** Number of expense transactions in the month. */
  expenseCount: number;
  /** Number of distinct accounts touched during the month. */
  activeAccounts: number;
  /** Percent change vs the previous month, e.g. -12.4 means "12.4% less". */
  vsLastMonth: number | null;
  /** Stable receipt ID, derived from month — e.g. "2026-04". */
  receiptId: string;
};

/**
 * Build the receipt payload for a given month. Never throws — returns an
 * "empty" payload if the month has no data so the UI can always render.
 */
export function deriveReceiptPayload(
  transactions: Transaction[],
  target: ReceiptMonth
): ReceiptPayload {
  const monthStart = new Date(target.year, target.month, 1).getTime();
  const monthEnd = new Date(target.year, target.month + 1, 1).getTime() - 1;

  // Previous-month bounds for the comparison line.
  const prevY = target.month === 0 ? target.year - 1 : target.year;
  const prevM = target.month === 0 ? 11 : target.month - 1;
  const prevStart = new Date(prevY, prevM, 1).getTime();
  const prevEnd = new Date(prevY, prevM + 1, 1).getTime() - 1;

  const daysInMonth = new Date(target.year, target.month + 1, 0).getDate();
  const label = new Date(target.year, target.month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const receiptId = `${target.year}-${String(target.month + 1).padStart(2, "0")}`;

  // Single pass — bucket everything at once.
  const catTotals: Record<string, number> = {};
  const dayTouched = new Set<number>();
  const accounts = new Set<string>();
  let expenseTotal = 0;
  let incomeTotal = 0;
  let biggestSplurge = 0;
  let expenseCount = 0;
  let prevExpenseTotal = 0;

  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    const when = new Date(tx.date).getTime();
    const amt = Number(tx.amount);
    if (!Number.isFinite(amt)) continue;

    // In-range: contribute to this month's stats.
    if (when >= monthStart && when <= monthEnd) {
      if (tx.type === "Expense") {
        expenseTotal += amt;
        expenseCount += 1;
        if (amt > biggestSplurge) biggestSplurge = amt;
        const cat = tx.category || "Other";
        catTotals[cat] = (catTotals[cat] || 0) + amt;
        dayTouched.add(new Date(tx.date).getDate());
        if (tx.account) accounts.add(tx.account);
      } else if (tx.type === "Income" && tx.status !== "pending") {
        incomeTotal += amt;
        if (tx.account) accounts.add(tx.account);
      }
      // Transfers are intentionally excluded — they're not spend or earn.
    }

    // Previous month: only need the expense total for the comparison.
    if (when >= prevStart && when <= prevEnd && tx.type === "Expense") {
      prevExpenseTotal += amt;
    }
  }

  const categories: CategoryLine[] = Object.entries(catTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Longest run of days in the month without any expense.
  let quietDayStreak = 0;
  {
    let current = 0;
    const now = new Date();
    // Only count days up to either end-of-month or today (whichever is earlier)
    // so an in-progress month doesn't inflate the streak with unseen future days.
    const effectiveLastDay =
      target.year === now.getFullYear() && target.month === now.getMonth()
        ? now.getDate()
        : daysInMonth;
    for (let d = 1; d <= effectiveLastDay; d++) {
      if (dayTouched.has(d)) {
        current = 0;
      } else {
        current += 1;
        if (current > quietDayStreak) quietDayStreak = current;
      }
    }
  }

  const vsLastMonth =
    prevExpenseTotal > 0
      ? Math.round(((expenseTotal - prevExpenseTotal) / prevExpenseTotal) * 1000) / 10
      : null;

  return {
    label,
    daysInMonth,
    categories,
    expenseTotal,
    incomeTotal,
    netSaved: incomeTotal - expenseTotal,
    biggestSplurge,
    quietDayStreak,
    expenseCount,
    activeAccounts: accounts.size,
    vsLastMonth,
    receiptId,
  };
}
