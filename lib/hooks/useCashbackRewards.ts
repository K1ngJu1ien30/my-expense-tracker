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
  triggerToast: (msg: string) => void;
};

export function useCashbackRewards(deps: CashbackRewardsDeps) {
  const { session, isOfflineRef, accountObjects, addTransaction, triggerToast } = deps;

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

      const cleanAmount = roundCurrency(amount);
      const isStatementCredit = creditDestination === "card_statement_credit";

      // 3a. Generate atomic ledger transaction
      // Statement credit is an Income on the credit card (reducing debt).
      // Bank deposit is an Income on the target bank account (increasing cash).
      const targetAccountName = isStatementCredit ? card.name : destinationAccount.name;
      const targetAccountId = isStatementCredit
        ? card.id || card.name
        : destinationAccount.id || destinationAccount.name;

      const txPayload: Partial<Transaction> = {
        type: "Income",
        amount: cleanAmount,
        account: targetAccountName,
        account_id: targetAccountId,
        date,
        category: "Cashback & Rewards",
        credit_card_tx_type: "cashback",
        note:
          note?.trim() ||
          (isStatementCredit
            ? `Statement credit cashback (${card.name})`
            : `Cashback deposit from ${card.name}`),
      };

      const txResult = await addTransaction(txPayload);
      if (!txResult.success) {
        return {
          success: false,
          error: txResult.error || "Failed to record cashback in transaction ledger.",
        };
      }

      // 3b. Create Cashback Record
      const newRecord: CashbackRecord = {
        id: crypto.randomUUID(),
        userId: session?.user?.id,
        cardId: card.id || card.name,
        cardName: card.name,
        amount: cleanAmount,
        creditDestination,
        destinationAccountId: destinationAccount.id || destinationAccount.name,
        destinationAccountName: destinationAccount.name,
        date,
        transactionId: undefined,
        note: note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      const nextRecords = [newRecord, ...recordsRef.current];
      setCashbackRecords(nextRecords);
      await localforage.setItem(recordsKey, nextRecords);

      // 3c. Cloud persistence if online
      if (!isOfflineRef.current && session?.user?.id) {
        try {
          await supabase.from("credit_card_cashback_records").insert({
            id: newRecord.id,
            user_id: session.user.id,
            account_id: card.id || card.name,
            destination_account_id: destinationAccount.id || destinationAccount.name,
            destination_type: creditDestination,
            amount: cleanAmount,
            transaction_id: null,
            reward_date: date,
            note: note?.trim() || null,
          });
        } catch (err) {
          console.warn("[useCashbackRewards] Cloud record insert bypassed:", err);
        }
      }

      triggerToast(
        isStatementCredit
          ? `Credited ${cleanAmount.toFixed(2)} statement credit to ${card.name}!`
          : `Deposited ${cleanAmount.toFixed(2)} cashback into ${destinationAccount.name}!`
      );

      return { success: true, record: newRecord };
    },
    [addTransaction, recordsKey, isOfflineRef, session, triggerToast]
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
