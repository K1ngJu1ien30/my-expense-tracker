"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Target, Plus, Check, X, Trash2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { useAppContext } from "@/lib/context";

const mockTrendData = [
  { name: 'Mon', value: 400, income: 0, transactions: 3 },
  { name: 'Tue', value: 300, income: 1500, transactions: 5 },
  { name: 'Wed', value: 550, income: 0, transactions: 4 },
  { name: 'Thu', value: 200, income: 0, transactions: 2 },
  { name: 'Fri', value: 700, income: 200, transactions: 8 },
  { name: 'Sat', value: 900, income: 0, transactions: 6 },
  { name: 'Sun', value: 450, income: 0, transactions: 3 },
];

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
  const { userName, goals } = useAppContext();
  const pinnedGoals = goals.filter(g => g.isPinned);

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mt-2">
        <div>
          <p className="text-muted-foreground font-medium text-sm">Good morning,</p>
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
        className="bg-primary text-primary-foreground p-6 rounded-[2rem] shadow-heavy shadow-primary/20 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
        
        <p className="text-primary-foreground/70 font-medium mb-1 relative z-10 text-sm">Total Balance</p>
        <h2 className="text-4xl font-black mb-6 relative z-10 tracking-tight">RM 12,450.00</h2>
        
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
          <p className="text-lg font-black dark:text-foreground">RM 142.50</p>
        </Link>
        <Link href="/history" className="bg-card w-full text-left p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer block">
          <div className="bg-emerald-500/10 w-8 h-8 rounded-full flex items-center justify-center mb-3">
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Weekly</p>
          <p className="text-lg font-black dark:text-foreground">RM 840.00</p>
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
            <LineChart data={mockTrendData}>
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
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
      </div>
    </div>
  );
}
