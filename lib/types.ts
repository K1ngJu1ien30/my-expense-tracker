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

// ═══════════════════════════════════════════════════════════════
// WanderPlan Types
// ═══════════════════════════════════════════════════════════════

export type WPTripStatus = 'planning' | 'active' | 'completed';
export type WPActivityCategory = 'transport' | 'food' | 'activity' | 'shopping' | 'rest' | 'accommodation' | 'sightseeing';
export type WPBudgetCategory = 'flights' | 'accommodation' | 'food' | 'transport' | 'activities' | 'shopping' | 'insurance' | 'visas' | 'misc';
export type WPPlaceCategory = 'eat' | 'stay' | 'do' | 'shop' | 'transport';
export type WPDocumentType = 'flight' | 'hotel' | 'train' | 'insurance' | 'visa' | 'other';
export type WPPackingCategory = 'clothing' | 'toiletries' | 'electronics' | 'documents' | 'medicine' | 'misc';

export type WPTrip = {
  id: string;
  user_id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  currency_code: string;
  status: WPTripStatus;
  settings: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WPTripDay = {
  id: string;
  trip_id: string;
  date: string;
  day_number: number;
  notes: string | null;
  deleted_at: string | null;
};

export type WPActivity = {
  id: string;
  trip_day_id: string;
  title: string;
  category: WPActivityCategory;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  place_id: string | null;
  location: { lat: number; lng: number; name?: string; address?: string } | null;
  cost_amount: number | null;
  cost_currency: string | null;
  notes: string | null;
  booking_ref: string | null;
  links: { title: string; url: string }[];
  order_index: number;
  is_completed: boolean;
  deleted_at: string | null;
};

export type WPBudgetAllocation = {
  id: string;
  trip_id: string;
  category: WPBudgetCategory;
  allocated_cents: number;
  spent_cents: number;
  deleted_at: string | null;
};

export type WPTripExpense = {
  id: string;
  trip_id: string;
  activity_id: string | null;
  budget_category: WPBudgetCategory;
  amount_cents: number;
  currency_code: string;
  note: string | null;
  date: string;
  transaction_id: string | null;
  deleted_at: string | null;
};

export type WPSavedPlace = {
  id: string;
  trip_id: string;
  name: string;
  category: WPPlaceCategory;
  sub_category: string | null;
  location: { lat: number; lng: number; address?: string } | null;
  google_maps_url: string | null;
  website_url: string | null;
  rating: number | null;
  price_level: number | null;
  notes: string | null;
  tags: string[];
  opening_hours: Record<string, string> | null;
  is_visited: boolean;
  deleted_at: string | null;
};

export type WPDocument = {
  id: string;
  trip_id: string;
  type: WPDocumentType;
  title: string;
  file_url: string | null;
  file_type: 'pdf' | 'image' | 'link' | null;
  external_url: string | null;
  booking_ref: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  deleted_at: string | null;
};

export type WPPackingItem = {
  id: string;
  trip_id: string;
  category: WPPackingCategory;
  item_name: string;
  quantity: number;
  is_packed: boolean;
  deleted_at: string | null;
};

export type WPWeatherData = {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
};
