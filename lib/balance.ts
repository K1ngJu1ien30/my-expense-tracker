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
 * Standard baseline exchange rates against MYR (RM).
 * Used for transparent base-currency conversion when accounts span multiple currencies.
 */
export const DEFAULT_EXCHANGE_RATES_TO_MYR: Record<string, number> = {
  RM: 1.0,
  MYR: 1.0,
  SGD: 3.35,
  USD: 4.45,
  JPY: 0.029,
  EUR: 4.75,
  GBP: 5.60,
  THB: 0.125,
  IDR: 0.00028,
};

/**
 * Converts an amount from one currency to another using the standard rate table
 * or custom user-provided rates.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRates?: Record<string, number>
): number {
  const from = (fromCurrency || "RM").trim().toUpperCase();
  const to = (toCurrency || "RM").trim().toUpperCase();
  if (from === to || amount === 0) return amount;

  const rates = { ...DEFAULT_EXCHANGE_RATES_TO_MYR, ...customRates };
  const fromRate = rates[from] ?? 1.0;
  const toRate = rates[to] ?? 1.0;

  // Convert via MYR/RM pivot: amount * fromRate = value in MYR, then / toRate = value in target
  const valueInPivot = amount * fromRate;
  return valueInPivot / toRate;
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
 * Calculates the comprehensive Financial Position across all accounts.
 *
 * Distinct Accounting Concepts:
 * 1. Available Cash: Liquid operational accounts (Bank, Cash, E-Wallet).
 *    (Plus Savings if includeSavings is explicitly enabled).
 * 2. Dedicated Savings: Savings accounts.
 * 3. Investments: Investment accounts.
 * 4. Liabilities: Outstanding credit card balances / debt.
 * 5. Net Financial Position: (Cash + Savings + Investments) - Liabilities.
 */
export function calculateFinancialPosition(
  accounts: Account[],
  transactions: Transaction[],
  options?: {
    includeSavings?: boolean;
    baseCurrency?: string;
  }
): FinancialPosition {
  const includeSavings = options?.includeSavings ?? false;
  const baseCurrency = (options?.baseCurrency || "RM").trim().toUpperCase();

  const { breakdowns, balancesByName } = calculateAccountBalances(accounts, transactions);

  // Group by currency
  const byCurrency: Record<string, CurrencyTotals> = {};
  const activeCurrencies = new Set<string>();

  let totalAvailableCashBase = 0;
  let totalSavingsBase = 0;
  let totalInvestmentsBase = 0;
  let totalLiabilitiesBase = 0;

  for (const item of breakdowns) {
    if (item.isArchived) continue;

    const cur = (item.currency || baseCurrency).trim().toUpperCase();
    activeCurrencies.add(cur);

    if (!byCurrency[cur]) {
      byCurrency[cur] = {
        currency: cur,
        availableCash: 0,
        savings: 0,
        investments: 0,
        liabilities: 0,
        netFinancialPosition: 0,
        accountCount: 0,
      };
    }

    const curTotals = byCurrency[cur];
    curTotals.accountCount += 1;

    const kind: AccountKind = item.kind || "bank";
    const bal = item.currentBalance;

    if (kind === "credit_card") {
      // Credit cards are liabilities. If balance is negative (-200), liability magnitude is 200.
      // If balance is positive (+50 e.g. overpayment/refund), liability is 0, credit asset is 50.
      if (bal < 0) {
        const debt = Math.abs(bal);
        curTotals.liabilities += debt;
        curTotals.netFinancialPosition -= debt;

        totalLiabilitiesBase += convertCurrency(debt, cur, baseCurrency);
      } else {
        curTotals.netFinancialPosition += bal;
      }
    } else if (kind === "savings") {
      curTotals.savings += bal;
      curTotals.netFinancialPosition += bal;
      totalSavingsBase += convertCurrency(bal, cur, baseCurrency);

      if (includeSavings) {
        curTotals.availableCash += bal;
        totalAvailableCashBase += convertCurrency(bal, cur, baseCurrency);
      }
    } else if (kind === "investment") {
      curTotals.investments += bal;
      curTotals.netFinancialPosition += bal;
      totalInvestmentsBase += convertCurrency(bal, cur, baseCurrency);
    } else {
      // Liquid operational cash: bank, cash, ewallet
      curTotals.availableCash += bal;
      curTotals.netFinancialPosition += bal;
      totalAvailableCashBase += convertCurrency(bal, cur, baseCurrency);
    }
  }

  // Net financial position in base currency: Assets - Liabilities
  const netFinancialPositionBase =
    totalAvailableCashBase +
    (includeSavings ? 0 : totalSavingsBase) +
    totalInvestmentsBase -
    totalLiabilitiesBase;

  return {
    accountBalances: balancesByName,
    breakdownList: breakdowns,
    availableCash: Math.round(totalAvailableCashBase * 100) / 100,
    totalSavings: Math.round(totalSavingsBase * 100) / 100,
    totalInvestments: Math.round(totalInvestmentsBase * 100) / 100,
    totalLiabilities: Math.round(totalLiabilitiesBase * 100) / 100,
    netFinancialPosition: Math.round(netFinancialPositionBase * 100) / 100,
    isMultiCurrency: activeCurrencies.size > 1,
    byCurrency,
    currencies: Array.from(activeCurrencies),
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
  targetCurrency?: string
): number {
  const position = calculateFinancialPosition(accounts, transactions, {
    includeSavings,
    baseCurrency: targetCurrency || "RM",
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
