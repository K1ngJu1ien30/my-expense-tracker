/**
 * Quick-Templates deriver.
 *
 * Scans the last 30 days of transactions and surfaces the user's top-N most
 * frequent (category, amount, account, note-seed) combinations. These are
 * one-tap buttons exposed on long-press of the + FAB: "Morning coffee RM 8",
 * "Gas RM 50", etc.
 *
 * Design:
 *   • Derived — not stored. Recomputed on every long-press so it's always
 *     in sync with the user's current behaviour without a schema change.
 *   • Similar-amount clustering — "RM 7.50" and "RM 8" buying coffee are
 *     the same intent. We bucket amounts to the nearest whole unit for
 *     grouping, then take the median of the bucket as the suggested value.
 *   • Only expenses. Incomes and transfers have too few per-user patterns
 *     to benefit, and surfacing them confuses the one-tap affordance.
 */

import type { Transaction } from "./types";

export type QuickTemplate = {
  id: string;
  amount: number;
  category: string;
  account: string;
  note: string;
  /** How many transactions in the last 30 days matched this pattern. */
  frequency: number;
};

const LOOKBACK_DAYS = 30;
const MAX_TEMPLATES = 4;
const MIN_FREQUENCY = 2;

/**
 * Derive quick templates from a transaction list. Safe to call on every
 * long-press — the cost is O(n) in the number of recent transactions.
 */
export function deriveQuickTemplates(transactions: Transaction[]): QuickTemplate[] {
  if (!transactions || transactions.length === 0) return [];

  const cutoff = Date.now() - LOOKBACK_DAYS * 86400000;

  // Bucket key: "category|account|roundedAmount" — roundedAmount clusters
  // similar-priced purchases into one suggestion.
  const buckets = new Map<
    string,
    { amounts: number[]; notes: string[]; category: string; account: string }
  >();

  for (const tx of transactions) {
    if (tx.type !== "Expense") continue;
    if (tx.deleted_at) continue;
    const when = new Date(tx.date).getTime();
    if (when < cutoff) continue;

    const amt = Number(tx.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;

    const bucket = `${(tx.category || "").toLowerCase()}|${(tx.account || "").toLowerCase()}|${Math.round(amt)}`;

    if (!buckets.has(bucket)) {
      buckets.set(bucket, {
        amounts: [],
        notes: [],
        category: tx.category || "General",
        account: tx.account || "",
      });
    }
    const b = buckets.get(bucket)!;
    b.amounts.push(amt);
    if (tx.note) b.notes.push(tx.note);
  }

  // Rank buckets by frequency. Break ties by recency-weighted count (the
  // amounts array length already captures count; to respect recency, we
  // could scan once more but it's not worth the complexity for top-4).
  const templates: QuickTemplate[] = Array.from(buckets.entries())
    .map(([key, b]) => {
      // Median amount is robust to one-off outliers within the bucket.
      const sorted = [...b.amounts].sort((x, y) => x - y);
      const median = sorted[Math.floor(sorted.length / 2)];
      // Most frequent note in the bucket — if any two tied, take the first.
      const noteCounts = b.notes.reduce<Record<string, number>>((acc, n) => {
        const norm = n.trim();
        if (!norm) return acc;
        acc[norm] = (acc[norm] || 0) + 1;
        return acc;
      }, {});
      const topNote = Object.entries(noteCounts).sort((a, z) => z[1] - a[1])[0]?.[0] || "";
      return {
        id: key,
        amount: Math.round(median * 100) / 100,
        category: b.category,
        account: b.account,
        note: topNote,
        frequency: b.amounts.length,
      };
    })
    .filter((t) => t.frequency >= MIN_FREQUENCY)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_TEMPLATES);

  return templates;
}
