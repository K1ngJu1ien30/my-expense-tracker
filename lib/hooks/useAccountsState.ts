"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import localforage from "localforage";
import { supabase } from "../supabase";
import type { Account } from "../types";

const DEFAULT_ACCOUNTS: Account[] = [
  { name: "Bank", currencyCode: "RM", isArchived: false },
  { name: "Cash", currencyCode: "RM", isArchived: false },
  { name: "eWallet", currencyCode: "RM", isArchived: false },
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
 * Handles three historical shapes:
 *   1. string[]                    → pre-archive era
 *   2. { name, isArchived }[]      → pre-currencyCode era
 *   3. { name, currencyCode, isArchived }[]  → current
 */
export function migrateAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_ACCOUNTS;
  return raw.map((acc): Account => {
    if (typeof acc === "string") {
      return { name: acc, currencyCode: "RM", isArchived: false };
    }
    const obj = acc as { name?: string; currencyCode?: string; isArchived?: boolean };
    return {
      name: obj.name || "",
      currencyCode: obj.currencyCode || "RM",
      isArchived: obj.isArchived ?? false,
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

  /** Dual-write accounts to the user_accounts table (replace-all strategy). */
  const syncAccountsToNewTable = useCallback(
    async (userId: string, accountsArray: Account[]) => {
      try {
        await supabase.from("user_accounts").delete().eq("user_id", userId);
        if (accountsArray.length > 0) {
          const rows = accountsArray.map((a, idx) => ({
            user_id: userId,
            name: a.name,
            currency_code: a.currencyCode || "RM",
            is_archived: a.isArchived || false,
            sort_order: idx,
          }));
          await supabase.from("user_accounts").insert(rows);
        }
      } catch (err) {
        console.warn(
          "[dual-write] user_accounts sync failed (falling back to user_metadata only):",
          err
        );
      }
    },
    []
  );

  /**
   * Update accounts + dual-write to both storage destinations.
   * Uses Promise.allSettled so one failure doesn't block the other write.
   */
  const handleUpdateAccounts = useCallback(
    async (newAccountsArray: Account[]) => {
      setAccountObjects(newAccountsArray);
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
    (acc: string, currencyCode: string = "RM") =>
      handleUpdateAccounts([
        ...accountObjects,
        { name: acc, currencyCode, isArchived: false },
      ]),
    [accountObjects, handleUpdateAccounts]
  );

  const renameAccount = useCallback(
    (old: string, next: string) =>
      handleUpdateAccounts(
        accountObjects.map(a => (a.name === old ? { ...a, name: next } : a))
      ),
    [accountObjects, handleUpdateAccounts]
  );

  const deleteAccount = useCallback(
    (acc: string) =>
      handleUpdateAccounts(accountObjects.filter(a => a.name !== acc)),
    [accountObjects, handleUpdateAccounts]
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
  // Sync initial read from localStorage so the first paint has something to show.
  const [categories, setCategoriesRaw] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("tracker_data_cache");
        if (cached) {
          const data = JSON.parse(cached);
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            return data.categories;
          }
        }
      } catch {
        /* swallow */
      }
    }
    return DEFAULT_CATEGORIES;
  });

  // Async hydration from IndexedDB (overrides sync localStorage fallback).
  useEffect(() => {
    localforage
      .getItem<{ categories?: string[] }>("tracker_data_cache")
      .then(data => {
        if (data?.categories?.length) setCategoriesRaw(data.categories);
      })
      .catch(() => {});
  }, []);

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
      // IndexedDB cache — source of truth when cloud is unreachable.
      try {
        const data =
          ((await localforage.getItem("tracker_data_cache")) as Record<
            string,
            unknown
          > | null) || {};
        data.categories = newCats;
        await localforage.setItem("tracker_data_cache", data);
      } catch {
        /* swallow */
      }
      // localStorage fallback (for cold-boot useState initializer)
      try {
        const raw = localStorage.getItem("tracker_data_cache");
        const lsData = raw ? JSON.parse(raw) : {};
        lsData.categories = newCats;
        localStorage.setItem("tracker_data_cache", JSON.stringify(lsData));
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

  return {
    // Accounts
    accountObjects,
    setAccountObjects,
    accounts,
    setAccounts,
    addAccount,
    renameAccount,
    deleteAccount,
    toggleArchiveAccount,
    reorderAccounts,
    // Categories
    categories,
    setCategoriesRaw, // exposed so refreshData can bypass the persist path during cloud sync
    setCategories,
    addCategory,
    deleteCategory,
    categoriesRef, // for stale-closure-safe cache writes
  };
}
