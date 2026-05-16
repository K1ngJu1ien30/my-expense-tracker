"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import localforage from "localforage";
import type {
  Goal,
  Subscription,
  Transaction,
  ToastType,
  PlannerItem,
  Asset,
  AssetLog,
  TradeItem,
  Account,
  WPTrip, WPTripDay, WPActivity, WPBudgetAllocation,
  WPTripExpense, WPSavedPlace, WPDocument, WPPackingItem,
  WPTripStatus, WPBudgetCategory,
} from "./types";
import { useEasterEggsUI } from "./hooks/useEasterEggsUI";
import { useUIState } from "./hooks/useUIState";
import { useUserPreferences } from "./hooks/useUserPreferences";
import { useAccountsState } from "./hooks/useAccountsState";
import { useSyncState } from "./hooks/useSyncState";
import { useMoneyState } from "./hooks/useMoneyState";
import { usePlanningState } from "./hooks/usePlanningState";
import { useModulesData } from "./hooks/useModulesData";
import { useWanderPlanState } from "./hooks/useWanderPlanState";

// Re-export for backward compatibility — existing pages import from "@/lib/context".
// Keeping this until we move everything to direct type imports from "@/lib/types".
export type {
  Goal,
  Subscription,
  Transaction,
  ToastType,
  PlannerItem,
  Asset,
  AssetLog,
  TradeItem,
  Account,
};

// Configure localforage for IndexedDB.
// Browser-only guard: during Next.js SSR there's no IndexedDB or localStorage,
// so calling this on the server produces a noisy "No available storage method
// found" rejection. We defer config to the client where it actually works.
if (typeof window !== "undefined") {
  localforage.config({
    name: 'tracker',
    storeName: 'app_cache',
    driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
  });
}

type AppContextType = {
  userName: string;
  setUserName: (val: string) => void;
  currency: string;
  setCurrency: (val: string) => void;
  formatCurrency: (amount: number) => string;
  exchangeRates: Record<string, number>;
  billingCycle: string;
  setBillingCycle: (val: string) => void;
  dailyReminder: boolean;
  setDailyReminder: (val: boolean) => void;
  reminderTime: string;
  setReminderTime: (val: string) => void;
  categories: string[];
  setCategories: (cats: string[]) => void;
  addCategory: (cat: string) => void;
  deleteCategory: (cat: string) => void;
  toast: ToastType;
  triggerToast: (msg: string) => void;
  transactions: Transaction[];
  addTransaction: (tx: Partial<Transaction>) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  editTransactionId: string | null;
  setEditTransactionId: (val: string | null) => void;
  subscriptions: Subscription[];
  addSubscription: (sub: Partial<Subscription>) => Promise<void>;
  updateSubscription: (id: string, patch: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  utilities: Subscription[];
  addUtility: (sub: Partial<Subscription>) => Promise<void>;
  updateUtility: (id: string, patch: Partial<Subscription>) => Promise<void>;
  deleteUtility: (id: string) => Promise<void>;
  goals: Goal[];
  addGoal: (goal: Partial<Goal>) => Promise<void>;
  updateGoal: (id: string, goal: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  accounts: string[];
  accountObjects: Account[];
  setAccounts: (val: string[]) => void;
  reorderAccounts: (val: string[]) => Promise<void>;
  addAccount: (acc: string, currencyCode?: string) => void;
  renameAccount: (old: string, next: string) => void;
  deleteAccount: (acc: string) => void;
  toggleArchiveAccount: (name: string) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  authLoading: boolean;
  includeSavings: boolean;
  toggleIncludeSavings: (val: boolean) => void;
  session: Session | null;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
  enableFoodBudget: boolean;
  toggleFoodBudget: (val: boolean) => void;
  enableSalaryPlanner: boolean;
  toggleSalaryPlanner: (val: boolean) => void;
  foodDailyLimit: number;
  setFoodDailyLimit: (val: number) => void;
  foodMonthlyLimit: number;
  setFoodMonthlyLimit: (val: number) => void;
  plannerItems: PlannerItem[];
  addPlannerItem: (item: Partial<PlannerItem>) => Promise<void>;
  deletePlannerItem: (id: string) => Promise<void>;
  isPinEnabled: boolean;
  togglePin: (val: boolean) => void;
  isBiometricEnabled: boolean;
  toggleBiometric: (val: boolean) => void;
  assets: Asset[];
  addAsset: (asset: Partial<Asset>) => Promise<void>;
  updateAsset: (id: string, patch: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  isVaultEnabled: boolean;
  toggleVault: (val: boolean) => void;
  isRadarEnabled: boolean;
  toggleRadar: (val: boolean) => void;
  activeAssetId: string | null;
  setActiveAssetId: (id: string | null) => void;
  showTransactionModal: boolean;
  setShowTransactionModal: (val: boolean) => void;
  isOffline: boolean;
  isClaimsEnabled: boolean;
  toggleClaims: (val: boolean) => void;
  isTradingEnabled: boolean;
  toggleTrading: (val: boolean) => void;
  isWanderPlanEnabled: boolean;
  toggleWanderPlan: (val: boolean) => void;
  // WanderPlan state + CRUD
  wpTrips: WPTrip[];
  wpTripDays: WPTripDay[];
  wpActivities: WPActivity[];
  wpAllocations: WPBudgetAllocation[];
  wpExpenses: WPTripExpense[];
  wpPlaces: WPSavedPlace[];
  wpDocuments: WPDocument[];
  wpPackingItems: WPPackingItem[];
  wpActiveTripId: string | null;
  setWPActiveTripId: (id: string | null) => void;
  loadWanderPlanData: (userId: string) => Promise<void>;
  createWPTrip: (data: Partial<WPTrip>) => Promise<string | null>;
  updateWPTrip: (id: string, data: Partial<WPTrip>) => Promise<void>;
  deleteWPTrip: (id: string) => Promise<void>;
  setWPTripStatus: (id: string, status: WPTripStatus) => Promise<void>;
  getWPTripDays: (tripId: string) => WPTripDay[];
  createWPActivity: (dayId: string, data: Partial<WPActivity>) => Promise<void>;
  updateWPActivity: (id: string, data: Partial<WPActivity>) => Promise<void>;
  deleteWPActivity: (id: string) => Promise<void>;
  toggleWPActivityCompleted: (id: string) => Promise<void>;
  reorderWPActivities: (dayId: string, orderedIds: string[]) => Promise<void>;
  setWPAllocation: (tripId: string, category: WPBudgetCategory, cents: number) => Promise<void>;
  addWPExpense: (tripId: string, data: Partial<WPTripExpense>) => Promise<void>;
  deleteWPExpense: (id: string) => Promise<void>;
  createWPPlace: (tripId: string, data: Partial<WPSavedPlace>) => Promise<void>;
  deleteWPPlace: (id: string) => Promise<void>;
  toggleWPPlaceVisited: (id: string) => Promise<void>;
  createWPDocument: (tripId: string, data: Partial<WPDocument>) => Promise<void>;
  deleteWPDocument: (id: string) => Promise<void>;
  addWPPackingItem: (tripId: string, data: Partial<WPPackingItem>) => Promise<void>;
  addWPPackingItems: (tripId: string, items: { category: string; item_name: string; quantity: number }[]) => Promise<void>;
  toggleWPPacked: (id: string) => Promise<void>;
  deleteWPPackingItem: (id: string) => Promise<void>;
  tradeItems: TradeItem[];
  addTradeItem: (item: Partial<TradeItem>) => Promise<void>;
  updateTradeItem: (id: string, patch: Partial<TradeItem>) => Promise<void>;
  deleteTradeItem: (id: string) => Promise<void>;
  isGodMode: boolean;
  whaleAlert: boolean;
  sharkUndo: boolean;
  derryActive: boolean;
  penguinAlert: boolean;
  dragonAlert: boolean;
  phoenixAlert: boolean;
  triggerDerry: () => void;
  enableTimeBasedGreeting: boolean;
  toggleTimeBasedGreeting: (val: boolean) => Promise<void>;
  enableFridayThe13th: boolean;
  toggleFridayThe13th: (val: boolean) => Promise<void>;
  primaryLocation: string;
  setPrimaryLocation: (val: string) => Promise<void>;
  secondaryLocation: string;
  setSecondaryLocation: (val: string) => Promise<void>;
};

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isHydrating, setIsHydrating] = useState(true);

  // ─── User preferences + feature flags (persisted to user_metadata) ──────
  const prefs = useUserPreferences(session);
  const {
    userName, setUserName,
    currency, setCurrency,
    billingCycle, setBillingCycle,
    dailyReminder, setDailyReminder,
    reminderTime, setReminderTime,
    accentColor, setAccentColor,
    includeSavings, toggleIncludeSavings,
    enableFoodBudget, toggleFoodBudget,
    enableSalaryPlanner, toggleSalaryPlanner,
    foodDailyLimit, setFoodDailyLimit,
    foodMonthlyLimit, setFoodMonthlyLimit,
    isPinEnabled, togglePin,
    isBiometricEnabled, toggleBiometric,
    isVaultEnabled, toggleVault,
    isRadarEnabled, toggleRadar,
    isClaimsEnabled, toggleClaims,
    isTradingEnabled, toggleTrading,
    isWanderPlanEnabled, toggleWanderPlan,
    enableTimeBasedGreeting, toggleTimeBasedGreeting,
    enableFridayThe13th, toggleFridayThe13th,
    primaryLocation, setPrimaryLocation,
    secondaryLocation, setSecondaryLocation,
  } = prefs;

  // ─── Remaining non-preference state ─────────────────────────────────────
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // ─── Accounts + Categories (extracted to hooks/useAccountsState) ────────
  const {
    accountObjects,
    setAccountObjects,
    accounts,
    setAccounts,
    addAccount,
    renameAccount,
    deleteAccount,
    toggleArchiveAccount,
    reorderAccounts,
    categories,
    setCategoriesRaw,
    setCategories,
    addCategory,
    deleteCategory,
    categoriesRef,
  } = useAccountsState(session);

  // ─── Remaining app-level state moved to dedicated CRUD hooks below ──────

  // ─── Easter Eggs (UI state extracted to hooks/useEasterEggsUI) ──────────
  const {
    isGodMode,
    whaleAlert,
    sharkUndo,
    derryActive,
    penguinAlert,
    dragonAlert,
    phoenixAlert,
    triggerWhaleAlert,
    maybeTriggerPenguinAlert,
    triggerDragonAlert,
    triggerPhoenixAlert,
    triggerDerry,
    showSharkUndo,
    deletedItemCacheRef,
    cacheDeletedItem,
    clearCacheTimeout,
  } = useEasterEggsUI();

  // Shark-undo restore — lives here because it needs access to the CRUD
  // setters from multiple domains (transactions, goals, trade items, assets).
  //
  // Wrapped in useCallback (and mirrored into a ref below) so the mount-once
  // shake-listener always invokes the LATEST closure rather than the one
  // captured on first render. Today every dep this closes over happens to be
  // stable, so it works either way — but pinning the contract here means a
  // future refactor that adds, say, a state-derived dep won't silently break
  // shake-to-undo by restoring stale data.
  const triggerSharkUndo = useCallback(async () => {
    const cached = deletedItemCacheRef.current;
    if (!cached) return;
    clearCacheTimeout();
    showSharkUndo();

    try {
      const { type, item } = cached;
      if (type === "transaction") {
        const { id: _id, ...rest } = item as Transaction;
        const { data } = await supabase.from("transactions").insert(rest).select().single();
        if (data) setTransactions(prev => [data as Transaction, ...prev]);
      } else if (type === "goal") {
        const g = item as Goal;
        const payload = { title: g.title, current_amount: g.current || 0, target_amount: g.target, is_pinned: g.isPinned || false, user_id: g.user_id };
        const { data } = await supabase.from("goals").insert(payload).select().single();
        if (data) setGoals(prev => [{ ...g, id: data.id } as Goal, ...prev]);
      } else if (type === "trade") {
        const { id: _id, ...rest } = item as TradeItem;
        const { data } = await supabase.from("trade_items").insert(rest).select().single();
        if (data) setTradeItems(prev => [data as TradeItem, ...prev]);
      } else if (type === "asset") {
        const { id: _id, ...rest } = item as Asset;
        const { data } = await supabase.from("asset_vault").insert(rest).select().single();
        if (data) setAssets(prev => [data as Asset, ...prev]);
      }
      triggerToast("🦈 Undo successful!");
      // 🔥 Phoenix rises — decorative flourish when a transaction/goal/asset
      // is resurrected from the 5-second undo cache. Runs in parallel with
      // the shark swim-by without blocking.
      triggerPhoenixAlert();
    } catch {
      triggerToast("Undo failed.");
    }
  }, [
    deletedItemCacheRef,
    clearCacheTimeout,
    showSharkUndo,
    triggerPhoenixAlert,
    // Intentionally excluded from the dep array:
    //   - setTransactions / setGoals / setTradeItems / setAssets: React state
    //     setters are guaranteed-stable for the component's lifetime.
    //   - triggerToast: a stable useCallback from useUIState (declared further
    //     down in this provider — including it would be a temporal-dead-zone
    //     reference at module-eval time and Next's build-time TS check is
    //     stricter than the rules-of-hooks linter about TDZ).
    // The ref-mirror pattern below means even if any of these somehow changed
    // identity, the accelerometer listener still picks up the latest version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // Ref mirror so the mount-once accelerometer listener can call the current
  // version of triggerSharkUndo without rebinding on every callback identity
  // change (which would tear down + reinstall the native motion subscription
  // every render — wasteful and battery-unfriendly).
  const triggerSharkUndoRef = React.useRef(triggerSharkUndo);
  useEffect(() => {
    triggerSharkUndoRef.current = triggerSharkUndo;
  }, [triggerSharkUndo]);

  // Shake-to-Undo: Listen for device acceleration
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      import('@capacitor/motion').then(({ Motion }) => {
        let lastShake = 0;
        type AccelEvent = { x?: number; y?: number; z?: number; acceleration?: { x: number; y: number; z: number } };
        const listener = Motion.addListener('accel', (event: AccelEvent) => {
          const src = event.acceleration || event;
          const x = src.x ?? 0;
          const y = src.y ?? 0;
          const z = src.z ?? 0;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          if (magnitude > 25 && Date.now() - lastShake > 2000) {
            lastShake = Date.now();
            // Read through the ref so we always invoke the freshest closure
            // even though the listener itself is bound exactly once.
            if (deletedItemCacheRef.current) triggerSharkUndoRef.current();
          }
        });
        cleanup = () => { listener.then((l: { remove?: () => void }) => l.remove?.()).catch(() => {}); };
      }).catch(() => {});
    } catch {}
    return () => { if (cleanup) cleanup(); };
    // Mount-once: the listener reads `triggerSharkUndoRef.current` on every
    // shake, so we never need to re-subscribe. `deletedItemCacheRef` is a
    // stable ref by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capgo OTA Safe Boot Trigger
  // Removed: app ships as a full APK per release, no over-the-air updates,
  // so there is no pending bundle to "confirm ready" to the updater plugin.

  // ─── UI State (toast, confirm modal, modal flags) ───────────────────────
  const {
    toast,
    triggerToast,
    confirmState,
    confirmAction,
    closeConfirm,
    editTransactionId,
    setEditTransactionId,
    activeAssetId,
    setActiveAssetId,
    showTransactionModal,
    setShowTransactionModal,
  } = useUIState();

  // Forward-declared ref for `isOffline` so useMoneyState can read it lazily.
  // useSyncState (declared below) keeps this ref synced via a useEffect.
  const isOfflineRef = React.useRef(false);

  // ─── Planning state (goals + plannerItems + their CRUD) ─────────────────
  const {
    goals,
    setGoals,
    plannerItems,
    setPlannerItems,
    addGoal,
    updateGoal,
    deleteGoal,
    addPlannerItem,
    deletePlannerItem,
  } = usePlanningState({ session, cacheDeletedItem, triggerDragonAlert });

  // ─── Modules data (assets + tradeItems + their CRUD) ────────────────────
  const {
    assets,
    setAssets,
    tradeItems,
    setTradeItems,
    addAsset,
    updateAsset,
    deleteAsset,
    addTradeItem,
    updateTradeItem,
    deleteTradeItem,
  } = useModulesData({ session, triggerWhaleAlert, cacheDeletedItem });

  // ─── WanderPlan state (trips, itinerary, budget, places, docs, packing) ─
  const wanderPlan = useWanderPlanState({ session });

  // ─── Money state (transactions, subscriptions, utilities + their CRUD) ──
  const {
    transactions,
    setTransactions,
    subscriptions,
    setSubscriptions,
    utilities,
    setUtilities,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    addUtility,
    updateUtility,
    deleteUtility,
  } = useMoneyState({
    session,
    isOfflineRef,
    triggerToast,
    triggerWhaleAlert,
    maybeTriggerPenguinAlert,
    cacheDeletedItem,
  });

  // ─── Sync layer (refreshData, offline queue, network listeners) ─────────
  const { isOffline, refreshData, syncOfflineQueue: _syncOfflineQueue } = useSyncState(session, {
    setTransactions,
    setGoals,
    setSubscriptions,
    setUtilities,
    setPlannerItems,
    setAssets,
    setTradeItems,
    setAccountObjects,
    setCategoriesRaw,
    setCategories,
    triggerToast,
    categoriesRef,
  });
  // Suppress unused-var warning — the hook owns this internally; we expose
  // it here only for completeness in case future code paths need to trigger
  // a manual sync.
  void _syncOfflineQueue;

  // Keep isOfflineRef synced with the live isOffline state for lazy reads
  // inside useMoneyState callbacks.
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  // Theming: accentColor is owned by useUserPreferences (see top of provider)

  // Currency formatter — integer math to avoid floating-point errors.
  // Wrapped in useCallback so downstream components that receive
  // `formatCurrency` as a prop / dep can keep their memoised derivations
  // stable across provider re-renders (e.g. analytics' useMemo chains).
  const formatCurrency = useCallback(
    (amount: number) => {
      const cents = Math.round(amount * 100);
      const whole = Math.floor(Math.abs(cents) / 100);
      const remainder = Math.abs(cents) % 100;
      const sign = cents < 0 ? "-" : "";
      return `${currency} ${sign}${whole.toLocaleString()}.${String(remainder).padStart(2, "0")}`;
    },
    [currency]
  );

  // Exchange rate fetch — non-blocking, cached for offline
  const fetchExchangeRates = async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/MYR");
      if (!res.ok) throw new Error("Rate fetch failed");
      const data = await res.json();
      if (data.rates) {
        setExchangeRates(data.rates);
        try { await localforage.setItem("exchange_rates_cache", data.rates); } catch {}
      }
    } catch {
      try {
        const cached = await localforage.getItem<Record<string, number>>("exchange_rates_cache");
        if (cached) setExchangeRates(cached);
      } catch {}
    }
  };

  // Fetch rates on mount
  useEffect(() => { fetchExchangeRates(); }, []);

  // 🎃 Friday the 13th — auto-trigger the Derry horror sequence at 13:13
  // local time on any Friday the 13th, behind the `enableFridayThe13th` flag
  // in Profile so it's opt-in. Fires at most once per calendar day via a
  // localStorage guard.
  useEffect(() => {
    if (!enableFridayThe13th) return;
    if (typeof window === "undefined") return;
    const check = () => {
      const now = new Date();
      if (now.getDay() !== 5) return; // Friday only (0=Sun..5=Fri)
      if (now.getDate() !== 13) return;
      if (now.getHours() !== 13 || now.getMinutes() !== 13) return;
      const key = `derry_fired_${now.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(key) === "true") return;
      localStorage.setItem(key, "true");
      triggerDerry();
    };
    // Check immediately on mount (covers opening the app AT 13:13), then
    // poll every 30s so we don't miss the minute boundary.
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [enableFridayThe13th, triggerDerry]);

  // 🎮 Konami Code listener — ↑↑↓↓←→←→BA toggles god mode on desktop PWA
  // builds. Mobile users still have the 7-tap avatar gesture.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SEQUENCE = [
      "ArrowUp", "ArrowUp",
      "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight",
      "ArrowLeft", "ArrowRight",
      "b", "a",
    ];
    let idx = 0;
    const handler = (e: KeyboardEvent) => {
      const expected = SEQUENCE[idx];
      const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (pressed === expected) {
        idx += 1;
        if (idx === SEQUENCE.length) {
          idx = 0;
          const current = localStorage.getItem("god_mode") === "true";
          localStorage.setItem("god_mode", current ? "false" : "true");
          window.location.reload();
        }
      } else {
        // Allow partial restart: if the mismatched key IS the first in the
        // sequence, treat it as a fresh attempt.
        idx = pressed === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(session);
      } catch (err) {
        console.error("Session recovery failed:", err);
        await supabase.auth.signOut();
        setSession(null);
      } finally {
        setAuthLoading(false);
      }
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // refreshData, syncOfflineQueue, network listeners — all owned by useSyncState (above).

  // ─── Memoised public-facing slices ──────────────────────────────────────
  // Without these `.filter()`s would re-run on every provider render (and at
  // 10k+ tx every Easter-egg/toast/modal toggle would burn ~1ms + force every
  // downstream useMemo that depends on `transactions` to recompute because
  // the array reference would change). Memoising stabilises the references.
  const sessionUserId = session?.user?.id;
  const visibleTransactions = useMemo(
    () =>
      transactions.filter(
        (t) => (!t.user_id || t.user_id === sessionUserId) && !t.deleted_at
      ),
    [transactions, sessionUserId]
  );
  const visibleSubscriptions = useMemo(
    () => subscriptions.filter((s) => !s.user_id || s.user_id === sessionUserId),
    [subscriptions, sessionUserId]
  );
  const visibleUtilities = useMemo(
    () => utilities.filter((u) => !u.user_id || u.user_id === sessionUserId),
    [utilities, sessionUserId]
  );
  const visibleGoals = useMemo(
    () => goals.filter((g) => !g.user_id || g.user_id === sessionUserId),
    [goals, sessionUserId]
  );

  useEffect(() => {
    if (session?.user) {
      // Hydrate every user preference / feature flag from user_metadata.
      prefs.hydrateFromMetadata(session.user.user_metadata, session.user.email);
      refreshData(session.user).finally(() => setIsHydrating(false));
      // WanderPlan data loads only when the module is enabled — avoids
      // 8 wasted Supabase queries for users who never toggle it on.
      if (session.user.user_metadata?.wanderplan_enabled) {
        wanderPlan.loadWanderPlanData(session.user.id).catch(() => {});
      }
    } else {
       prefs.resetPreferences();
       setTransactions([]);
       setGoals([]);
       setSubscriptions([]);
       setUtilities([]);
       setPlannerItems([]);
       setAssets([]);
       setTradeItems([]);
       setIsHydrating(false);
    }
    // This effect fires only when the Supabase session changes. All the
    // setters, `prefs`, and `refreshData` are stable references produced
    // by the child hooks and don't need to retrigger hydration — doing so
    // would cause every state update inside those hooks to re-run the
    // full hydrate/refresh cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // --- Supabase CRUD (transactions/subs/utilities owned by useMoneyState;
  //     goals/planner owned by usePlanningState; assets/trades owned by
  //     useModulesData — see provider hook calls above) ---

  if (isHydrating || authLoading) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse font-medium text-sm">Loading Tracker...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      userName, setUserName,
      currency, setCurrency, formatCurrency, exchangeRates,
      billingCycle, setBillingCycle,
      dailyReminder, setDailyReminder,
      reminderTime, setReminderTime,
      categories, setCategories, addCategory, deleteCategory,
      includeSavings, toggleIncludeSavings,
      toast, triggerToast,
      subscriptions: visibleSubscriptions,
      addSubscription, updateSubscription, deleteSubscription,
      utilities: visibleUtilities,
      addUtility, updateUtility, deleteUtility,
      transactions: visibleTransactions,
      addTransaction, updateTransaction, deleteTransaction,
      editTransactionId, setEditTransactionId,
      goals: visibleGoals,
      addGoal, updateGoal, deleteGoal,
      accounts, accountObjects, setAccounts, reorderAccounts, addAccount, renameAccount, deleteAccount, toggleArchiveAccount,
      accentColor, setAccentColor,
      session, authLoading,
      confirmAction,
      enableFoodBudget, toggleFoodBudget,
      enableSalaryPlanner, toggleSalaryPlanner,
      foodDailyLimit, setFoodDailyLimit,
      foodMonthlyLimit, setFoodMonthlyLimit,
      plannerItems, addPlannerItem, deletePlannerItem,
      isPinEnabled, togglePin,
      isBiometricEnabled, toggleBiometric,
      assets, addAsset, updateAsset, deleteAsset,
      isVaultEnabled, toggleVault,
      isRadarEnabled, toggleRadar,
      isClaimsEnabled, toggleClaims,
      isTradingEnabled, toggleTrading,
      isWanderPlanEnabled, toggleWanderPlan,
      ...wanderPlan,
      enableTimeBasedGreeting, toggleTimeBasedGreeting,
      enableFridayThe13th, toggleFridayThe13th,
      primaryLocation, setPrimaryLocation,
      secondaryLocation, setSecondaryLocation,
      tradeItems, addTradeItem, updateTradeItem, deleteTradeItem,
      activeAssetId, setActiveAssetId,
      showTransactionModal, setShowTransactionModal,
      isOffline,
      isGodMode, whaleAlert, sharkUndo, derryActive, triggerDerry,
      penguinAlert, dragonAlert, phoenixAlert,
    }}>
      {children}

      {/* Whale Alert Overlay */}
      <AnimatePresence>
        {whaleAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", damping: 12 }}
              className="text-center"
            >
              <span className="text-[120px] block">🐋</span>
              <p className="text-white font-black text-xl mt-2 tracking-wide">WHALE ALERT</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🐧 Penguin Alert — late-night snack detector. Softer than whale
          because it's a gentle callout, not a flex. */}
      <AnimatePresence>
        {penguinAlert && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", damping: 20 }}
            aria-hidden="true"
            className="fixed top-20 left-0 right-0 z-[500] flex justify-center pointer-events-none"
          >
            <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl px-5 py-3 shadow-heavy flex items-center gap-3">
              <span className="text-3xl">🐧</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-sky-500">
                  Late-Night Snack
                </p>
                <p className="text-xs font-bold text-foreground">Detected. Sweet dreams.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🐉 Dragon Alert — fires when a savings goal is completed. Full
          center-screen hero because reaching a goal is a big deal. */}
      <AnimatePresence>
        {dragonAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
            className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(251,191,36,0.25) 0%, rgba(0,0,0,0.7) 70%)" }}
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.5, rotate: 8, opacity: 0 }}
              transition={{ type: "spring", damping: 14 }}
              className="text-center"
            >
              <span className="text-[140px] block drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]">🐉</span>
              <p className="text-amber-400 font-black text-2xl mt-2 tracking-[0.2em] drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                GOAL CONQUERED
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔥 Phoenix Alert — decorative flourish when an item is restored via
          shake-to-undo. Fades up and flies off to the top so the user sees
          their transaction rising from the ashes. */}
      <AnimatePresence>
        {phoenixAlert && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.6 }}
            animate={{ opacity: 1, y: -120, scale: 1.1 }}
            exit={{ opacity: 0, y: -180, scale: 1.3 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            aria-hidden="true"
            className="fixed left-1/2 top-2/3 -translate-x-1/2 z-[500] pointer-events-none"
          >
            <span className="text-[100px] block drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">🔥</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shark Undo Animation */}
      <AnimatePresence>
        {sharkUndo && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "120%", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="fixed top-1/2 -mt-16 left-0 z-[500] pointer-events-none"
          >
            <span className="text-[100px] block">🦈</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Security Confirmation Modal */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeConfirm} aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-md" />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-4 border border-border/50">
               <div>
                  <h3 id="confirm-title" className="font-bold text-lg text-foreground leading-tight">{confirmState.title}</h3>
                  <p id="confirm-message" className="text-sm text-muted-foreground font-medium mt-1.5">{confirmState.message}</p>
               </div>
               
               <div className="flex gap-3 pt-2">
                 <button type="button" onClick={closeConfirm} className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm text-foreground hover:bg-border transition-colors outline-none focus:ring-2 focus:ring-border">
                   Cancel
                 </button>
                 <button
                   type="button"
                   onClick={() => { confirmState.onConfirm(); closeConfirm(); }}
                   className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm active:scale-95 transition-all outline-none focus:ring-2 focus:ring-red-500/50 shadow-sm"
                 >
                   Delete
                 </button>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within an AppProvider");
  return ctx;
}