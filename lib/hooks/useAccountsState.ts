"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import type { Account, AccountKind, CreditCardDetails } from "../types";
import { getUserDataCacheKey } from "../cacheKeys";

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "default-bank", name: "Bank", currencyCode: "RM", isArchived: false, kind: "bank", openingBalance: 0 },
  { id: "default-cash", name: "Cash", currencyCode: "RM", isArchived: false, kind: "cash", openingBalance: 0 },
  { id: "default-ewallet", name: "eWallet", currencyCode: "RM", isArchived: false, kind: "ewallet", openingBalance: 0 },
];

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Entertainment",
  "Shopping",
  "Bills",
  "Family",
  "Subs",
];

/**
 * Safe migration from legacy account formats to the current Account object.
 * Handles historical shapes while preserving stable UUIDs, account kinds,
 * opening balance information, and credit card details.
 */
export function migrateAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_ACCOUNTS;
  return raw.map((acc): Account => {
    if (typeof acc === "string") {
      return {
        id: crypto.randomUUID(),
        name: acc,
        currencyCode: "RM",
        isArchived: false,
        kind: "bank",
        openingBalance: 0,
      };
    }
    const obj = acc as {
      id?: string;
      name?: string;
      currencyCode?: string;
      currency_code?: string;
      isArchived?: boolean;
      is_archived?: boolean;
      kind?: AccountKind;
      openingBalance?: number | string;
      opening_balance?: number | string;
      openingBalanceDate?: string;
      opening_balance_date?: string;
      creditLimit?: number | string | null;
      credit_limit?: number | string | null;
      statementDay?: number | null;
      statement_day?: number | null;
      dueDay?: number | null;
      due_day?: number | null;
      cardDetails?: CreditCardDetails;
    };
    return {
      id: obj.id || crypto.randomUUID(),
      name: obj.name || "",
      currencyCode: obj.currencyCode || obj.currency_code || "RM",
      isArchived: obj.isArchived ?? obj.is_archived ?? false,
      kind: obj.kind || "bank",
      openingBalance: Number(obj.openingBalance ?? obj.opening_balance ?? 0) || 0,
      openingBalanceDate: obj.openingBalanceDate || obj.opening_balance_date,
      creditLimit:
        obj.creditLimit !== undefined
          ? obj.creditLimit !== null
            ? Number(obj.creditLimit)
            : null
          : obj.credit_limit !== undefined
            ? obj.credit_limit !== null
              ? Number(obj.credit_limit)
              : null
            : null,
      statementDay: obj.statementDay ?? obj.statement_day ?? null,
      dueDay: obj.dueDay ?? obj.due_day ?? null,
      cardDetails: obj.cardDetails
        ? {
            accountId: obj.cardDetails.accountId || obj.id || "",
            userId: obj.cardDetails.userId,
            issuer: obj.cardDetails.issuer,
            cardLastFour: obj.cardDetails.cardLastFour,
            statementDay: obj.cardDetails.statementDay || obj.statementDay || obj.statement_day || 15,
            gracePeriodDays: obj.cardDetails.gracePeriodDays ?? 20,
            dueDay: obj.cardDetails.dueDay ?? obj.dueDay ?? obj.due_day ?? null,
            apr: obj.cardDetails.apr,
            cardColor: obj.cardDetails.cardColor,
            reminderDaysBefore: obj.cardDetails.reminderDaysBefore ?? 3,
            createdAt: obj.cardDetails.createdAt,
            updatedAt: obj.cardDetails.updatedAt,
          }
        : undefined,
    };
  });
}

/**
 * useAccountsState — owns the wallet accounts + transaction categories.
 *
 * Both collections use the Migration 002 dual-write strategy:
 *   • Accounts  → `user_accounts` table (new, authoritative) + `user_metadata.custom_accounts` (legacy, for old APKs).
 *   • Categories → `user_categories` table (new, cross-device) + IndexedDB/localStorage (offline cache).
 *
 * Read strategy (handled by provider's refreshData): table first, metadata as fallback.
 * Write strategy (this hook): fire both destinations in parallel via Promise.allSettled,
 * tolerating either failure so the user never sees a hang.
 *
 * The `session` parameter is passed from the provider so this hook stays
 * decoupled from auth lifecycle management.
 */
export function useAccountsState(session: Session | null) {
  // ─── Accounts ──────────────────────────────────────────────────────────
  const [accountObjects, setAccountObjects] = useState<Account[]>(DEFAULT_ACCOUNTS);

  // Derived: non-archived account names for consumers
  const accounts = accountObjects.filter(a => !a.isArchived).map(a => a.name);

  /** Compat setter for consumers that pass a bare string[] */
  const setAccounts = useCallback((val: string[]) => {
    setAccountObjects(migrateAccounts(val));
  }, []);

  /** Dual-write accounts to user_accounts and credit_card_details (upsert strategy). */
  const syncAccountsToNewTable = useCallback(
    async (userId: string, accountsArray: Account[]): Promise<boolean> => {
      try {
        if (accountsArray.length > 0) {
          const rows = accountsArray.map((a, idx) => ({
            id: a.id && a.id.length === 36 ? a.id : crypto.randomUUID(),
            user_id: userId,
            name: a.name,
            currency_code: a.currencyCode || "RM",
            is_archived: a.isArchived || false,
            sort_order: idx,
            kind: a.kind || "bank",
            opening_balance: a.openingBalance ?? 0,
            credit_limit: a.creditLimit ?? null,
            statement_day: a.statementDay ?? null,
            due_day: a.dueDay ?? null,
          }));
          const { error: upsertErr } = await supabase
            .from("user_accounts")
            .upsert(rows, { onConflict: "id" });
          if (upsertErr) {
            console.warn("[dual-write] user_accounts upsert failed:", upsertErr);
            return false;
          }

          // Sync credit_card_details for any credit card accounts that have details
          const cardRows = accountsArray
            .filter(a => a.kind === "credit_card" && a.cardDetails)
            .map(a => ({
              account_id: a.id!,
              user_id: userId,
              issuer: a.cardDetails!.issuer || null,
              card_last_four: a.cardDetails!.cardLastFour || null,
              statement_day: a.cardDetails!.statementDay || a.statementDay || 15,
              grace_period_days: a.cardDetails!.gracePeriodDays ?? 20,
              due_day: a.cardDetails!.dueDay ?? a.dueDay ?? null,
              apr: a.cardDetails!.apr ?? null,
              card_color: a.cardDetails!.cardColor ?? null,
              reminder_days_before: a.cardDetails!.reminderDaysBefore ?? 3,
            }));

          if (cardRows.length > 0) {
            const { error: cardErr } = await supabase
              .from("credit_card_details")
              .upsert(cardRows, { onConflict: "account_id" });
            if (cardErr) {
              console.warn("[dual-write] credit_card_details upsert error:", cardErr);
            }
          }
        }
        return true;
      } catch (err) {
        console.warn(
          "[dual-write] user_accounts sync failed (falling back to user_metadata only):",
          err
        );
        return false;
      }
    },
    []
  );

  /**
   * Update accounts + dual-write to both storage destinations, and immediately
   * persist to user-scoped local cache (IndexedDB + localStorage) so offline
   * edits are never lost on reload.
   * Uses Promise.allSettled so cloud failure doesn't block local responsiveness.
   */
  const handleUpdateAccounts = useCallback(
    async (newAccountsArray: Account[]) => {
      setAccountObjects(newAccountsArray);
      const cacheKey = getUserDataCacheKey(session?.user?.id);

      // 1. IndexedDB cache
      try {
        const data =
          ((await localforage.getItem(cacheKey)) as Record<string, unknown> | null) || {};
        data.accounts = newAccountsArray;
        await localforage.setItem(cacheKey, data);
      } catch {
        /* swallow */
      }

      // 2. localStorage fallback
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(cacheKey);
          const lsData = raw ? JSON.parse(raw) : {};
          lsData.accounts = newAccountsArray;
          localStorage.setItem(cacheKey, JSON.stringify(lsData));
        } catch {
          /* swallow */
        }
      }

      if (!session?.user) return;
      await Promise.allSettled([
        supabase.auth.updateUser({ data: { custom_accounts: newAccountsArray } }),
        syncAccountsToNewTable(session.user.id, newAccountsArray),
      ]);
    },
    [session, syncAccountsToNewTable]
  );

  const reorderAccounts = useCallback(
    async (names: string[]) => {
      const archivedAccounts = accountObjects.filter(a => a.isArchived);
      const reordered = names.map(
        name =>
          accountObjects.find(a => a.name === name) || {
            name,
            currencyCode: "RM",
            isArchived: false,
          }
      );
      await handleUpdateAccounts([...reordered, ...archivedAccounts]);
    },
    [accountObjects, handleUpdateAccounts]
  );

  const addAccount = useCallback(
    (
      acc: string,
      currencyCode: string = "RM",
      kind: AccountKind = "bank",
      openingBalance: number = 0,
      creditLimit?: number | null,
      statementDay?: number | null,
      dueDay?: number | null
    ) =>
      handleUpdateAccounts([
        ...accountObjects,
        {
          id: crypto.randomUUID(),
          name: acc,
          currencyCode,
          isArchived: false,
          kind,
          openingBalance,
          creditLimit: creditLimit ?? null,
          statementDay: statementDay ?? null,
          dueDay: dueDay ?? null,
        },
      ]),
    [accountObjects, handleUpdateAccounts]
  );

  const addCreditCardAccount = useCallback(
    async (params: {
      name: string;
      currencyCode?: string;
      creditLimit?: number | null;
      openingBalance?: number;
      issuer?: string;
      cardLastFour?: string;
      statementDay: number;
      gracePeriodDays?: number;
      dueDay?: number | null;
      apr?: number | null;
      cardColor?: string | null;
      reminderDaysBefore?: number;
    }) => {
      const accountId = crypto.randomUUID();
      const cardDetails: CreditCardDetails = {
        accountId,
        userId: session?.user?.id,
        issuer: params.issuer,
        cardLastFour: params.cardLastFour,
        statementDay: params.statementDay || 15,
        gracePeriodDays: params.gracePeriodDays ?? 20,
        dueDay: params.dueDay ?? null,
        apr: params.apr ?? null,
        cardColor: params.cardColor ?? null,
        reminderDaysBefore: params.reminderDaysBefore ?? 3,
      };

      // Unpaid debt on a credit card is entered as positive debt magnitude by user,
      // and stored as negative opening balance to properly represent debt.
      const rawDebt = params.openingBalance ? Math.abs(params.openingBalance) : 0;
      const openingBalance = -rawDebt;

      const newAcc: Account = {
        id: accountId,
        name: params.name,
        currencyCode: params.currencyCode || "RM",
        isArchived: false,
        kind: "credit_card",
        openingBalance,
        creditLimit: params.creditLimit ?? null,
        statementDay: params.statementDay || 15,
        dueDay: params.dueDay ?? null,
        cardDetails,
      };

      await handleUpdateAccounts([...accountObjects, newAcc]);
    },
    [accountObjects, handleUpdateAccounts, session]
  );

  const updateAccount = useCallback(
    (nameOrId: string, patch: Partial<Account>) =>
      handleUpdateAccounts(
        accountObjects.map(a =>
          a.id === nameOrId || a.name === nameOrId ? { ...a, ...patch } : a
        )
      ),
    [accountObjects, handleUpdateAccounts]
  );

  const updateCreditCardDetails = useCallback(
    async (accountId: string, patch: Partial<CreditCardDetails>) => {
      const updatedAccounts = accountObjects.map(a => {
        if (a.id === accountId) {
          const updatedCardDetails: CreditCardDetails = {
            accountId,
            userId: session?.user?.id,
            statementDay: a.statementDay || 15,
            gracePeriodDays: 20,
            reminderDaysBefore: 3,
            ...(a.cardDetails || {}),
            ...patch,
          };
          return {
            ...a,
            statementDay: updatedCardDetails.statementDay ?? a.statementDay,
            dueDay: updatedCardDetails.dueDay ?? a.dueDay,
            cardDetails: updatedCardDetails,
          };
        }
        return a;
      });

      await handleUpdateAccounts(updatedAccounts);
    },
    [accountObjects, handleUpdateAccounts, session]
  );

  const renameAccount = useCallback(
    (old: string, next: string) =>
      handleUpdateAccounts(
        accountObjects.map(a => (a.name === old ? { ...a, name: next } : a))
      ),
    [accountObjects, handleUpdateAccounts]
  );

  const deleteAccount = useCallback(
    (acc: string) => {
      const target = accountObjects.find(a => a.name === acc || a.id === acc);
      if (target?.id && session?.user?.id) {
        supabase.from("user_accounts").delete().eq("id", target.id).eq("user_id", session.user.id).then();
        if (target.kind === "credit_card") {
          supabase.from("credit_card_details").delete().eq("account_id", target.id).eq("user_id", session.user.id).then();
        }
      }
      return handleUpdateAccounts(accountObjects.filter(a => a.name !== acc && a.id !== acc));
    },
    [accountObjects, handleUpdateAccounts, session]
  );

  const toggleArchiveAccount = useCallback(
    (name: string) =>
      handleUpdateAccounts(
        accountObjects.map(a =>
          a.name === name ? { ...a, isArchived: !a.isArchived } : a
        )
      ),
    [accountObjects, handleUpdateAccounts]
  );

  // ─── Categories ────────────────────────────────────────────────────────
  const [categories, setCategoriesRaw] = useState<string[]>(DEFAULT_CATEGORIES);

  // User-isolated cache hydration: loads only for the authenticated user,
  // and resets to clean defaults when logged out.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setCategoriesRaw(DEFAULT_CATEGORIES);
      setAccountObjects(DEFAULT_ACCOUNTS);
      return;
    }

    const cacheKey = getUserDataCacheKey(userId);
    // 1. Try sync read from user's localStorage cache for immediate paint
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategoriesRaw(data.categories);
          }
          if (Array.isArray(data.accounts) && data.accounts.length > 0) {
            setAccountObjects(migrateAccounts(data.accounts));
          }
        }
      } catch {
        /* swallow */
      }
    }

    // 2. Async hydration from user's IndexedDB cache
    localforage
      .getItem<{ categories?: string[]; accounts?: unknown }>(cacheKey)
      .then(data => {
        if (data?.categories?.length) setCategoriesRaw(data.categories);
        if (data?.accounts) setAccountObjects(migrateAccounts(data.accounts));
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Ref mirror — used by the provider's refreshData to avoid stale closures
  // when caching the current category list after a network fetch.
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  /** Dual-write categories to the user_categories table (replace-all strategy).
   *
   * Returns true on success, false on any failure — the caller uses this to
   * surface a toast so the user knows when a category addition didn't make
   * it to the cloud and might disappear after a clean install.
   */
  const syncCategoriesToNewTable = useCallback(
    async (userId: string, cats: string[]): Promise<boolean> => {
      try {
        const { error: deleteErr } = await supabase
          .from("user_categories")
          .delete()
          .eq("user_id", userId);
        if (deleteErr) throw deleteErr;
        if (cats.length > 0) {
          const rows = cats.map((name, idx) => ({
            user_id: userId,
            name,
            sort_order: idx,
          }));
          const { error: insertErr } = await supabase.from("user_categories").insert(rows);
          if (insertErr) throw insertErr;
        }
        return true;
      } catch (err) {
        console.warn(
          "[dual-write] user_categories sync failed (falling back to local cache only):",
          err
        );
        return false;
      }
    },
    []
  );

  /** Persist categories to IndexedDB + localStorage + Supabase. */
  const persistCategories = useCallback(
    async (newCats: string[]) => {
      const cacheKey = getUserDataCacheKey(session?.user?.id);
      // IndexedDB cache — source of truth when cloud is unreachable.
      try {
        const data =
          ((await localforage.getItem(cacheKey)) as Record<
            string,
            unknown
          > | null) || {};
        data.categories = newCats;
        await localforage.setItem(cacheKey, data);
      } catch {
        /* swallow */
      }
      // localStorage fallback (for cold-boot useState initializer)
      try {
        const raw = localStorage.getItem(cacheKey);
        const lsData = raw ? JSON.parse(raw) : {};
        lsData.categories = newCats;
        localStorage.setItem(cacheKey, JSON.stringify(lsData));
      } catch {
        /* swallow */
      }
      // Cloud sync for cross-device consistency. Awaited (not fire-and-forget)
      // so we can detect failures — otherwise a silent cloud-write failure
      // means the category is only on-device, and gets overwritten by the
      // next refreshData() merge. See the bug report: "categories disappear
      // after every app update."
      if (session?.user) {
        const ok = await syncCategoriesToNewTable(session.user.id, newCats);
        if (!ok) {
          // Also mirror into user_metadata as a secondary fallback so the
          // category survives cache wipes even when the dedicated table is
          // unreachable (e.g. migration 002 not yet applied on this project).
          try {
            await supabase.auth.updateUser({ data: { custom_categories: newCats } });
          } catch {
            /* silent — we've done all we can */
          }
        }
      }
    },
    [session, syncCategoriesToNewTable]
  );

  const setCategories = useCallback(
    (cats: string[] | ((prev: string[]) => string[])) => {
      setCategoriesRaw(prev => {
        const next = typeof cats === "function" ? cats(prev) : cats;
        persistCategories(next);
        return next;
      });
    },
    [persistCategories]
  );

  const addCategory = useCallback(
    (cat: string) => setCategories(prev => [...prev, cat]),
    [setCategories]
  );

  const deleteCategory = useCallback(
    (cat: string) => setCategories(prev => prev.filter(c => c !== cat)),
    [setCategories]
  );

  const resetAccountsState = useCallback(() => {
    setCategoriesRaw(DEFAULT_CATEGORIES);
    setAccountObjects(DEFAULT_ACCOUNTS);
  }, []);

  return {
    // Accounts
    accountObjects,
    setAccountObjects,
    accounts,
    setAccounts,
    addAccount,
    addCreditCardAccount,
    updateAccount,
    updateCreditCardDetails,
    renameAccount,
    deleteAccount,
    toggleArchiveAccount,
    reorderAccounts,
    resetAccountsState,
    // Categories
    categories,
    setCategoriesRaw, // exposed so refreshData can bypass the persist path during cloud sync
    setCategories,
    addCategory,
    deleteCategory,
    categoriesRef, // for stale-closure-safe cache writes
  };
}
