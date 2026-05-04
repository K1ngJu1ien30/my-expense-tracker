/**
 * Spending Velocity filter logic.
 *
 * The velocity projection on Analytics computes
 * `total expense this month / days elapsed × daysInMonth`. Without
 * filtering, paying a stack of fixed bills on salary day causes the
 * projection to explode (a one-off RM 550 bill day reads as a
 * RM 5,500/month pace).
 *
 * We solve this with a two-layer rule:
 *
 *   1. **Category auto-rule (default):** transactions in the
 *      `AUTO_EXCLUDE_CATEGORIES` set are excluded automatically. This
 *      matches intuition: bills, subscriptions, utilities, and savings
 *      reserves are already accounted for via "Recurring Costs" and
 *      planning — they shouldn't be double-counted as spending velocity.
 *
 *   2. **Per-transaction override:** if a transaction has
 *      `exclude_from_velocity = true`, it's excluded regardless of
 *      category. If `false`, it's included regardless of category. Only
 *      when `null` / `undefined` does the auto-rule apply.
 *
 * This design keeps the common case ergonomic (users don't have to
 * remember to tick a box for every bill — categorisation alone does the
 * right thing) while still giving full control for edge cases.
 */

import type { Transaction } from "./types";

/**
 * Canonical set of categories that are excluded from Spending Velocity
 * by default. Case-insensitive match. Users can still opt-in individual
 * transactions via the per-row override.
 *
 * Keep in sync with the copy shown in the TransactionModal toggle.
 */
export const AUTO_EXCLUDE_CATEGORIES: ReadonlySet<string> = new Set([
  "bills",
  "subs",
  "subscription",
  "subscriptions",
  "utilities",
  "utility",
  "savings",
  "transfer",
]);

/**
 * Decide whether a single transaction should count toward Spending Velocity.
 *
 * Returns `true` when the transaction should be INCLUDED. Non-expense
 * transactions (income, transfers) are always excluded — velocity is a
 * spending-only metric.
 */
export function countsTowardVelocity(tx: Transaction): boolean {
  if (tx.type !== "Expense") return false;
  if (tx.deleted_at) return false;

  // Explicit per-transaction override wins over the category rule.
  if (tx.exclude_from_velocity === true) return false;
  if (tx.exclude_from_velocity === false) return true;

  // Fall through to the category auto-rule.
  const cat = (tx.category || "").trim().toLowerCase();
  if (AUTO_EXCLUDE_CATEGORIES.has(cat)) return false;

  return true;
}

/**
 * Convenience: filter a list of transactions to only those that count
 * toward velocity. Pure function — does not mutate input.
 */
export function filterVelocityTransactions(
  transactions: Transaction[]
): Transaction[] {
  return transactions.filter(countsTowardVelocity);
}

/**
 * Explainer string for the Analytics UI footer. Kept here so the
 * user-facing copy and the filter logic can't drift apart.
 */
export function velocityFilterExplainer(): string {
  return "Excludes Bills, Subs, Utilities, Savings, and Transfers by default. Toggle per-transaction via the edit modal.";
}
