-- ============================================================================
-- Migration 009: Credit Card Payment Integrity & Transactional Allocations
-- Universal Expense Tracker — Stage B
-- ============================================================================
-- SAFETY MODEL (Zero-Downtime & Additive):
--   1. All schema modifications are strictly ADDITIVE.
--   2. Non-credit card accounts and general transactions are completely unaffected.
--   3. Cross-user data isolation is enforced via composite foreign keys (table_id, user_id).
--   4. Full RLS policies active on every new table.
--   5. Idempotent: safe to run multiple times without data duplication.
--   6. Replaces separate multi-step client writes with a transactional PostgreSQL RPC.
--
-- DO NOT EXECUTE DIRECTLY VIA AGENT.
-- Review this file, then execute manually in Supabase SQL Editor when approved:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. CREDIT CARD PAYMENT ALLOCATIONS TABLE
-- ----------------------------------------------------------------------------
-- Tracks exact, auditable amount allocated from a credit card payment to a
-- specific statement cycle. Enables partial repayments, multi-statement waterfall
-- settlements, and derives remaining balances mathematically without ambiguous guessing.

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

-- Indexes for fast allocation retrieval and statement balance derivation
CREATE INDEX IF NOT EXISTS idx_cc_allocations_user_statement
    ON credit_card_payment_allocations (user_id, statement_id);

CREATE INDEX IF NOT EXISTS idx_cc_allocations_user_payment
    ON credit_card_payment_allocations (user_id, payment_id);

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE credit_card_payment_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_card_payment_allocations' 
          AND policyname = 'Users can only access their own payment allocations'
    ) THEN
        CREATE POLICY "Users can only access their own payment allocations"
            ON credit_card_payment_allocations
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. TRANSACTIONAL POSTING RPC: record_credit_card_repayment
-- ----------------------------------------------------------------------------
-- Atomically creates:
--   1. Ledger transfer in `transactions` (credit_card_tx_type = 'repayment')
--   2. Payment record in `credit_card_payments` (explicitly linked to the transaction)
--   3. Allocation records in `credit_card_payment_allocations`
--   4. Updates `is_settled` status on statements whose balance is satisfied.
--
-- Idempotency: If `p_operation_id` was already processed, it returns the existing
-- record without double-deducting funds or creating duplicate records.

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
    v_source_name VARCHAR;
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
BEGIN
    -- 1. Security: Verify authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to post repayments';
    END IF;

    -- 2. Idempotency Check: Did this operation ID already succeed?
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

    -- 3. Input Validation
    v_amount := ROUND(p_amount::numeric, 2);
    IF v_amount IS NULL OR v_amount <= 0.00 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Repayment amount must be strictly positive';
    END IF;

    IF p_card_account_id = p_source_account_id THEN
        RAISE EXCEPTION 'INVALID_ACCOUNTS: Source account and destination card cannot be the same';
    END IF;

    -- 4. Verify Account Ownership & Types
    SELECT name INTO v_card_name
    FROM user_accounts
    WHERE id = p_card_account_id AND user_id = v_user_id AND kind = 'credit_card';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_CARD: Destination account must be an owned credit card';
    END IF;

    SELECT name INTO v_source_name
    FROM user_accounts
    WHERE id = p_source_account_id AND user_id = v_user_id AND kind <> 'credit_card';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SOURCE: Source account must be an owned non-credit-card liquid account';
    END IF;

    -- 5. Atomic Ledger Transaction Creation (Transfer)
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

    -- 6. Insert credit_card_payments record linked to the ledger transaction
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

    -- 7. Calculate and Insert Allocations
    v_remaining_payment := v_amount;

    IF p_statement_id IS NOT NULL THEN
        -- Case A: Explicit single statement targeted
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
        -- Case B: Multi-statement waterfall allocation (oldest due date first)
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

    -- Any payment remainder represents unbilled purchase clearing (reduces total card debt)
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
-- 4. NON-DESTRUCTIVE LEGACY BACKFILL FOR EXISTING ALLOCATIONS
-- ----------------------------------------------------------------------------
-- Safely backfills allocations for existing payments where statement_id was explicitly
-- set and no allocation record currently exists. Payments with statement_id IS NULL
-- are preserved as general unbilled repayments and are NOT retroactively modified.

INSERT INTO credit_card_payment_allocations (user_id, payment_id, statement_id, allocated_amount, created_at)
SELECT 
    p.user_id,
    p.id,
    p.statement_id,
    LEAST(p.amount, s.closing_balance),
    p.created_at
FROM credit_card_payments p
JOIN credit_card_statements s ON s.id = p.statement_id AND s.user_id = p.user_id
WHERE p.statement_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM credit_card_payment_allocations a 
      WHERE a.payment_id = p.id AND a.statement_id = p.statement_id
  );

-- Update is_settled on existing statements whose balance was satisfied by backfilled allocations
UPDATE credit_card_statements s
SET is_settled = TRUE,
    settled_at = COALESCE(s.settled_at, NOW()),
    updated_at = NOW()
WHERE s.is_settled = FALSE
  AND s.closing_balance <= (
      SELECT COALESCE(SUM(a.allocated_amount), 0.00)
      FROM credit_card_payment_allocations a
      WHERE a.statement_id = s.id AND a.user_id = s.user_id
  );
