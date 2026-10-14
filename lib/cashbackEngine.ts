// ============================================================================
// Cashback & Rewards Engine (Phase 3B)
// ============================================================================

import type {
  Account,
  CardRewardsConfig,
  CashbackRecord,
  Transaction,
} from "./types";
import { roundCurrency } from "./utils";

export type EstimatedCashbackBreakdown = {
  category: string;
  spend: number;
  ratePct: number;
  cashback: number;
  txCount: number;
};

export type EstimatedCashbackResult = {
  totalEstimated: number;
  rawEstimated: number;
  qualifyingSpend: number;
  breakdown: EstimatedCashbackBreakdown[];
  isCapped: boolean;
  monthlyCap: number | null;
  qualifiesForMinSpend: boolean;
  minSpendThreshold: number | null;
};

export type ConfirmedCashbackResult = {
  confirmedThisMonth: number;
  confirmedYTD: number;
  totalCredited: number;
  recordsCount: number;
};

/**
 * Default starter rewards template if user wants one-click setup.
 */
export const DEFAULT_CASHBACK_RULES = [
  { category: "Dining", ratePct: 5.0 },
  { category: "Groceries", ratePct: 2.0 },
  { category: "Petrol", ratePct: 5.0 },
  { category: "General", ratePct: 0.5 },
];

/**
 * Pure function: calculates estimated cashback on unbilled/current cycle purchases
 * based on card-specific reward rates and optional monthly caps.
 *
 * NOTE: Estimated cashback is purely informational and NEVER affects ledger balances
 * until explicitly credited by the user.
 */
export function calculateEstimatedCashback(params: {
  activeCard: Account;
  transactions: Transaction[];
  config?: CardRewardsConfig | null;
  latestStatementDate?: string | null;
  referenceDateStr?: string;
}): EstimatedCashbackResult {
  const {
    activeCard,
    transactions,
    config,
    latestStatementDate,
    referenceDateStr = new Date().toISOString().split("T")[0],
  } = params;

  const cardId = activeCard.id || activeCard.name;
  const isEnabled = config ? config.isEnabled : false;
  const rules = config?.rules && config.rules.length > 0 ? config.rules : [];
  const monthlyCap = config?.monthlyCap ?? null;
  const minSpendThreshold = config?.minSpendThreshold ?? null;

  if (!isEnabled || rules.length === 0) {
    return {
      totalEstimated: 0,
      rawEstimated: 0,
      qualifyingSpend: 0,
      breakdown: [],
      isCapped: false,
      monthlyCap,
      qualifiesForMinSpend: true,
      minSpendThreshold,
    };
  }

  // Filter transactions to unbilled purchases or current calendar month if no statement date
  const cardPurchases = transactions.filter((tx) => {
    if (tx.deleted_at || tx.type !== "Expense") return false;
    const matchesCard =
      tx.account_id === cardId ||
      tx.account.trim().toLowerCase() === activeCard.name.trim().toLowerCase();
    if (!matchesCard) return false;

    if (latestStatementDate) {
      return new Date(tx.date) > new Date(latestStatementDate);
    }

    // Default to current calendar month (YYYY-MM)
    const txPrefix = tx.date.slice(0, 7);
    const currentPrefix = referenceDateStr.slice(0, 7);
    return txPrefix === currentPrefix;
  });

  // Calculate qualifying spend
  const totalSpend = cardPurchases.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const qualifiesForMinSpend =
    minSpendThreshold === null || minSpendThreshold === undefined || totalSpend >= minSpendThreshold;

  // Breakdown tracker by rule category
  const breakdownMap = new Map<
    string,
    { spend: number; ratePct: number; cashback: number; txCount: number }
  >();

  // Find general fallback rule if defined
  const generalRule = rules.find((r) =>
    ["general", "all", "others", "other"].includes(r.category.trim().toLowerCase())
  );

  for (const tx of cardPurchases) {
    const amount = Number(tx.amount || 0);
    if (amount <= 0) continue;

    const txCat = (tx.category || "General").trim().toLowerCase();

    // Match rule by category name
    const matchedRule =
      rules.find((r) => r.category.trim().toLowerCase() === txCat) || generalRule;

    if (matchedRule && matchedRule.ratePct > 0) {
      const catKey = matchedRule.category;
      const rate = matchedRule.ratePct;
      const cb = (amount * rate) / 100;

      const existing = breakdownMap.get(catKey) || {
        spend: 0,
        ratePct: rate,
        cashback: 0,
        txCount: 0,
      };

      existing.spend += amount;
      existing.cashback += cb;
      existing.txCount += 1;
      breakdownMap.set(catKey, existing);
    }
  }

  const breakdown: EstimatedCashbackBreakdown[] = Array.from(breakdownMap.entries()).map(
    ([category, data]) => ({
      category,
      spend: roundCurrency(data.spend),
      ratePct: data.ratePct,
      cashback: roundCurrency(data.cashback),
      txCount: data.txCount,
    })
  );

  const rawEstimated = roundCurrency(
    breakdown.reduce((sum, item) => sum + item.cashback, 0)
  );

  let totalEstimated = rawEstimated;
  let isCapped = false;

  if (!qualifiesForMinSpend) {
    totalEstimated = 0;
  } else if (monthlyCap !== null && monthlyCap !== undefined && monthlyCap > 0) {
    if (totalEstimated > monthlyCap) {
      totalEstimated = monthlyCap;
      isCapped = true;
    }
  }

  return {
    totalEstimated: roundCurrency(totalEstimated),
    rawEstimated,
    qualifyingSpend: roundCurrency(totalSpend),
    breakdown,
    isCapped,
    monthlyCap,
    qualifiesForMinSpend,
    minSpendThreshold,
  };
}

/**
 * Pure function: calculates confirmed cashback totals across time windows
 * for an active card.
 */
export function calculateConfirmedCashback(params: {
  cardIdOrName: string;
  cashbackRecords: CashbackRecord[];
  referenceDateStr?: string;
}): ConfirmedCashbackResult {
  const {
    cardIdOrName,
    cashbackRecords,
    referenceDateStr = new Date().toISOString().split("T")[0],
  } = params;

  const currentMonthPrefix = referenceDateStr.slice(0, 7); // "YYYY-MM"
  const currentYearPrefix = referenceDateStr.slice(0, 4); // "YYYY"

  const cardRecords = cashbackRecords.filter(
    (r) =>
      r.cardId === cardIdOrName ||
      r.cardName.trim().toLowerCase() === cardIdOrName.trim().toLowerCase()
  );

  let confirmedThisMonth = 0;
  let confirmedYTD = 0;
  let totalCredited = 0;

  for (const r of cardRecords) {
    const amt = Number(r.amount || 0);
    totalCredited += amt;

    if (r.date.startsWith(currentMonthPrefix)) {
      confirmedThisMonth += amt;
    }
    if (r.date.startsWith(currentYearPrefix)) {
      confirmedYTD += amt;
    }
  }

  return {
    confirmedThisMonth: roundCurrency(confirmedThisMonth),
    confirmedYTD: roundCurrency(confirmedYTD),
    totalCredited: roundCurrency(totalCredited),
    recordsCount: cardRecords.length,
  };
}
