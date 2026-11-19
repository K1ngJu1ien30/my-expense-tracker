-- ============================================================================
-- Migration 015: Transactions Incremental Delta Sync (`updated_at` Watermark)
-- Universal Expense Tracker — Release v3.5.0+
-- ============================================================================
-- OBJECTIVES:
--   1. Add an `updated_at` TIMESTAMPTZ column to `public.transactions` and
--      backfill existing rows safely from `COALESCE(deleted_at, created_at, date, NOW())`.
--   2. Attach a lightweight `BEFORE UPDATE` trigger so every edit or soft-delete
--      automatically stamps `NEW.updated_at = NOW()`.
--   3. Create index `idx_transactions_user_updated_at ON public.transactions (user_id, updated_at DESC)`
--      so warm app launches fetch ONLY rows modified/deleted since the device's
--      last sync watermark (typically 0–5 rows, ~100ms) instead of re-downloading
--      the entire transaction ledger.
--   4. Fully additive & backward-compatible: older clients ignore `updated_at`,
--      and new clients automatically fall back to full keyset pagination if
--      this migration has not yet been applied.
--
-- DO NOT EXECUTE AUTOMATICALLY.
-- Review this script, then apply manually in the Supabase Dashboard SQL Editor:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: READ-ONLY PRE-FLIGHT INSPECTION QUERIES
-- ----------------------------------------------------------------------------
-- Run before applying to inspect current columns & triggers on `transactions`:
--
-- A. Check if `updated_at` already exists:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'transactions'
--     AND column_name IN ('created_at', 'deleted_at', 'updated_at');
--
-- B. Check existing triggers on `transactions`:
--   SELECT trigger_name, event_manipulation, action_timing
--   FROM information_schema.triggers
--   WHERE event_object_schema = 'public'
--     AND event_object_table = 'transactions';
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- SECTION 2: ADD `updated_at` COLUMN, BACKFILL, TRIGGER & INDEX
-- ----------------------------------------------------------------------------

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill any existing NULL rows deterministically
UPDATE public.transactions
SET updated_at = COALESCE(deleted_at, created_at, date, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_set_updated_at ON public.transactions;

CREATE TRIGGER trg_transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_transactions_updated_at();

-- Index covering incremental delta sync queries:
--   WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at ASC LIMIT 500
CREATE INDEX IF NOT EXISTS idx_transactions_user_updated_at
  ON public.transactions (user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- SECTION 3: POST-MIGRATION VERIFICATION
-- ----------------------------------------------------------------------------
--   SELECT COUNT(*) AS null_updated_at_rows
--   FROM public.transactions
--   WHERE updated_at IS NULL;
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND tablename = 'transactions'
--     AND indexname = 'idx_transactions_user_updated_at';
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT *
--   FROM public.transactions
--   WHERE user_id = auth.uid()
--     AND updated_at >= NOW() - INTERVAL '1 day'
--   ORDER BY updated_at ASC
--   LIMIT 500;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- SECTION 4: SAFE ROLLBACK SCRIPT
-- ----------------------------------------------------------------------------
-- To revert cleanly without losing any transaction data (clients will
-- automatically fall back to full keyset pagination):
--
--   DROP TRIGGER IF EXISTS trg_transactions_set_updated_at ON public.transactions;
--   DROP FUNCTION IF EXISTS public.set_transactions_updated_at();
--   DROP INDEX IF EXISTS public.idx_transactions_user_updated_at;
--   ALTER TABLE public.transactions DROP COLUMN IF EXISTS updated_at;
-- ----------------------------------------------------------------------------
