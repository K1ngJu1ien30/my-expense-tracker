"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

  const userId = session?.user?.id;
  const [rewardsConfigs, setRewardsConfigs] = useState<Record<string, CardRewardsConfig>>({});
  const [rawCashbackRecords, setRawCashbackRecords] = useState<CashbackRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const configsKey = getUserCashbackConfigsKey(userId);
  const recordsKey = getUserCashbackRecordsKey(userId);

  const configsRef = useRef(rewardsConfigs);
  const recordsRef = useRef(rawCashbackRecords);
  const accountObjectsRef = useRef(accountObjects);
  const activeUserIdRef = useRef(userId);

  useEffect(() => {
    configsRef.current = rewardsConfigs;
  }, [rewardsConfigs]);

  useEffect(() => {
    recordsRef.current = rawCashbackRecords;
  }, [rawCashbackRecords]);

  useEffect(() => {
    accountObjectsRef.current = accountObjects;
  }, [accountObjects]);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  // Resolve fresh account display names in memory whenever accountObjects
  // updates — avoids re-querying IndexedDB/Supabase on account changes.
  const cashbackRecords = useMemo(() => {
    if (rawCashbackRecords.length === 0 || accountObjects.length === 0) {
      return rawCashbackRecords;
    }
    const accById = new Map<string, Account>();
    const accByName = new Map<string, Account>();
    for (const a of accountObjects) {
      if (a.id) accById.set(a.id, a);
      accByName.set(a.name, a);
    }
    return rawCashbackRecords.map((rec) => {
      const cardAcc = accById.get(rec.cardId) || accByName.get(rec.cardId);
      const destAcc = accById.get(rec.destinationAccountId) || accByName.get(rec.destinationAccountId);
      const nextCardName = cardAcc?.name || rec.cardName;
      const nextDestName = destAcc?.name || rec.destinationAccountName;
      if (nextCardName === rec.cardName && nextDestName === rec.destinationAccountName) {
        return rec;
      }
      return {
        ...rec,
        cardName: nextCardName,
        destinationAccountName: nextDestName,
      };
    });
  }, [rawCashbackRecords, accountObjects]);

  // ─── 1. Load data from local cache and cloud (keyed strictly by userId) ─
  const loadData = useCallback(async () => {
    if (!userId) {
      setRewardsConfigs({});
      setRawCashbackRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 1a. Load from local cache in parallel first
    try {
      const [localConfigs, localRecords] = await Promise.all([
        localforage.getItem<Record<string, CardRewardsConfig>>(configsKey),
        localforage.getItem<CashbackRecord[]>(recordsKey),
      ]);
      if (activeUserIdRef.current !== userId) return;
      if (localConfigs && typeof localConfigs === "object") {
        setRewardsConfigs(localConfigs);
      }
      if (Array.isArray(localRecords)) {
        setRawCashbackRecords(localRecords);
      }
    } catch (err) {
      console.warn("[useCashbackRewards] Error reading local cache:", err);
    }

    // 1b. If online and authenticated, fetch both tables in parallel
    if (!isOfflineRef.current) {
      try {
        const [cfgRes, recRes] = await Promise.all([
          supabase
            .from("credit_card_reward_configs")
            .select("account_id,is_enabled,rules,monthly_cap,min_spend_threshold,notes")
            .eq("user_id", userId),
          supabase
            .from("credit_card_cashback_records")
            .select("id,user_id,account_id,destination_account_id,destination_type,amount,reward_date,transaction_id,note,created_at")
            .eq("user_id", userId)
            .order("reward_date", { ascending: false }),
        ]);

        if (activeUserIdRef.current !== userId) return;

        if (!cfgRes.error && cfgRes.data) {
          const mappedConfigs: Record<string, CardRewardsConfig> = {};
          (cfgRes.data as RawRewardConfigRow[]).forEach((row) => {
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
          void localforage.setItem(configsKey, mappedConfigs).catch(() => {});
        }

        if (!recRes.error && recRes.data) {
          const curAccounts = accountObjectsRef.current;
          const mappedRecords: CashbackRecord[] = (recRes.data as RawCashbackRecordRow[]).map(
            (row) => {
              const cardAcc = curAccounts.find(
                (a) => a.id === row.account_id || a.name === row.account_id
              );
              const destAcc = curAccounts.find(
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
          setRawCashbackRecords(mappedRecords);
          void localforage.setItem(recordsKey, mappedRecords).catch(() => {});
        }
      } catch (err: unknown) {
        // Table does not exist or network unavailable — offline cache is already loaded
        console.warn("[useCashbackRewards] Cloud sync gracefully bypassed:", err);
      }
    }

    if (activeUserIdRef.current === userId) {
      setIsLoading(false);
    }
  }, [userId, configsKey, recordsKey, isOfflineRef]);

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
      operationId?: string; // Durable client operation ID for safe retries
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

      const operationId = params.operationId || crypto.randomUUID();

      // Attempt atomic RPC call
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
          setRawCashbackRecords(nextRecords);
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

        // Missing RPC requires database migration — strictly reject non-atomic fallback
        if (rpcErr && rpcErr.code === "42883") {
          return {
            success: false,
            error:
              "Database migration required: please execute 011_cashback_persistence_and_integrity.sql in Supabase to enable atomic cashback posting.",
          };
        }

        // Server RPC rejection or constraint error
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
