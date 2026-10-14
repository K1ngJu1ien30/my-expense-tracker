"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import type {
  Account,
  CreditCardPayment,
  CreditCardPaymentType,
  CreditCardStatement,
  RawCreditCardPaymentRow,
  RawCreditCardStatementRow,
  Transaction,
  TransactionSaveResult,
} from "../types";
import {
  getUserCreditCardPaymentsKey,
  getUserCreditCardStatementsKey,
} from "../cacheKeys";
import { roundCurrency } from "../utils";

export type CreditCardPaymentsDeps = {
  session: Session | null;
  isOfflineRef: MutableRefObject<boolean>;
  accountObjects: Account[];
  transactions: Transaction[];
  addTransaction: (tx: Partial<Transaction>) => Promise<TransactionSaveResult>;
  triggerToast: (msg: string) => void;
};

/**
 * Calculates remaining balance on an issued credit card statement.
 * Decreases by payments allocated to it without modifying the original statement closing balance.
 */
export function calculateStatementRemaining(
  statement: CreditCardStatement,
  payments: CreditCardPayment[]
): number {
  const allocated = payments
    .filter((p) => p.statementId === statement.id)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const remainingCents = Math.max(
    0,
    Math.round(Number(statement.closingBalance) * 100) - Math.round(allocated * 100)
  );
  return remainingCents / 100;
}

/**
 * Calculates remaining minimum payment on an issued statement.
 */
export function calculateMinimumRemaining(
  statement: CreditCardStatement,
  payments: CreditCardPayment[]
): number {
  const allocated = payments
    .filter((p) => p.statementId === statement.id)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const minCents = Math.round(Number(statement.minimumPayment || 0) * 100);
  const remainingMinCents = Math.max(0, minCents - Math.round(allocated * 100));
  return remainingMinCents / 100;
}

export function useCreditCardPayments(deps: CreditCardPaymentsDeps) {
  const { session, isOfflineRef, accountObjects, addTransaction, triggerToast } = deps;

  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [payments, setPayments] = useState<CreditCardPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const statementsKey = getUserCreditCardStatementsKey(session?.user?.id);
  const paymentsKey = getUserCreditCardPaymentsKey(session?.user?.id);

  // Sync state refs to prevent race conditions
  const statementsRef = useRef(statements);
  const paymentsRef = useRef(payments);

  useEffect(() => {
    statementsRef.current = statements;
  }, [statements]);

  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);

  // ─── 1. Load data from local cache and cloud ────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoading(true);

    // 1a. Load from local cache
    try {
      const localSt = await localforage.getItem<CreditCardStatement[]>(statementsKey);
      if (Array.isArray(localSt)) {
        setStatements(localSt);
      }
      const localPay = await localforage.getItem<CreditCardPayment[]>(paymentsKey);
      if (Array.isArray(localPay)) {
        setPayments(localPay);
      }
    } catch (e) {
      console.warn("[CreditCardPayments] Failed to read from local storage:", e);
    }

    // 1b. Load from Supabase if online and session exists
    if (session?.user?.id && !isOfflineRef.current) {
      try {
        const { data: stData, error: stErr } = await supabase
          .from("credit_card_statements")
          .select("*")
          .eq("user_id", session.user.id)
          .order("statement_date", { ascending: false });

        if (!stErr && Array.isArray(stData)) {
          const mappedSt: CreditCardStatement[] = (stData as RawCreditCardStatementRow[]).map((r) => ({
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
          }));
          setStatements(mappedSt);
          await localforage.setItem(statementsKey, mappedSt);
        } else if (stErr && stErr.code !== "42P01" && stErr.code !== "42703") {
          console.warn("[CreditCardPayments] Failed to fetch statements:", stErr);
        }

        const { data: payData, error: payErr } = await supabase
          .from("credit_card_payments")
          .select("*")
          .eq("user_id", session.user.id)
          .order("payment_date", { ascending: false });

        if (!payErr && Array.isArray(payData)) {
          const mappedPay: CreditCardPayment[] = (payData as RawCreditCardPaymentRow[]).map((r) => ({
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
          }));
          setPayments(mappedPay);
          await localforage.setItem(paymentsKey, mappedPay);
        } else if (payErr && payErr.code !== "42P01" && payErr.code !== "42703") {
          console.warn("[CreditCardPayments] Failed to fetch payments:", payErr);
        }
      } catch (err) {
        console.warn("[CreditCardPayments] Cloud sync error (falling back to cache):", err);
      }
    }

    setIsLoading(false);
  }, [session, isOfflineRef, statementsKey, paymentsKey]);

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
    }): Promise<{ success: boolean; statement?: CreditCardStatement; error?: string }> => {
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

      const updatedStatements = [newStatement, ...statementsRef.current];
      setStatements(updatedStatements);
      await localforage.setItem(statementsKey, updatedStatements);

      // Cloud sync if available
      if (session?.user?.id && !isOfflineRef.current) {
        try {
          const rawRow: RawCreditCardStatementRow = {
            id: newStatement.id,
            user_id: session.user.id,
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
          const { error } = await supabase.from("credit_card_statements").insert(rawRow);
          if (error && error.code !== "42P01" && error.code !== "42703") {
            console.warn("[CreditCardPayments] Cloud insert statement failed:", error);
          }
        } catch (e) {
          console.warn("[CreditCardPayments] Cloud statement insert error:", e);
        }
      }

      triggerToast("Statement recorded successfully");
      return { success: true, statement: newStatement };
    },
    [session, isOfflineRef, statementsKey, triggerToast]
  );

  // ─── 3. Record a Credit Card Payment ────────────────────────────────────
  const recordCreditCardPayment = useCallback(
    async (params: {
      accountId: string; // Credit card account ID or name
      sourceAccountId: string; // Source bank/cash account ID or name
      statementId?: string | null;
      paymentDate: string; // YYYY-MM-DD
      amount: number;
      paymentType: CreditCardPaymentType;
      note?: string;
    }): Promise<{ success: boolean; paymentId?: string; status?: "synced" | "pending_sync"; error?: string }> => {
      // 1. Validation
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

      const numAmount = Number(params.amount);
      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        return { success: false, error: "Payment amount must be greater than zero." };
      }
      const sanitizedAmount = roundCurrency(numAmount);

      const paymentDate = params.paymentDate || new Date().toISOString().split("T")[0];
      const paymentId = crypto.randomUUID();

      // 2. Atomic Ledger Dual-Write: Create Transfer transaction
      const transferTx: Partial<Transaction> = {
        type: "Transfer",
        amount: sanitizedAmount,
        account: sourceAcc.name,
        account_id: sourceAcc.id,
        to_account: cardAcc.name,
        to_account_id: cardAcc.id,
        date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
        credit_card_tx_type: "repayment",
        statement_id: params.statementId || null,
        note: params.note ? params.note.trim() : `Repayment for ${cardAcc.name}`,
      };

      const txResult = await addTransaction(transferTx);
      if (!txResult.success) {
        return { success: false, error: txResult.error || "Failed to record payment in ledger." };
      }

      // 3. Record in credit_card_payments
      const newPayment: CreditCardPayment = {
        id: paymentId,
        userId: session?.user?.id,
        accountId: cardAcc.id || cardAcc.name,
        sourceAccountId: sourceAcc.id || sourceAcc.name,
        statementId: params.statementId || null,
        transactionId: undefined, // Linked via transfer date & accounts
        paymentDate,
        amount: sanitizedAmount,
        paymentType: params.paymentType,
        note: params.note ? params.note.trim() : null,
        createdAt: new Date().toISOString(),
      };

      const updatedPayments = [newPayment, ...paymentsRef.current];
      setPayments(updatedPayments);
      await localforage.setItem(paymentsKey, updatedPayments);

      // 4. Update statement settlement status & allocation
      const currentStatements = [...statementsRef.current];
      let statementsModified = false;

      if (params.statementId) {
        // Direct statement payment
        const targetIdx = currentStatements.findIndex((s) => s.id === params.statementId);
        if (targetIdx !== -1) {
          const target = currentStatements[targetIdx];
          const remaining = calculateStatementRemaining(target, updatedPayments);
          const isSettled = remaining <= 0.005;
          currentStatements[targetIdx] = {
            ...target,
            isSettled,
            settledAt: isSettled ? target.settledAt || new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          };
          statementsModified = true;
        }
      } else {
        // Multi-statement waterfall allocation (oldest due date first)
        const unsettledForCard = currentStatements
          .filter((s) => s.accountId === (cardAcc.id || cardAcc.name) && !s.isSettled)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        let remainingRepaymentCents = Math.round(sanitizedAmount * 100);

        for (const st of unsettledForCard) {
          if (remainingRepaymentCents <= 0) break;
          const stRemaining = calculateStatementRemaining(st, updatedPayments);
          const stRemainingCents = Math.round(stRemaining * 100);

          if (remainingRepaymentCents >= stRemainingCents && stRemainingCents > 0) {
            const idx = currentStatements.findIndex((s) => s.id === st.id);
            if (idx !== -1) {
              currentStatements[idx] = {
                ...currentStatements[idx],
                isSettled: true,
                settledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              statementsModified = true;
            }
            remainingRepaymentCents -= stRemainingCents;
          } else {
            // Partial payment on this statement
            remainingRepaymentCents = 0;
            break;
          }
        }
      }

      if (statementsModified) {
        setStatements(currentStatements);
        await localforage.setItem(statementsKey, currentStatements);
      }

      // 5. Cloud sync for payment and statement status (if online)
      if (session?.user?.id && !isOfflineRef.current) {
        try {
          const rawPayRow: RawCreditCardPaymentRow = {
            id: newPayment.id,
            user_id: session.user.id,
            account_id: newPayment.accountId,
            source_account_id: newPayment.sourceAccountId,
            statement_id: newPayment.statementId ?? null,
            transaction_id: null,
            payment_date: newPayment.paymentDate,
            amount: newPayment.amount,
            payment_type: newPayment.paymentType,
            note: newPayment.note ?? null,
          };
          const { error: payErr } = await supabase.from("credit_card_payments").insert(rawPayRow);
          if (payErr && payErr.code !== "42P01" && payErr.code !== "42703") {
            console.warn("[CreditCardPayments] Cloud insert payment warning:", payErr);
          }

          if (statementsModified) {
            for (const st of currentStatements) {
              const { error: stErr } = await supabase
                .from("credit_card_statements")
                .update({
                  is_settled: st.isSettled,
                  settled_at: st.settledAt ?? null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", st.id)
                .eq("user_id", session.user.id);

              if (stErr && stErr.code !== "42P01" && stErr.code !== "42703") {
                console.warn("[CreditCardPayments] Cloud update statement warning:", stErr);
              }
            }
          }
        } catch (e) {
          console.warn("[CreditCardPayments] Cloud dual-write sync warning:", e);
        }
      }

      return {
        success: true,
        paymentId,
        status: txResult.status,
      };
    },
    [accountObjects, addTransaction, session, isOfflineRef, paymentsKey, statementsKey]
  );

  return {
    statements,
    payments,
    isLoading,
    addCreditCardStatement,
    recordCreditCardPayment,
    refreshPaymentsData: loadData,
  };
}
