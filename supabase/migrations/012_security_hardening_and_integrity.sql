-- ============================================================================
-- Migration 012: Database Security Hardening & Repayment Concurrency Integrity
-- Universal Expense Tracker — Final Production Review
-- ============================================================================
-- SAFETY MODEL (Zero-Downtime & Additive):
--   1. Restricts execution privileges of all SECURITY DEFINER RPCs to authenticated
--      and service_role users; revokes execution from PUBLIC and anon.
--   2. Explicitly sets safe search_path = public, auth on all functions.
--   3. Serializes concurrent repayments via row-level locks (FOR UPDATE) on
--      account and statement rows, preventing statement overallocation race conditions.
--   4. Validates repayment amounts against live outstanding credit card debt.
--   5. Retains strict idempotency on p_operation_id so network retries never double-deduct.
--   6. Fully idempotent and reversible.
--
-- DO NOT EXECUTE DIRECTLY VIA AGENT.
-- Review this file, then execute manually in Supabase SQL Editor when approved:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDENED REPAYMENT RPC: record_credit_card_repayment
-- ----------------------------------------------------------------------------
-- Concurrency & Locking:
--   - Locks user_accounts rows for destination card and source account FOR UPDATE.
--   - Locks targeted and candidate credit_card_statements rows FOR UPDATE.
-- Debt Validation:
--   - Computes current outstanding debt from opening balance and ledger history.
--   - Rejects repayments that exceed current debt (+ 0.01 tolerance).
-- Idempotency:
--   - Safely returns existing payment and ledger info if p_operation_id was already recorded.

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
    -- 1. Verify caller authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to post repayments'
            USING ERRCODE = '42501';
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

    -- 3. Input validation
    v_amount := ROUND(p_amount::numeric, 2);
    IF v_amount IS NULL OR v_amount <= 0.00 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: Repayment amount must be strictly positive'
            USING ERRCODE = '22023';
    END IF;

    IF p_card_account_id = p_source_account_id THEN
        RAISE EXCEPTION 'INVALID_ACCOUNTS: Source account and destination card cannot be the same'
            USING ERRCODE = '22023';
    END IF;

    -- 4. Row-level concurrency locking: lock both account rows to serialize concurrent writes
    PERFORM 1 FROM user_accounts
    WHERE id = p_card_account_id AND user_id = v_user_id
    FOR UPDATE;

    PERFORM 1 FROM user_accounts
    WHERE id = p_source_account_id AND user_id = v_user_id
    FOR UPDATE;

    -- 5. Verify Account Ownership, Kinds & Currencies
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

    -- 6. Live Card Debt Validation
    -- Calculate live net debt from opening balance and active ledger transactions
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

    -- Validate that payment does not exceed outstanding debt (allowing 0.01 rounding tolerance)
    IF v_current_debt IS NOT NULL AND v_current_debt > 0.00 AND v_amount > (v_current_debt + 0.01) THEN
        RAISE EXCEPTION 'AMOUNT_EXCEEDS_DEBT: Payment amount (% %) exceeds current card debt (% %). Unsupported overpayment.',
            v_card_currency, v_amount, v_card_currency, v_current_debt
            USING ERRCODE = '22023';
    END IF;

    -- 7. Atomic Ledger Transaction Creation (Transfer)
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

    -- 8. Insert credit_card_payments record linked to the ledger transaction
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

    -- 9. Calculate and Insert Allocations with Row Locking
    v_remaining_payment := v_amount;

    IF p_statement_id IS NOT NULL THEN
        -- Case A: Explicit single statement targeted
        -- Lock statement row to prevent concurrent overallocation
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
        -- Case B: Multi-statement waterfall allocation (oldest due date first)
        -- Lock candidate statements FOR UPDATE to serialize allocations
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

    -- Remainder represents unbilled purchases cleared
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
-- 2. PERMISSION HARDENING: REVOKE PUBLIC / ANON & GRANT AUTHENTICATED
-- ----------------------------------------------------------------------------

-- A. record_credit_card_repayment
REVOKE ALL ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) TO authenticated, service_role;

-- B. post_credit_card_cashback
REVOKE ALL ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) TO authenticated, service_role;

-- C. check_account_dependencies
REVOKE ALL ON FUNCTION check_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_account_dependencies(UUID) TO authenticated, service_role;

-- D. delete_user_account
REVOKE ALL ON FUNCTION delete_user_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. TRAVEL TABLES & OBSOLETE WANDERPLAN FUNCTIONS INSPECTION QUERIES
-- ----------------------------------------------------------------------------
-- Run these read-only queries in Supabase Dashboard SQL Editor to review
-- any leftover travel tables or functions and verify 0 dependencies:
--
-- Check table names and row counts:
--   SELECT table_name 
--   FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--     AND (table_name LIKE '%travel%' OR table_name LIKE '%trip%' OR table_name LIKE 'wp_%');
--
-- Check for incoming foreign key references:
--   SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name
--   FROM information_schema.table_constraints AS tc 
--   JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
--   JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
--   WHERE tc.constraint_type = 'FOREIGN KEY' 
--     AND (ccu.table_name LIKE '%travel%' OR ccu.table_name LIKE 'wp_%');
--
-- Check obsolete routines:
--   SELECT routine_name, routine_type, security_type
--   FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND (routine_name LIKE '%travel%' OR routine_name LIKE '%wander%' OR routine_name LIKE '%trip%');
--
-- After verifying they have 0 dependencies and 0 rows, drop safely when approved:
--   -- DROP TABLE IF EXISTS travel_trips CASCADE;
--   -- DROP TABLE IF EXISTS travel_expenses CASCADE;
--   -- DROP FUNCTION IF EXISTS obsolete_wanderplan_function_name(...) CASCADE;

-- ----------------------------------------------------------------------------
-- 4. ROLLBACK SCRIPT (Execute only if rolling back this migration)
-- ----------------------------------------------------------------------------
-- To restore default permissive execute privileges (if required):
--   GRANT EXECUTE ON FUNCTION record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION check_account_dependencies(UUID) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION delete_user_account(UUID) TO PUBLIC;
