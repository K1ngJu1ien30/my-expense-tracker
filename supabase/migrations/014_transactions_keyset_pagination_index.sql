-- ============================================================================
-- Migration 014: Transactions Keyset Pagination Partial Composite Index
-- Universal Expense Tracker — Release v3.5.0
-- ============================================================================
-- OBJECTIVES:
--   1. Support O(1) keyset/cursor pagination on active transactions ordered by
--      (date DESC, id DESC) with zero in-memory sort and zero soft-deleted row
--      scans.
--   2. Match the exact predicate executed by lib/transactionPagination.ts:
--        WHERE user_id = $1
--          AND deleted_at IS NULL
--          AND (date < $2 OR (date = $2 AND id < $3))
--        ORDER BY date DESC, id DESC
--        LIMIT $4
--   3. Keep existing indexes intact (fully additive, zero downtime, reversible).
--
-- DO NOT EXECUTE AUTOMATICALLY.
-- Review this script, then apply manually in the Supabase Dashboard SQL Editor:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: READ-ONLY PRE-FLIGHT INSPECTION QUERIES
-- ----------------------------------------------------------------------------
-- Run these queries prior to applying the migration to inspect existing indexes
-- and confirm the `deleted_at` column exists on `transactions`:
--
-- A. Check existing indexes on `transactions`:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'transactions'
--   ORDER BY indexname;
--
-- B. Confirm `transactions` columns (`user_id`, `date`, `id`, `deleted_at`):
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'transactions'
--     AND column_name IN ('id', 'user_id', 'date', 'deleted_at');
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- SECTION 2: CREATE PARTIAL COMPOSITE INDEX FOR KEYSET PAGINATION
-- ----------------------------------------------------------------------------
-- Note: Supabase Dashboard SQL Editor executes statements inside an implicit
-- transaction block, where CREATE INDEX CONCURRENTLY is disallowed. Standard
-- CREATE INDEX IF NOT EXISTS is safe and instantaneous for personal-scale
-- ledgers (typically <50ms for tens of thousands of rows).

CREATE INDEX IF NOT EXISTS idx_transactions_user_date_id_active
  ON public.transactions (user_id, date DESC, id DESC)
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- SECTION 3: POST-MIGRATION VERIFICATION
-- ----------------------------------------------------------------------------
-- Run after applying to verify the index exists and Postgres selects it:
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND tablename = 'transactions'
--     AND indexname = 'idx_transactions_user_date_id_active';
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT *
--   FROM public.transactions
--   WHERE user_id = auth.uid()
--     AND deleted_at IS NULL
--   ORDER BY date DESC, id DESC
--   LIMIT 1000;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- SECTION 4: SAFE ROLLBACK SCRIPT
-- ----------------------------------------------------------------------------
-- To revert this migration cleanly without affecting data or prior indexes:
--
--   DROP INDEX IF EXISTS public.idx_transactions_user_date_id_active;
-- ----------------------------------------------------------------------------
