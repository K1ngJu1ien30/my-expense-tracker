"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";

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
  account: string; 
  date: string; 
  note?: string; 
  user_id?: string; 
};

export type ToastType = { message: string; id: number } | null;

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
  addAccount: (acc: string) => void;
  renameAccount: (old: string, next: string) => void;
  deleteAccount: (acc: string) => void;
  accentColor: string;
  setAccentColor: (val: string) => void;
  session: Session | null;
  authLoading: boolean;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
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
  
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm });
  };

  const addAccount = (acc: string) => setAccounts(prev => [...prev, acc]);
  const renameAccount = (old: string, next: string) => setAccounts(prev => prev.map(a => a === old ? next : a));
  const deleteAccount = (acc: string) => setAccounts(prev => prev.filter(a => a !== acc));

  const addCategory = (cat: string) => setCategories(prev => [...prev, cat]);
  const deleteCategory = (cat: string) => setCategories(prev => prev.filter(c => c !== cat));

  // Theming
  const [accentColor, setAccentColor] = useState("#3b82f6");

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

  useEffect(() => {
    if (session?.user) {
      const metaName = session.user.user_metadata?.display_name;
      const emailName = session.user.email?.split('@')[0];
      setUserNameRaw(metaName || emailName || "User");

      // Fetch from Supabase
      const fetchData = async () => {
        const [txs, gls, subs] = await Promise.all([
          supabase.from("transactions").select("*").order("date", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("subscriptions").select("*").order("created_at", { ascending: false })
        ]);
        if (txs.data) {
           setTransactions(txs.data as Transaction[]);
           const uniqueAccounts = Array.from(new Set(txs.data.map((t: any) => t.account).filter(Boolean))) as string[];
           if (uniqueAccounts.length > 0) {
              setAccounts(prev => Array.from(new Set([...prev, ...uniqueAccounts])));
           }
        }
        if (gls.data) setGoals(gls.data.map((g: any) => ({
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
        })) as Goal[]);
        if (subs.data) {
          setSubscriptions(subs.data.filter((s:any) => s.type === "subscription").map((s:any) => ({
             id: s.id, name: s.name, cost: Number(s.amount), billingDay: s.billing_day, sourceAccount: s.source_account, autoDeduct: s.auto_deduct, user_id: s.user_id, icon: "MonitorPlay", bg: "bg-red-500/10", color: "text-red-500"
          })) as Subscription[]);
          setUtilities(subs.data.filter((s:any) => s.type === "utility").map((s:any) => ({
             id: s.id, name: s.name, cost: Number(s.amount), billingDay: s.billing_day, sourceAccount: s.source_account, autoDeduct: s.auto_deduct, user_id: s.user_id, icon: "Zap", bg: "bg-yellow-500/10", color: "text-yellow-500"
          })) as Subscription[]);
        }
      };
      fetchData();
    } else {
       setTransactions([]);
       setGoals([]);
       setSubscriptions([]);
       setUtilities([]);
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
      session, authLoading,
      confirmAction
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
