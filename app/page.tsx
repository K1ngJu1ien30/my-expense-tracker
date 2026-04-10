"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Target, Plus, Check, X, Trash2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { useAppContext } from "@/lib/context";



const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card shadow-xl rounded-xl p-3 border border-gray-100 dark:border-white/10 outline-none min-w-[120px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{label} Summary</p>
        <div className="space-y-1 text-sm font-semibold">
          <p className="text-rose-500">Expenses: RM {data.value}</p>
          {data.income > 0 && <p className="text-emerald-500">Income: RM {data.income}</p>}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { userName, goals, transactions, includeSavings, accounts } = useAppContext();
  const pinnedGoals = goals.filter(g => g.isPinned);

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
           if (tx.type === "Income") newAcc += Number(tx.amount);
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

  const todayTransactions = useMemo(() => {
     const todayStr = new Date().toISOString().split('T')[0];
     return transactions.filter(t => {
       if (t.type !== "Expense") return false;
       if (!includeSavings && t.account?.toLowerCase().includes('saving')) return false;
       const txDateStr = t.date.includes('T') ? t.date.split('T')[0] : t.date.includes(' ') ? t.date.split(' ')[0] : t.date;
       return txDateStr === todayStr;
     });
  }, [transactions, includeSavings]);

  const todayTotal = useMemo(() => {
     return todayTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [todayTransactions]);

  const weeklyTransactions = useMemo(() => {
     const now = new Date();
     const dayOfWeek = now.getDay() || 7;
     const startOfWeek = new Date(now);
     startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
     const endOfWeek = new Date(startOfWeek);
     endOfWeek.setDate(startOfWeek.getDate() + 6);

     const startStr = startOfWeek.toISOString().split('T')[0];
     const endStr = endOfWeek.toISOString().split('T')[0];

     return transactions.filter(t => {
        if (t.type !== "Expense") return false;
        if (!includeSavings && t.account?.toLowerCase().includes('saving')) return false;
        const txDateStr = t.date.includes('T') ? t.date.split('T')[0] : t.date.includes(' ') ? t.date.split(' ')[0] : t.date;
        return txDateStr >= startStr && txDateStr <= endStr;
     });
  }, [transactions, includeSavings]);

  const weeklyTotal = useMemo(() => {
     return weeklyTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [weeklyTransactions]);

  const dynamicTrendData = useMemo(() => {
     if (transactions.length === 0) return [];
     const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
     const data = [];
     const map: Record<string, any> = {};
     for (let i = 6; i >= 0; i--) {
       const d = new Date();
       d.setDate(d.getDate() - i);
       const dayLabel = fmt.format(d);
       const dateKey = `${d.getMonth()+1}/${d.getDate()}`;
       const item = { name: dayLabel, dateKey, income: 0, value: 0, transactions: 0 };
       map[dateKey] = item;
       data.push(item);
     }
     
     const weekAgo = new Date();
     weekAgo.setDate(weekAgo.getDate() - 7);
     
     transactions.forEach(t => {
        const d = new Date(t.date);
        if (d < weekAgo) return;
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
      {/* Header */}
      <div className="flex justify-between items-center mt-2">
        <div>
          <p className="text-muted-foreground font-medium text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold">{userName}</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center border-2 border-primary/20 shadow-sm">
          <span className="font-bold text-primary">{userName.charAt(0).toUpperCase()}</span>
        </div>
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
        <h2 className="text-4xl font-black mb-6 relative z-10 tracking-tight">RM {totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        
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
            <p className="text-lg font-black dark:text-foreground">RM {todayTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          )}
        </Link>
        <Link href="/history" className="bg-card w-full text-left p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer block">
          <div className="bg-rose-500/10 w-8 h-8 rounded-full flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Weekly</p>
          <p className="text-lg font-black dark:text-foreground">RM {weeklyTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
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
                  <p className="text-xs font-bold text-primary">RM {g.current.toLocaleString()} <span className="text-muted-foreground font-medium">/ {g.target >= 1000 ? `${g.target/1000}k` : g.target}</span></p>
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
