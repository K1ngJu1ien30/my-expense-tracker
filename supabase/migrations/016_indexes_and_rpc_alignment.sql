-- ============================================================================
-- Migration 016: Missing Query Indexes & Hardened RPC Alignment
-- Universal Expense Tracker — Release v3.5.0+
-- ============================================================================
-- OBJECTIVES:
--   1. Add missing composite indexes matching live hook queries across
--      `goals`, `subscriptions`, `credit_card_statements`, `credit_card_payments`,
--      `credit_card_payment_allocations`, and `credit_card_cashback_records`.
--   2. Align `record_credit_card_repayment`:
--      - Set canonical `category = 'Transfer'` on inserted repayment rows.
--      - Exclude archived and investment accounts as repayment sources.
--      - Lock `user_accounts` rows in deterministic `ORDER BY id FOR UPDATE`
--        order to guarantee deadlock freedom under concurrent writes.
--   3. Align `post_credit_card_cashback`:
--      - Acquire deterministic `FOR UPDATE` row locks on involved `user_accounts`.
--      - Enforce non-credit-card & matching-currency guard on `bank_deposit`.
--      - Return both snake_case and camelCase keys + `cardName`/`destinationAccountName`
--        even on idempotent duplicate retries.
--   4. Strictly revoke PUBLIC/anon EXECUTE privileges and grant only to
--      `authenticated, service_role` with `SET search_path = public, auth`.
--
-- DO NOT EXECUTE AUTOMATICALLY.
-- Review this script, then apply manually in the Supabase Dashboard SQL Editor:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: READ-ONLY PRE-FLIGHT INSPECTION QUERIES
-- ----------------------------------------------------------------------------
--   SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND tablename IN (
--       'goals', 'subscriptions', 'credit_card_statements',
--       'credit_card_payments', 'credit_card_payment_allocations',
--       'credit_card_cashback_records'
--     )
--   ORDER BY tablename, indexname;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- SECTION 2: ADDITIVE COMPOSITE INDEXES MATCHING LIVE HOOK QUERIES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_goals_user_created_at
  ON public.goals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_created_at
  ON public.subscriptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_statements_user_stmt_date
  ON public.credit_card_statements (user_id, statement_date DESC);

CREATE INDEX IF NOT EXISTS idx_cc_payments_user_pay_date
  ON public.credit_card_payments (user_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_cc_payments_user_source_acc
  ON public.credit_card_payments (user_id, source_account_id);

CREATE INDEX IF NOT EXISTS idx_cc_allocations_user_created_at
  ON public.credit_card_payment_allocations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cc_cashback_user_reward_date
  ON public.credit_card_cashback_records (user_id, reward_date DESC);

CREATE INDEX IF NOT EXISTS idx_cc_cashback_user_dest_acc
  ON public.credit_card_cashback_records (user_id, destination_account_id);

-- ----------------------------------------------------------------------------
-- SECTION 3: ALIGN `record_credit_card_repayment` RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_credit_card_repayment(
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
    v_existing_payment RECORD;
    v_card_name TEXT;
    v_card_currency TEXT;
    v_source_name TEXT;
    v_source_currency TEXT;
    v_tx_id UUID;
    v_amount NUMERIC(12,2);
    v_current_debt NUMERIC(12,2);
    v_remaining_to_allocate NUMERIC(12,2);
    v_stmt RECORD;
    v_stmt_allocated NUMERIC(12,2);
    v_stmt_remaining NUMERIC(12,2);
    v_alloc_now NUMERIC(12,2);
    v_total_stmt_allocated NUMERIC(12,2) := 0;
    v_settled_ids JSONB := '[]'::jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Authentication required to post repayments'
            USING ERRCODE = '42501';
    END IF;

    -- Idempotency check
    SELECT id, transaction_id, amount INTO v_existing_payment
    FROM public.credit_card_payments
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

    -- Deterministic lock ordering prevents deadlocks under concurrent repayments
    PERFORM 1 FROM public.user_accounts
    WHERE user_id = v_user_id
      AND id IN (p_card_account_id, p_source_account_id)
    ORDER BY id ASC
    FOR UPDATE;

    SELECT name, COALESCE(currency_code, 'RM') INTO v_card_name, v_card_currency
    FROM public.user_accounts
    WHERE id = p_card_account_id
      AND user_id = v_user_id
      AND kind = 'credit_card'
      AND COALESCE(is_archived, FALSE) = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_CARD: Destination account must be an active owned credit card'
            USING ERRCODE = '22023';
    END IF;

    SELECT name, COALESCE(currency_code, 'RM') INTO v_source_name, v_source_currency
    FROM public.user_accounts
    WHERE id = p_source_account_id
      AND user_id = v_user_id
      AND kind NOT IN ('credit_card', 'investment')
      AND COALESCE(is_archived, FALSE) = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SOURCE: Source account must be an active owned liquid account'
            USING ERRCODE = '22023';
    END IF;

    IF UPPER(v_card_currency) <> UPPER(v_source_currency) THEN
        RAISE EXCEPTION 'CURRENCY_MISMATCH: Source account currency (%) must match credit card currency (%). Cross-currency repayments are not supported.',
            v_source_currency, v_card_currency
            USING ERRCODE = '22023';
    END IF;

    -- Live debt validation
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
    FROM public.user_accounts u
    LEFT JOIN public.transactions t
        ON (t.account_id = u.id OR t.to_account_id = u.id OR t.account = u.name OR t.to_account = u.name)
       AND t.user_id = v_user_id
       AND t.deleted_at IS NULL
    WHERE u.id = p_card_account_id AND u.user_id = v_user_id
    GROUP BY u.opening_balance, u.name;

    IF v_current_debt IS NULL OR v_current_debt <= 0.00 THEN
        RAISE EXCEPTION 'NO_OUTSTANDING_DEBT: Credit card "%" has no outstanding debt.',
            v_card_name USING ERRCODE = '22023';
    END IF;

    IF v_amount > (v_current_debt + 0.01) THEN
        RAISE EXCEPTION 'AMOUNT_EXCEEDS_DEBT: Payment amount (% %) exceeds current card debt (% %).',
            v_card_currency, v_amount, v_card_currency, v_current_debt
            USING ERRCODE = '22023';
    END IF;

    v_tx_id := uuid_generate_v4();

    INSERT INTO public.transactions (
        id, user_id, type, amount, category,
        account, account_id, to_account, to_account_id,
        credit_card_tx_type, statement_id, date, note, created_at
    ) VALUES (
        v_tx_id, v_user_id, 'Transfer', v_amount, 'Transfer',
        v_source_name, p_source_account_id, v_card_name, p_card_account_id,
        'repayment', p_statement_id, COALESCE(p_payment_date, CURRENT_DATE)::timestamptz,
        COALESCE(p_note, 'Repayment for ' || v_card_name), NOW()
    );

    INSERT INTO public.credit_card_payments (
        id, user_id, account_id, source_account_id, statement_id,
        transaction_id, payment_date, amount, payment_type, note, created_at
    ) VALUES (
        p_operation_id, v_user_id, p_card_account_id, p_source_account_id, p_statement_id,
        v_tx_id, COALESCE(p_payment_date, CURRENT_DATE), v_amount, COALESCE(p_payment_type, 'custom'), p_note, NOW()
    );

    v_remaining_to_allocate := v_amount;

    FOR v_stmt IN
        SELECT id, closing_balance, is_settled
        FROM public.credit_card_statements
        WHERE user_id = v_user_id
          AND account_id = p_card_account_id
          AND is_settled = FALSE
        ORDER BY
            CASE WHEN id = p_statement_id THEN 0 ELSE 1 END ASC,
            statement_date ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining_to_allocate <= 0.00;

        SELECT COALESCE(SUM(allocated_amount), 0.00) INTO v_stmt_allocated
        FROM public.credit_card_payment_allocations
        WHERE statement_id = v_stmt.id AND user_id = v_user_id;

        v_stmt_remaining := GREATEST(0.00, v_stmt.closing_balance - v_stmt_allocated);
        IF v_stmt_remaining <= 0.00 THEN
            UPDATE public.credit_card_statements
            SET is_settled = TRUE, settled_at = COALESCE(settled_at, NOW()), updated_at = NOW()
            WHERE id = v_stmt.id AND user_id = v_user_id;
            v_settled_ids := v_settled_ids || to_jsonb(v_stmt.id);
            CONTINUE;
        END IF;

        v_alloc_now := LEAST(v_remaining_to_allocate, v_stmt_remaining);

        INSERT INTO public.credit_card_payment_allocations (
            user_id, payment_id, statement_id, allocated_amount, created_at
        ) VALUES (
            v_user_id, p_operation_id, v_stmt.id, v_alloc_now, NOW()
        );

        v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_now;
        v_total_stmt_allocated := v_total_stmt_allocated + v_alloc_now;

        IF (v_stmt_remaining - v_alloc_now) <= 0.005 THEN
            UPDATE public.credit_card_statements
            SET is_settled = TRUE, settled_at = NOW(), updated_at = NOW()
            WHERE id = v_stmt.id AND user_id = v_user_id;
            v_settled_ids := v_settled_ids || to_jsonb(v_stmt.id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'payment_id', p_operation_id,
        'transaction_id', v_tx_id,
        'amount', v_amount,
        'statement_allocated', v_total_stmt_allocated,
        'unbilled_allocated', v_remaining_to_allocate,
        'settled_statement_ids', v_settled_ids
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_credit_card_repayment(UUID, UUID, UUID, NUMERIC, DATE, VARCHAR, UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- SECTION 4: ALIGN `post_credit_card_cashback` RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_credit_card_cashback(
    p_operation_id UUID,
    p_card_id UUID,
    p_destination_account_id UUID,
    p_destination_type VARCHAR,
    p_amount NUMERIC,
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
    v_card_currency TEXT;
    v_dest_name TEXT;
    v_dest_kind TEXT;
    v_dest_currency TEXT;
    v_target_account_id UUID;
    v_target_account_name TEXT;
    v_transaction_id UUID;
    v_tx_note TEXT;
    v_tx_category TEXT;
    v_existing_record RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Cashback amount must be greater than zero.' USING ERRCODE = '22023';
    END IF;

    IF p_destination_type NOT IN ('card_statement_credit', 'bank_deposit') THEN
        RAISE EXCEPTION 'Invalid destination type: %. Must be card_statement_credit or bank_deposit.', p_destination_type
            USING ERRCODE = '22023';
    END IF;

    -- Idempotency check (includes cardName & destinationAccountName for safe client hydration)
    SELECT
        c.id, c.account_id, c.destination_account_id, c.destination_type,
        c.amount, c.transaction_id, c.reward_date, c.note, c.created_at,
        ca.name AS card_name, da.name AS dest_name
    INTO v_existing_record
    FROM public.credit_card_cashback_records c
    LEFT JOIN public.user_accounts ca ON ca.id = c.account_id AND ca.user_id = v_user_id
    LEFT JOIN public.user_accounts da ON da.id = c.destination_account_id AND da.user_id = v_user_id
    WHERE c.id = p_operation_id AND c.user_id = v_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'record', jsonb_build_object(
                'id', v_existing_record.id,
                'userId', v_user_id,
                'cardId', v_existing_record.account_id,
                'cardName', COALESCE(v_existing_record.card_name, 'Credit Card'),
                'destinationAccountId', v_existing_record.destination_account_id,
                'destinationAccountName', COALESCE(v_existing_record.dest_name, 'Account'),
                'creditDestination', v_existing_record.destination_type,
                'amount', v_existing_record.amount,
                'transactionId', v_existing_record.transaction_id,
                'date', v_existing_record.reward_date,
                'note', v_existing_record.note,
                'createdAt', v_existing_record.created_at
            )
        );
    END IF;

    -- Deterministic account locking
    PERFORM 1 FROM public.user_accounts
    WHERE user_id = v_user_id
      AND id IN (p_card_id, p_destination_account_id)
    ORDER BY id ASC
    FOR UPDATE;

    SELECT name, kind, COALESCE(currency_code, 'RM')
    INTO v_card_name, v_card_kind, v_card_currency
    FROM public.user_accounts
    WHERE id = p_card_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit card account not found or access denied.' USING ERRCODE = '22023';
    END IF;

    IF v_card_kind <> 'credit_card' THEN
        RAISE EXCEPTION 'Account % is not a credit card.', v_card_name USING ERRCODE = '22023';
    END IF;

    SELECT name, kind, COALESCE(currency_code, 'RM')
    INTO v_dest_name, v_dest_kind, v_dest_currency
    FROM public.user_accounts
    WHERE id = p_destination_account_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account not found or access denied.' USING ERRCODE = '22023';
    END IF;

    IF p_destination_type = 'bank_deposit' THEN
        IF v_dest_kind = 'credit_card' THEN
            RAISE EXCEPTION 'Bank deposit cashback cannot be deposited into a credit card.' USING ERRCODE = '22023';
        END IF;
        IF UPPER(v_card_currency) <> UPPER(v_dest_currency) THEN
            RAISE EXCEPTION 'Cross-currency cashback deposit unsupported (% card -> % account).',
                v_card_currency, v_dest_currency USING ERRCODE = '22023';
        END IF;
    END IF;

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

    v_transaction_id := uuid_generate_v4();

    INSERT INTO public.transactions (
        id, user_id, type, amount, category,
        account, account_id, date, note, credit_card_tx_type, status, created_at
    ) VALUES (
        v_transaction_id, v_user_id, 'Income', ROUND(p_amount::numeric, 2), v_tx_category,
        v_target_account_name, v_target_account_id, p_reward_date::timestamptz,
        v_tx_note, 'cashback', 'cleared', NOW()
    );

    INSERT INTO public.credit_card_cashback_records (
        id, user_id, account_id, destination_account_id, destination_type,
        amount, transaction_id, reward_date, note, created_at
    ) VALUES (
        p_operation_id, v_user_id, p_card_id, p_destination_account_id, p_destination_type,
        ROUND(p_amount::numeric, 2), v_transaction_id, p_reward_date, NULLIF(TRIM(p_note), ''), NOW()
    );

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
            'amount', ROUND(p_amount::numeric, 2),
            'transactionId', v_transaction_id,
            'date', p_reward_date,
            'note', NULLIF(TRIM(p_note), ''),
            'createdAt', NOW()
        ),
        'transaction', jsonb_build_object(
            'id', v_transaction_id,
            'user_id', v_user_id,
            'userId', v_user_id,
            'type', 'Income',
            'amount', ROUND(p_amount::numeric, 2),
            'category', v_tx_category,
            'account', v_target_account_name,
            'account_id', v_target_account_id,
            'accountId', v_target_account_id,
            'date', p_reward_date::timestamptz,
            'note', v_tx_note,
            'credit_card_tx_type', 'cashback',
            'creditCardTxType', 'cashback',
            'status', 'cleared'
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_credit_card_cashback(UUID, UUID, UUID, VARCHAR, NUMERIC, DATE, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- SECTION 5: SAFE ROLLBACK SCRIPT
-- ----------------------------------------------------------------------------
-- To drop the additive indexes without touching any user data:
--   DROP INDEX IF EXISTS public.idx_goals_user_created_at;
--   DROP INDEX IF EXISTS public.idx_subscriptions_user_created_at;
--   DROP INDEX IF EXISTS public.idx_cc_statements_user_stmt_date;
--   DROP INDEX IF EXISTS public.idx_cc_payments_user_pay_date;
--   DROP INDEX IF EXISTS public.idx_cc_payments_user_source_acc;
--   DROP INDEX IF EXISTS public.idx_cc_allocations_user_created_at;
--   DROP INDEX IF EXISTS public.idx_cc_cashback_user_reward_date;
--   DROP INDEX IF EXISTS public.idx_cc_cashback_user_dest_acc;
-- To revert RPCs, re-run migrations 011 and 013.
-- ----------------------------------------------------------------------------
