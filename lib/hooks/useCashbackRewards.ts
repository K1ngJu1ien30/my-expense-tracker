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
import {
  upsertCachedTransactions,
  upsertTransactionSorted,
  type LocalTxTracker,
} from "../txCache";
import { isValidUuid, parseLocalDateToIso, roundCurrency } from "../utils";

export type CashbackRewardsDeps = {
  session: Session | null;
  isOfflineRef: MutableRefObject<boolean>;
  localTxTracker?: LocalTxTracker;
  accountObjects: Account[];
  addTransaction: (tx: Partial<Transaction>) => Promise<TransactionSaveResult>;
  setTransactions?: (val: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  triggerToast: (msg: string) => void;
};

function normalizeRpcCashbackTx(
  raw: Record<string, unknown> | undefined | null,
  fallbackUserId: string
): Transaction | null {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  return {
    id: String(raw.id),
    user_id: String(raw.user_id ?? raw.userId ?? fallbackUserId),
    type: (raw.type as Transaction["type"]) || "Income",
    amount: Number(raw.amount ?? 0),
    category: String(raw.category ?? "Cashback"),
    account: String(raw.account ?? ""),
    account_id: (raw.account_id ?? raw.accountId) ? String(raw.account_id ?? raw.accountId) : undefined,
    date: parseLocalDateToIso(String(raw.date ?? new Date().toISOString())),
    note: raw.note ? String(raw.note) : undefined,
    status: (raw.status as Transaction["status"]) || "cleared",
    credit_card_tx_type: (raw.credit_card_tx_type ?? raw.creditCardTxType ?? "cashback") as Transaction["credit_card_tx_type"],
  };
}

export function useCashbackRewards(deps: CashbackRewardsDeps) {
  const {
    session,
    isOfflineRef,
    localTxTracker,
    accountObjects,
    addTransaction: _addTransaction,
    setTransactions,
    triggerToast,
  } = deps;
  void _addTransaction;

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

    setRewardsConfigs({});
    setRawCashbackRecords([]);
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
            let parsedRules: CardRewardsConfig["rules"] = [];
            try {
              parsedRules =
                typeof row.rules === "string"
                  ? JSON.parse(row.rules)
                  : Array.isArray(row.rules)
                    ? row.rules
                    : [];
            } catch {
              parsedRules = [];
            }
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
    void Promise.resolve().then(() => loadData());
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
      if (!isOfflineRef.current && userId) {
        try {
          await supabase.from("credit_card_reward_configs").upsert(
            {
              account_id: config.accountId,
              user_id: userId,
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
    [configsKey, isOfflineRef, userId]
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

      if (!amount || !Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: "Please enter a valid positive cashback amount." };
      }

      // Explicit offline check: block multi-table writes while offline to preserve ledger consistency
      if (isOfflineRef.current) {
        return {
          success: false,
          error: "Offline mode: Recording confirmed cashback redemptions requires an active connection to ensure your ledger and rewards auditor stay synchronized.",
        };
      }

      if (!userId) {
        return { success: false, error: "Please sign in to record cashback." };
      }

      const cleanAmount = roundCurrency(amount);
      const isStatementCredit = creditDestination === "card_statement_credit";
      const curAccounts = accountObjectsRef.current;

      // Resolve valid account identifiers from loaded account objects
      const cardAcc =
        curAccounts.find(
          (a) => (card.id && a.id === card.id) || a.name.toLowerCase() === card.name.toLowerCase()
        ) || card;
      const destAcc =
        curAccounts.find(
          (a) =>
            (destinationAccount.id && a.id === destinationAccount.id) ||
            a.name.toLowerCase() === destinationAccount.name.toLowerCase()
        ) || destinationAccount;

      const cardId = cardAcc.id;
      const destAccountId = destAcc.id;

      if (!isValidUuid(cardId) || !isValidUuid(destAccountId)) {
        return {
          success: false,
          error: "Unable to verify account identifiers. Please ensure accounts have valid database IDs.",
        };
      }

      if (!isStatementCredit && destAcc.kind === "credit_card") {
        return {
          success: false,
          error: "Bank deposit cashback must go into a non-credit-card account.",
        };
      }

      // Guard cross-currency bank deposit cashback
      if (
        !isStatementCredit &&
        cardAcc.currencyCode &&
        destAcc.currencyCode &&
        cardAcc.currencyCode.toUpperCase() !== destAcc.currencyCode.toUpperCase()
      ) {
        return {
          success: false,
          error: `Cross-currency cashback deposit is unsupported (${cardAcc.currencyCode} card → ${destAcc.currencyCode} account).`,
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
          const rawRec = (rpcRes.record || {}) as Partial<CashbackRecord>;
          const normalizedRecord: CashbackRecord = {
            id: rawRec.id || operationId,
            userId: rawRec.userId || userId,
            cardId: rawRec.cardId || cardId,
            cardName: rawRec.cardName || cardAcc.name,
            amount: Number(rawRec.amount ?? cleanAmount),
            creditDestination: rawRec.creditDestination || creditDestination,
            destinationAccountId: rawRec.destinationAccountId || destAccountId,
            destinationAccountName: rawRec.destinationAccountName || destAcc.name,
            date: rawRec.date || date,
            transactionId: rawRec.transactionId,
            note: rawRec.note,
            createdAt: rawRec.createdAt || new Date().toISOString(),
          };
          const normalizedTx = normalizeRpcCashbackTx(
            rpcRes.transaction as Record<string, unknown> | undefined,
            userId
          );

          // Update local state atomically
          const nextRecords = [
            normalizedRecord,
            ...recordsRef.current.filter((r) => r.id !== normalizedRecord.id),
          ];
          setRawCashbackRecords(nextRecords);
          await localforage.setItem(recordsKey, nextRecords);

          if (normalizedTx) {
            if (localTxTracker) {
              localTxTracker.recordStart(normalizedTx.id, { tx: normalizedTx, inFlight: false });
            }
            if (setTransactions) {
              setTransactions((prev) => upsertTransactionSorted(prev, normalizedTx));
            }
            void upsertCachedTransactions(userId, [normalizedTx]);
          }

          const cardCur = cardAcc.currencyCode || "RM";
          triggerToast(
            isStatementCredit
              ? `Credited ${cardCur} ${cleanAmount.toFixed(2)} statement credit to ${cardAcc.name}!`
              : `Deposited ${cardCur} ${cleanAmount.toFixed(2)} cashback into ${destAcc.name}!`
          );

          return { success: true, record: normalizedRecord };
        }

        if (rpcErr && rpcErr.code === "42883") {
          return {
            success: false,
            error:
              "Database migration required: please execute 011_cashback_persistence_and_integrity.sql in Supabase to enable atomic cashback posting.",
          };
        }

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
    [isOfflineRef, localTxTracker, recordsKey, setTransactions, triggerToast, userId]
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
