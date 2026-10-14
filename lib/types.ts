// ============================================================================
// Shared type definitions for the Tracker app.
// Extracted from lib/context.tsx (refactor: Phase 2 — Architecture).
// ============================================================================

// -------------------------------------------------------------------------
// Domain types — used throughout the app.
// -------------------------------------------------------------------------

export type Goal = {
  id: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  isPinned: boolean;
  color: string;
  bg: string;
  iconName: string;
  user_id?: string;
};

export type Subscription = {
  id: string;
  name: string;
  cost: number;
  icon: string;
  bg: string;
  color: string;
  autoDeduct?: boolean;
  billingDay?: number;
  sourceAccount?: string;
  source_account_id?: string;
  type?: string;
  user_id?: string;
  lastPaidMonth?: string;
};

export type Transaction = {
  id: string;
  type: string;
  amount: number;
  category: string;
  sub_category?: string;
  account: string;
  to_account?: string;
  account_id?: string;
  to_account_id?: string;
  date: string;
  note?: string;
  user_id?: string;
  status?: string;
  is_claimable?: boolean;
  claim_status?: string;
  deleted_at?: string | null;
  /**
   * Per-transaction override for the Spending Velocity calculation.
   *
   * Three-state:
   *   • `undefined` / `null` — defer to the category auto-rule (Bills,
   *     Subs, Utilities, Savings are auto-excluded from velocity).
   *   • `true` — explicitly excluded (overrides the category rule).
   *   • `false` — explicitly INCLUDED (forces this row to count even if
   *     its category would normally be auto-excluded).
   *
   * See `lib/velocity.ts` for the resolution logic.
   */
  exclude_from_velocity?: boolean | null;
  credit_card_tx_type?: CreditCardTxType | null;
  statement_id?: string | null;
};

export type CreditCardTxType =
  | "purchase"
  | "repayment"
  | "refund"
  | "fee"
  | "interest"
  | "cashback";

export type TransactionSaveResult =
  | { success: true; status: "synced" | "pending_sync" }
  | { success: false; error: string };

export type ToastType = { message: string; id: number } | null;

export type PlannerItem = {
  id: string;
  category: string;
  item_name: string;
  amount: number;
  user_id?: string;
};

export type Asset = {
  id: string;
  name: string;
  category: string;
  emoji_icon: string;
  purchase_date: string;
  purchase_price: number;
  user_id?: string;
};

export type AssetLog = {
  id: string;
  asset_id: string;
  log_date: string;
  description: string;
  cost: number;
};



export type CreditCardStatement = {
  id: string;
  userId?: string;
  accountId: string;
  statementDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  openingBalance: number;
  closingBalance: number;
  minimumPayment: number;
  isSettled: boolean;
  settledAt?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreditCardPaymentType =
  | "full_statement"
  | "minimum_due"
  | "custom"
  | "full_outstanding";

export type CreditCardPayment = {
  id: string;
  userId?: string;
  accountId: string;
  sourceAccountId: string;
  statementId?: string | null;
  transactionId?: string | null;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentType: CreditCardPaymentType;
  note?: string | null;
  createdAt?: string;
};

export type CreditCardDetails = {
  accountId: string;
  userId?: string;
  issuer?: string;
  cardLastFour?: string;
  statementDay: number;
  gracePeriodDays: number;
  dueDay?: number | null;
  apr?: number | null;
  cardColor?: string | null;
  reminderDaysBefore: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AccountKind =
  | "bank"
  | "cash"
  | "ewallet"
  | "savings"
  | "credit_card"
  | "investment";

export type Account = {
  id?: string;
  name: string;
  currencyCode: string;
  isArchived: boolean;
  kind?: AccountKind;
  openingBalance?: number;
  openingBalanceDate?: string;
  creditLimit?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
  cardDetails?: CreditCardDetails;
};

// -------------------------------------------------------------------------
// Supabase raw row types — mirror the snake_case columns from schema.sql.
// These replace dozens of `(x: any) =>` casts across the codebase.
// -------------------------------------------------------------------------

export type RawGoalRow = {
  id: string;
  user_id: string;
  title: string;
  current_amount: number | string;
  target_amount: number | string;
  is_pinned: boolean;
  created_at?: string;
};

export type RawSubscriptionRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number | string;
  billing_day?: number;
  source_account?: string;
  source_account_id?: string;
  auto_deduct?: boolean;
  type: "subscription" | "fixed_bill" | "utility" | "bill";
  last_paid_month?: string;
  created_at?: string;
};

export type RawUserAccountRow = {
  id: string;
  user_id: string;
  name: string;
  currency_code: string | null;
  is_archived: boolean | null;
  sort_order: number;
  kind?: AccountKind;
  opening_balance?: number | string;
  opening_balance_date?: string;
  credit_limit?: number | string | null;
  statement_day?: number | null;
  due_day?: number | null;
};

export type RawCreditCardDetailsRow = {
  account_id: string;
  user_id: string;
  issuer: string | null;
  card_last_four: string | null;
  statement_day: number;
  grace_period_days: number;
  due_day: number | null;
  apr: number | null;
  card_color: string | null;
  reminder_days_before: number;
  created_at?: string;
  updated_at?: string;
};

export type RawCreditCardStatementRow = {
  id: string;
  user_id: string;
  account_id: string;
  statement_date: string;
  due_date: string;
  opening_balance: number | string;
  closing_balance: number | string;
  minimum_payment: number | string;
  is_settled: boolean;
  settled_at: string | null;
  note: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RawCreditCardPaymentRow = {
  id: string;
  user_id: string;
  account_id: string;
  source_account_id: string;
  statement_id: string | null;
  transaction_id: string | null;
  payment_date: string;
  amount: number | string;
  payment_type: CreditCardPaymentType;
  note: string | null;
  created_at?: string;
};

export type RawUserCategoryRow = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
};

// -------------------------------------------------------------------------
// Internal state types
// -------------------------------------------------------------------------

export type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};

// A single cached deleted item (for shake-to-undo).
// `item` is intentionally `unknown` here — each caller knows its own shape.
export type DeletedItemCache = {
  type: "transaction" | "goal" | "asset";
  item: unknown;
  timeout: ReturnType<typeof setTimeout>;
};

// -------------------------------------------------------------------------
// Balance Engine types (Phase 1C)
// -------------------------------------------------------------------------

export type AccountBalanceBreakdown = {
  accountId: string;
  accountName: string;
  currency: string;
  kind: AccountKind;
  isArchived: boolean;
  openingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
  currentBalance: number;
  transactionCount: number;
};

export type CurrencyTotals = {
  currency: string;
  availableCash: number;
  savings: number;
  investments: number;
  liabilities: number;
  netFinancialPosition: number;
  accountCount: number;
};

export type FinancialPosition = {
  accountBalances: Record<string, number>;
  breakdownList: AccountBalanceBreakdown[];
  availableCash: number;
  totalSavings: number;
  totalInvestments: number;
  totalLiabilities: number;
  netFinancialPosition: number;
  isMultiCurrency: boolean;
  byCurrency: Record<string, CurrencyTotals>;
  currencies: string[];
};

export type AccountReconciliation = {
  accountId: string;
  accountName: string;
  currency: string;
  kind: AccountKind;
  openingBalance: number;
  calculatedBalance: number;
  transactionCount: number;
  orphanedTransactionCount: number;
  isBalanced: boolean;
};

// -------------------------------------------------------------------------
// Credit Card Rewards & Cashback types (Phase 3B)
// -------------------------------------------------------------------------

export type CardRewardRule = {
  category: string;
  ratePct: number;
};

export type CardRewardsConfig = {
  accountId: string;
  isEnabled: boolean;
  rules: CardRewardRule[];
  monthlyCap?: number | null;
  minSpendThreshold?: number | null;
  notes?: string;
};

export type CashbackDestination = "card_statement_credit" | "bank_deposit";

export type CashbackRecord = {
  id: string;
  userId?: string;
  cardId: string;
  cardName: string;
  amount: number;
  creditDestination: CashbackDestination;
  destinationAccountId: string;
  destinationAccountName: string;
  date: string;
  transactionId?: string;
  note?: string;
  createdAt?: string;
};

export type RawCashbackRecordRow = {
  id: string;
  user_id: string;
  account_id: string;
  destination_account_id: string;
  destination_type: string;
  amount: number | string;
  transaction_id: string | null;
  reward_date: string;
  note: string | null;
  created_at?: string;
};

export type RawRewardConfigRow = {
  account_id: string;
  user_id: string;
  is_enabled: boolean;
  rules: CardRewardRule[] | string;
  monthly_cap: number | string | null;
  min_spend_threshold: number | string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

