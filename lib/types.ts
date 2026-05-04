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
  type?: string;
  user_id?: string;
};

export type Transaction = {
  id: string;
  type: string;
  amount: number;
  category: string;
  sub_category?: string;
  account: string;
  to_account?: string;
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
};

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

export type TradeItem = {
  id: string;
  item_name: string;
  buy_price: number;
  sell_price: number | null;
  status: "held" | "sold";
  date_acquired: string;
  date_sold: string | null;
  user_id?: string;
};

export type Account = {
  name: string;
  currencyCode: string;
  isArchived: boolean;
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
  auto_deduct?: boolean;
  type: "subscription" | "utility";
  created_at?: string;
};

export type RawUserAccountRow = {
  id: string;
  user_id: string;
  name: string;
  currency_code: string | null;
  is_archived: boolean | null;
  sort_order: number;
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
  type: "transaction" | "goal" | "trade" | "asset";
  item: unknown;
  timeout: ReturnType<typeof setTimeout>;
};
