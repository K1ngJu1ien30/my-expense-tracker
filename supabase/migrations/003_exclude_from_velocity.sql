-- ============================================================================
-- Migration 003: Add `exclude_from_velocity` to transactions
-- ============================================================================
-- WHY: The Spending Velocity chart on the Analytics page computes an
-- end-of-month projection as `sum(expenses this month) / days elapsed ×
-- daysInMonth`. On salary day, users frequently clear a whole stack of
-- fixed bills (utilities, phone, subscriptions, rent) in a single day —
-- which inflates the "per day" pace to the point where the projection
-- becomes nonsensical (e.g. RM 5,500/month when the user's actual
-- discretionary spend is RM 30/day).
--
-- This column lets a transaction be explicitly marked as NOT counting
-- toward the velocity calculation. Nullable so old rows stay untouched.
--
--   NULL   → velocity filter uses the category-based auto-rule (default
--            excludes anything in Bills / Subs / Utilities / Savings).
--   true   → user explicitly excluded this row (overrides category rule).
--   false  → user explicitly INCLUDED this row (overrides category rule).
--
-- This three-state design is deliberate: it lets the category auto-rule
-- keep working retroactively for existing data (you just pay a bill and
-- it's auto-excluded because `category = 'Bills'`), while still allowing
-- a per-row override for the rare cases where the auto-rule is wrong
-- (e.g. a Bills-tagged one-off that ISN'T recurring).
--
-- Run in Supabase SQL Editor. Fully idempotent.
-- ============================================================================

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS exclude_from_velocity BOOLEAN DEFAULT NULL;

-- No index needed — `transactions` is always loaded in full for a user
-- via the existing `idx_transactions_user_date` partial index, and the
-- filter runs client-side as part of the velocity memo.

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- 1. Confirm the column exists:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'transactions' AND column_name = 'exclude_from_velocity';
--
-- 2. Count how many existing rows would be auto-excluded by category
--    (run this if you want to preview what the velocity filter will do):
--    SELECT category, COUNT(*) FROM transactions
--    WHERE deleted_at IS NULL AND category IN ('Bills','Subs','Utilities','Savings')
--    GROUP BY category ORDER BY COUNT(*) DESC;
-- ----------------------------------------------------------------------------
