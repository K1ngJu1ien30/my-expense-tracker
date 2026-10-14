-- ============================================================================
-- Migration 011: Cashback Persistence Reliability & Atomic Posting
-- Universal Expense Tracker — Stage E
-- ============================================================================
-- SAFETY MODEL (Zero-Downtime & Additive):
--   1. Provides an atomic, idempotent PostgreSQL RPC `post_credit_card_cashback`
--      that synchronizes the general ledger `transactions` table with the
--      `credit_card_cashback_records` audit trail.
--   2. Enforces mutual foreign-key linkage: every confirmed cashback record is
--      linked directly to its underlying financial ledger transaction.
--   3. Idempotent: client-generated `operation_id` prevents duplicate credits
--      on retry, network interruptions, or concurrent submissions.
--   4. Validates user ownership on source credit card and destination accounts.
--   5. Strictly additive — does not drop existing tables or alter existing records.
--
-- DO NOT EXECUTE DIRECTLY VIA AGENT.
-- Review this file, then execute manually in Supabase SQL Editor when approved:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STRENGTHEN INTEGRITY CONSTRAINTS ON credit_card_cashback_records
-- ----------------------------------------------------------------------------

-- Ensure composite uniqueness and foreign key linkage
DO $$
BEGIN
    -- Composite unique constraint on (id, user_id) for safe composite FK referencing
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_cc_cashback_records_id_user'
    ) THEN
        ALTER TABLE credit_card_cashback_records
            ADD CONSTRAINT uq_cc_cashback_records_id_user 
            UNIQUE (id, user_id);
    END IF;

    -- Ensure transaction_id has RESTRICT constraint to prevent ledger desync
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_cc_cashback_transaction'
    ) THEN
        ALTER TABLE credit_card_cashback_records 
            DROP CONSTRAINT fk_cc_cashback_transaction;
    END IF;

    ALTER TABLE credit_card_cashback_records
        ADD CONSTRAINT fk_cc_cashback_transaction
        FOREIGN KEY (transaction_id, user_id)
        REFERENCES transactions (id, user_id)
        ON DELETE RESTRICT;
END $$;

-- Performance index for transaction lookup
CREATE INDEX IF NOT EXISTS idx_cc_cashback_records_tx_user
    ON credit_card_cashback_records (user_id, transaction_id)
    WHERE transaction_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. ATOMIC RPC: post_credit_card_cashback
-- ----------------------------------------------------------------------------
-- Atomically posts a confirmed credit card cashback redemption:
--   Step 1: Validates authenticated user identity & account ownership.
--   Step 2: Checks idempotency via p_operation_id (prevents duplicate posting).
--   Step 3: Creates the ledger transaction in `transactions`.
--           • For 'card_statement_credit': posted as Income on the credit card (reducing debt).
--           • For 'bank_deposit': posted as Income on the destination bank account (increasing cash).
--   Step 4: Creates the audit record in `credit_card_cashback_records` linked to the transaction.
--   Step 5: Returns the complete atomic payload as JSON.

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
    -- 1. Authenticate caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate input parameters
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Cashback amount must be greater than zero.' USING ERRCODE = '22023';
    END IF;

    IF p_destination_type NOT IN ('card_statement_credit', 'bank_deposit') THEN
        RAISE EXCEPTION 'Invalid destination type: %. Must be card_statement_credit or bank_deposit.', p_destination_type
            USING ERRCODE = '22023';
    END IF;

    -- 3. Idempotency Check: Return existing record if already processed
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

    -- 4. Verify card ownership and account kind
    SELECT name, kind INTO v_card_name, v_card_kind
    FROM user_accounts
    WHERE id = p_card_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit card account not found or access denied.' USING ERRCODE = '22023';
    END IF;

    IF v_card_kind <> 'credit_card' THEN
        RAISE EXCEPTION 'Account % is not a credit card.', v_card_name USING ERRCODE = '22023';
    END IF;

    -- 5. Verify destination account ownership
    SELECT name, kind INTO v_dest_name, v_dest_kind
    FROM user_accounts
    WHERE id = p_destination_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account not found or access denied.' USING ERRCODE = '22023';
    END IF;

    -- 6. Configure ledger target and classification
    IF p_destination_type = 'card_statement_credit' THEN
        v_target_account_id := p_card_id;
        v_target_account_name := v_card_name;
        v_tx_category := 'Card Statement Credit';
        v_tx_note := COALESCE(NULLIF(TRIM(p_note), ''), 'Statement credit cashback (' || v_card_name || ')');
    ELSE
        v_target_account_id := p_destination_account_id;
        v_target_account_name := v_dest_name;
        v_tx_category := 'Cashback & Rewards';
        v_tx_note := COALESCE(NULLIF(TRIM(p_note), ''), 'Cashback deposit from ' || v_card_name);
    END IF;

    -- Generate a distinct UUID for the financial ledger transaction
    v_transaction_id := uuid_generate_v4();

    -- 7. Insert the Ledger Transaction atomically
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
        p_reward_date,
        v_tx_note,
        'cashback',
        'cleared',
        NOW()
    );

    -- 8. Insert the Confirmed Cashback Record linked to the transaction
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
        NULLIF(TRIM(p_note), ''),
        NOW()
    );

    -- 9. Return verified payload
    RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', false,
        'record', jsonb_build_object(
            'id', p_operation_id,
            'userId', v_user_id,
            'cardId', p_card_id,
            'cardName', v_card_name,
            'destinationAccountId', p_destination_account_id,
            'destinationAccountName', v_dest_name,
            'creditDestination', p_destination_type,
            'amount', p_amount,
            'transactionId', v_transaction_id,
            'date', p_reward_date,
            'note', NULLIF(TRIM(p_note), ''),
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) 
    TO authenticated;

COMMENT ON FUNCTION post_credit_card_cashback IS 
    'Atomically posts a confirmed cashback redemption, creating both the ledger transaction and the cashback audit record with idempotency.';
