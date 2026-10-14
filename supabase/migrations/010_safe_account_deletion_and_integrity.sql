-- ============================================================================
-- Migration 010: Safe Account Deletion & Integrity Cascades
-- Universal Expense Tracker — Stage C
-- ============================================================================
-- SAFETY MODEL (Zero-Downtime & Additive):
--   1. Protects financial ledgers and historical reporting from unsafe account deletion.
--   2. Replaces unsafe cascading deletes (ON DELETE CASCADE) with ON DELETE RESTRICT
--      on all financial tables (statements, payments, cashback, transactions, subscriptions).
--   3. Replaces illegal composite foreign keys using ON DELETE SET NULL (which attempt
--      to null a required user_id) with strict ON DELETE RESTRICT.
--   4. Provides database-level RPCs for dependency verification and safe deletion.
--   5. Idempotent: safe to run multiple times without data loss.
--
-- DO NOT EXECUTE DIRECTLY VIA AGENT.
-- Review this file, then execute manually in Supabase SQL Editor when approved:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STRENGTHEN FOREIGN KEYS ON user_accounts
-- ----------------------------------------------------------------------------
-- Replace ON DELETE CASCADE and ON DELETE SET NULL with ON DELETE RESTRICT
-- to prevent accidental destruction or corruption of financial records.

-- 1a. Transactions: Account & To-Account
DO $$
BEGIN
    -- Drop legacy SET NULL foreign keys if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_user_account') THEN
        ALTER TABLE transactions DROP CONSTRAINT fk_transactions_user_account;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_account_id') THEN
        ALTER TABLE transactions DROP CONSTRAINT fk_transactions_account_id;
    END IF;

    -- Add protected RESTRICT constraint
    ALTER TABLE transactions
        ADD CONSTRAINT fk_transactions_user_account
        FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_user_to_account') THEN
        ALTER TABLE transactions DROP CONSTRAINT fk_transactions_user_to_account;
    END IF;

    ALTER TABLE transactions
        ADD CONSTRAINT fk_transactions_user_to_account
        FOREIGN KEY (to_account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 1b. Subscriptions & Recurring Bills
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_user_account') THEN
        ALTER TABLE subscriptions DROP CONSTRAINT fk_subscriptions_user_account;
    END IF;

    ALTER TABLE subscriptions
        ADD CONSTRAINT fk_subscriptions_user_account
        FOREIGN KEY (source_account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 1c. Credit Card Statements
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_credit_card_statements_account') THEN
        ALTER TABLE credit_card_statements DROP CONSTRAINT fk_credit_card_statements_account;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_statement_account') THEN
        ALTER TABLE credit_card_statements DROP CONSTRAINT fk_cc_statement_account;
    END IF;

    ALTER TABLE credit_card_statements
        ADD CONSTRAINT fk_credit_card_statements_account
        FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 1d. Credit Card Payments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_payments_account') THEN
        ALTER TABLE credit_card_payments DROP CONSTRAINT fk_cc_payments_account;
    END IF;

    ALTER TABLE credit_card_payments
        ADD CONSTRAINT fk_cc_payments_account
        FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;

    -- Ensure source account is also RESTRICT
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_payments_source') THEN
        ALTER TABLE credit_card_payments DROP CONSTRAINT fk_cc_payments_source;
    END IF;

    ALTER TABLE credit_card_payments
        ADD CONSTRAINT fk_cc_payments_source
        FOREIGN KEY (source_account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 1e. Credit Card Cashback Records
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_cashback_account') THEN
        ALTER TABLE credit_card_cashback_records DROP CONSTRAINT fk_cc_cashback_account;
    END IF;

    ALTER TABLE credit_card_cashback_records
        ADD CONSTRAINT fk_cc_cashback_account
        FOREIGN KEY (account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_cashback_destination') THEN
        ALTER TABLE credit_card_cashback_records DROP CONSTRAINT fk_cc_cashback_destination;
    END IF;

    ALTER TABLE credit_card_cashback_records
        ADD CONSTRAINT fk_cc_cashback_destination
        FOREIGN KEY (destination_account_id, user_id)
        REFERENCES user_accounts (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- ----------------------------------------------------------------------------
-- 2. REPAIR COMPOSITE FOREIGN KEYS USING ON DELETE SET NULL
-- ----------------------------------------------------------------------------
-- Composite foreign keys (column, user_id) referencing (id, user_id) with
-- ON DELETE SET NULL are invalid when user_id is NOT NULL. Change them to RESTRICT
-- so dependent financial records cannot be silently orphaned or broken.

-- 2a. Statement reference in credit_card_payments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_payments_statement') THEN
        ALTER TABLE credit_card_payments DROP CONSTRAINT fk_cc_payments_statement;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_payment_statement') THEN
        ALTER TABLE credit_card_payments DROP CONSTRAINT fk_cc_payment_statement;
    END IF;

    ALTER TABLE credit_card_payments
        ADD CONSTRAINT fk_cc_payments_statement
        FOREIGN KEY (statement_id, user_id)
        REFERENCES credit_card_statements (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 2b. Transaction link in credit_card_payments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_payments_transaction') THEN
        ALTER TABLE credit_card_payments DROP CONSTRAINT fk_cc_payments_transaction;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_payment_transaction') THEN
        ALTER TABLE credit_card_payments DROP CONSTRAINT fk_cc_payment_transaction;
    END IF;

    ALTER TABLE credit_card_payments
        ADD CONSTRAINT fk_cc_payments_transaction
        FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 2c. Statement link in transactions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transactions_statement') THEN
        ALTER TABLE transactions DROP CONSTRAINT fk_transactions_statement;
    END IF;

    ALTER TABLE transactions
        ADD CONSTRAINT fk_transactions_statement
        FOREIGN KEY (statement_id, user_id)
        REFERENCES credit_card_statements (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- 2d. Transaction link in credit_card_cashback_records
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cc_cashback_transaction') THEN
        ALTER TABLE credit_card_cashback_records DROP CONSTRAINT fk_cc_cashback_transaction;
    END IF;

    ALTER TABLE credit_card_cashback_records
        ADD CONSTRAINT fk_cc_cashback_transaction
        FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- ----------------------------------------------------------------------------
-- 3. DATABASE RPC: check_account_dependencies
-- ----------------------------------------------------------------------------
-- Audits all dependent financial records for a given account before deletion.

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
    v_summary TEXT := '';
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required';
    END IF;

    SELECT name INTO v_acc_name
    FROM user_accounts
    WHERE id = p_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account does not exist or is not owned by user';
    END IF;

    -- Count ledger transactions
    SELECT COUNT(*) INTO v_tx_count
    FROM transactions
    WHERE user_id = v_user_id
      AND (account_id = p_account_id OR to_account_id = p_account_id OR account = v_acc_name OR to_account = v_acc_name);

    -- Count credit card statements
    SELECT COUNT(*) INTO v_stmt_count
    FROM credit_card_statements
    WHERE user_id = v_user_id AND account_id = p_account_id;

    -- Count repayments
    SELECT COUNT(*) INTO v_pay_count
    FROM credit_card_payments
    WHERE user_id = v_user_id AND (account_id = p_account_id OR source_account_id = p_account_id);

    -- Count subscriptions / recurring bills
    SELECT COUNT(*) INTO v_sub_count
    FROM subscriptions
    WHERE user_id = v_user_id AND (source_account_id = p_account_id OR source_account = v_acc_name);

    -- Count cashback records
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
-- 4. DATABASE RPC: delete_user_account (Safe Account Deletion)
-- ----------------------------------------------------------------------------
-- Atomically deletes a user account ONLY IF it has 0 dependent financial records.
-- If any financial record exists, raises an exception and aborts.

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
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required';
    END IF;

    -- Verify ownership
    SELECT name INTO v_acc_name
    FROM user_accounts
    WHERE id = p_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Account not found or unauthorized';
    END IF;

    -- Check dependencies
    v_dep := check_account_dependencies(p_account_id);

    IF (v_dep->>'has_dependencies')::boolean THEN
        RAISE EXCEPTION 'ACCOUNT_HAS_DEPENDENCIES: Cannot delete account "%" with active or historical financial records. Archive the account instead.', v_acc_name
            USING ERRCODE = '23503';
    END IF;

    -- Safe to delete empty metadata and account record
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
