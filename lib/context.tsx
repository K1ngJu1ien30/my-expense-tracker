"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export type Goal = {
  id: string;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  isPinned: boolean;
  color: string;
  bg: string;
  iconName: string;
  user_id?: string;
};

export type Subscription = { 
  id: string; 
  name: string; 
  cost: number; 
  icon: string; 
  bg: string; 
  color: string; 
  autoDeduct?: boolean; 
  billingDay?: number; 
  sourceAccount?: string; 
  type?: string;
  user_id?: string; 
};

export type Transaction = { 
  id: string; 
  type: string; 
  amount: number; 
  category: string; 
  sub_category?: string;
  account: string; 
  to_account?: string;
  date: string; 
  note?: string; 
  user_id?: string;
  status?: string;
  is_claimable?: boolean;
  claim_status?: string;
};

export type ToastType = { message: string; id: number } | null;

export type PlannerItem = {
  id: string;
  category: string;
  item_name: string;
  amount: number;
  user_id?: string;
};

export type Asset = {
  id: string;
  name: string;
  category: string;
  emoji_icon: string;
  purchase_date: string;
  purchase_price: number;
  user_id?: string;
};

export type AssetLog = {
  id: string;
  asset_id: string;
  log_date: string;
  description: string;
  cost: number;
};

type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};

type AppContextType = {
  userName: string;
  setUserName: (val: string) => void;
  currency: string;
  setCurrency: (val: string) => void;
  formatCurrency: (amount: number) => string;
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
  setAccounts: (val: string[]) => void;
  reorderAccounts: (val: string[]) => Promise<void>;
  addAccount: (acc: string) => void;
  renameAccount: (old: string, next: string) => void;
  deleteAccount: (acc: string) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  authLoading: boolean;
  includeSavings: boolean;
  toggleIncludeSavings: (val: boolean) => void;
  session: any | null; // using any to avoid import issues if not already there, but wait, it's Session | null in this file originally.
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
};

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [userName, setUserNameRaw] = useState("User");
  const [currency, setCurrency] = useState("RM");
  const [billingCycle, setBillingCycle] = useState("1");
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [categories, setCategories] = useState<string[]>(["Food", "Transport", "Entertainment", "Shopping", "Bills", "Family", "Subs"]);
  const [includeSavings, setIncludeSavingsRaw] = useState(true);

  const [enableFoodBudget, setEnableFoodBudgetRaw] = useState(false);
  const [enableSalaryPlanner, setEnableSalaryPlannerRaw] = useState(false);
  const [foodDailyLimit, setFoodDailyLimitRaw] = useState(0);
  const [foodMonthlyLimit, setFoodMonthlyLimitRaw] = useState(0);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [isPinEnabled, setIsPinEnabledRaw] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabledRaw] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isVaultEnabled, setIsVaultEnabledRaw] = useState(false);
  const [isRadarEnabled, setIsRadarEnabledRaw] = useState(false);
  const [isClaimsEnabled, setIsClaimsEnabledRaw] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Capgo OTA Safe Boot Trigger
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorUpdater.notifyAppReady();
    }
  }, []);

  const toggleIncludeSavings = async (val: boolean) => {
    setIncludeSavingsRaw(val);
    if (session?.user) {
       await supabase.auth.updateUser({ data: { include_savings: val } });
    }
  };

  const toggleFoodBudget = async (val: boolean) => {
    setEnableFoodBudgetRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { enable_food_budget: val } });
  };
  const toggleSalaryPlanner = async (val: boolean) => {
    setEnableSalaryPlannerRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { enable_salary_planner: val } });
  };
  const setFoodDailyLimit = async (val: number) => {
    setFoodDailyLimitRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { food_daily_limit: val } });
  };
  const setFoodMonthlyLimit = async (val: number) => {
    setFoodMonthlyLimitRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { food_monthly_limit: val } });
  };
  const toggleAppLock = async (val: boolean) => {
    setIsPinEnabledRaw(val);
    if (!val) setIsBiometricEnabledRaw(false);
    if (session?.user) {
      const data: Record<string, boolean> = { pin_enabled: val };
      if (!val) data.biometric_enabled = false;
      await supabase.auth.updateUser({ data });
    }
  };
  const togglePin = toggleAppLock;
  const toggleBiometric = async (val: boolean) => {
    setIsBiometricEnabledRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { biometric_enabled: val } });
  };

  const [toast, setToast] = useState<ToastType>(null);
  const triggerToast = (message: string) => {
    const id = Date.now();
    setToast({ message, id });
    setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 3000);
  };

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [utilities, setUtilities] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  
  const [accounts, setAccounts] = useState<string[]>(["Bank", "Cash", "eWallet"]);
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm });
  };

  const handleUpdateAccounts = async (newAccountsArray: string[]) => {
    setAccounts(newAccountsArray);
    if (session?.user) {
      await supabase.auth.updateUser({ data: { custom_accounts: newAccountsArray } });
    }
  };
  const reorderAccounts = handleUpdateAccounts;

  const addAccount = (acc: string) => handleUpdateAccounts([...accounts, acc]);
  const renameAccount = (old: string, next: string) => handleUpdateAccounts(accounts.map(a => a === old ? next : a));
  const deleteAccount = (acc: string) => handleUpdateAccounts(accounts.filter(a => a !== acc));

  const addCategory = (cat: string) => setCategories(prev => [...prev, cat]);
  const deleteCategory = (cat: string) => setCategories(prev => prev.filter(c => c !== cat));

  // Theming
  const [accentColor, setAccentColor] = useState("#3b82f6");

  // Currency formatter
  const formatCurrency = (amount: number) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  // Capacitor hardware back button
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      // @ts-ignore
      import('@capacitor/app').then(({ App }) => {
        App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
        cleanup = () => { App.removeAllListeners().catch(() => {}); };
      }).catch(() => {});
    } catch {}
    return () => { if (cleanup) cleanup(); };
  }, []);

  // Standalone data refresh — used by initial load and post-sync
  const refreshData = async (currentUser: { id: string; user_metadata?: any }) => {
    const savedAccounts = currentUser.user_metadata?.custom_accounts || ['Bank', 'Cash', 'eWallet'];

    try {
      console.log("[refreshData] Fetching live data...");
      const [txs, gls, subs, plannerRes, assetsRes] = await Promise.all([
        supabase.from("transactions").select("*").eq('user_id', currentUser.id).order("date", { ascending: false }),
        supabase.from("goals").select("*").eq('user_id', currentUser.id).order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").eq('user_id', currentUser.id).order("created_at", { ascending: false }),
        supabase.from("salary_planner").select("*").eq('user_id', currentUser.id).order("created_at", { ascending: false }),
        supabase.from("asset_vault").select("*").eq('user_id', currentUser.id).order("created_at", { ascending: false })
      ]);

      // Supabase select() does not throw on network failure — force it
      if (txs.error || gls.error || subs.error || plannerRes.error || assetsRes.error) {
        console.log("[refreshData] Supabase returned error objects:", { txs: txs.error, gls: gls.error, subs: subs.error, planner: plannerRes.error, assets: assetsRes.error });
        throw new Error("Supabase fetch returned errors");
      }

      // Strict null check — if Supabase returned no data arrays, treat as failure
      if (!txs.data || !gls.data || !subs.data || !plannerRes.data || !assetsRes.data) {
        console.log("[refreshData] Supabase returned null data arrays — treating as offline");
        throw new Error("Supabase returned null data");
      }

      const parsedTransactions = txs.data as Transaction[];
      const parsedGoals = gls.data.map((g: any) => ({
        id: g.id,
        title: g.title,
        subtitle: 'Goal',
        current: Number(g.current_amount),
        target: Number(g.target_amount),
        isPinned: g.is_pinned,
        color: "bg-emerald-500",
        bg: "bg-emerald-500/10",
        iconName: "Target",
        user_id: g.user_id
      })) as Goal[];
      const parsedSubscriptions = subs.data.filter((s: any) => s.type === "subscription").map((s: any) => ({
        id: s.id, name: s.name, cost: Number(s.amount), billingDay: s.billing_day, sourceAccount: s.source_account, autoDeduct: s.auto_deduct, user_id: s.user_id, icon: "MonitorPlay", bg: "bg-red-500/10", color: "text-red-500"
      })) as Subscription[];
      const parsedUtilities = subs.data.filter((s: any) => s.type === "utility").map((s: any) => ({
        id: s.id, name: s.name, cost: Number(s.amount), billingDay: s.billing_day, sourceAccount: s.source_account, autoDeduct: s.auto_deduct, user_id: s.user_id, icon: "Zap", bg: "bg-yellow-500/10", color: "text-yellow-500"
      })) as Subscription[];
      const parsedPlanner = plannerRes.data as PlannerItem[];
      const parsedAssets = assetsRes.data as Asset[];

      console.log("[refreshData] Live data fetch successful. Saving to cache...", { tx: parsedTransactions.length, goals: parsedGoals.length, subs: parsedSubscriptions.length, utils: parsedUtilities.length, planner: parsedPlanner.length, assets: parsedAssets.length });

      setTransactions(parsedTransactions);
      setGoals(parsedGoals);
      setSubscriptions(parsedSubscriptions);
      setUtilities(parsedUtilities);
      setPlannerItems(parsedPlanner);
      setAssets(parsedAssets);
      setAccounts(savedAccounts);

      // Only cache when we confirmed valid non-null data above
      const cachePayload = {
        transactions: parsedTransactions,
        goals: parsedGoals,
        subscriptions: parsedSubscriptions,
        utilities: parsedUtilities,
        plannerItems: parsedPlanner,
        assets: parsedAssets,
        accounts: savedAccounts,
      };
      try {
        localStorage.setItem('tracker_data_cache', JSON.stringify(cachePayload));
        console.log("[refreshData] Cache saved successfully.");
      } catch (storageErr) {
        console.warn("[refreshData] localStorage.setItem failed:", storageErr);
      }
    } catch (err) {
      console.log("[refreshData] Network error caught. Attempting to read cache...", err);
      setAccounts(savedAccounts);

      // Hydrate from localStorage cache on offline cold-boot
      try {
        const cached = localStorage.getItem('tracker_data_cache');
        if (cached) {
          console.log("[refreshData] Cache found! Hydrating state...");
          const data = JSON.parse(cached);
          let cachedTx = (data.transactions ?? []) as Transaction[];
          setGoals((data.goals ?? []) as Goal[]);
          setSubscriptions((data.subscriptions ?? []) as Subscription[]);
          setUtilities((data.utilities ?? []) as Subscription[]);
          setPlannerItems((data.plannerItems ?? []) as PlannerItem[]);
          setAssets((data.assets ?? []) as Asset[]);
          if (data.accounts) setAccounts(data.accounts);

          // Prepend any pending offline transactions so balance stays accurate
          const offlineRaw = localStorage.getItem('offline_tx_queue');
          if (offlineRaw) {
            const offlineQueue = JSON.parse(offlineRaw) as Partial<Transaction>[];
            const offlineTxs = offlineQueue.map((tx, i) => ({
              ...tx,
              id: `offline-${Date.now()}-${i}`,
              user_id: currentUser.id,
            })) as Transaction[];
            cachedTx = [...offlineTxs, ...cachedTx];
            console.log("[refreshData] Prepended", offlineTxs.length, "offline queue items to cached transactions.");
          }

          setTransactions(cachedTx);
          console.log("[refreshData] Cache hydration complete.", { tx: cachedTx.length, goals: (data.goals ?? []).length });
        } else {
          console.log("[refreshData] Cache empty or missing!");
        }
      } catch (cacheErr) {
        console.error("[refreshData] Cache hydration failed:", cacheErr);
      }
    }
  };

  // Network status + offline queue sync
  const syncOfflineQueue = async () => {
    try {
      const raw = localStorage.getItem("offline_tx_queue");
      if (!raw) return;
      const queue = JSON.parse(raw) as Partial<Transaction>[];
      if (queue.length === 0) return;
      for (const tx of queue) {
        await supabase.from("transactions").insert({ ...tx, user_id: session?.user?.id });
      }
      localStorage.removeItem("offline_tx_queue");
      triggerToast(`${queue.length} offline expense${queue.length > 1 ? "s" : ""} synced to cloud!`);

      // Post-sync: refresh state with server-assigned UUIDs
      if (session?.user) await refreshData(session.user);
    } catch (err) {
      console.error("Offline sync failed:", err);
    }
  };

  useEffect(() => {
    // Browser fallback
    const handleOnline = () => { setIsOffline(false); syncOfflineQueue(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);

    // Capacitor native network listener
    let nativeCleanup: (() => void) | undefined;
    try {
      // @ts-ignore
      import('@capacitor/network').then(({ Network }) => {
        Network.getStatus().then((status: any) => setIsOffline(!status.connected)).catch(() => {});
        Network.addListener('networkStatusChange', (status: any) => {
          const wasOffline = !navigator.onLine;
          setIsOffline(!status.connected);
          if (status.connected && wasOffline) syncOfflineQueue();
        });
        nativeCleanup = () => { Network.removeAllListeners().catch(() => {}); };
      }).catch(() => {});
    } catch {}

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (nativeCleanup) nativeCleanup();
    };
  }, [session]);

  useEffect(() => {
    if (session?.user) {
      const metaName = session.user.user_metadata?.display_name;
      const emailName = session.user.email?.split('@')[0];
      setUserNameRaw(metaName || emailName || "User");

      const savedIncludeSavings = session.user.user_metadata?.include_savings ?? true;
      setIncludeSavingsRaw(savedIncludeSavings);

      setEnableFoodBudgetRaw(session.user.user_metadata?.enable_food_budget === true);
      setEnableSalaryPlannerRaw(session.user.user_metadata?.enable_salary_planner === true);
      setFoodDailyLimitRaw(session.user.user_metadata?.food_daily_limit ?? 0);
      setFoodMonthlyLimitRaw(session.user.user_metadata?.food_monthly_limit ?? 0);
      setIsPinEnabledRaw(session.user.user_metadata?.pin_enabled === true);
      setIsBiometricEnabledRaw(session.user.user_metadata?.biometric_enabled === true);
      setIsVaultEnabledRaw(session.user.user_metadata?.vault_enabled === true);
      setIsRadarEnabledRaw(session.user.user_metadata?.radar_enabled === true);
      setIsClaimsEnabledRaw(session.user.user_metadata?.claims_enabled === true);

      refreshData(session.user);
    } else {
       setTransactions([]);
       setGoals([]);
       setSubscriptions([]);
       setUtilities([]);
       setPlannerItems([]);
       setAssets([]);
    }
  }, [session]);

  const setUserName = async (newName: string) => {
     setUserNameRaw(newName);
     if (session?.user) {
        await supabase.auth.updateUser({ data: { display_name: newName } });
     }
  };

  // --- Supabase CRUD ---
  
  const addTransaction = async (tx: Partial<Transaction>) => {
    delete tx.id;
    if (isOffline) {
      const offlineTx = { ...tx, id: `offline-${Date.now()}`, user_id: session?.user?.id };
      setTransactions(prev => [offlineTx as Transaction, ...prev]);
      try {
        const existing = JSON.parse(localStorage.getItem("offline_tx_queue") || "[]");
        existing.push({ ...tx, user_id: session?.user?.id });
        localStorage.setItem("offline_tx_queue", JSON.stringify(existing));
      } catch {}
      triggerToast("No connection. Expense saved offline.");
      return;
    }
    const { data, error } = await supabase.from('transactions').insert({ ...tx, user_id: session?.user?.id }).select().single();
    if (!error && data) setTransactions(prev => [data as Transaction, ...prev]);
  };
  const updateTransaction = async (id: string, patch: Partial<Transaction>) => {
    const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select().single();
    if (!error && data) setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  };
  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const addSubscription = async (sub: Partial<Subscription>) => {
    delete sub.id;
    const { icon, bg, color, cost, billingDay, sourceAccount, autoDeduct, ...rest } = sub;
    const payload = { ...rest, amount: cost, billing_day: billingDay, source_account: sourceAccount, auto_deduct: autoDeduct, type: "subscription", user_id: session?.user?.id };
    const { data, error } = await supabase.from('subscriptions').insert(payload).select().single();
    if (!error && data) setSubscriptions(prev => [{...sub, id: data.id} as Subscription, ...prev]);
  };
  const updateSubscription = async (id: string, patch: Partial<Subscription>) => {
    const { icon, bg, color, cost, billingDay, sourceAccount, autoDeduct, ...rest } = patch;
    const payload: any = { ...rest };
    if (cost !== undefined) payload.amount = cost;
    if (billingDay !== undefined) payload.billing_day = billingDay;
    if (sourceAccount !== undefined) payload.source_account = sourceAccount;
    if (autoDeduct !== undefined) payload.auto_deduct = autoDeduct;

    const { data, error } = await supabase.from('subscriptions').update(payload).eq('id', id).select().single();
    if (!error && data) setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };
  const deleteSubscription = async (id: string) => {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (!error) setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const addUtility = async (sub: Partial<Subscription>) => {
    delete sub.id;
    const { icon, bg, color, cost, billingDay, sourceAccount, autoDeduct, ...rest } = sub;
    const payload = { ...rest, amount: cost, billing_day: billingDay, source_account: sourceAccount, auto_deduct: autoDeduct, type: "utility", user_id: session?.user?.id };
    const { data, error } = await supabase.from('subscriptions').insert(payload).select().single();
    if (!error && data) setUtilities(prev => [{...sub, id: data.id} as Subscription, ...prev]);
  };
  const updateUtility = async (id: string, patch: Partial<Subscription>) => {
    const { icon, bg, color, cost, billingDay, sourceAccount, autoDeduct, ...rest } = patch;
    const payload: any = { ...rest };
    if (cost !== undefined) payload.amount = cost;
    if (billingDay !== undefined) payload.billing_day = billingDay;
    if (sourceAccount !== undefined) payload.source_account = sourceAccount;
    if (autoDeduct !== undefined) payload.auto_deduct = autoDeduct;

    const { data, error } = await supabase.from('subscriptions').update(payload).eq('id', id).select().single();
    if (!error && data) setUtilities(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };
  const deleteUtility = async (id: string) => {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (!error) setUtilities(prev => prev.filter(s => s.id !== id));
  };

  const addGoal = async (goal: Partial<Goal>) => {
    delete goal.id;
    const { title, current, target, isPinned } = goal;
    const payload = { title, current_amount: current || 0, target_amount: target, is_pinned: isPinned || false, user_id: session?.user?.id };
    const { data, error } = await supabase.from('goals').insert(payload).select().single();
    if (!error && data) setGoals(prev => [{...goal, id: data.id} as Goal, ...prev]);
  };
  const updateGoal = async (id: string, patch: Partial<Goal>) => {
    const { title, current, target, isPinned } = patch;
    const payload: any = {};
    if (title !== undefined) payload.title = title;
    if (current !== undefined) payload.current_amount = current;
    if (target !== undefined) payload.target_amount = target;
    if (isPinned !== undefined) payload.is_pinned = isPinned;

    const { data, error } = await supabase.from('goals').update(payload).eq('id', id).select().single();
    if (!error && data) setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  };
  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (!error) setGoals(prev => prev.filter(g => g.id !== id));
  };

  const addPlannerItem = async (item: Partial<PlannerItem>) => {
    delete item.id;
    const payload = { ...item, user_id: session?.user?.id };
    const { data, error } = await supabase.from('salary_planner').insert(payload).select().single();
    if (!error && data) setPlannerItems(prev => [data as PlannerItem, ...prev]);
  };
  const deletePlannerItem = async (id: string) => {
    const { error } = await supabase.from('salary_planner').delete().eq('id', id);
    if (!error) setPlannerItems(prev => prev.filter(p => p.id !== id));
  };

  const addAsset = async (asset: Partial<Asset>) => {
    delete asset.id;
    const payload = { ...asset, user_id: session?.user?.id };
    const { data, error } = await supabase.from('asset_vault').insert(payload).select().single();
    if (!error && data) setAssets(prev => [data as Asset, ...prev]);
  };
  const deleteAsset = async (id: string) => {
    const { error } = await supabase.from('asset_vault').delete().eq('id', id);
    if (!error) setAssets(prev => prev.filter(a => a.id !== id));
  };
  const updateAsset = async (id: string, patch: Partial<Asset>) => {
    const { data, error } = await supabase.from('asset_vault').update(patch).eq('id', id).select().single();
    if (!error && data) setAssets(prev => prev.map(a => a.id === id ? { ...a, ...data } as Asset : a));
  };
  const toggleVault = async (val: boolean) => {
    setIsVaultEnabledRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { vault_enabled: val } });
  };
  const toggleRadar = async (val: boolean) => {
    setIsRadarEnabledRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { radar_enabled: val } });
  };
  const toggleClaims = async (val: boolean) => {
    setIsClaimsEnabledRaw(val);
    if (session?.user) await supabase.auth.updateUser({ data: { claims_enabled: val } });
  };

  return (
    <AppContext.Provider value={{
      userName, setUserName,
      currency, setCurrency, formatCurrency,
      billingCycle, setBillingCycle,
      dailyReminder, setDailyReminder,
      reminderTime, setReminderTime,
      categories, setCategories, addCategory, deleteCategory,
      includeSavings, toggleIncludeSavings,
      toast, triggerToast,
      subscriptions: subscriptions.filter(s => !s.user_id || s.user_id === session?.user?.id),
      addSubscription, updateSubscription, deleteSubscription,
      utilities: utilities.filter(u => !u.user_id || u.user_id === session?.user?.id),
      addUtility, updateUtility, deleteUtility,
      transactions: transactions.filter(t => !t.user_id || t.user_id === session?.user?.id),
      addTransaction, updateTransaction, deleteTransaction,
      editTransactionId, setEditTransactionId,
      goals: goals.filter(g => !g.user_id || g.user_id === session?.user?.id),
      addGoal, updateGoal, deleteGoal,
      accounts, setAccounts, reorderAccounts, addAccount, renameAccount, deleteAccount,
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
      activeAssetId, setActiveAssetId,
      showTransactionModal, setShowTransactionModal,
      isOffline
    }}>
      {children}

      {/* Global Security Confirmation Modal */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmState({...confirmState, isOpen: false})} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-4 border border-border/50">
               <div>
                  <h3 className="font-bold text-lg text-foreground leading-tight">{confirmState.title}</h3>
                  <p className="text-sm text-muted-foreground font-medium mt-1.5">{confirmState.message}</p>
               </div>
               
               <div className="flex gap-3 pt-2">
                 <button onClick={() => setConfirmState({...confirmState, isOpen: false})} className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm text-foreground hover:bg-border transition-colors outline-none focus:ring-2 focus:ring-border">
                   Cancel
                 </button>
                 <button 
                   onClick={() => { confirmState.onConfirm(); setConfirmState({...confirmState, isOpen: false}); }} 
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