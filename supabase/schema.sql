-- ============================================================================
-- Supabase Consolidated Schema — Expense Tracker Pro v3.0.0
-- Complete, Idempotent Database Schema with Strict RLS Boundaries
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Accounts & Wallets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'RM',
    kind VARCHAR(30) NOT NULL DEFAULT 'bank' CHECK (kind IN ('bank', 'cash', 'e_wallet', 'ewallet', 'savings', 'credit_card', 'investment')),
    opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    opening_balance_date DATE DEFAULT CURRENT_DATE,
    credit_limit NUMERIC(14, 2) DEFAULT NULL,
    statement_day INTEGER DEFAULT NULL CHECK (statement_day IS NULL OR (statement_day BETWEEN 1 AND 31)),
    due_day INTEGER DEFAULT NULL CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_accounts_unique_name_per_user UNIQUE (user_id, name),
    CONSTRAINT user_accounts_id_user_id_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_user_sort
    ON user_accounts (user_id, sort_order, name)
    WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_user_accounts_user_all
    ON user_accounts (user_id, sort_order);

ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for user_accounts" ON user_accounts;
CREATE POLICY "Strict isolation for user_accounts" ON user_accounts
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50) DEFAULT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_categories_unique_name_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_sort
    ON user_categories (user_id, sort_order, name);

ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for user_categories" ON user_categories;
CREATE POLICY "Strict isolation for user_categories" ON user_categories
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Transactions Tracker
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(50) NOT NULL, -- 'expense', 'income', 'transfer'
    category VARCHAR(255),
    sub_category VARCHAR(255),
    account VARCHAR(255),
    to_account VARCHAR(255),
    note TEXT,
    status VARCHAR(50) DEFAULT 'cleared' CHECK (status IN ('cleared', 'pending')),
    is_claimable BOOLEAN DEFAULT false,
    claim_status VARCHAR(50) DEFAULT 'none' CHECK (claim_status IN ('none', 'pending', 'cleared')),
    exclude_from_velocity BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT transactions_id_user_id_unique UNIQUE (id, user_id)
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Transactions" ON transactions;
CREATE POLICY "Strict isolation mapping for Transactions" ON transactions
    FOR ALL USING (auth.uid() = user_id);

-- Indexes for lightning fast queries & offline sync
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions (account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_to_account_id ON transactions (to_account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Credit Card Details & Extended Metadata
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_card_details (
    account_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issuer VARCHAR(100) DEFAULT NULL,
    card_last_four VARCHAR(4) DEFAULT NULL,
    statement_day INTEGER NOT NULL DEFAULT 15 CHECK (statement_day BETWEEN 1 AND 31),
    grace_period_days INTEGER NOT NULL DEFAULT 20 CHECK (grace_period_days BETWEEN 1 AND 60),
    due_day INTEGER DEFAULT NULL CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
    apr NUMERIC(5, 2) DEFAULT 15.00 CHECK (apr IS NULL OR (apr >= 0.00 AND apr <= 100.00)),
    card_color VARCHAR(50) DEFAULT NULL,
    reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days_before BETWEEN 0 AND 30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_credit_card_details PRIMARY KEY (account_id),
    CONSTRAINT fk_credit_card_details_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE
);

ALTER TABLE credit_card_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_details" ON credit_card_details;
CREATE POLICY "Strict isolation for credit_card_details" ON credit_card_details
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. Credit Card Statements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_card_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    statement_date DATE NOT NULL,
    due_date DATE NOT NULL,
    statement_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    minimum_payment NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_settled BOOLEAN NOT NULL DEFAULT false,
    closing_balance NUMERIC(14, 2) DEFAULT NULL,
    finance_charge NUMERIC(14, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cc_statement_cycle UNIQUE (account_id, statement_date),
    CONSTRAINT uq_cc_statement_id_user UNIQUE (id, user_id),
    CONSTRAINT fk_cc_statement_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE
);

ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_statements" ON credit_card_statements;
CREATE POLICY "Strict isolation for credit_card_statements" ON credit_card_statements
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. Credit Card Payments Ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_card_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    statement_id UUID NOT NULL,
    transaction_id UUID NOT NULL,
    source_account_id UUID NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_preset VARCHAR(30) NOT NULL DEFAULT 'statement_balance'
        CHECK (payment_preset IN ('statement_balance', 'minimum_due', 'custom_partial', 'full_outstanding')),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cc_payment_statement FOREIGN KEY (statement_id, user_id)
        REFERENCES credit_card_statements (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_payment_transaction FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_payment_source FOREIGN KEY (source_account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE RESTRICT
);

ALTER TABLE credit_card_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_payments" ON credit_card_payments;
CREATE POLICY "Strict isolation for credit_card_payments" ON credit_card_payments
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. Credit Card Cashback & Rewards
-- ----------------------------------------------------------------------------
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

ALTER TABLE credit_card_reward_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_reward_configs" ON credit_card_reward_configs;
CREATE POLICY "Strict isolation for credit_card_reward_configs" ON credit_card_reward_configs
    FOR ALL USING (auth.uid() = user_id);

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

ALTER TABLE credit_card_cashback_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_cashback_records" ON credit_card_cashback_records;
CREATE POLICY "Strict isolation for credit_card_cashback_records" ON credit_card_cashback_records
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. Goals Tracking Loop
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    target_amount DECIMAL(12,2) NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Goals" ON goals;
CREATE POLICY "Strict isolation mapping for Goals" ON goals
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 9. Advanced Subscription & Utilities Matrices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    billing_day INTEGER,
    source_account VARCHAR(255),
    auto_deduct BOOLEAN DEFAULT true,
    type VARCHAR(50) NOT NULL, -- 'subscription' vs 'utility'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Subscriptions" ON subscriptions;
CREATE POLICY "Strict isolation mapping for Subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 10. Salary Planner
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_planner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category VARCHAR(255),
    item_name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE salary_planner ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Salary Planner" ON salary_planner;
CREATE POLICY "Strict isolation mapping for Salary Planner" ON salary_planner
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 11. Asset Vault & Maintenance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    emoji_icon TEXT DEFAULT '📦',
    purchase_date DATE,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE asset_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Asset Vault" ON asset_vault;
CREATE POLICY "Strict isolation mapping for Asset Vault" ON asset_vault
    FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS asset_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES asset_vault(id) ON DELETE CASCADE,
    log_date DATE DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    cost DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE asset_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Asset Logs" ON asset_logs;
CREATE POLICY "Strict isolation mapping for Asset Logs" ON asset_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM asset_vault WHERE asset_vault.id = asset_logs.asset_id AND asset_vault.user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 12. Trade Items (Flipping/Trading Module)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    buy_price DECIMAL(12,2) NOT NULL,
    sell_price DECIMAL(12,2),
    status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'sold')),
    date_acquired TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_sold TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Trade Items" ON trade_items;
CREATE POLICY "Strict isolation mapping for Trade Items" ON trade_items
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 13. Radar Sources
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS radar_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'tmdb_cinema', 'tmdb_streaming')),
    name VARCHAR(255) NOT NULL,
    url TEXT,
    keywords TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE radar_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation mapping for Radar Sources" ON radar_sources;
CREATE POLICY "Strict isolation mapping for Radar Sources" ON radar_sources
    FOR ALL USING (auth.uid() = user_id);
