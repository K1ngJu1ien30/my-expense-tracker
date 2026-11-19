"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import type {
  Account,
  CreditCardPayment,
  CreditCardPaymentAllocation,
  CreditCardPaymentType,
  CreditCardStatement,
  RawCreditCardPaymentAllocationRow,
  RawCreditCardPaymentRow,
  RawCreditCardStatementRow,
  Transaction,
  TransactionSaveResult,
} from "../types";
import {
  getUserCreditCardAllocationsKey,
  getUserCreditCardPaymentsKey,
  getUserCreditCardStatementsKey,
} from "../cacheKeys";
import { roundCurrency } from "../utils";
import {
  enqueueOfflineStatement,
  getOfflineStatementQueueForUser,
  removeAcknowledgedOfflineStatements,
} from "../offlineQueue";

export type CreditCardPaymentsDeps = {

  session: Session | null;
  isOfflineRef: MutableRefObject<boolean>;
  accountObjects: Account[];
  transactions: Transaction[];
  addTransaction: (tx: Partial<Transaction>) => Promise<TransactionSaveResult>;
  setTransactions?: (val: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  triggerToast: (msg: string) => void;
};

type RepaymentRpcResponse = {
  success: boolean;
  already_processed?: boolean;
  payment_id?: string;
  transaction_id?: string;
  amount?: number;
  statement_allocated?: number;
  unbilled_allocated?: number;
  settled_statement_ids?: string[];
  message?: string;
};

/**
 * Calculates remaining balance on an issued credit card statement.
 * Derives balance mathematically from auditable allocation records, with fallback
 * for legacy payments where direct allocations are not yet backfilled.
 */
export function calculateStatementRemaining(
  statement: CreditCardStatement,
  payments: CreditCardPayment[] = [],
  allocations?: CreditCardPaymentAllocation[]
): number {
  let allocatedCents = 0;

  if (allocations && allocations.length > 0) {
    const allocationPaymentIds = new Set<string>();
    for (const alloc of allocations) {
      if (alloc.statementId === statement.id) {
        allocatedCents += Math.round(Number(alloc.allocatedAmount || 0) * 100);
      }
      allocationPaymentIds.add(alloc.paymentId);
    }

    // Fallback for legacy payments that have this statementId but haven't been backfilled
    for (const p of payments) {
      if (p.statementId === statement.id && !allocationPaymentIds.has(p.id)) {
        allocatedCents += Math.round(Number(p.amount || 0) * 100);
      }
    }
  } else {
    for (const p of payments) {
      if (p.statementId === statement.id) {
        allocatedCents += Math.round(Number(p.amount || 0) * 100);
      }
    }
  }

  const closingCents = Math.round(Number(statement.closingBalance || 0) * 100);
  const remainingCents = Math.max(0, closingCents - allocatedCents);
  return remainingCents / 100;
}

/**
 * Calculates remaining minimum payment on an issued statement.
 */
export function calculateMinimumRemaining(
  statement: CreditCardStatement,
  payments: CreditCardPayment[] = [],
  allocations?: CreditCardPaymentAllocation[]
): number {
  let allocatedCents = 0;

  if (allocations && allocations.length > 0) {
    const allocationPaymentIds = new Set<string>();
    for (const alloc of allocations) {
      if (alloc.statementId === statement.id) {
        allocatedCents += Math.round(Number(alloc.allocatedAmount || 0) * 100);
      }
      allocationPaymentIds.add(alloc.paymentId);
    }

    for (const p of payments) {
      if (p.statementId === statement.id && !allocationPaymentIds.has(p.id)) {
        allocatedCents += Math.round(Number(p.amount || 0) * 100);
      }
    }
  } else {
    for (const p of payments) {
      if (p.statementId === statement.id) {
        allocatedCents += Math.round(Number(p.amount || 0) * 100);
      }
    }
  }

  const minCents = Math.round(Number(statement.minimumPayment || 0) * 100);
  const remainingMinCents = Math.max(0, minCents - allocatedCents);
  return remainingMinCents / 100;
}

export function useCreditCardPayments(deps: CreditCardPaymentsDeps) {
  const {
    session,
    isOfflineRef,
    accountObjects,
    setTransactions,
    triggerToast,
  } = deps;

  const userId = session?.user?.id;
  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [allocations, setAllocations] = useState<CreditCardPaymentAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const statementsKey = getUserCreditCardStatementsKey(userId);
  const paymentsKey = getUserCreditCardPaymentsKey(userId);
  const allocationsKey = getUserCreditCardAllocationsKey(userId);

  // Sync state refs to prevent race conditions
  const statementsRef = useRef(statements);
  const paymentsRef = useRef(payments);
  const allocationsRef = useRef(allocations);
  const activeUserIdRef = useRef(userId);

  useEffect(() => {
    statementsRef.current = statements;
  }, [statements]);

  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);

  useEffect(() => {
    allocationsRef.current = allocations;
  }, [allocations]);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  // ─── 1. Load data from local cache and cloud (keyed strictly by userId) ─
  const loadData = useCallback(async () => {
    if (!userId) {
      setStatements([]);
      setPayments([]);
      setAllocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 1a. Load from local cache
    try {
      const [localSt, localPay, localAlloc] = await Promise.all([
        localforage.getItem<CreditCardStatement[]>(statementsKey),
        localforage.getItem<CreditCardPayment[]>(paymentsKey),
        localforage.getItem<CreditCardPaymentAllocation[]>(allocationsKey),
      ]);

      if (activeUserIdRef.current !== userId) return;

      if (Array.isArray(localSt)) {
        setStatements(localSt);
      }
      if (Array.isArray(localPay)) {
        setPayments(localPay);
      }
      if (Array.isArray(localAlloc)) {
        setAllocations(localAlloc);
      }
    } catch (e) {
      console.warn("[CreditCardPayments] Failed to read from local storage:", e);
    }

    // 1b. Load from Supabase if online and session exists
    if (!isOfflineRef.current) {
      try {
        // Flush any pending durable offline statements before querying fresh data
        const pendingStmts = await getOfflineStatementQueueForUser(userId);
        if (pendingStmts && pendingStmts.length > 0) {
          const acked = new Set<string>();
          for (const s of pendingStmts) {
            const { error: insErr } = await supabase.from("credit_card_statements").insert(s);
            if (!insErr || insErr.code === "23505") {
              acked.add(s.id);
            }
          }
          if (acked.size > 0) {
            await removeAcknowledgedOfflineStatements(acked);
          }
        }

        const [stRes, payRes, allocRes] = await Promise.all([
          supabase
            .from("credit_card_statements")
            .select("id,user_id,account_id,statement_date,due_date,opening_balance,closing_balance,minimum_payment,is_settled,settled_at,note,created_at,updated_at")
            .eq("user_id", userId)
            .order("statement_date", { ascending: false }),
          supabase
            .from("credit_card_payments")
            .select("id,user_id,account_id,source_account_id,statement_id,transaction_id,payment_date,amount,payment_type,note,created_at")
            .eq("user_id", userId)
            .order("payment_date", { ascending: false }),
          supabase
            .from("credit_card_payment_allocations")
            .select("id,user_id,payment_id,statement_id,allocated_amount,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        if (activeUserIdRef.current !== userId) return;

        if (!stRes.error && Array.isArray(stRes.data)) {
          const mappedSt: CreditCardStatement[] = (stRes.data as RawCreditCardStatementRow[]).map(
            (r) => ({
              id: r.id,
              userId: r.user_id,
              accountId: r.account_id,
              statementDate: r.statement_date,
              dueDate: r.due_date,
              openingBalance: Number(r.opening_balance || 0),
              closingBalance: Number(r.closing_balance || 0),
              minimumPayment: Number(r.minimum_payment || 0),
              isSettled: Boolean(r.is_settled),
              settledAt: r.settled_at,
              note: r.note,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            })
          );
          setStatements(mappedSt);
          void localforage.setItem(statementsKey, mappedSt).catch(() => {});
        } else if (stRes.error && stRes.error.code !== "42P01" && stRes.error.code !== "42703") {
          console.warn("[CreditCardPayments] Failed to fetch statements:", stRes.error);
        }

        if (!payRes.error && Array.isArray(payRes.data)) {
          const mappedPay: CreditCardPayment[] = (payRes.data as RawCreditCardPaymentRow[]).map(
            (r) => ({
              id: r.id,
              userId: r.user_id,
              accountId: r.account_id,
              sourceAccountId: r.source_account_id,
              statementId: r.statement_id,
              transactionId: r.transaction_id,
              paymentDate: r.payment_date,
              amount: Number(r.amount || 0),
              paymentType: r.payment_type || "custom",
              note: r.note,
              createdAt: r.created_at,
            })
          );
          setPayments(mappedPay);
          void localforage.setItem(paymentsKey, mappedPay).catch(() => {});
        } else if (payRes.error && payRes.error.code !== "42P01" && payRes.error.code !== "42703") {
          console.warn("[CreditCardPayments] Failed to fetch payments:", payRes.error);
        }

        if (!allocRes.error && Array.isArray(allocRes.data)) {
          const mappedAlloc: CreditCardPaymentAllocation[] = (allocRes.data as RawCreditCardPaymentAllocationRow[]).map(
            (r) => ({
              id: r.id,
              userId: r.user_id,
              paymentId: r.payment_id,
              statementId: r.statement_id,
              allocatedAmount: Number(r.allocated_amount || 0),
              createdAt: r.created_at,
            })
          );
          setAllocations(mappedAlloc);
          void localforage.setItem(allocationsKey, mappedAlloc).catch(() => {});
        } else if (allocRes.error && allocRes.error.code !== "42P01" && allocRes.error.code !== "42703") {
          console.warn("[CreditCardPayments] Failed to fetch allocations:", allocRes.error);
        }
      } catch (err) {
        console.warn("[CreditCardPayments] Cloud sync error (falling back to cache):", err);
      }
    }

    if (activeUserIdRef.current === userId) {
      setIsLoading(false);
    }
  }, [userId, isOfflineRef, statementsKey, paymentsKey, allocationsKey]);

  useEffect(() => {
    // Initial hydration of cached statements & payments from storage and Supabase
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // ─── 2. Add an issued statement ─────────────────────────────────────────
  const addCreditCardStatement = useCallback(
    async (params: {
      accountId: string;
      statementDate: string;
      dueDate: string;
      openingBalance?: number;
      closingBalance: number;
      minimumPayment?: number;
      note?: string;
    }): Promise<{
      success: boolean;
      statement?: CreditCardStatement;
      status?: "synced" | "pending_sync";
      error?: string;
    }> => {
      if (!params.accountId) {
        return { success: false, error: "Credit card account is required." };
      }
      if (!params.statementDate || !params.dueDate) {
        return { success: false, error: "Statement date and due date are required." };
      }
      if (new Date(params.dueDate) < new Date(params.statementDate)) {
        return { success: false, error: "Due date cannot be earlier than statement date." };
      }
      if (params.closingBalance <= 0 || isNaN(params.closingBalance)) {
        return { success: false, error: "Statement closing balance must be greater than zero." };
      }

      const id = crypto.randomUUID();
      const newStatement: CreditCardStatement = {
        id,
        userId: session?.user?.id,
        accountId: params.accountId,
        statementDate: params.statementDate,
        dueDate: params.dueDate,
        openingBalance: Number(params.openingBalance || 0),
        closingBalance: roundCurrency(params.closingBalance),
        minimumPayment: roundCurrency(params.minimumPayment || 0),
        isSettled: false,
        settledAt: null,
        note: params.note || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rawRow: RawCreditCardStatementRow = {
        id: newStatement.id,
        user_id: session?.user?.id || "",
        account_id: newStatement.accountId,
        statement_date: newStatement.statementDate,
        due_date: newStatement.dueDate,
        opening_balance: newStatement.openingBalance,
        closing_balance: newStatement.closingBalance,
        minimum_payment: newStatement.minimumPayment,
        is_settled: newStatement.isSettled,
        settled_at: newStatement.settledAt ?? null,
        note: newStatement.note ?? null,
      };

      // Cloud insert when online
      if (session?.user?.id && !isOfflineRef.current) {
        try {
          const { error } = await supabase.from("credit_card_statements").insert(rawRow);
          if (error) {
            // Duplicate statement date constraint violation
            if (error.code === "23505" || error.message?.includes("uq_credit_card_statements_account_date")) {
              return {
                success: false,
                error: "A statement cycle for this card and statement date already exists.",
              };
            }
            if (error.code === "42501") {
              return {
                success: false,
                error: "Permission denied while recording credit card statement.",
              };
            }

            // On unexpected network or transient server failure, queue to durable offline statement retry queue
            console.warn("[CreditCardPayments] Cloud statement insert failed, queuing for retry:", error);
            await enqueueOfflineStatement(rawRow);

            const updatedStatements = [newStatement, ...statementsRef.current];
            setStatements(updatedStatements);
            await localforage.setItem(statementsKey, updatedStatements);

            triggerToast("Statement saved locally (offline retry pending)");
            return { success: true, statement: newStatement, status: "pending_sync" };
          }
        } catch (e) {
          console.warn("[CreditCardPayments] Cloud statement insert exception, queuing:", e);
          if (session?.user?.id) {
            await enqueueOfflineStatement(rawRow);
            const updatedStatements = [newStatement, ...statementsRef.current];
            setStatements(updatedStatements);
            await localforage.setItem(statementsKey, updatedStatements);

            triggerToast("Statement saved locally (offline retry pending)");
            return { success: true, statement: newStatement, status: "pending_sync" };
          }
          return { success: false, error: e instanceof Error ? e.message : "Failed to record statement." };
        }
      } else if (session?.user?.id && isOfflineRef.current) {
        // Explicit offline persistence in durable statement queue
        await enqueueOfflineStatement(rawRow);
        const updatedStatements = [newStatement, ...statementsRef.current];
        setStatements(updatedStatements);
        await localforage.setItem(statementsKey, updatedStatements);

        triggerToast("Statement saved offline (will sync when online)");
        return { success: true, statement: newStatement, status: "pending_sync" };
      }

      // Online success path
      const updatedStatements = [newStatement, ...statementsRef.current];
      setStatements(updatedStatements);
      await localforage.setItem(statementsKey, updatedStatements);

      triggerToast("Statement recorded successfully");
      return { success: true, statement: newStatement, status: "synced" };
    },
    [session, isOfflineRef, statementsKey, triggerToast]
  );

  // ─── 3. Record a Credit Card Payment (Atomic PostgreSQL RPC) ────────────
  const recordCreditCardPayment = useCallback(
    async (params: {
      accountId: string; // Credit card account ID or name
      sourceAccountId: string; // Source bank/cash account ID or name
      statementId?: string | null;
      paymentDate: string; // YYYY-MM-DD
      amount: number;
      paymentType: CreditCardPaymentType;
      note?: string;
      operationId?: string; // Durable client operation ID for safe retries
    }): Promise<{
      success: boolean;
      paymentId?: string;
      status?: "synced" | "pending_sync";
      error?: string;
      alreadyProcessed?: boolean;
    }> => {
      // 1. Explicit Offline Guard: credit card repayments require an active connection
      // to ensure atomic ledger transfers and statement settlements do not desync.
      if (isOfflineRef.current) {
        return {
          success: false,
          error:
            "Credit card repayments require an active internet connection to ensure atomic statement settlement. Please reconnect and try again.",
        };
      }

      if (!session?.user?.id) {
        return {
          success: false,
          error: "Authentication required to record credit card repayments.",
        };
      }

      // 2. Account Validation
      const cardAcc = accountObjects.find(
        (a) => a.id === params.accountId || a.name.toLowerCase() === params.accountId.toLowerCase()
      );
      if (!cardAcc) {
        return { success: false, error: "Please select a valid credit card." };
      }
      if (cardAcc.kind !== "credit_card") {
        return { success: false, error: "Destination account must be a credit card." };
      }

      const sourceAcc = accountObjects.find(
        (a) => a.id === params.sourceAccountId || a.name.toLowerCase() === params.sourceAccountId.toLowerCase()
      );
      if (!sourceAcc) {
        return { success: false, error: "Please select a payment source account." };
      }
      if (sourceAcc.kind === "credit_card") {
        return { success: false, error: "Payment source cannot be a credit card." };
      }
      if (sourceAcc.id === cardAcc.id || sourceAcc.name.toLowerCase() === cardAcc.name.toLowerCase()) {
        return { success: false, error: "Source and card account cannot be the same." };
      }

      // Enforce currency matching: cross-currency credit card repayment is unsupported
      const cardCurrency = (cardAcc.currencyCode || "RM").trim().toUpperCase();
      const sourceCurrency = (sourceAcc.currencyCode || "RM").trim().toUpperCase();
      if (cardCurrency !== sourceCurrency) {
        return {
          success: false,
          error: `Cross-currency repayment is not supported. Source account currency (${sourceCurrency}) must match credit card currency (${cardCurrency}).`,
        };
      }

      const numAmount = Number(params.amount);
      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        return { success: false, error: "Payment amount must be greater than zero." };
      }
      const sanitizedAmount = roundCurrency(numAmount);
      const paymentDate = params.paymentDate || new Date().toISOString().split("T")[0];
      const operationId = params.operationId || crypto.randomUUID();

      // 3. Invoke Atomic RPC: record_credit_card_repayment
      try {
        const { data, error } = await supabase.rpc("record_credit_card_repayment", {
          p_operation_id: operationId,
          p_card_account_id: cardAcc.id,
          p_source_account_id: sourceAcc.id,
          p_amount: sanitizedAmount,
          p_payment_date: paymentDate,
          p_payment_type: params.paymentType,
          p_statement_id: params.statementId || null,
          p_note: params.note ? params.note.trim() : null,
        });

        if (error) {
          if (error.code === "42883" || error.message?.includes("record_credit_card_repayment")) {
            return {
              success: false,
              error:
                "Database migration required: please execute 009_credit_card_payment_integrity.sql in your Supabase SQL editor to enable atomic repayments.",
            };
          }
          return {
            success: false,
            error: error.message || "Failed to record credit card payment.",
          };
        }

        const rpcResult = data as RepaymentRpcResponse;
        if (!rpcResult || !rpcResult.success) {
          return {
            success: false,
            error: rpcResult?.message || "Repayment transaction rejected by server.",
          };
        }

        const txId = rpcResult.transaction_id || crypto.randomUUID();
        const paymentId = rpcResult.payment_id || operationId;

        // 4. Update Client Ledger State (Transactions)
        if (setTransactions) {
          const newLedgerTx: Transaction = {
            id: txId,
            type: "Transfer",
            amount: sanitizedAmount,
            category: "Transfer",
            account: sourceAcc.name,
            account_id: sourceAcc.id,
            to_account: cardAcc.name,
            to_account_id: cardAcc.id,
            date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
            credit_card_tx_type: "repayment",
            statement_id: params.statementId || null,
            note: params.note ? params.note.trim() : `Repayment for ${cardAcc.name}`,
            user_id: session.user.id,
          };
          setTransactions((prev) => [newLedgerTx, ...prev.filter((t) => t.id !== newLedgerTx.id)]);
        }

        // 5. Update Local Payments State
        const newPayment: CreditCardPayment = {
          id: paymentId,
          userId: session.user.id,
          accountId: cardAcc.id || cardAcc.name,
          sourceAccountId: sourceAcc.id || sourceAcc.name,
          statementId: params.statementId || null,
          transactionId: txId,
          paymentDate,
          amount: sanitizedAmount,
          paymentType: params.paymentType,
          note: params.note ? params.note.trim() : null,
          createdAt: new Date().toISOString(),
        };

        const updatedPayments = [
          newPayment,
          ...paymentsRef.current.filter((p) => p.id !== paymentId),
        ];
        setPayments(updatedPayments);
        await localforage.setItem(paymentsKey, updatedPayments);

        // 6. Eagerly mark settled statements returned by RPC
        if (
          Array.isArray(rpcResult.settled_statement_ids) &&
          rpcResult.settled_statement_ids.length > 0
        ) {
          const settledSet = new Set<string>(rpcResult.settled_statement_ids);
          const eagerlyUpdatedStatements = statementsRef.current.map((st) => {
            if (settledSet.has(st.id)) {
              return {
                ...st,
                isSettled: true,
                settledAt: st.settledAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            }
            return st;
          });
          setStatements(eagerlyUpdatedStatements);
          await localforage.setItem(statementsKey, eagerlyUpdatedStatements);
        }

        // 7. Refresh allocations and statements from Supabase to guarantee exact consistency
        try {
          const [allocRes, stmtRes] = await Promise.all([
            supabase
              .from("credit_card_payment_allocations")
              .select("*")
              .eq("user_id", session.user.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("credit_card_statements")
              .select("*")
              .eq("user_id", session.user.id)
              .order("statement_date", { ascending: false }),
          ]);

          if (!allocRes.error && Array.isArray(allocRes.data)) {
            const mappedAlloc: CreditCardPaymentAllocation[] = (allocRes.data as RawCreditCardPaymentAllocationRow[]).map(
              (r) => ({
                id: r.id,
                userId: r.user_id,
                paymentId: r.payment_id,
                statementId: r.statement_id,
                allocatedAmount: Number(r.allocated_amount || 0),
                createdAt: r.created_at,
              })
            );
            setAllocations(mappedAlloc);
            await localforage.setItem(allocationsKey, mappedAlloc);
          }

          if (!stmtRes.error && Array.isArray(stmtRes.data)) {
            const mappedSt: CreditCardStatement[] = (stmtRes.data as RawCreditCardStatementRow[]).map(
              (r) => ({
                id: r.id,
                userId: r.user_id,
                accountId: r.account_id,
                statementDate: r.statement_date,
                dueDate: r.due_date,
                openingBalance: Number(r.opening_balance || 0),
                closingBalance: Number(r.closing_balance || 0),
                minimumPayment: Number(r.minimum_payment || 0),
                isSettled: Boolean(r.is_settled),
                settledAt: r.settled_at,
                note: r.note,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
              })
            );
            setStatements(mappedSt);
            await localforage.setItem(statementsKey, mappedSt);
          }
        } catch (refreshErr) {
          console.warn("[CreditCardPayments] Post-payment refresh notice:", refreshErr);
        }

        return {
          success: true,
          paymentId,
          status: "synced",
          alreadyProcessed: Boolean(rpcResult.already_processed),
        };
      } catch (err) {
        console.error("[CreditCardPayments] Repayment RPC execution exception:", err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while processing repayment.",
        };
      }
    },
    [
      isOfflineRef,
      session,
      accountObjects,
      setTransactions,
      paymentsKey,
      statementsKey,
      allocationsKey,
    ]
  );

  return {
    statements,
    payments,
    allocations,
    isLoading,
    addCreditCardStatement,
    recordCreditCardPayment,
    refreshPaymentsData: loadData,
  };
}
