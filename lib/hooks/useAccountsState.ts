"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import type { Account, AccountKind, CreditCardDetails } from "../types";
import { getUserDataCacheKey, getUserMetaCacheKey } from "../cacheKeys";

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

  // Derived: non-archived account names for consumers (memoized so reference
  // stays stable across unrelated provider re-renders).
  const accounts = useMemo(
    () => accountObjects.filter(a => !a.isArchived).map(a => a.name),
    [accountObjects]
  );

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
            id: a.id!,
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
            .filter(a => a.kind === "credit_card" && a.cardDetails && a.id)
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

  const userId = session?.user?.id;

  /**
   * Update accounts + dual-write to both storage destinations, and immediately
   * persist to user-scoped local cache (IndexedDB + localStorage) so offline
   * edits are never lost on reload.
   * Assigns canonical UUIDs up front so every state copy and DB row share one ID.
   */
  const handleUpdateAccounts = useCallback(
    async (rawAccountsArray: Account[]) => {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const newAccountsArray: Account[] = rawAccountsArray.map(a => {
        const canonicalId = a.id && uuidRe.test(a.id) ? a.id : crypto.randomUUID();
        if (canonicalId === a.id && (!a.cardDetails || a.cardDetails.accountId === canonicalId)) {
          return a;
        }
        return {
          ...a,
          id: canonicalId,
          ...(a.cardDetails ? { cardDetails: { ...a.cardDetails, accountId: canonicalId } } : {}),
        };
      });

      setAccountObjects(newAccountsArray);
      const cacheKey = getUserDataCacheKey(userId);
      const metaKey = getUserMetaCacheKey(userId);

      // 1. Lightweight localStorage metadata mirror (tiny — no transactions)
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(metaKey);
          const lsMeta = raw ? JSON.parse(raw) : {};
          lsMeta.accounts = newAccountsArray;
          localStorage.setItem(metaKey, JSON.stringify(lsMeta));
        } catch {
          /* swallow */
        }
      }

      // 2. IndexedDB cache (primary persistent store)
      try {
        const data =
          ((await localforage.getItem(cacheKey)) as Record<string, unknown> | null) || {};
        data.accounts = newAccountsArray;
        await localforage.setItem(cacheKey, data);
      } catch {
        /* swallow */
      }

      if (!userId) return;
      await Promise.allSettled([
        supabase.auth.updateUser({ data: { custom_accounts: newAccountsArray } }),
        syncAccountsToNewTable(userId, newAccountsArray),
      ]);
    },
    [userId, syncAccountsToNewTable]
  );

  const reorderAccounts = useCallback(
    async (names: string[]) => {
      const archivedAccounts = accountObjects.filter(a => a.isArchived);
      const reordered = names.map(
        name =>
          accountObjects.find(a => a.name === name) || {
            id: crypto.randomUUID(),
            name,
            currencyCode: "RM",
            isArchived: false,
            kind: "bank" as const,
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
        if (a.id === accountId || a.name === accountId) {
          const updatedCardDetails: CreditCardDetails = {
            accountId: a.id || accountId,
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
    async (
      acc: string,
      options?: {
        dependencyCheck?: () => { canDelete: boolean; reason?: string };
      }
    ): Promise<{ success: boolean; error?: string }> => {
      const target = accountObjects.find(a => a.name === acc || a.id === acc);
      if (!target) {
        return { success: false, error: "Account not found." };
      }

      // 1. Client-side dependency check
      if (options?.dependencyCheck) {
        const check = options.dependencyCheck();
        if (!check.canDelete) {
          return {
            success: false,
            error:
              check.reason ||
              "Cannot delete account with existing financial history. Please archive instead.",
          };
        }
      }

      // 2. Database-level safe delete (RPC or restricted delete)
      if (target.id && session?.user?.id) {
        try {
          const { error: rpcErr } = await supabase.rpc("delete_user_account", {
            p_account_id: target.id,
          });

          if (rpcErr) {
            // Check for dependency violation or foreign key restriction
            if (
              rpcErr.code === "23503" ||
              rpcErr.message?.includes("ACCOUNT_HAS_DEPENDENCIES") ||
              rpcErr.message?.includes("violates foreign key constraint")
            ) {
              return {
                success: false,
                error:
                  "Cannot delete this account because it has linked financial records. Please archive it instead.",
              };
            }

            // Missing RPC requires database migration — reject unsafe direct table delete fallback
            if (rpcErr.code === "42883" || rpcErr.message?.includes("delete_user_account")) {
              return {
                success: false,
                error:
                  "Database migration required: please execute 010_safe_account_deletion_and_integrity.sql in Supabase to enable safe account deletion.",
              };
            }

            return { success: false, error: rpcErr.message };
          }
        } catch (err) {
          console.error("[deleteAccount] Deletion exception:", err);
          return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to delete account.",
          };
        }
      }

      // 3. Update local state and storage
      const nextAccounts = accountObjects.filter(a => a.name !== acc && a.id !== acc);
      await handleUpdateAccounts(nextAccounts);
      return { success: true };
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

  // User-isolated cache hydration: loads lightweight metadata synchronously
  // from localStorage for instant first-paint accounts/categories without
  // parsing the full transactions cache. Full IndexedDB hydration is handled
  // once by useSyncState.hydrateFromCache().
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setCategoriesRaw(DEFAULT_CATEGORIES);
      setAccountObjects(DEFAULT_ACCOUNTS);
      return;
    }

    const metaKey = getUserMetaCacheKey(userId);
    const legacyFullKey = getUserDataCacheKey(userId);
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(metaKey) || localStorage.getItem(legacyFullKey);
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
  }, [session?.user?.id]);

  // Ref mirror — used by the provider's refreshData to avoid stale closures
  // when caching the current category list after a network fetch.
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  /**
   * Dual-write categories to the user_categories table using safe upsert-then-prune
   * (never deletes existing rows before the new rows are written, so a mid-sync
   * network failure can never wipe all user categories).
   */
  const syncCategoriesToNewTable = useCallback(
    async (uid: string, cats: string[]): Promise<boolean> => {
      try {
        // Deduplicate preserving order
        const deduped: string[] = [];
        const seen = new Set<string>();
        for (const c of cats) {
          const trimmed = c.trim();
          if (trimmed && !seen.has(trimmed.toLowerCase())) {
            seen.add(trimmed.toLowerCase());
            deduped.push(trimmed);
          }
        }

        if (deduped.length > 0) {
          const rows = deduped.map((name, idx) => ({
            user_id: uid,
            name,
            sort_order: idx,
          }));
          const { error: upsertErr } = await supabase
            .from("user_categories")
            .upsert(rows, { onConflict: "user_id,name" });
          if (upsertErr) throw upsertErr;
        }

        // Remove only categories that are no longer in `deduped`
        const { data: existingRows, error: selectErr } = await supabase
          .from("user_categories")
          .select("name")
          .eq("user_id", uid);
        if (selectErr) throw selectErr;

        const toRemove = (existingRows || [])
          .map(r => r.name as string)
          .filter(name => !seen.has(name.toLowerCase()));

        if (toRemove.length > 0) {
          const { error: delErr } = await supabase
            .from("user_categories")
            .delete()
            .eq("user_id", uid)
            .in("name", toRemove);
          if (delErr) throw delErr;
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

  /** Persist categories to IndexedDB + lightweight localStorage meta + Supabase. */
  const persistCategories = useCallback(
    async (newCats: string[]) => {
      const cacheKey = getUserDataCacheKey(userId);
      const metaKey = getUserMetaCacheKey(userId);

      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(metaKey);
          const lsMeta = raw ? JSON.parse(raw) : {};
          lsMeta.categories = newCats;
          localStorage.setItem(metaKey, JSON.stringify(lsMeta));
        } catch {
          /* swallow */
        }
      }

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

      if (userId) {
        const ok = await syncCategoriesToNewTable(userId, newCats);
        if (!ok) {
          try {
            await supabase.auth.updateUser({ data: { custom_categories: newCats } });
          } catch {
            /* silent */
          }
        }
      }
    },
    [userId, syncCategoriesToNewTable]
  );

  const setCategories = useCallback(
    (cats: string[] | ((prev: string[]) => string[])) => {
      const next = typeof cats === "function" ? cats(categoriesRef.current) : cats;
      categoriesRef.current = next;
      setCategoriesRaw(next);
      void persistCategories(next);
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
