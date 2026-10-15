// ============================================================================
// Centralized Balance Engine & Financial Accounting Core (Phase 1C)
// ============================================================================

import type {
  Account,
  AccountBalanceBreakdown,
  AccountKind,
  AccountReconciliation,
  CurrencyTotals,
  FinancialPosition,
  Transaction,
} from "./types";

/**
 * Standard baseline exchange rates against MYR (RM) representing units of MYR per 1 foreign currency.
 * Used for transparent base-currency conversion when accounts span multiple currencies and live rates are offline.
 * Formula: valueInMYR = amount * DEFAULT_EXCHANGE_RATES_TO_MYR[currency]
 */
export const DEFAULT_EXCHANGE_RATES_TO_MYR: Record<string, number> = {
  RM: 1.0,
  MYR: 1.0,
  SGD: 3.35,
  USD: 4.45,
  EUR: 4.80,
  GBP: 5.65,
  AUD: 2.90,
  CAD: 3.25,
  CHF: 4.95,
  JPY: 0.029,
  CNY: 0.62,
  HKD: 0.57,
  NZD: 2.70,
  KRW: 0.0033,
  TWD: 0.14,
  THB: 0.125,
  IDR: 0.00028,
  VND: 0.00018,
  PHP: 0.078,
  INR: 0.053,
  BND: 3.35,
};

export type RateResolution = {
  rateToMYR: number | null;
  isEstimated: boolean;
  isKnown: boolean;
};

/**
 * Resolves the exchange rate of a currency against the MYR pivot.
 * Rate represents: 1 unit of foreign currency = X MYR.
 *
 * Supports:
 * - Direct MYR/RM identity (1.0, not estimated).
 * - customRates (where value is MYR per foreign unit).
 * - liveRates (where value is foreign units per 1 MYR, as returned by open.er-api.com/v6/latest/MYR;
 *   hence 1 foreign unit = 1 / liveRates[currency] MYR).
 * - DEFAULT_EXCHANGE_RATES_TO_MYR fallback table.
 *
 * IMPORTANT: NEVER silently treat an unknown currency as 1:1 with MYR!
 * If unknown, rateToMYR is null and isKnown is false.
 */
export function resolveRateToMYR(
  currency: string,
  options?: {
    customRates?: Record<string, number>;
    liveRates?: Record<string, number>;
  }
): RateResolution {
  const cur = (currency || "RM").trim().toUpperCase();
  if (cur === "RM" || cur === "MYR") {
    return { rateToMYR: 1.0, isEstimated: false, isKnown: true };
  }

  // 1. Check custom rates (explicit user or test overrides: MYR per unit)
  if (
    options?.customRates &&
    typeof options.customRates[cur] === "number" &&
    !isNaN(options.customRates[cur]) &&
    options.customRates[cur] > 0
  ) {
    return { rateToMYR: options.customRates[cur], isEstimated: true, isKnown: true };
  }

  // 2. Check live rates from open.er-api.com (base is MYR, so liveRates[cur] = foreign units per 1 MYR)
  // For example: liveRates["USD"] = 0.2247 -> 1 USD = 1 / 0.2247 = 4.45038 MYR
  if (
    options?.liveRates &&
    typeof options.liveRates[cur] === "number" &&
    options.liveRates[cur] > 0
  ) {
    return { rateToMYR: 1 / options.liveRates[cur], isEstimated: true, isKnown: true };
  }

  // 3. Check fallback baseline rate table
  if (
    typeof DEFAULT_EXCHANGE_RATES_TO_MYR[cur] === "number" &&
    !isNaN(DEFAULT_EXCHANGE_RATES_TO_MYR[cur])
  ) {
    return { rateToMYR: DEFAULT_EXCHANGE_RATES_TO_MYR[cur], isEstimated: true, isKnown: true };
  }

  // 4. Unknown currency rate — do NOT assume 1:1!
  return { rateToMYR: null, isEstimated: true, isKnown: false };
}

export type CurrencyConversionResult = {
  amount: number;
  isEstimated: boolean;
  isKnown: boolean;
};

/**
 * Converts an amount from one currency to another using high-precision rate resolution.
 * If either currency has an unknown exchange rate, it preserves the original nominal amount
 * but flags isKnown = false to prevent silent financial misreporting.
 */
export function convertCurrencySafe(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  options?: {
    customRates?: Record<string, number>;
    liveRates?: Record<string, number>;
  }
): CurrencyConversionResult {
  const from = (fromCurrency || "RM").trim().toUpperCase();
  const to = (toCurrency || "RM").trim().toUpperCase();

  if (from === to || amount === 0) {
    return { amount, isEstimated: false, isKnown: true };
  }

  const fromResolution = resolveRateToMYR(from, options);
  const toResolution = resolveRateToMYR(to, options);

  if (
    !fromResolution.isKnown ||
    fromResolution.rateToMYR === null ||
    !toResolution.isKnown ||
    toResolution.rateToMYR === null
  ) {
    // Cannot accurately convert without an exchange rate: preserve nominal, flag as unknown
    return { amount, isEstimated: true, isKnown: false };
  }

  // Value in MYR = amount * fromRateToMYR
  // Value in Target = valueInMYR / toRateToMYR
  const valueInPivot = amount * fromResolution.rateToMYR;
  const converted = valueInPivot / toResolution.rateToMYR;

  return {
    amount: converted,
    isEstimated: fromResolution.isEstimated || toResolution.isEstimated,
    isKnown: true,
  };
}

/**
 * Backward-compatible helper for simple conversion calls.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRates?: Record<string, number>,
  liveRates?: Record<string, number>
): number {
  return convertCurrencySafe(amount, fromCurrency, toCurrency, { customRates, liveRates }).amount;
}

/**
 * Internal cents accumulator for high-precision integer accounting.
 */
type InternalAccountAccumulator = {
  account: Account;
  openingBalanceCents: number;
  incomeCents: number;
  expenseCents: number;
  transfersInCents: number;
  transfersOutCents: number;
  transactionCount: number;
};

/**
 * Pure calculation function: computes full balance breakdown for each account.
 * Uses integer cents arithmetic to eliminate floating-point drift.
 * Matches transactions using stable `account_id` / `to_account_id` with fallback to case-insensitive name.
 */
export function calculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): {
  breakdowns: AccountBalanceBreakdown[];
  balancesByName: Record<string, number>;
  balancesById: Record<string, number>;
  orphanedTransactions: Transaction[];
} {
  // 1. Build lookup tables for official accounts
  const idToAcc = new Map<string, Account>();
  const nameToAcc = new Map<string, Account>();
  const accumulators = new Map<string, InternalAccountAccumulator>();

  for (const acc of accounts) {
    const accKey = acc.id || acc.name.trim().toLowerCase();
    idToAcc.set(accKey, acc);
    if (acc.id) idToAcc.set(acc.id, acc);
    nameToAcc.set(acc.name.trim().toLowerCase(), acc);

    const openingCents = Math.round(Number(acc.openingBalance || 0) * 100);
    accumulators.set(accKey, {
      account: acc,
      openingBalanceCents: openingCents,
      incomeCents: 0,
      expenseCents: 0,
      transfersInCents: 0,
      transfersOutCents: 0,
      transactionCount: 0,
    });
  }

  // Helper to find accumulator for a transaction account reference
  const findAccumulator = (id?: string, name?: string): InternalAccountAccumulator | undefined => {
    if (id && accumulators.has(id)) return accumulators.get(id);
    if (name) {
      const lower = name.trim().toLowerCase();
      const matched = nameToAcc.get(lower);
      if (matched) {
        const key = matched.id || matched.name.trim().toLowerCase();
        return accumulators.get(key);
      }
    }
    return undefined;
  };

  const orphanedTransactions: Transaction[] = [];

  // 2. Process all transactions in a single linear pass
  for (const tx of transactions) {
    if (tx.deleted_at) continue;

    const amtCents = Math.round(Number(tx.amount || 0) * 100);
    if (isNaN(amtCents) || amtCents === 0) continue;

    const sourceAcc = findAccumulator(tx.account_id, tx.account);

    if (tx.type === "Income") {
      // Pending income does not affect cleared balance until cleared
      if (tx.status !== "pending") {
        if (sourceAcc) {
          sourceAcc.incomeCents += amtCents;
          sourceAcc.transactionCount += 1;
        } else {
          orphanedTransactions.push(tx);
        }
      }
    } else if (tx.type === "Expense") {
      if (sourceAcc) {
        sourceAcc.expenseCents += amtCents;
        sourceAcc.transactionCount += 1;
      } else {
        orphanedTransactions.push(tx);
      }
    } else if (tx.type === "Transfer") {
      const destAcc = findAccumulator(tx.to_account_id, tx.to_account);
      if (sourceAcc) {
        sourceAcc.transfersOutCents += amtCents;
        sourceAcc.transactionCount += 1;
      }
      if (destAcc) {
        destAcc.transfersInCents += amtCents;
        destAcc.transactionCount += 1;
      }
      if (!sourceAcc && !destAcc) {
        orphanedTransactions.push(tx);
      }
    }
  }

  // 3. Assemble breakdowns
  const breakdowns: AccountBalanceBreakdown[] = [];
  const balancesByName: Record<string, number> = {};
  const balancesById: Record<string, number> = {};

  for (const [, accData] of accumulators) {
    const acc = accData.account;
    const isCredit = acc.kind === "credit_card";

    // For standard accounts:
    // current = opening + income - expenses + transfersIn - transfersOut
    // For credit cards:
    // Expenses increase debt, transfers in decrease debt (repayment)
    // Standard signed balance: negative means money owed.
    const netCents =
      accData.openingBalanceCents +
      accData.incomeCents -
      accData.expenseCents +
      accData.transfersInCents -
      accData.transfersOutCents;

    const currentBalance = netCents / 100;

    const breakdown: AccountBalanceBreakdown = {
      accountId: acc.id || acc.name,
      accountName: acc.name,
      currency: acc.currencyCode || "RM",
      kind: acc.kind || (isCredit ? "credit_card" : "bank"),
      isArchived: acc.isArchived ?? false,
      openingBalance: accData.openingBalanceCents / 100,
      totalIncome: accData.incomeCents / 100,
      totalExpenses: accData.expenseCents / 100,
      totalTransfersIn: accData.transfersInCents / 100,
      totalTransfersOut: accData.transfersOutCents / 100,
      currentBalance,
      transactionCount: accData.transactionCount,
    };

    breakdowns.push(breakdown);
    balancesByName[acc.name] = currentBalance;
    if (acc.id) balancesById[acc.id] = currentBalance;
  }

  return {
    breakdowns,
    balancesByName,
    balancesById,
    orphanedTransactions,
  };
}

/**
 * Determines whether an account should be treated as a savings account.
 * Supports explicit account kind "savings" as well as legacy accounts
 * where kind was not set or set to "bank" but the account name contains "saving".
 * Explicit non-savings kinds (e.g. "credit_card", "investment") are never treated as savings.
 */
export function isSavingsAccount(account: {
  kind?: AccountKind | string;
  name?: string;
  accountName?: string;
}): boolean {
  if (account.kind === "savings") return true;
  if (account.kind && account.kind !== "bank") return false;
  const name = (account.name || account.accountName || "").toLowerCase();
  return name.includes("saving");
}

/**
 * Computes consolidated multi-currency financial position across all active accounts.
 *
 * Distinct Accounting Concepts:
 * 1. Available Cash: Liquid operational accounts (Bank, Cash, E-Wallet).
 *    (Plus Savings if includeSavings is explicitly enabled).
 * 2. Dedicated Savings: Savings accounts.
 * 3. Investments: Investment accounts.
 * 4. Liabilities: Outstanding credit card balances / debt.
 * 5. Net Financial Position: (Cash + Savings + Investments) - Liabilities (Full all-assets net worth).
 * 6. Net Total: Display total respecting includeSavings preference.
 */
export function calculateFinancialPosition(
  accounts: Account[],
  transactions: Transaction[],
  options?: {
    includeSavings?: boolean;
    baseCurrency?: string;
    customRates?: Record<string, number>;
    liveRates?: Record<string, number>;
  }
): FinancialPosition {
  const includeSavings = options?.includeSavings ?? false;
  const baseCurrency = (options?.baseCurrency || "RM").trim().toUpperCase();

  const { breakdowns, balancesByName } = calculateAccountBalances(accounts, transactions);

  // Group by currency
  const byCurrency: Record<string, CurrencyTotals> = {};
  const activeCurrencies = new Set<string>();
  const unconvertedCurrenciesSet = new Set<string>();

  let totalAvailableCashBase = 0;
  let totalSavingsBase = 0;
  let totalInvestmentsBase = 0;
  let totalLiabilitiesBase = 0;
  let totalCreditAssetsBase = 0;
  let isEstimatedConversion = false;

  const activeBreakdowns: AccountBalanceBreakdown[] = [];
  const archivedBreakdowns: AccountBalanceBreakdown[] = [];

  for (const item of breakdowns) {
    if (item.isArchived) {
      archivedBreakdowns.push(item);
      continue;
    }
    activeBreakdowns.push(item);

    const cur = (item.currency || baseCurrency).trim().toUpperCase();
    activeCurrencies.add(cur);

    if (!byCurrency[cur]) {
      byCurrency[cur] = {
        currency: cur,
        availableCash: 0,
        savings: 0,
        investments: 0,
        liabilities: 0,
        creditAssets: 0,
        netFinancialPosition: 0,
        netTotal: 0,
        accountCount: 0,
      };
    }

    const curTotals = byCurrency[cur];
    curTotals.accountCount += 1;

    const isSavings = isSavingsAccount(item);
    const kind: AccountKind = isSavings ? "savings" : (item.kind || "bank");
    const bal = item.currentBalance;

    // Helper for converting amount to base currency with tracking
    const toBase = (amount: number): number => {
      if (amount === 0) return 0;
      const res = convertCurrencySafe(amount, cur, baseCurrency, {
        customRates: options?.customRates,
        liveRates: options?.liveRates,
      });
      if (res.isEstimated) isEstimatedConversion = true;
      if (!res.isKnown) {
        unconvertedCurrenciesSet.add(cur);
        // Exclude unconverted nominal amounts from consolidated base-currency totals
        // to prevent mathematical corruption (e.g. adding 1,000,000 JPY to MYR/USD base total).
        // Native amounts remain accurately tracked and displayed in byCurrency[cur].
        return 0;
      }
      return res.amount;
    };

    if (kind === "credit_card") {
      // Credit cards are liabilities when negative balance (-200 means debt of 200).
      // If balance is positive (+50 e.g. overpayment/refund/cashback), liability is 0, credit asset is 50.
      if (bal < 0) {
        const debt = Math.abs(bal);
        curTotals.liabilities += debt;
        curTotals.netFinancialPosition -= debt;
        curTotals.netTotal -= debt;

        totalLiabilitiesBase += toBase(debt);
      } else if (bal > 0) {
        curTotals.creditAssets = (curTotals.creditAssets || 0) + bal;
        curTotals.netFinancialPosition += bal;
        curTotals.netTotal += bal;

        totalCreditAssetsBase += toBase(bal);
      }
    } else if (kind === "savings") {
      curTotals.savings += bal;
      // All-assets Net Financial Position ALWAYS includes dedicated savings (true net worth)
      curTotals.netFinancialPosition += bal;
      totalSavingsBase += toBase(bal);

      if (includeSavings) {
        curTotals.availableCash += bal;
        curTotals.netTotal += bal;
        totalAvailableCashBase += toBase(bal);
      }
    } else if (kind === "investment") {
      curTotals.investments += bal;
      curTotals.netFinancialPosition += bal;
      curTotals.netTotal += bal;
      totalInvestmentsBase += toBase(bal);
    } else {
      // Liquid operational cash: bank, cash, ewallet
      curTotals.availableCash += bal;
      curTotals.netFinancialPosition += bal;
      curTotals.netTotal += bal;
      totalAvailableCashBase += toBase(bal);
    }
  }

  // All-assets net financial position in base currency: (Liquid Cash + Savings + Investments + Credit Assets) - Liabilities
  // Represents full accounting net worth
  const liquidCashBase = includeSavings ? (totalAvailableCashBase - totalSavingsBase) : totalAvailableCashBase;
  const netFinancialPositionBase =
    liquidCashBase +
    totalSavingsBase +
    totalInvestmentsBase +
    totalCreditAssetsBase -
    totalLiabilitiesBase;

  // Display Net Total: strictly respects includeSavings preference
  // When includeSavings is OFF: Liquid Cash + Investments + Credit Assets - Liabilities (Excludes Savings)
  // When includeSavings is ON: Liquid Cash + Savings + Investments + Credit Assets - Liabilities (Includes Savings once)
  const netTotalBase =
    liquidCashBase +
    (includeSavings ? totalSavingsBase : 0) +
    totalInvestmentsBase +
    totalCreditAssetsBase -
    totalLiabilitiesBase;

  return {
    accountBalances: balancesByName,
    breakdownList: activeBreakdowns,
    archivedBreakdownList: archivedBreakdowns,
    availableCash: Math.round(totalAvailableCashBase * 100) / 100,
    totalSavings: Math.round(totalSavingsBase * 100) / 100,
    totalInvestments: Math.round(totalInvestmentsBase * 100) / 100,
    totalLiabilities: Math.round(totalLiabilitiesBase * 100) / 100,
    totalCreditAssets: Math.round(totalCreditAssetsBase * 100) / 100,
    netFinancialPosition: Math.round(netFinancialPositionBase * 100) / 100,
    netTotal: Math.round(netTotalBase * 100) / 100,
    isMultiCurrency: activeCurrencies.size > 1,
    byCurrency,
    currencies: Array.from(activeCurrencies),
    isEstimatedConversion,
    hasUnknownCurrencyRates: unconvertedCurrenciesSet.size > 0,
    unconvertedCurrencies: Array.from(unconvertedCurrenciesSet),
  };
}

/**
 * Convenience helper for the Salary Planner and Quick Balance views:
 * Returns the liquid available cash balance (in base currency or target currency).
 */
export function calculateAvailableCash(
  accounts: Account[],
  transactions: Transaction[],
  includeSavings: boolean = false,
  targetCurrency?: string,
  liveRates?: Record<string, number>
): number {
  const position = calculateFinancialPosition(accounts, transactions, {
    includeSavings,
    baseCurrency: targetCurrency || "RM",
    liveRates,
  });
  return position.availableCash;
}

/**
 * Reconciles an individual account's balance:
 * Validates opening balance, transaction delta, and checks for unlinked transactions.
 */
export function reconcileAccount(
  account: Account,
  transactions: Transaction[]
): AccountReconciliation {
  const { breakdowns, orphanedTransactions } = calculateAccountBalances([account], transactions);
  const bd = breakdowns[0];

  const opening = Number(account.openingBalance || 0);
  const calculated = bd ? bd.currentBalance : opening;

  // Unlinked transactions referring to this account's name or ID that weren't captured
  const unlinked = orphanedTransactions.filter(
    (t) =>
      t.account_id === account.id ||
      t.to_account_id === account.id ||
      t.account.toLowerCase() === account.name.toLowerCase() ||
      t.to_account?.toLowerCase() === account.name.toLowerCase()
  );

  return {
    accountId: account.id || account.name,
    accountName: account.name,
    currency: account.currencyCode || "RM",
    kind: account.kind || "bank",
    openingBalance: opening,
    calculatedBalance: calculated,
    transactionCount: bd ? bd.transactionCount : 0,
    orphanedTransactionCount: unlinked.length,
    isBalanced: unlinked.length === 0,
  };
}
