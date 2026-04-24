-- ============================================================================
-- Migration 002: Move accounts & categories from user_metadata → dedicated tables
-- ============================================================================
-- SAFETY MODEL (zero-downtime):
--   1. This script only CREATES new tables and SEEDS them from existing
--      auth.users.user_metadata. It does NOT modify or delete any existing data.
--   2. Friends running the old APK continue reading/writing user_metadata and
--      see no change.
--   3. The upcoming code change will DUAL-WRITE to both user_metadata and these
--      new tables for a transition period, so old and new clients co-exist.
--   4. A future migration (003) will eventually drop the user_metadata fields
--      AFTER all users have updated to the new APK.
--
-- Run in Supabase SQL Editor → New query → paste → Run.
-- Fully idempotent: safe to re-run.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Table 1: user_accounts
-- ----------------------------------------------------------------------------
-- Replaces `auth.users.user_metadata.custom_accounts` JSONB blob.
-- sort_order preserves the user's hand-ordered wallet carousel position.
CREATE TABLE IF NOT EXISTS user_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'RM',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate account names per user (case-insensitive)
    CONSTRAINT user_accounts_unique_name_per_user UNIQUE (user_id, name)
);

-- Fast lookup: "give me all non-archived accounts for this user in sort order"
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_sort
    ON user_accounts (user_id, sort_order, name)
    WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_user_accounts_user_all
    ON user_accounts (user_id, sort_order);

-- RLS: user can only see/modify their own accounts
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- Drop & re-create policy for idempotency
DROP POLICY IF EXISTS "Strict isolation for user_accounts" ON user_accounts;
CREATE POLICY "Strict isolation for user_accounts" ON user_accounts
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Table 2: user_categories
-- ----------------------------------------------------------------------------
-- Replaces categories stored in client IndexedDB + auth.users.user_metadata.
-- Categories are now truly cross-device synced.
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_categories_unique_name_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_sort
    ON user_categories (user_id, sort_order);

ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for user_categories" ON user_categories;
CREATE POLICY "Strict isolation for user_categories" ON user_categories
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- ONE-TIME DATA SEED
-- ============================================================================
-- Backfills user_accounts and user_categories for every EXISTING user by
-- reading their auth.users.user_metadata. Runs ONLY for users that don't
-- already have rows in the new tables — so safe to re-run.
--
-- Uses DO blocks (anonymous PL/pgSQL) so we can loop and handle each user's
-- JSONB shape variations (the 3 historical forms of custom_accounts):
--   a) Missing / null         → seed defaults ["Bank","Cash","eWallet"]
--   b) string[]               → older format, pre-archive
--   c) Array of objects with { name, isArchived, currencyCode? }
-- ============================================================================

DO $$
DECLARE
    u RECORD;
    acc_data JSONB;
    acc_element JSONB;
    idx INTEGER;
    acc_name TEXT;
    acc_currency TEXT;
    acc_archived BOOLEAN;
BEGIN
    -- Loop over every user in auth.users
    FOR u IN SELECT id, raw_user_meta_data FROM auth.users LOOP
        -- Skip if this user already has accounts migrated
        IF EXISTS (SELECT 1 FROM user_accounts WHERE user_id = u.id) THEN
            CONTINUE;
        END IF;

        acc_data := u.raw_user_meta_data -> 'custom_accounts';

        IF acc_data IS NULL OR jsonb_typeof(acc_data) != 'array' OR jsonb_array_length(acc_data) = 0 THEN
            -- Case a: no metadata → seed defaults
            INSERT INTO user_accounts (user_id, name, currency_code, is_archived, sort_order)
            VALUES
                (u.id, 'Bank',    'RM', false, 0),
                (u.id, 'Cash',    'RM', false, 1),
                (u.id, 'eWallet', 'RM', false, 2);
        ELSE
            -- Cases b + c: iterate the array
            idx := 0;
            FOR acc_element IN SELECT * FROM jsonb_array_elements(acc_data) LOOP
                IF jsonb_typeof(acc_element) = 'string' THEN
                    -- Old string[] format
                    acc_name := acc_element #>> '{}';
                    acc_currency := 'RM';
                    acc_archived := false;
                ELSE
                    -- Object format (may be missing currencyCode on older migrations)
                    acc_name := COALESCE(acc_element ->> 'name', '');
                    acc_currency := COALESCE(acc_element ->> 'currencyCode', 'RM');
                    acc_archived := COALESCE((acc_element ->> 'isArchived')::boolean, false);
                END IF;

                -- Skip blanks
                IF acc_name IS NOT NULL AND acc_name != '' THEN
                    INSERT INTO user_accounts (user_id, name, currency_code, is_archived, sort_order)
                    VALUES (u.id, acc_name, acc_currency, acc_archived, idx)
                    ON CONFLICT (user_id, name) DO NOTHING;
                    idx := idx + 1;
                END IF;
            END LOOP;

            -- If after iteration we still ended up empty (e.g. all blanks), seed defaults
            IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE user_id = u.id) THEN
                INSERT INTO user_accounts (user_id, name, currency_code, is_archived, sort_order)
                VALUES
                    (u.id, 'Bank',    'RM', false, 0),
                    (u.id, 'Cash',    'RM', false, 1),
                    (u.id, 'eWallet', 'RM', false, 2);
            END IF;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Seed categories for every user (defaults only — the old app never stored
-- categories in user_metadata; they lived in localStorage. Every user starts
-- with the canonical default set, then their client can sync its local cache
-- up to the cloud on next launch.)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    u RECORD;
    default_cats TEXT[] := ARRAY['Food','Transport','Entertainment','Shopping','Bills','Family','Subs'];
    cat TEXT;
    idx INTEGER;
BEGIN
    FOR u IN SELECT id FROM auth.users LOOP
        -- Skip if this user already has categories
        IF EXISTS (SELECT 1 FROM user_categories WHERE user_id = u.id) THEN
            CONTINUE;
        END IF;

        idx := 0;
        FOREACH cat IN ARRAY default_cats LOOP
            INSERT INTO user_categories (user_id, name, sort_order)
            VALUES (u.id, cat, idx)
            ON CONFLICT (user_id, name) DO NOTHING;
            idx := idx + 1;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES — run these one at a time to confirm success:
-- ============================================================================
-- 1. Count of migrated accounts (should be >= number of users × 3):
--    SELECT COUNT(*) AS total_accounts FROM user_accounts;
--
-- 2. Sample rows to eyeball:
--    SELECT user_id, name, currency_code, is_archived, sort_order
--    FROM user_accounts ORDER BY user_id, sort_order LIMIT 20;
--
-- 3. Confirm every user got seeded:
--    SELECT u.id, u.email,
--           (SELECT COUNT(*) FROM user_accounts   WHERE user_id = u.id) AS acc_count,
--           (SELECT COUNT(*) FROM user_categories WHERE user_id = u.id) AS cat_count
--    FROM auth.users u;
--
-- 4. Check indexes were created:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename IN ('user_accounts','user_categories');
-- ============================================================================
