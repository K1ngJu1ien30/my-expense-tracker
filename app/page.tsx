"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Target, Plus, Check, X, Trash2, Clock } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";



const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card shadow-xl rounded-xl p-3 border border-gray-100 dark:border-white/10 outline-none min-w-[120px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{label} Summary</p>
        <div className="space-y-1 text-sm font-semibold">
          <p className="text-rose-500">Expenses: {data.currency} {data.value}</p>
          {data.income > 0 && <p className="text-emerald-500">Income: {data.currency} {data.income}</p>}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { userName, goals, transactions, includeSavings, accounts, formatCurrency, currency, isGodMode } = useAppContext();
  const pinnedGoals = isGodMode ? goals.map(g => ({ ...g, current: g.target })) : goals.filter(g => g.isPinned);

  // God Mode: 7 taps on avatar within 3 seconds
  const godTapCount = useRef(0);
  const godTapTimer = useRef<NodeJS.Timeout | null>(null);
  const [matrixFlash, setMatrixFlash] = useState(false);

  const handleAvatarTap = useCallback(() => {
    godTapCount.current++;
    if (godTapCount.current === 1) {
      godTapTimer.current = setTimeout(() => { godTapCount.current = 0; }, 3000);
    }
    if (godTapCount.current >= 7) {
      godTapCount.current = 0;
      if (godTapTimer.current) clearTimeout(godTapTimer.current);
      // Toggle god mode via context — we need to access the raw setter
      // Flash matrix green
      NativeHaptics.heavyDoubleThud().then(() => NativeHaptics.lightTick());
      setMatrixFlash(true);
      setTimeout(() => setMatrixFlash(false), 500);
      // Toggle via localStorage flag and reload
      const current = localStorage.getItem("god_mode") === "true";
      localStorage.setItem("god_mode", current ? "false" : "true");
      window.location.reload();
    }
  }, []);

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning," 
                 : hour >= 12 && hour < 17 ? "Good afternoon," 
                 : "Good evening,";

  const totalBalance = useMemo(() => {
     const activeAccounts = includeSavings
       ? accounts
       : accounts.filter(acc => acc && !acc.toLowerCase().includes('saving'));

     return activeAccounts.reduce((total, accountName) => {
       const balance = transactions.reduce((acc, tx) => {
         let newAcc = acc;
         if (tx.account?.toLowerCase().trim() === accountName?.toLowerCase()?.trim()) {
           if (tx.type === "Income" && tx.status !== "pending") newAcc += Number(tx.amount);
           if (tx.type === "Expense" || tx.type === "Transfer") newAcc -= Number(tx.amount);
         }
         if (tx.type === "Transfer" && tx.to_account?.toLowerCase().trim() === accountName?.toLowerCase()?.trim()) {
           newAcc += Number(tx.amount);
         }
         return newAcc;
       }, 0);
       return total + balance;
     }, 0);
  }, [transactions, includeSavings, accounts]);

  const pendingIncome = useMemo(() => {
     return transactions
       .filter(tx => tx.type === "Income" && tx.status === "pending")
       .reduce((sum, tx) => sum + Number(tx.amount), 0);
  }, [transactions]);

  const todayTransactions = useMemo(() => {
     const now = new Date();
     const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
     const startOfTomorrow = startOfToday + 86400000;
     return transactions.filter(t => {
       if (t.type !== "Expense") return false;
       if (!includeSavings && t.account?.toLowerCase().includes('saving')) return false;
       const txTime = new Date(t.date).getTime();
       return txTime >= startOfToday && txTime < startOfTomorrow;
     });
  }, [transactions, includeSavings]);

  const todayTotal = useMemo(() => {
     return todayTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [todayTransactions]);

  const weeklyTransactions = useMemo(() => {
     const now = new Date();
     const dayOfWeek = now.getDay() || 7;
     const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
     const endOfWeek = startOfWeek + 7 * 86400000;

     return transactions.filter(t => {
        if (t.type !== "Expense") return false;
        if (!includeSavings && t.account?.toLowerCase().includes('saving')) return false;
        const txTime = new Date(t.date).getTime();
        return txTime >= startOfWeek && txTime < endOfWeek;
     });
  }, [transactions, includeSavings]);

  const weeklyTotal = useMemo(() => {
     return weeklyTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [weeklyTransactions]);

  const dynamicTrendData = useMemo(() => {
     if (transactions.length === 0) return [];
     const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
     const now = new Date();
     const data = [];
     const map: Record<string, any> = {};
     for (let i = 6; i >= 0; i--) {
       const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
       const dayLabel = fmt.format(d);
       const dateKey = `${d.getMonth()+1}/${d.getDate()}`;
       const item = { name: dayLabel, dateKey, income: 0, value: 0, transactions: 0, currency };
       map[dateKey] = item;
       data.push(item);
     }
     
     const weekAgoMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
     
     transactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getTime() < weekAgoMs) return;
        const dateKey = `${d.getMonth()+1}/${d.getDate()}`;
        if (map[dateKey]) {
           if (t.type === "Income") map[dateKey].income += Number(t.amount);
           if (t.type === "Expense") map[dateKey].value += Number(t.amount);
           map[dateKey].transactions += 1;
        }
     });
     return data;
  }, [transactions]);

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Matrix Flash */}
      {matrixFlash && <div className="fixed inset-0 z-[9999] bg-[#00ff41] pointer-events-none animate-pulse" />}

      {/* Header */}
      <div className="flex justify-between items-center mt-2">
        <div>
          <p className="text-muted-foreground font-medium text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold">{userName}</h1>
        </div>
        <button onClick={handleAvatarTap} className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center border-2 border-primary/20 shadow-sm active:scale-95 transition-transform">
          <span className="font-bold text-primary">{userName.charAt(0).toUpperCase()}</span>
        </button>
      </div>

      {/* Main Expense Card (Dark) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-primary text-primary-foreground p-6 rounded-[2rem] shadow-heavy shadow-primary/20 relative overflow-hidden dark:bg-zinc-900 dark:text-zinc-100 border border-transparent dark:border-white/5"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
        
        <p className="text-primary-foreground/70 font-medium mb-1 relative z-10 text-sm">Total Balance</p>
        <h2 className="text-4xl font-black mb-4 relative z-10 tracking-tight">{isGodMode ? `${currency} 99,999,999.00` : formatCurrency(totalBalance)}</h2>
        
        {pendingIncome > 0 && (
          <div className="flex items-center gap-2 bg-amber-400/20 px-3 py-1.5 rounded-full backdrop-blur-md mb-4 w-fit relative z-10">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">{formatCurrency(pendingIncome)} Pending</span>
          </div>
        )}
        
        <div className="flex gap-4 relative z-10">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
            <div className="bg-emerald-400/20 p-1 rounded-full"><TrendingDown className="w-3 h-3 text-emerald-400" /></div>
            <span className="text-xs font-semibold">Income</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
            <div className="bg-rose-400/20 p-1 rounded-full"><TrendingUp className="w-3 h-3 text-rose-400" /></div>
            <span className="text-xs font-semibold">Expense</span>
          </div>
        </div>
      </motion.div>

      {/* Insights Row */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/history" className="bg-card w-full text-left p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer block">
          <div className="bg-primary/5 w-8 h-8 rounded-full flex items-center justify-center mb-3">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Today</p>
          {todayTransactions.length === 0 ? (
            <p className="text-sm font-medium text-muted-foreground">No transactions today!</p>
          ) : (
            <p className="text-lg font-black dark:text-foreground">{formatCurrency(todayTotal)}</p>
          )}
        </Link>
        <Link href="/history" className="bg-card w-full text-left p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer block">
          <div className="bg-rose-500/10 w-8 h-8 rounded-full flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Weekly</p>
          <p className="text-lg font-black dark:text-foreground">{formatCurrency(weeklyTotal)}</p>
        </Link>
      </div>

      {/* Savings Goals Section */}
      <div>
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="font-bold text-foreground">Savings Goals</h3>
          <Link href="/goals" className="text-xs font-bold text-primary uppercase hover:opacity-80 transition-opacity">View All</Link>
        </div>
        <div className="space-y-4">
          {pinnedGoals.length === 0 && (
             <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 text-center">
                 <p className="text-muted-foreground text-sm font-medium">No blocked goals pinned. Add them in Goals!</p>
             </div>
          )}
          {pinnedGoals.map(g => (
            <div key={`${g.id}-${g.current}`} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 relative">
              <div className="flex justify-between items-end mb-3">
                <div className="flex items-center gap-2">
                  <div className={`${g.bg} p-2 rounded-xl`}>
                    <Target className={`w-5 h-5 ${g.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{g.title}</p>
                    <p className="text-xs text-muted-foreground font-medium">{g.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">{currency} {g.current.toLocaleString()} <span className="text-muted-foreground font-medium">/ {g.target >= 1000 ? `${g.target/1000}k` : g.target}</span></p>
                </div>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((g.current / g.target) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                  className={`h-full ${g.color} rounded-full`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spending Trend Chart */}
      <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 mb-10">
        <h3 className="font-bold text-foreground mb-4">Spending Trend</h3>
        <div className="h-[120px] w-[105%] -ml-[2.5%]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dynamicTrendData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="var(--foreground)" 
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 6, fill: "var(--foreground)" }} 
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--border)', strokeWidth: 2, strokeDasharray: '4 4', fill: 'transparent' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground font-medium px-2 mt-2">
          {dynamicTrendData.map((d, i) => <span key={i}>{d.name}</span>)}
        </div>
      </div>
    </div>
  );
}
