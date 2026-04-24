-- ============================================================================
-- Migration 001: Performance Indexes
-- ============================================================================
-- Adds indexes to cover every query pattern used by lib/context.tsx refreshData().
-- All statements use IF NOT EXISTS — safe to re-run.
--
-- Impact: At 5k+ transactions the .eq('user_id', ...) calls go from seq-scan to
-- index-scan, cutting Hub cold-boot server-side time from ~300ms to <30ms.
--
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

-- Transactions: the hot table. Primary query is
--   WHERE user_id = $1 AND deleted_at IS NULL ORDER BY date DESC
-- Partial index excludes soft-deleted rows for maximum efficiency.
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, date DESC)
  WHERE deleted_at IS NULL;

-- Secondary transaction index for category/type filters on Stats page.
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date
  ON transactions (user_id, type, date DESC)
  WHERE deleted_at IS NULL;

-- Pending income lookup (Hub pending tooltip)
CREATE INDEX IF NOT EXISTS idx_transactions_user_status
  ON transactions (user_id, status)
  WHERE deleted_at IS NULL AND status = 'pending';

-- Claimable / split-bill lookup
CREATE INDEX IF NOT EXISTS idx_transactions_claimable
  ON transactions (user_id, claim_status)
  WHERE is_claimable = true AND deleted_at IS NULL;

-- Goals: filtered by user, ordered by pinned-first then created_at
CREATE INDEX IF NOT EXISTS idx_goals_user_pinned
  ON goals (user_id, is_pinned DESC, created_at DESC);

-- Subscriptions + utilities share this table; filtered by user + type
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_type
  ON subscriptions (user_id, type, created_at DESC);

-- Salary planner items
CREATE INDEX IF NOT EXISTS idx_salary_planner_user
  ON salary_planner (user_id, created_at DESC);

-- Asset vault list
CREATE INDEX IF NOT EXISTS idx_asset_vault_user
  ON asset_vault (user_id, created_at DESC);

-- Asset maintenance logs: scoped to one asset at a time
CREATE INDEX IF NOT EXISTS idx_asset_logs_asset_date
  ON asset_logs (asset_id, log_date DESC);

-- Radar sources
CREATE INDEX IF NOT EXISTS idx_radar_sources_user
  ON radar_sources (user_id, created_at DESC);

-- Trade items: filtered by user + status (held vs sold)
CREATE INDEX IF NOT EXISTS idx_trade_items_user_status
  ON trade_items (user_id, status, date_acquired DESC);

-- ============================================================================
-- Verification query — run this after to confirm all indexes exist:
-- ============================================================================
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
-- ============================================================================
