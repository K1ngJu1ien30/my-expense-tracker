"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import type {
  Account,
  CardRewardsConfig,
  CashbackDestination,
  CashbackRecord,
  RawCashbackRecordRow,
  RawRewardConfigRow,
  Transaction,
  TransactionSaveResult,
} from "../types";
import {
  getUserCashbackConfigsKey,
  getUserCashbackRecordsKey,
} from "../cacheKeys";
import { roundCurrency } from "../utils";

export type CashbackRewardsDeps = {
  session: Session | null;
  isOfflineRef: MutableRefObject<boolean>;
  accountObjects: Account[];
  addTransaction: (tx: Partial<Transaction>) => Promise<TransactionSaveResult>;
  setTransactions?: (val: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  triggerToast: (msg: string) => void;
};

export function useCashbackRewards(deps: CashbackRewardsDeps) {
  const { session, isOfflineRef, accountObjects, addTransaction: _addTransaction, setTransactions, triggerToast } = deps;

  const [rewardsConfigs, setRewardsConfigs] = useState<Record<string, CardRewardsConfig>>({});
  const [cashbackRecords, setCashbackRecords] = useState<CashbackRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const configsKey = getUserCashbackConfigsKey(session?.user?.id);
  const recordsKey = getUserCashbackRecordsKey(session?.user?.id);

  const configsRef = useRef(rewardsConfigs);
  const recordsRef = useRef(cashbackRecords);

  useEffect(() => {
    configsRef.current = rewardsConfigs;
  }, [rewardsConfigs]);

  useEffect(() => {
    recordsRef.current = cashbackRecords;
  }, [cashbackRecords]);

  // ─── 1. Load data from local cache and cloud ────────────────────────────
  const loadData = useCallback(async () => {
    setIsLoading(true);

    // 1a. Load from local cache first
    try {
      const localConfigs = await localforage.getItem<Record<string, CardRewardsConfig>>(configsKey);
      if (localConfigs && typeof localConfigs === "object") {
        setRewardsConfigs(localConfigs);
      }
      const localRecords = await localforage.getItem<CashbackRecord[]>(recordsKey);
      if (Array.isArray(localRecords)) {
        setCashbackRecords(localRecords);
      }
    } catch (err) {
      console.warn("[useCashbackRewards] Error reading local cache:", err);
    }

    // 1b. If online and authenticated, fetch from Supabase
    if (!isOfflineRef.current && session?.user?.id) {
      try {
        const { data: rawConfigs, error: cfgErr } = await supabase
          .from("credit_card_reward_configs")
          .select("*")
          .eq("user_id", session.user.id);

        if (!cfgErr && rawConfigs) {
          const mappedConfigs: Record<string, CardRewardsConfig> = {};
          (rawConfigs as RawRewardConfigRow[]).forEach((row) => {
            const parsedRules =
              typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules || [];
            mappedConfigs[row.account_id] = {
              accountId: row.account_id,
              isEnabled: row.is_enabled,
              rules: parsedRules,
              monthlyCap: row.monthly_cap !== null ? Number(row.monthly_cap) : null,
              minSpendThreshold:
                row.min_spend_threshold !== null ? Number(row.min_spend_threshold) : null,
              notes: row.notes || undefined,
            };
          });
          setRewardsConfigs(mappedConfigs);
          await localforage.setItem(configsKey, mappedConfigs);
        }

        const { data: rawRecords, error: recErr } = await supabase
          .from("credit_card_cashback_records")
          .select("*")
          .eq("user_id", session.user.id)
          .order("reward_date", { ascending: false });

        if (!recErr && rawRecords) {
          const mappedRecords: CashbackRecord[] = (rawRecords as RawCashbackRecordRow[]).map(
            (row) => {
              const cardAcc = accountObjects.find(
                (a) => a.id === row.account_id || a.name === row.account_id
              );
              const destAcc = accountObjects.find(
                (a) =>
                  a.id === row.destination_account_id || a.name === row.destination_account_id
              );

              return {
                id: row.id,
                userId: row.user_id,
                cardId: row.account_id,
                cardName: cardAcc?.name || "Credit Card",
                amount: Number(row.amount),
                creditDestination: row.destination_type as CashbackDestination,
                destinationAccountId: row.destination_account_id,
                destinationAccountName: destAcc?.name || "Account",
                date: row.reward_date,
                transactionId: row.transaction_id || undefined,
                note: row.note || undefined,
                createdAt: row.created_at,
              };
            }
          );
          setCashbackRecords(mappedRecords);
          await localforage.setItem(recordsKey, mappedRecords);
        }
      } catch (err: unknown) {
        // Table does not exist or network unavailable — offline cache is already loaded
        console.warn("[useCashbackRewards] Cloud sync gracefully bypassed:", err);
      }
    }

    setIsLoading(false);
  }, [configsKey, recordsKey, isOfflineRef, session, accountObjects]);

  useEffect(() => {
    // Initial hydration of cached cashback configs and records from storage and Supabase
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // ─── 2. Save Card Rewards Config ────────────────────────────────────────
  const saveRewardsConfig = useCallback(
    async (config: CardRewardsConfig) => {
      const cardKey = config.accountId;
      const nextConfigs = {
        ...configsRef.current,
        [cardKey]: config,
      };

      setRewardsConfigs(nextConfigs);
      await localforage.setItem(configsKey, nextConfigs);

      // Cloud persistence if online
      if (!isOfflineRef.current && session?.user?.id) {
        try {
          await supabase.from("credit_card_reward_configs").upsert(
            {
              account_id: config.accountId,
              user_id: session.user.id,
              is_enabled: config.isEnabled,
              rules: config.rules,
              monthly_cap: config.monthlyCap ?? null,
              min_spend_threshold: config.minSpendThreshold ?? null,
              notes: config.notes ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "account_id,user_id" }
          );
        } catch (err) {
          console.warn("[useCashbackRewards] Cloud upsert bypassed:", err);
        }
      }
    },
    [configsKey, isOfflineRef, session]
  );

  // ─── 3. Record Confirmed Cashback Redemption ────────────────────────────
  const recordConfirmedCashback = useCallback(
    async (params: {
      card: Account;
      destinationAccount: Account;
      creditDestination: CashbackDestination;
      amount: number;
      date: string;
      note?: string;
    }): Promise<{ success: boolean; record?: CashbackRecord; error?: string }> => {
      const { card, destinationAccount, creditDestination, amount, date, note } = params;

      if (!amount || amount <= 0) {
        return { success: false, error: "Please enter a valid positive cashback amount." };
      }

      // Explicit offline check: block multi-table writes while offline to preserve ledger consistency
      if (isOfflineRef.current) {
        return {
          success: false,
          error: "Offline mode: Recording confirmed cashback redemptions requires an active connection to ensure your ledger and rewards auditor stay synchronized.",
        };
      }

      if (!session?.user?.id) {
        return { success: false, error: "Please sign in to record cashback." };
      }

      const cleanAmount = roundCurrency(amount);
      const isStatementCredit = creditDestination === "card_statement_credit";

      // Resolve valid account identifiers from loaded account objects
      const cardAcc =
        accountObjects.find(
          (a) => (card.id && a.id === card.id) || a.name.toLowerCase() === card.name.toLowerCase()
        ) || card;
      const destAcc =
        accountObjects.find(
          (a) =>
            (destinationAccount.id && a.id === destinationAccount.id) ||
            a.name.toLowerCase() === destinationAccount.name.toLowerCase()
        ) || destinationAccount;

      const cardId = cardAcc.id;
      const destAccountId = destAcc.id;

      if (!cardId || !destAccountId) {
        return {
          success: false,
          error: "Unable to verify account identifiers. Please ensure accounts have valid database IDs.",
        };
      }

      const operationId = crypto.randomUUID();

      // Attempt atomic RPC call first
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("post_credit_card_cashback", {
          p_operation_id: operationId,
          p_card_id: cardId,
          p_destination_account_id: destAccountId,
          p_destination_type: creditDestination,
          p_amount: cleanAmount,
          p_reward_date: date,
          p_note: note?.trim() || null,
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          const rpcRecord = rpcRes.record as CashbackRecord;
          const rpcTx = rpcRes.transaction as Transaction;

          // Update local state atomically
          const nextRecords = [
            rpcRecord,
            ...recordsRef.current.filter((r) => r.id !== rpcRecord.id),
          ];
          setCashbackRecords(nextRecords);
          await localforage.setItem(recordsKey, nextRecords);

          if (setTransactions && rpcTx) {
            setTransactions((prev) => [rpcTx, ...prev.filter((t) => t.id !== rpcTx.id)]);
          }

          triggerToast(
            isStatementCredit
              ? `Credited ${cleanAmount.toFixed(2)} statement credit to ${cardAcc.name}!`
              : `Deposited ${cleanAmount.toFixed(2)} cashback into ${destAcc.name}!`
          );

          return { success: true, record: rpcRecord };
        }

        // If RPC not found (code 42883: function does not exist), fall back to coordinated 2-step write
        if (rpcErr && rpcErr.code === "42883") {
          console.warn("[useCashbackRewards] RPC post_credit_card_cashback not installed. Using coordinated fallback.");

          const txId = crypto.randomUUID();
          const targetAccountName = isStatementCredit ? cardAcc.name : destAcc.name;
          const targetAccountId = isStatementCredit ? cardId : destAccountId;
          const txCategory = isStatementCredit ? "Card Statement Credit" : "Cashback & Rewards";
          const txNote =
            note?.trim() ||
            (isStatementCredit
              ? `Statement credit cashback (${cardAcc.name})`
              : `Cashback deposit from ${cardAcc.name}`);

          // Step 1: Insert ledger transaction with predetermined UUID
          const { data: txData, error: txErr } = await supabase
            .from("transactions")
            .insert({
              id: txId,
              user_id: session.user.id,
              type: "Income",
              amount: cleanAmount,
              category: txCategory,
              account: targetAccountName,
              account_id: targetAccountId,
              date,
              note: txNote,
              credit_card_tx_type: "cashback",
              status: "cleared",
            })
            .select()
            .single();

          if (txErr || !txData) {
            return {
              success: false,
              error: txErr?.message || "Failed to record cashback in transaction ledger.",
            };
          }

          // Step 2: Insert cashback record linked to txId
          const { data: cbData, error: cbErr } = await supabase
            .from("credit_card_cashback_records")
            .insert({
              id: operationId,
              user_id: session.user.id,
              account_id: cardId,
              destination_account_id: destAccountId,
              destination_type: creditDestination,
              amount: cleanAmount,
              transaction_id: txId,
              reward_date: date,
              note: note?.trim() || null,
            })
            .select()
            .single();

          if (cbErr || !cbData) {
            // Clean up ledger transaction to avoid phantom orphaned records
            await supabase.from("transactions").delete().eq("id", txId);
            return {
              success: false,
              error: cbErr?.message || "Failed to record cashback audit record in cloud.",
            };
          }

          const fallbackRecord: CashbackRecord = {
            id: operationId,
            userId: session.user.id,
            cardId,
            cardName: cardAcc.name,
            amount: cleanAmount,
            creditDestination,
            destinationAccountId: destAccountId,
            destinationAccountName: destAcc.name,
            date,
            transactionId: txId,
            note: note?.trim() || undefined,
            createdAt: new Date().toISOString(),
          };

          const nextRecords = [fallbackRecord, ...recordsRef.current];
          setCashbackRecords(nextRecords);
          await localforage.setItem(recordsKey, nextRecords);

          if (setTransactions) {
            setTransactions((prev) => [txData as Transaction, ...prev]);
          }

          triggerToast(
            isStatementCredit
              ? `Credited ${cleanAmount.toFixed(2)} statement credit to ${cardAcc.name}!`
              : `Deposited ${cleanAmount.toFixed(2)} cashback into ${destAcc.name}!`
          );

          return { success: true, record: fallbackRecord };
        }

        // Real RPC failure
        console.error("[useCashbackRewards] RPC post_credit_card_cashback error:", rpcErr);
        return {
          success: false,
          error: rpcErr?.message || "Failed to record cashback on cloud.",
        };
      } catch (err: unknown) {
        console.error("[useCashbackRewards] Network error during cashback posting:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error recording cashback.",
        };
      }
    },
    [accountObjects, isOfflineRef, recordsKey, session, setTransactions, triggerToast]
  );

  return {
    rewardsConfigs,
    cashbackRecords,
    isLoading,
    saveRewardsConfig,
    recordConfirmedCashback,
    reloadCashbackData: loadData,
  };
}
