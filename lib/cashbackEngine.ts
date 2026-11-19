// ============================================================================
// Cashback & Rewards Engine (Phase 3B)
// ============================================================================

import type {
  Account,
  CardRewardsConfig,
  CashbackRecord,
  Transaction,
} from "./types";
import { formatLocalDate, getLocalDateKeyFromIso, roundCurrency } from "./utils";

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
    referenceDateStr = formatLocalDate(),
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

  const latestStmtKey = latestStatementDate ? getLocalDateKeyFromIso(latestStatementDate) : null;
  const currentMonthPrefix = referenceDateStr.slice(0, 7);

  // Filter transactions to unbilled purchases (strictly AFTER statement calendar date)
  // or current local calendar month if no statement date
  const cardPurchases = transactions.filter((tx) => {
    if (tx.deleted_at || tx.type !== "Expense") return false;
    const matchesCard =
      tx.account_id === cardId ||
      tx.account.trim().toLowerCase() === activeCard.name.trim().toLowerCase();
    if (!matchesCard) return false;

    const txDateKey = getLocalDateKeyFromIso(tx.date);
    if (latestStmtKey) {
      return txDateKey > latestStmtKey;
    }
    return txDateKey.slice(0, 7) === currentMonthPrefix;
  });

  // Calculate qualifying spend in integer cents to eliminate threshold float drift
  const totalSpendCents = cardPurchases.reduce(
    (sum, tx) => sum + Math.round(Number(tx.amount || 0) * 100),
    0
  );
  const totalSpend = totalSpendCents / 100;
  const minSpendCents =
    minSpendThreshold !== null && minSpendThreshold !== undefined
      ? Math.round(minSpendThreshold * 100)
      : null;
  const qualifiesForMinSpend = minSpendCents === null || totalSpendCents >= minSpendCents;

  // Breakdown tracker by rule category
  const breakdownMap = new Map<
    string,
    { spendCents: number; ratePct: number; cashback: number; txCount: number }
  >();

  // Pre-index rules by lowercase category name (O(1) lookup per tx)
  const rulesByCategory = new Map<string, (typeof rules)[number]>();
  let generalRule: (typeof rules)[number] | undefined;
  for (const r of rules) {
    const key = r.category.trim().toLowerCase();
    rulesByCategory.set(key, r);
    if (!generalRule && ["general", "all", "others", "other"].includes(key)) {
      generalRule = r;
    }
  }

  for (const tx of cardPurchases) {
    const amountCents = Math.round(Number(tx.amount || 0) * 100);
    if (amountCents <= 0) continue;
    const amount = amountCents / 100;

    const txCat = (tx.category || "General").trim().toLowerCase();
    const matchedRule = rulesByCategory.get(txCat) || generalRule;

    if (matchedRule && matchedRule.ratePct > 0) {
      const catKey = matchedRule.category;
      const rate = matchedRule.ratePct;
      const cb = (amount * rate) / 100;

      const existing = breakdownMap.get(catKey) || {
        spendCents: 0,
        ratePct: rate,
        cashback: 0,
        txCount: 0,
      };

      existing.spendCents += amountCents;
      existing.cashback += cb;
      existing.txCount += 1;
      breakdownMap.set(catKey, existing);
    }
  }

  const breakdown: EstimatedCashbackBreakdown[] = Array.from(breakdownMap.entries()).map(
    ([category, data]) => ({
      category,
      spend: data.spendCents / 100,
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
    referenceDateStr = formatLocalDate(),
  } = params;

  const currentMonthPrefix = referenceDateStr.slice(0, 7); // "YYYY-MM"
  const currentYearPrefix = referenceDateStr.slice(0, 4); // "YYYY"

  const targetLower = cardIdOrName.trim().toLowerCase();
  const cardRecords = cashbackRecords.filter(
    (r) =>
      r.cardId === cardIdOrName ||
      (r.cardName || "").trim().toLowerCase() === targetLower
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
