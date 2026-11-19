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
    exclude_from_velocity BOOLEAN DEFAULT NULL,
    credit_card_tx_type VARCHAR(30) DEFAULT NULL,
    statement_id UUID DEFAULT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
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
    opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(14, 2) NOT NULL,
    minimum_payment NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_settled BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT uq_credit_card_payments_id_user UNIQUE (id, user_id),
    CONSTRAINT fk_cc_payments_account FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_payments_source FOREIGN KEY (source_account_id, user_id)
        REFERENCES user_accounts (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cc_payments_statement FOREIGN KEY (statement_id, user_id)
        REFERENCES credit_card_statements (id, user_id) ON DELETE SET NULL,
    CONSTRAINT fk_cc_payments_transaction FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id) ON DELETE SET NULL
);

ALTER TABLE credit_card_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_payments" ON credit_card_payments;
CREATE POLICY "Strict isolation for credit_card_payments" ON credit_card_payments
    FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6b. Credit Card Payment Allocations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_card_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL,
    statement_id UUID NOT NULL,
    allocated_amount NUMERIC(14, 2) NOT NULL CHECK (allocated_amount > 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_cc_allocations_payment FOREIGN KEY (payment_id, user_id)
        REFERENCES credit_card_payments (id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_cc_allocations_statement FOREIGN KEY (statement_id, user_id)
        REFERENCES credit_card_statements (id, user_id) ON DELETE CASCADE,
    CONSTRAINT uq_cc_allocation_payment_statement UNIQUE (payment_id, statement_id)
);

ALTER TABLE credit_card_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict isolation for credit_card_payment_allocations" ON credit_card_payment_allocations;
CREATE POLICY "Strict isolation for credit_card_payment_allocations" ON credit_card_payment_allocations
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
    source_account_id UUID REFERENCES user_accounts(id) ON DELETE RESTRICT,
    auto_deduct BOOLEAN DEFAULT true,
    last_paid_month VARCHAR(20),
    type VARCHAR(50) NOT NULL, -- 'subscription' | 'fixed_bill' | 'utility'
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

-- ============================================================================
-- 14. TRANSACTIONAL POSTING & INTEGRITY RPCs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 14a. check_account_dependencies
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_account_dependencies(
    p_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_acc_name VARCHAR;
    v_tx_count INTEGER := 0;
    v_stmt_count INTEGER := 0;
    v_pay_count INTEGER := 0;
    v_sub_count INTEGER := 0;
    v_cb_count INTEGER := 0;
    v_has_dependencies BOOLEAN := FALSE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT name INTO v_acc_name
    FROM user_accounts
    WHERE id = p_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account does not exist or is not owned by user'
            USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_tx_count
    FROM transactions
    WHERE user_id = v_user_id
      AND (account_id = p_account_id OR to_account_id = p_account_id OR account = v_acc_name OR to_account = v_acc_name);

    SELECT COUNT(*) INTO v_stmt_count
    FROM credit_card_statements
    WHERE user_id = v_user_id AND account_id = p_account_id;

    SELECT COUNT(*) INTO v_pay_count
    FROM credit_card_payments
    WHERE user_id = v_user_id AND (account_id = p_account_id OR source_account_id = p_account_id);

    SELECT COUNT(*) INTO v_sub_count
    FROM subscriptions
    WHERE user_id = v_user_id AND (source_account_id = p_account_id OR source_account = v_acc_name);

    SELECT COUNT(*) INTO v_cb_count
    FROM credit_card_cashback_records
    WHERE user_id = v_user_id AND (account_id = p_account_id OR destination_account_id = p_account_id);

    v_has_dependencies := (v_tx_count > 0 OR v_stmt_count > 0 OR v_pay_count > 0 OR v_sub_count > 0 OR v_cb_count > 0);

    RETURN jsonb_build_object(
        'can_delete', NOT v_has_dependencies,
        'has_dependencies', v_has_dependencies,
        'account_id', p_account_id,
        'account_name', v_acc_name,
        'transaction_count', v_tx_count,
        'statement_count', v_stmt_count,
        'payment_count', v_pay_count,
        'subscription_count', v_sub_count,
        'cashback_count', v_cb_count
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14b. delete_user_account
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_user_account(
    p_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_acc_name VARCHAR;
    v_dep JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT name INTO v_acc_name
    FROM user_accounts
    WHERE id = p_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account not found or unauthorized'
            USING ERRCODE = '22023';
    END IF;

    v_dep := check_account_dependencies(p_account_id);

    IF (v_dep->>'has_dependencies')::boolean THEN
        RAISE EXCEPTION 'ACCOUNT_HAS_DEPENDENCIES: Cannot delete account "%" with active or historical financial records. Archive the account instead.', v_acc_name
            USING ERRCODE = '23503';
    END IF;

    DELETE FROM credit_card_reward_configs WHERE account_id = p_account_id AND user_id = v_user_id;
    DELETE FROM credit_card_details WHERE account_id = p_account_id AND user_id = v_user_id;
    DELETE FROM user_accounts WHERE id = p_account_id AND user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_account_id', p_account_id,
        'account_name', v_acc_name,
        'message', 'Empty account successfully deleted.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14c. record_credit_card_repayment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_credit_card_repayment(
    p_operation_id UUID,
    p_card_account_id UUID,
    p_source_account_id UUID,
    p_amount NUMERIC,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_payment_type VARCHAR DEFAULT 'custom',
    p_statement_id UUID DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_card_name VARCHAR;
    v_card_currency VARCHAR;
    v_source_name VARCHAR;
    v_source_currency VARCHAR;
    v_existing_payment RECORD;
    v_tx_id UUID;
    v_amount NUMERIC(14, 2);
    v_remaining_payment NUMERIC(14, 2);
    v_statement RECORD;
    v_st_remaining NUMERIC(14, 2);
    v_alloc_amount NUMERIC(14, 2);
    v_total_statement_alloc NUMERIC(14, 2) := 0.00;
    v_unbilled_alloc NUMERIC(14, 2) := 0.00;
    v_settled_statements UUID[] := ARRAY[]::UUID[];
    v_current_debt NUMERIC(14, 2);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to post repayments'
            USING ERRCODE = '42501';
    END IF;

    SELECT id, transaction_id, amount INTO v_existing_payment
    FROM credit_card_payments
    WHERE id = p_operation_id AND user_id = v_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'payment_id', v_existing_payment.id,
            'transaction_id', v_existing_payment.transaction_id,
            'amount', v_existing_payment.amount,
            'message', 'Operation was already recorded previously.'
        );
    END IF;

    v_amount := ROUND(p_amount::numeric, 2);
    IF v_amount IS NULL OR v_amount <= 0.00 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Repayment amount must be strictly positive'
            USING ERRCODE = '22023';
    END IF;

    IF p_card_account_id = p_source_account_id THEN
        RAISE EXCEPTION 'INVALID_ACCOUNTS: Source account and destination card cannot be the same'
            USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM user_accounts
    WHERE id = p_card_account_id AND user_id = v_user_id
    FOR UPDATE;

    PERFORM 1 FROM user_accounts
    WHERE id = p_source_account_id AND user_id = v_user_id
    FOR UPDATE;

    SELECT name, COALESCE(currency_code, 'RM') INTO v_card_name, v_card_currency
    FROM user_accounts
    WHERE id = p_card_account_id AND user_id = v_user_id AND kind = 'credit_card';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_CARD: Destination account must be an owned credit card'
            USING ERRCODE = '22023';
    END IF;

    SELECT name, COALESCE(currency_code, 'RM') INTO v_source_name, v_source_currency
    FROM user_accounts
    WHERE id = p_source_account_id AND user_id = v_user_id AND kind <> 'credit_card';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SOURCE: Source account must be an owned non-credit-card liquid account'
            USING ERRCODE = '22023';
    END IF;

    -- SAFEGUARD A: Enforce matching currency between card and payment source
    IF v_card_currency <> v_source_currency THEN
        RAISE EXCEPTION 'CURRENCY_MISMATCH: Source account currency (%) must match credit card currency (%). Cross-currency repayments are not supported.',
            v_source_currency, v_card_currency
            USING ERRCODE = '22023';
    END IF;

    SELECT 
        - (
            COALESCE(u.opening_balance, 0.00)
            + COALESCE(SUM(CASE 
                WHEN t.type = 'Income' AND (t.account_id = p_card_account_id OR (t.account_id IS NULL AND t.account = u.name)) AND t.status <> 'pending' THEN t.amount 
                ELSE 0.00 END), 0.00)
            - COALESCE(SUM(CASE 
                WHEN t.type = 'Expense' AND (t.account_id = p_card_account_id OR (t.account_id IS NULL AND t.account = u.name)) THEN t.amount 
                ELSE 0.00 END), 0.00)
            + COALESCE(SUM(CASE 
                WHEN t.type = 'Transfer' AND (t.to_account_id = p_card_account_id OR (t.to_account_id IS NULL AND t.to_account = u.name)) THEN t.amount 
                ELSE 0.00 END), 0.00)
            - COALESCE(SUM(CASE 
                WHEN t.type = 'Transfer' AND (t.account_id = p_card_account_id OR (t.account_id IS NULL AND t.account = u.name)) THEN t.amount 
                ELSE 0.00 END), 0.00)
        ) INTO v_current_debt
    FROM user_accounts u
    LEFT JOIN transactions t 
        ON (t.account_id = u.id OR t.to_account_id = u.id OR t.account = u.name OR t.to_account = u.name) 
       AND t.user_id = v_user_id 
       AND t.deleted_at IS NULL
    WHERE u.id = p_card_account_id AND u.user_id = v_user_id
    GROUP BY u.opening_balance, u.name;

    -- SAFEGUARD B1: Reject repayment if card has no outstanding debt or has positive credit balance
    IF v_current_debt IS NULL OR v_current_debt <= 0.00 THEN
        RAISE EXCEPTION 'NO_OUTSTANDING_DEBT: Credit card "%" has no outstanding debt (current balance: % %). Repayments cannot be recorded for zero or positive credit balances.',
            v_card_name, v_card_currency, COALESCE(-v_current_debt, 0.00)
            USING ERRCODE = '22023';
    END IF;

    -- SAFEGUARD B2: Reject repayment if amount exceeds current debt (+0.01 tolerance)
    IF v_amount > (v_current_debt + 0.01) THEN
        RAISE EXCEPTION 'AMOUNT_EXCEEDS_DEBT: Payment amount (% %) exceeds current card debt (% %). Unsupported overpayment.',
            v_card_currency, v_amount, v_card_currency, v_current_debt
            USING ERRCODE = '22023';
    END IF;

    v_tx_id := uuid_generate_v4();

    INSERT INTO transactions (
        id,
        user_id,
        type,
        amount,
        account,
        account_id,
        to_account,
        to_account_id,
        credit_card_tx_type,
        statement_id,
        date,
        note,
        created_at
    ) VALUES (
        v_tx_id,
        v_user_id,
        'Transfer',
        v_amount,
        v_source_name,
        p_source_account_id,
        v_card_name,
        p_card_account_id,
        'repayment',
        p_statement_id,
        p_payment_date::timestamptz,
        COALESCE(p_note, 'Repayment for ' || v_card_name),
        NOW()
    );

    INSERT INTO credit_card_payments (
        id,
        user_id,
        account_id,
        source_account_id,
        statement_id,
        transaction_id,
        payment_date,
        amount,
        payment_type,
        note,
        created_at
    ) VALUES (
        p_operation_id,
        v_user_id,
        p_card_account_id,
        p_source_account_id,
        p_statement_id,
        v_tx_id,
        p_payment_date,
        v_amount,
        COALESCE(p_payment_type, 'custom'),
        p_note,
        NOW()
    );

    v_remaining_payment := v_amount;

    IF p_statement_id IS NOT NULL THEN
        PERFORM 1 FROM credit_card_statements
        WHERE id = p_statement_id AND user_id = v_user_id AND account_id = p_card_account_id
        FOR UPDATE;

        SELECT s.id, s.closing_balance,
               s.closing_balance - COALESCE(SUM(a.allocated_amount), 0.00) AS remaining
        INTO v_statement
        FROM credit_card_statements s
        LEFT JOIN credit_card_payment_allocations a ON a.statement_id = s.id AND a.user_id = v_user_id
        WHERE s.id = p_statement_id AND s.user_id = v_user_id AND s.account_id = p_card_account_id
        GROUP BY s.id, s.closing_balance;

        IF FOUND THEN
            v_st_remaining := GREATEST(0.00, v_statement.remaining);
            v_alloc_amount := LEAST(v_remaining_payment, v_st_remaining);

            IF v_alloc_amount > 0.00 THEN
                INSERT INTO credit_card_payment_allocations (
                    user_id, payment_id, statement_id, allocated_amount, created_at
                ) VALUES (
                    v_user_id, p_operation_id, v_statement.id, v_alloc_amount, NOW()
                );

                v_total_statement_alloc := v_alloc_amount;
                v_remaining_payment := v_remaining_payment - v_alloc_amount;

                IF (v_st_remaining - v_alloc_amount) <= 0.005 THEN
                    UPDATE credit_card_statements
                    SET is_settled = TRUE, settled_at = NOW(), updated_at = NOW()
                    WHERE id = v_statement.id AND user_id = v_user_id;

                    v_settled_statements := array_append(v_settled_statements, v_statement.id);
                END IF;
            END IF;
        END IF;

    ELSE
        PERFORM 1 FROM credit_card_statements
        WHERE account_id = p_card_account_id 
          AND user_id = v_user_id 
          AND is_settled = FALSE
        FOR UPDATE;

        FOR v_statement IN
            SELECT s.id, s.closing_balance,
                   s.closing_balance - COALESCE(SUM(a.allocated_amount), 0.00) AS remaining
            FROM credit_card_statements s
            LEFT JOIN credit_card_payment_allocations a ON a.statement_id = s.id AND a.user_id = v_user_id
            WHERE s.account_id = p_card_account_id 
              AND s.user_id = v_user_id 
              AND s.is_settled = FALSE
            GROUP BY s.id, s.closing_balance, s.due_date, s.statement_date
            ORDER BY s.due_date ASC, s.statement_date ASC
        LOOP
            IF v_remaining_payment <= 0.00 THEN
                EXIT;
            END IF;

            v_st_remaining := GREATEST(0.00, v_statement.remaining);
            IF v_st_remaining > 0.00 THEN
                v_alloc_amount := LEAST(v_remaining_payment, v_st_remaining);

                INSERT INTO credit_card_payment_allocations (
                    user_id, payment_id, statement_id, allocated_amount, created_at
                ) VALUES (
                    v_user_id, p_operation_id, v_statement.id, v_alloc_amount, NOW()
                );

                v_total_statement_alloc := v_total_statement_alloc + v_alloc_amount;
                v_remaining_payment := v_remaining_payment - v_alloc_amount;

                IF (v_st_remaining - v_alloc_amount) <= 0.005 THEN
                    UPDATE credit_card_statements
                    SET is_settled = TRUE, settled_at = NOW(), updated_at = NOW()
                    WHERE id = v_statement.id AND user_id = v_user_id;

                    v_settled_statements := array_append(v_settled_statements, v_statement.id);
                END IF;
            END IF;
        END LOOP;
    END IF;

    v_unbilled_alloc := v_remaining_payment;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'payment_id', p_operation_id,
        'transaction_id', v_tx_id,
        'amount', v_amount,
        'statement_allocated', v_total_statement_alloc,
        'unbilled_allocated', v_unbilled_alloc,
        'settled_statement_ids', v_settled_statements
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14d. post_credit_card_cashback
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_credit_card_cashback(
    p_operation_id UUID,
    p_card_id UUID,
    p_destination_account_id UUID,
    p_destination_type VARCHAR(30),
    p_amount NUMERIC(14, 2),
    p_reward_date DATE,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_card_name TEXT;
    v_card_kind TEXT;
    v_dest_name TEXT;
    v_dest_kind TEXT;
    v_target_account_id UUID;
    v_target_account_name TEXT;
    v_transaction_id UUID;
    v_tx_note TEXT;
    v_tx_category TEXT;
    v_existing_record RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Cashback amount must be greater than zero' USING ERRCODE = '22023';
    END IF;

    IF p_destination_type NOT IN ('card_statement_credit', 'bank_deposit') THEN
        RAISE EXCEPTION 'INVALID_TYPE: Invalid destination type: %. Must be card_statement_credit or bank_deposit.', p_destination_type
            USING ERRCODE = '22023';
    END IF;

    SELECT 
        c.id, c.account_id, c.destination_account_id, c.destination_type,
        c.amount, c.transaction_id, c.reward_date, c.note, c.created_at
    INTO v_existing_record
    FROM credit_card_cashback_records c
    WHERE c.id = p_operation_id AND c.user_id = v_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'record', jsonb_build_object(
                'id', v_existing_record.id,
                'userId', v_user_id,
                'cardId', v_existing_record.account_id,
                'destinationAccountId', v_existing_record.destination_account_id,
                'creditDestination', v_existing_record.destination_type,
                'amount', v_existing_record.amount,
                'transactionId', v_existing_record.transaction_id,
                'date', v_existing_record.reward_date,
                'note', v_existing_record.note,
                'createdAt', v_existing_record.created_at
            )
        );
    END IF;

    SELECT name, kind INTO v_card_name, v_card_kind
    FROM user_accounts
    WHERE id = p_card_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit card account not found or access denied.' USING ERRCODE = '22023';
    END IF;

    IF v_card_kind <> 'credit_card' THEN
        RAISE EXCEPTION 'Account % is not a credit card.', v_card_name USING ERRCODE = '22023';
    END IF;

    SELECT name, kind INTO v_dest_name, v_dest_kind
    FROM user_accounts
    WHERE id = p_destination_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account not found or access denied.' USING ERRCODE = '22023';
    END IF;

    IF p_destination_type = 'bank_deposit' AND v_dest_kind = 'credit_card' THEN
        RAISE EXCEPTION 'Bank deposit destination cannot be a credit card.' USING ERRCODE = '22023';
    END IF;

    IF p_destination_type = 'card_statement_credit' THEN
        v_target_account_id := p_card_id;
        v_target_account_name := v_card_name;
        v_tx_category := 'Card Statement Credit';
        v_tx_note := COALESCE(p_note, 'Statement credit cashback (' || v_card_name || ')');
    ELSE
        v_target_account_id := p_destination_account_id;
        v_target_account_name := v_dest_name;
        v_tx_category := 'Cashback & Rewards';
        v_tx_note := COALESCE(p_note, 'Cashback deposit from ' || v_card_name);
    END IF;

    v_transaction_id := uuid_generate_v4();

    INSERT INTO transactions (
        id,
        user_id,
        type,
        amount,
        category,
        account,
        account_id,
        date,
        note,
        credit_card_tx_type,
        status,
        created_at
    ) VALUES (
        v_transaction_id,
        v_user_id,
        'Income',
        p_amount,
        v_tx_category,
        v_target_account_name,
        v_target_account_id,
        p_reward_date::timestamptz,
        v_tx_note,
        'cashback',
        'cleared',
        NOW()
    );

    INSERT INTO credit_card_cashback_records (
        id,
        user_id,
        account_id,
        destination_account_id,
        destination_type,
        amount,
        transaction_id,
        reward_date,
        note,
        created_at
    ) VALUES (
        p_operation_id,
        v_user_id,
        p_card_id,
        p_destination_account_id,
        p_destination_type,
        p_amount,
        v_transaction_id,
        p_reward_date,
        p_note,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', false,
        'record', jsonb_build_object(
            'id', p_operation_id,
            'userId', v_user_id,
            'cardId', p_card_id,
            'destinationAccountId', p_destination_account_id,
            'creditDestination', p_destination_type,
            'amount', p_amount,
            'transactionId', v_transaction_id,
            'date', p_reward_date,
            'note', p_note,
            'createdAt', NOW()
        ),
        'transaction', jsonb_build_object(
            'id', v_transaction_id,
            'userId', v_user_id,
            'type', 'Income',
            'amount', p_amount,
            'category', v_tx_category,
            'account', v_target_account_name,
            'accountId', v_target_account_id,
            'date', p_reward_date,
            'note', v_tx_note,
            'creditCardTxType', 'cashback',
            'status', 'cleared'
        )
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. PERMISSION HARDENING: RESTRICT EXECUTION TO AUTHENTICATED USERS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION check_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_account_dependencies(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) TO authenticated, service_role;

