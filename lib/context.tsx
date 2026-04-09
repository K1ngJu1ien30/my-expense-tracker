"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Goal = {
  id: number;
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

export type Subscription = { id: number; name: string; cost: number; icon: string; bg: string; color: string; autoDeduct?: boolean; billingDay?: number; sourceAccount?: string; user_id?: string; };
export type Transaction = { id: number; type: string; amount: number; category: string; account: string; date: string; note?: string; user_id?: string; };
export type ToastType = { message: string; id: number } | null;

type AppContextType = {
  userName: string;
  setUserName: (val: string) => void;
  currency: string;
  setCurrency: (val: string) => void;
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
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: number, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: number) => void;
  editTransactionId: number | null;
  setEditTransactionId: (val: number | null) => void;
  subscriptions: Subscription[];
  addSubscription: (sub: Subscription) => void;
  updateSubscription: (id: number, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: number) => void;
  utilities: Subscription[];
  addUtility: (sub: Subscription) => void;
  updateUtility: (id: number, patch: Partial<Subscription>) => void;
  deleteUtility: (id: number) => void;
  goals: Goal[];
  addGoal: (goal: Goal) => void;
  updateGoal: (id: number, goal: Partial<Goal>) => void;
  deleteGoal: (id: number) => void;
  accounts: string[];
  setAccounts: (val: string[]) => void;
  addAccount: (acc: string) => void;
  renameAccount: (old: string, next: string) => void;
  deleteAccount: (acc: string) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  isSecurityEnabled: boolean;
  setIsSecurityEnabled: (val: boolean) => void;
  securityMethod: string;
  setSecurityMethod: (val: string) => void;
  appPin: string;
  setAppPin: (val: string) => void;
  isLocked: boolean;
  setIsLocked: (val: boolean) => void;
  session: Session | null;
  authLoading: boolean;
};

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [userName, setUserName] = useState("Jeff");
  const [currency, setCurrency] = useState("RM");
  const [billingCycle, setBillingCycle] = useState("1");
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [categories, setCategories] = useState<string[]>(["Food", "Transport", "Entertainment", "Shopping", "Bills", "Family", "Subs"]);

  const [toast, setToast] = useState<ToastType>(null);
  const triggerToast = (message: string) => {
    const id = Date.now();
    setToast({ message, id });
    setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 3000);
  };

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([
    { id: 1, name: "Netflix", cost: 55.00, icon: "MonitorPlay", bg: "bg-red-500/10", color: "text-red-500" },
    { id: 2, name: "Spotify Premium", cost: 14.90, icon: "Music", bg: "bg-green-500/10", color: "text-green-500" }
  ]);
  const addSubscription = (sub: Subscription) => setSubscriptions(prev => [...prev, { ...sub, user_id: session?.user?.id }]);
  const updateSubscription = (id: number, patch: Partial<Subscription>) => setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  const deleteSubscription = (id: number) => setSubscriptions(prev => prev.filter(s => s.id !== id));

  const [utilities, setUtilities] = useState<Subscription[]>([
    { id: 3, name: "Electricity", cost: 120.00, icon: "Zap", bg: "bg-yellow-500/10", color: "text-yellow-500" },
    { id: 4, name: "Internet", cost: 89.00, icon: "Wifi", bg: "bg-blue-500/10", color: "text-blue-500" },
    { id: 5, name: "Water", cost: 35.00, icon: "Droplet", bg: "bg-cyan-500/10", color: "text-cyan-500" },
    { id: 6, name: "Rent", cost: 1200.00, icon: "Smartphone", bg: "bg-orange-500/10", color: "text-orange-500" },
  ]);
  const addUtility = (sub: Subscription) => setUtilities(prev => [...prev, { ...sub, user_id: session?.user?.id }]);
  const updateUtility = (id: number, patch: Partial<Subscription>) => setUtilities(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  const deleteUtility = (id: number) => setUtilities(prev => prev.filter(s => s.id !== id));

  const [accounts, setAccounts] = useState<string[]>(["Bank", "Cash", "eWallet"]);
  const addAccount = (acc: string) => setAccounts(prev => [...prev, acc]);
  const renameAccount = (old: string, next: string) => setAccounts(prev => prev.map(a => a === old ? next : a));
  const deleteAccount = (acc: string) => setAccounts(prev => prev.filter(a => a !== acc));

  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 1, type: "Expense", amount: 12.50, category: "Food", account: "Bank (MBB)", date: new Date().toISOString() },
    { id: 2, type: "Income", amount: 2500, category: "Salary", account: "Bank (MBB)", date: new Date().toISOString() }
  ]);
  const addTransaction = (tx: Transaction) => setTransactions(prev => [{ ...tx, user_id: session?.user?.id }, ...prev]);
  const updateTransaction = (id: number, patch: Partial<Transaction>) => setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const deleteTransaction = (id: number) => setTransactions(prev => prev.filter(t => t.id !== id));
  const [editTransactionId, setEditTransactionId] = useState<number | null>(null);

  const [goals, setGoals] = useState<Goal[]>([
    { id: 1, title: 'Year-End Family Trip', subtitle: 'Year-End Goal', current: 3500, target: 10000, isPinned: true, color: "bg-blue-500", bg: "bg-blue-500/10", iconName: "Target" },
    { id: 2, title: 'Emergency Fund', subtitle: 'Safety Net', current: 15000, target: 20000, isPinned: false, color: "bg-emerald-500", bg: "bg-emerald-500/10", iconName: "ShieldAlert" },
  ]);

  const addGoal = (goal: Goal) => setGoals(prev => [...prev, { ...goal, user_id: session?.user?.id }]);
  const updateGoal = (id: number, patch: Partial<Goal>) => setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  const deleteGoal = (id: number) => setGoals(prev => prev.filter(g => g.id !== id));

  const addCategory = (cat: string) => setCategories(prev => [...prev, cat]);
  const deleteCategory = (cat: string) => setCategories(prev => prev.filter(c => c !== cat));

  // Theming and Security State
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [isSecurityEnabled, setIsSecurityEnabled] = useState(false);
  const [securityMethod, setSecurityMethod] = useState("PIN");
  const [appPin, setAppPin] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (isSecurityEnabled) setIsLocked(true);
  }, [isSecurityEnabled]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AppContext.Provider value={{
      userName, setUserName,
      currency, setCurrency,
      billingCycle, setBillingCycle,
      dailyReminder, setDailyReminder,
      reminderTime, setReminderTime,
      categories, setCategories, addCategory, deleteCategory,
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
      accounts, setAccounts, addAccount, renameAccount, deleteAccount,
      accentColor, setAccentColor,
      isSecurityEnabled, setIsSecurityEnabled,
      securityMethod, setSecurityMethod,
      appPin, setAppPin,
      isLocked, setIsLocked,
      session, authLoading
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within an AppProvider");
  return ctx;
}
