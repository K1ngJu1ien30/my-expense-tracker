-- ============================================================================
-- Migration 006: Financial Account Architecture & Stable Account References
-- Universal Expense Tracker — Phase 1A
-- ============================================================================
-- SAFETY MODEL (Zero-Downtime & Additive):
--   1. All schema modifications are strictly ADDITIVE.
--   2. Existing columns (`transactions.account`, `transactions.to_account`,
--      `subscriptions.source_account`, `user_accounts.name`) remain intact.
--   3. Older APK versions and un-migrated clients will continue reading and
--      writing legacy string fields without errors.
--   4. Dual-linking allows transactions to carry BOTH stable UUID `account_id`
--      and human-readable `account` name during the transition period.
--   5. Idempotent: safe to run multiple times without data duplication.
--
-- DO NOT EXECUTE DIRECTLY VIA AGENT.
-- Review this file, then execute manually in Supabase SQL Editor when approved:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ENHANCE user_accounts WITH KIND & OPENING BALANCES
-- ----------------------------------------------------------------------------

-- Add account kind (bank, cash, ewallet, savings, credit_card, investment)
ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS kind VARCHAR(30) NOT NULL DEFAULT 'bank';

-- Ensure kind constraint is enforced
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_accounts_kind_check'
    ) THEN
        ALTER TABLE user_accounts
            ADD CONSTRAINT user_accounts_kind_check 
            CHECK (kind IN ('bank', 'cash', 'ewallet', 'savings', 'credit_card', 'investment'));
    END IF;
END $$;

-- Add opening balance and effective start date
ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS opening_balance_date DATE DEFAULT CURRENT_DATE;

-- Add credit card metadata (optional, nullable for non-credit accounts)
ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2) DEFAULT NULL;

ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS statement_day INTEGER DEFAULT NULL;

ALTER TABLE user_accounts
    ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT NULL;

-- Enforce day range constraint for credit cards
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_accounts_credit_days_check'
    ) THEN
        ALTER TABLE user_accounts
            ADD CONSTRAINT user_accounts_credit_days_check 
            CHECK (
                (statement_day IS NULL OR (statement_day BETWEEN 1 AND 31)) AND
                (due_day IS NULL OR (due_day BETWEEN 1 AND 31))
            );
    END IF;
END $$;

-- Ensure composite uniqueness for user-scoped foreign key verification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_accounts_id_user_id_unique'
    ) THEN
        ALTER TABLE user_accounts
            ADD CONSTRAINT user_accounts_id_user_id_unique 
            UNIQUE (id, user_id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. ADD STABLE ACCOUNT REFERENCES TO transactions
-- ----------------------------------------------------------------------------

-- Primary account ID (source account for Expense/Transfer, deposit account for Income)
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS account_id UUID DEFAULT NULL;

-- Destination account ID (for Transfers)
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS to_account_id UUID DEFAULT NULL;

-- Enforce cross-user isolation: a transaction CANNOT reference an account
-- owned by a different user. Composite FK (account_id, user_id) guarantees this.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_transactions_user_account'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT fk_transactions_user_account 
            FOREIGN KEY (account_id, user_id) 
            REFERENCES user_accounts (id, user_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_transactions_user_to_account'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT fk_transactions_user_to_account 
            FOREIGN KEY (to_account_id, user_id) 
            REFERENCES user_accounts (id, user_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. ADD STABLE ACCOUNT REFERENCE TO subscriptions
-- ----------------------------------------------------------------------------

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS source_account_id UUID DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_subscriptions_user_account'
    ) THEN
        ALTER TABLE subscriptions
            ADD CONSTRAINT fk_subscriptions_user_account 
            FOREIGN KEY (source_account_id, user_id) 
            REFERENCES user_accounts (id, user_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_user_account_id
    ON transactions (user_id, account_id, date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_to_account_id
    ON transactions (user_id, to_account_id, date DESC)
    WHERE deleted_at IS NULL AND type = 'Transfer';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_account_id
    ON subscriptions (user_id, source_account_id);

CREATE INDEX IF NOT EXISTS idx_user_accounts_kind
    ON user_accounts (user_id, kind);

-- ----------------------------------------------------------------------------
-- 5. IDEMPOTENT DATA BACKFILL
-- ----------------------------------------------------------------------------

-- 5A. Infer account kinds for existing accounts based on naming patterns
UPDATE user_accounts
SET kind = 'cash'
WHERE kind = 'bank' AND lower(name) LIKE '%cash%';

UPDATE user_accounts
SET kind = 'ewallet'
WHERE kind = 'bank' AND (
    lower(name) LIKE '%wallet%' OR 
    lower(name) LIKE '%tng%' OR 
    lower(name) LIKE '%touch%' OR 
    lower(name) LIKE '%grab%' OR 
    lower(name) LIKE '%boost%' OR 
    lower(name) LIKE '%shopeepay%'
);

UPDATE user_accounts
SET kind = 'credit_card'
WHERE kind = 'bank' AND (
    lower(name) LIKE '%credit%' OR 
    lower(name) LIKE '%card%'
);

UPDATE user_accounts
SET kind = 'savings'
WHERE kind = 'bank' AND lower(name) LIKE '%saving%';

-- 5B. Backfill transactions.account_id from existing account names
UPDATE transactions t
SET account_id = a.id
FROM user_accounts a
WHERE t.account_id IS NULL
  AND t.user_id = a.user_id
  AND lower(trim(t.account)) = lower(trim(a.name));

-- 5C. Backfill transactions.to_account_id for Transfers
UPDATE transactions t
SET to_account_id = a.id
FROM user_accounts a
WHERE t.type = 'Transfer'
  AND t.to_account_id IS NULL
  AND t.to_account IS NOT NULL
  AND t.user_id = a.user_id
  AND lower(trim(t.to_account)) = lower(trim(a.name));

-- 5D. Backfill subscriptions.source_account_id
UPDATE subscriptions s
SET source_account_id = a.id
FROM user_accounts a
WHERE s.source_account_id IS NULL
  AND s.source_account IS NOT NULL
  AND s.user_id = a.user_id
  AND lower(trim(s.source_account)) = lower(trim(a.name));

-- ============================================================================
-- VERIFICATION QUERIES (Run to inspect results after migration):
-- ============================================================================
-- 1. Review updated user_accounts with inferred kinds:
--    SELECT user_id, name, kind, currency_code, opening_balance, is_archived
--    FROM user_accounts
--    ORDER BY user_id, sort_order;
--
-- 2. Verify transaction linkage percentage:
--    SELECT 
--      COUNT(*) AS total_transactions,
--      COUNT(account_id) AS linked_to_account_id,
--      COUNT(*) - COUNT(account_id) AS unlinked_legacy_names
--    FROM transactions
--    WHERE deleted_at IS NULL;
--
-- 3. Verify transfer destination linkage percentage:
--    SELECT 
--      COUNT(*) AS total_transfers,
--      COUNT(to_account_id) AS linked_to_dest_id
--    FROM transactions
--    WHERE type = 'Transfer' AND deleted_at IS NULL;
-- ============================================================================
