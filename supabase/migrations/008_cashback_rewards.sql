-- ============================================================================
-- 008: CREDIT CARD CASHBACK & REWARDS ARCHITECTURE (PHASE 3B PROPOSAL)
-- ============================================================================
-- Additive schema supporting card-specific reward rate configurations,
-- category eligibility rules, and historical cashback redemption audit trails.
--
-- NOTE: In accordance with Rules 6 & 7, this migration is provided as a proposal
-- for manual review and approval. It is NOT executed automatically by the agent.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. CREDIT CARD REWARD CONFIGURATIONS
-- ----------------------------------------------------------------------------
-- Stores per-card reward rules (e.g. Dining 5%, Petrol 3%, General 1%)
-- and optional monthly cashback caps / minimum spend thresholds.

CREATE TABLE IF NOT EXISTS credit_card_reward_configs (
    account_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    monthly_cap NUMERIC(10, 2) DEFAULT NULL CHECK (monthly_cap IS NULL OR monthly_cap >= 0),
    min_spend_threshold NUMERIC(10, 2) DEFAULT NULL CHECK (min_spend_threshold IS NULL OR min_spend_threshold >= 0),
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_cc_reward_configs PRIMARY KEY (account_id),
    CONSTRAINT fk_cc_reward_configs_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_cc_reward_configs_user_account UNIQUE (account_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 2. CONFIRMED CASHBACK RECORDS
-- ----------------------------------------------------------------------------
-- Records actual cashback credited to a card (statement credit) or deposited
-- into a bank/cash account, with references to general ledger transactions.

CREATE TABLE IF NOT EXISTS credit_card_cashback_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    destination_account_id UUID NOT NULL,
    destination_type VARCHAR(30) NOT NULL 
        CHECK (destination_type IN ('card_statement_credit', 'bank_deposit')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    transaction_id UUID DEFAULT NULL,
    reward_date DATE NOT NULL,
    note TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cc_cashback_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_cashback_destination FOREIGN KEY (destination_account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cc_cashback_transaction FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cc_reward_configs_user
    ON credit_card_reward_configs (user_id);

CREATE INDEX IF NOT EXISTS idx_cc_cashback_records_user_card
    ON credit_card_cashback_records (user_id, account_id, reward_date DESC);

CREATE INDEX IF NOT EXISTS idx_cc_cashback_records_tx
    ON credit_card_cashback_records (user_id, transaction_id)
    WHERE transaction_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE credit_card_reward_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_cashback_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_reward_configs' AND policyname = 'Users can view own reward configs'
    ) THEN
        CREATE POLICY "Users can view own reward configs"
            ON credit_card_reward_configs FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_reward_configs' AND policyname = 'Users can insert own reward configs'
    ) THEN
        CREATE POLICY "Users can insert own reward configs"
            ON credit_card_reward_configs FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_reward_configs' AND policyname = 'Users can update own reward configs'
    ) THEN
        CREATE POLICY "Users can update own reward configs"
            ON credit_card_reward_configs FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_reward_configs' AND policyname = 'Users can delete own reward configs'
    ) THEN
        CREATE POLICY "Users can delete own reward configs"
            ON credit_card_reward_configs FOR DELETE
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    -- credit_card_cashback_records policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_cashback_records' AND policyname = 'Users can view own cashback records'
    ) THEN
        CREATE POLICY "Users can view own cashback records"
            ON credit_card_cashback_records FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_cashback_records' AND policyname = 'Users can insert own cashback records'
    ) THEN
        CREATE POLICY "Users can insert own cashback records"
            ON credit_card_cashback_records FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_cashback_records' AND policyname = 'Users can update own cashback records'
    ) THEN
        CREATE POLICY "Users can update own cashback records"
            ON credit_card_cashback_records FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_cashback_records' AND policyname = 'Users can delete own cashback records'
    ) THEN
        CREATE POLICY "Users can delete own cashback records"
            ON credit_card_cashback_records FOR DELETE
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;
