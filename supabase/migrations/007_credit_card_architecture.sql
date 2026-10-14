-- ============================================================================
-- Migration 007: Credit Card Module Architecture & Data Integrity
-- Universal Expense Tracker — Phase 2A
-- ============================================================================
-- SAFETY MODEL (Zero-Downtime & Additive):
--   1. All schema modifications are strictly ADDITIVE.
--   2. Non-credit card accounts and general transactions are completely unaffected.
--   3. Users without credit cards will have zero rows in credit-card specific tables.
--   4. Cross-user data isolation is enforced at the database level via composite
--      foreign keys (table_id, user_id) on all relationships.
--   5. Full RLS policies active on every new table.
--   6. Idempotent: safe to run multiple times.
--
-- DO NOT EXECUTE DIRECTLY VIA AGENT.
-- Review this file, then execute manually in Supabase SQL Editor when approved:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PREREQUISITE COMPOSITE CONSTRAINTS FOR CROSS-TABLE INTEGRITY
-- ----------------------------------------------------------------------------

-- Ensure transactions has a composite unique constraint on (id, user_id)
-- so credit_card_payments can validate user ownership of linked ledger entries.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'transactions_id_user_id_unique'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT transactions_id_user_id_unique 
            UNIQUE (id, user_id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. CREDIT CARD DETAILS & SETTINGS (1-to-1 extension of user_accounts)
-- ----------------------------------------------------------------------------
-- Stores card-specific configuration, issuer rules, and reminder preferences.
-- Only rows where user_accounts.kind = 'credit_card' will have an entry here.

CREATE TABLE IF NOT EXISTS credit_card_details (
    account_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issuer VARCHAR(100) DEFAULT NULL,
    card_last_four VARCHAR(4) DEFAULT NULL,
    statement_day INTEGER NOT NULL DEFAULT 15 CHECK (statement_day BETWEEN 1 AND 31),
    grace_period_days INTEGER NOT NULL DEFAULT 20 CHECK (grace_period_days BETWEEN 1 AND 60),
    due_day INTEGER DEFAULT NULL CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
    apr NUMERIC(5, 2) DEFAULT NULL CHECK (apr IS NULL OR (apr >= 0.00 AND apr <= 100.00)),
    card_color VARCHAR(50) DEFAULT NULL,
    reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days_before BETWEEN 0 AND 30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_credit_card_details PRIMARY KEY (account_id),
    CONSTRAINT fk_credit_card_details_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_credit_card_details_user_account UNIQUE (account_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. ISSUED CREDIT CARD STATEMENTS
-- ----------------------------------------------------------------------------
-- Tracks monthly statement cycles, closing amounts, due dates, and settlement status.

CREATE TABLE IF NOT EXISTS credit_card_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    statement_date DATE NOT NULL,
    due_date DATE NOT NULL,
    opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(14, 2) NOT NULL,
    minimum_payment NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMPTZ DEFAULT NULL,
    note TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_credit_card_statements_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_credit_card_statements_account_date UNIQUE (account_id, statement_date),
    CONSTRAINT uq_credit_card_statements_id_user UNIQUE (id, user_id),
    CONSTRAINT chk_statement_dates CHECK (due_date >= statement_date)
);

-- ----------------------------------------------------------------------------
-- 4. ADD ADDITIVE STATEMENT & CLASSIFICATION COLUMNS TO transactions
-- ----------------------------------------------------------------------------
-- Enables card transactions to be classified explicitly (purchase, fee, repayment, etc.)
-- and optionally allocated to a specific billing statement.

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS credit_card_tx_type VARCHAR(30) DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_transactions_cc_type'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT chk_transactions_cc_type 
            CHECK (
                credit_card_tx_type IS NULL OR 
                credit_card_tx_type IN ('purchase', 'repayment', 'refund', 'fee', 'interest', 'cashback')
            );
    END IF;
END $$;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS statement_id UUID DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_transactions_statement'
    ) THEN
        ALTER TABLE transactions
            ADD CONSTRAINT fk_transactions_statement 
            FOREIGN KEY (statement_id, user_id) 
            REFERENCES credit_card_statements (id, user_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. CREDIT CARD PAYMENTS & ALLOCATIONS
-- ----------------------------------------------------------------------------
-- Records repayments made to a card, tracking the source bank account, the statement
-- being satisfied, payment presets, and links to general ledger transactions.

CREATE TABLE IF NOT EXISTS credit_card_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    source_account_id UUID NOT NULL,
    statement_id UUID DEFAULT NULL,
    transaction_id UUID DEFAULT NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_type VARCHAR(30) NOT NULL DEFAULT 'custom'
        CHECK (payment_type IN ('full_statement', 'minimum_due', 'custom', 'full_outstanding')),
    note TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cc_payments_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_payments_source FOREIGN KEY (source_account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cc_payments_statement FOREIGN KEY (statement_id, user_id)
        REFERENCES credit_card_statements (id, user_id) ON DELETE SET NULL,
    CONSTRAINT fk_cc_payments_transaction FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_credit_card_details_user
    ON credit_card_details (user_id);

CREATE INDEX IF NOT EXISTS idx_credit_card_statements_user_account
    ON credit_card_statements (user_id, account_id, statement_date DESC);

CREATE INDEX IF NOT EXISTS idx_credit_card_statements_due_date
    ON credit_card_statements (user_id, due_date)
    WHERE is_settled = FALSE;

CREATE INDEX IF NOT EXISTS idx_credit_card_payments_user_card
    ON credit_card_payments (user_id, account_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_credit_card_payments_statement
    ON credit_card_payments (user_id, statement_id)
    WHERE statement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_statement_id
    ON transactions (user_id, statement_id)
    WHERE statement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_cc_type
    ON transactions (user_id, credit_card_tx_type)
    WHERE credit_card_tx_type IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE credit_card_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_payments ENABLE ROW LEVEL SECURITY;

-- credit_card_details isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_details' AND policyname = 'Users can only access their own credit card details'
    ) THEN
        CREATE POLICY "Users can only access their own credit card details"
            ON credit_card_details
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- credit_card_statements isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_statements' AND policyname = 'Users can only access their own credit card statements'
    ) THEN
        CREATE POLICY "Users can only access their own credit card statements"
            ON credit_card_statements
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- credit_card_payments isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_payments' AND policyname = 'Users can only access their own credit card payments'
    ) THEN
        CREATE POLICY "Users can only access their own credit card payments"
            ON credit_card_payments
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. SAFE BACKFILL STRATEGY
-- ----------------------------------------------------------------------------

-- 8A. Auto-populate credit_card_details for any existing credit card accounts
INSERT INTO credit_card_details (account_id, user_id, statement_day, due_day)
SELECT 
    a.id, 
    a.user_id, 
    COALESCE(a.statement_day, 15), 
    COALESCE(a.due_day, 5)
FROM user_accounts a
WHERE a.kind = 'credit_card'
ON CONFLICT (account_id) DO NOTHING;

-- 8B. Default existing expense transactions on credit cards to 'purchase'
UPDATE transactions t
SET credit_card_tx_type = 'purchase'
FROM user_accounts a
WHERE t.account_id = a.id
  AND a.kind = 'credit_card'
  AND t.type = 'Expense'
  AND t.credit_card_tx_type IS NULL;

-- 8C. Default existing transfers into credit cards to 'repayment'
UPDATE transactions t
SET credit_card_tx_type = 'repayment'
FROM user_accounts a
WHERE t.to_account_id = a.id
  AND a.kind = 'credit_card'
  AND t.type = 'Transfer'
  AND t.credit_card_tx_type IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (Run to verify setup)
-- ============================================================================
-- 1. Check tables exist:
--    SELECT table_name FROM information_schema.tables WHERE table_name IN ('credit_card_details', 'credit_card_statements', 'credit_card_payments');
--
-- 2. Check foreign keys and cross-table constraints:
--    SELECT conname, contype FROM pg_constraint WHERE conname LIKE '%credit_card%' OR conname LIKE '%cc_payments%';
--
-- 3. Check RLS is active:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('credit_card_details', 'credit_card_statements', 'credit_card_payments');
-- ============================================================================

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (If ever needed)
-- ============================================================================
-- DROP TABLE IF EXISTS credit_card_payments CASCADE;
-- DROP TABLE IF EXISTS credit_card_statements CASCADE;
-- DROP TABLE IF EXISTS credit_card_details CASCADE;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS statement_id;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS credit_card_tx_type;
-- ============================================================================
