// ============================================================================
// Account Financial Integrity & Dependency Verification Engine (Stage C)
// ============================================================================

import type {
  Account,
  CreditCardPayment,
  CreditCardStatement,
  Subscription,
  Transaction,
  CashbackRecord,
} from "./types";

export type AccountDependencyCounts = {
  transactions: number;
  statements: number;
  payments: number;
  subscriptions: number;
  cashback: number;
  total: number;
};

export type AccountDependencyResult = {
  canDelete: boolean;
  hasDependencies: boolean;
  counts: AccountDependencyCounts;
  reason?: string;
  breakdownText: string;
};

/**
 * Pure function: rigorously audits all active and historical financial records
 * linked to an account before allowing deletion.
 *
 * An account cannot be deleted if it has:
 *  - Transactions (as source account or destination transfer account)
 *  - Credit card billing statements
 *  - Credit card repayments (as card or as source bank account)
 *  - Active or recurring bills / subscriptions
 *  - Cashback reward records
 */
export function checkAccountDependencies(
  account: Account,
  contextData: {
    transactions: Transaction[];
    statements?: CreditCardStatement[];
    creditCardPayments?: CreditCardPayment[];
    subscriptions?: Subscription[];
    utilities?: Subscription[];
    cashbackRecords?: CashbackRecord[];
  }
): AccountDependencyResult {
  const {
    transactions = [],
    statements = [],
    creditCardPayments = [],
    subscriptions = [],
    utilities = [],
    cashbackRecords = [],
  } = contextData;

  const accId = account.id;
  const accNameLower = account.name ? account.name.trim().toLowerCase() : "";

  // 1. Transactions check (source or destination, active or soft-deleted)
  const transactionCount = transactions.filter((t) => {
    if (accId && (t.account_id === accId || t.to_account_id === accId)) return true;
    const fromName = t.account ? t.account.trim().toLowerCase() : "";
    const toName = t.to_account ? t.to_account.trim().toLowerCase() : "";
    return fromName === accNameLower || toName === accNameLower;
  }).length;

  // 2. Statements check (for credit cards)
  const statementCount = statements.filter((s) => {
    if (accId && s.accountId === accId) return true;
    return s.accountId?.trim().toLowerCase() === accNameLower;
  }).length;

  // 3. Payments check (as card or as source bank account)
  const paymentCount = creditCardPayments.filter((p) => {
    if (accId && (p.accountId === accId || p.sourceAccountId === accId)) return true;
    const cardIdLower = p.accountId ? p.accountId.trim().toLowerCase() : "";
    const srcIdLower = p.sourceAccountId ? p.sourceAccountId.trim().toLowerCase() : "";
    return cardIdLower === accNameLower || srcIdLower === accNameLower;
  }).length;

  // 4. Subscriptions & Utilities check
  const allSubs = [...subscriptions, ...utilities];
  const subscriptionCount = allSubs.filter((sub) => {
    if (accId && sub.source_account_id === accId) return true;
    const src = sub.sourceAccount ? sub.sourceAccount.trim().toLowerCase() : "";
    return src === accNameLower;
  }).length;

  // 5. Cashback records check
  const cashbackCount = cashbackRecords.filter((cb) => {
    if (accId && (cb.cardId === accId || cb.destinationAccountId === accId)) return true;
    const cardLower = cb.cardName ? cb.cardName.trim().toLowerCase() : "";
    const destLower = cb.destinationAccountName ? cb.destinationAccountName.trim().toLowerCase() : "";
    return cardLower === accNameLower || destLower === accNameLower;
  }).length;

  const total =
    transactionCount +
    statementCount +
    paymentCount +
    subscriptionCount +
    cashbackCount;

  const hasDependencies = total > 0;
  const canDelete = !hasDependencies;

  const parts: string[] = [];
  if (transactionCount > 0) {
    parts.push(`${transactionCount} transaction${transactionCount === 1 ? "" : "s"}`);
  }
  if (statementCount > 0) {
    parts.push(`${statementCount} statement${statementCount === 1 ? "" : "s"}`);
  }
  if (paymentCount > 0) {
    parts.push(`${paymentCount} payment${paymentCount === 1 ? "" : "s"}`);
  }
  if (subscriptionCount > 0) {
    parts.push(`${subscriptionCount} recurring bill${subscriptionCount === 1 ? "" : "s"}`);
  }
  if (cashbackCount > 0) {
    parts.push(`${cashbackCount} cashback record${cashbackCount === 1 ? "" : "s"}`);
  }

  const breakdownText =
    parts.length > 0 ? parts.join(", ") : "no linked financial records";

  const reason = hasDependencies
    ? `Linked to ${breakdownText}. Please archive this account instead of deleting it to preserve historical reports and financial integrity.`
    : undefined;

  return {
    canDelete,
    hasDependencies,
    counts: {
      transactions: transactionCount,
      statements: statementCount,
      payments: paymentCount,
      subscriptions: subscriptionCount,
      cashback: cashbackCount,
      total,
    },
    reason,
    breakdownText,
  };
}
