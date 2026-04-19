"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Wallet, Target, Clock, HelpCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";

type TrendDataPoint = { name: string; dateKey: string; income: number; value: number; transactions: number; currency: string };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: TrendDataPoint }>; label?: string }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card shadow-xl rounded-xl p-3 border border-gray-100 dark:border-white/10 outline-none min-w-[120px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{label} Summary</p>
        <div className="space-y-1 text-sm font-semibold">
          <p className="text-rose-500">Expenses: {data.currency} {Number(data.value).toFixed(2)}</p>
          {data.income > 0 && <p className="text-emerald-500">Income: {data.currency} {Number(data.income).toFixed(2)}</p>}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { userName, goals, transactions, includeSavings, accounts, accountObjects, formatCurrency, currency, isGodMode, derryActive } = useAppContext();
  const pinnedGoals = isGodMode ? goals.map(g => ({ ...g, current: g.target })) : goals.filter(g => g.isPinned);

  // God Mode: 7 taps on avatar within 3 seconds
  const godTapCount = useRef(0);
  const godTapTimer = useRef<NodeJS.Timeout | null>(null);
  const [matrixFlash, setMatrixFlash] = useState(false);
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [showPendingTip, setShowPendingTip] = useState(false);
  const revealTimer = useRef<NodeJS.Timeout | null>(null);

  const handleRevealBalance = () => {
    setBalanceRevealed(true);
    NativeHaptics.lightTick();
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setBalanceRevealed(false), 5000);
  };

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
      setTimeout(() => {
        setMatrixFlash(false);
        const current = localStorage.getItem("god_mode") === "true";
        localStorage.setItem("god_mode", current ? "false" : "true");
        window.location.reload();
      }, 2000);
    }
  }, []);

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning," 
                 : hour >= 12 && hour < 17 ? "Good afternoon," 
                 : "Good evening,";

  // === Single-pass transaction computation (Task 3: performance) ===
  const dashData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
    const endOfWeek = startOfWeek + 7 * 86400000;
    const weekAgoMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();

    const activeAccounts = includeSavings
      ? accounts
      : accounts.filter(acc => acc && !acc.toLowerCase().includes('saving'));

    // Integer math accumulators (cents) for precision
    const balancesCents: Record<string, number> = {};
    activeAccounts.forEach(a => { balancesCents[a] = 0; });

    let totalBalanceCents = 0;
    let pendingIncomeCents = 0;
    let todayTotalCents = 0;
    let weeklyTotalCents = 0;
    const todayTxs: typeof transactions = [];

    // Trend data setup
    const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
    const trendMap: Record<string, TrendDataPoint> = {};
    const trendData: TrendDataPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayLabel = fmt.format(d);
      const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
      const item: TrendDataPoint = { name: dayLabel, dateKey, income: 0, value: 0, transactions: 0, currency };
      trendMap[dateKey] = item;
      trendData.push(item);
    }

    // Single pass over all transactions
    transactions.forEach(t => {
      const amtCents = Math.round(Number(t.amount) * 100);
      const txTime = new Date(t.date).getTime();
      const isSavingsAcc = t.account?.toLowerCase().includes('saving');

      // Pending income
      if (t.type === "Income" && t.status === "pending") {
        pendingIncomeCents += amtCents;
      }

      // Per-account balances (case-insensitive consolidation)
      if (t.account) {
        const official = activeAccounts.find(a => a.toLowerCase() === t.account.toLowerCase());
        const accName = official || t.account;
        if (balancesCents[accName] === undefined) balancesCents[accName] = 0;
        if (t.type === "Income" && t.status !== "pending") balancesCents[accName] += amtCents;
        if (t.type === "Expense") balancesCents[accName] -= amtCents;
        if (t.type === "Transfer") balancesCents[accName] -= amtCents;
      }
      if (t.type === "Transfer" && t.to_account) {
        const officialTo = activeAccounts.find(a => a.toLowerCase() === t.to_account!.toLowerCase());
        const toName = officialTo || t.to_account;
        if (balancesCents[toName] === undefined) balancesCents[toName] = 0;
        balancesCents[toName] += amtCents;
      }

      // Today & weekly expense totals
      if (t.type === "Expense" && (!isSavingsAcc || includeSavings)) {
        if (txTime >= startOfToday && txTime < startOfTomorrow) {
          todayTotalCents += amtCents;
          todayTxs.push(t);
        }
        if (txTime >= startOfWeek && txTime < endOfWeek) {
          weeklyTotalCents += amtCents;
        }
      }

      // Trend data
      if (txTime >= weekAgoMs) {
        const d = new Date(t.date);
        const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
        if (trendMap[dateKey]) {
          if (t.type === "Income") trendMap[dateKey].income += Number(t.amount);
          if (t.type === "Expense") trendMap[dateKey].value += Number(t.amount);
          trendMap[dateKey].transactions += 1;
        }
      }
    });

    // Convert cents back to float for display, compute total
    const accountBalances: Record<string, number> = {};
    for (const [k, v] of Object.entries(balancesCents)) {
      accountBalances[k] = v / 100;
    }
    totalBalanceCents = Object.values(balancesCents)
      .filter((_, i) => {
        const name = Object.keys(balancesCents)[i];
        return activeAccounts.some(a => a.toLowerCase() === name.toLowerCase());
      })
      .reduce((sum, v) => sum + v, 0);

    return {
      totalBalance: totalBalanceCents / 100,
      accountBalances,
      pendingIncome: pendingIncomeCents / 100,
      todayTotal: todayTotalCents / 100,
      todayTransactions: todayTxs,
      weeklyTotal: weeklyTotalCents / 100,
      dynamicTrendData: transactions.length > 0 ? trendData : [],
    };
  }, [transactions, includeSavings, accounts, currency]);

  const { totalBalance, accountBalances, pendingIncome, todayTotal, todayTransactions, weeklyTotal, dynamicTrendData } = dashData;

  // Ordered account list: official order first, ghost accounts appended
  const orderedAccountCards = useMemo(() => {
    const activeAccounts = includeSavings
      ? accounts
      : accounts.filter(acc => acc && !acc.toLowerCase().includes('saving'));

    const officialCards = activeAccounts.map(name => ({
      name,
      balance: accountBalances[name] || 0
    }));

    const officialSet = new Set(activeAccounts.map(a => a.toLowerCase()));
    const ghostCards = Object.entries(accountBalances)
      .filter(([name]) => !officialSet.has(name.toLowerCase()))
      .map(([name, balance]) => ({ name, balance }));

    return [...officialCards, ...ghostCards];
  }, [accountBalances, accounts, includeSavings]);

  const getCurrencyPrefix = (accountName: string) => {
    const accObj = accountObjects.find(a => a.name.toLowerCase() === accountName.toLowerCase());
    return accObj?.currencyCode || currency;
  };

  const formatAccountBalance = (accountName: string, balance: number) => {
    const cents = Math.round(balance * 100);
    const whole = Math.floor(Math.abs(cents) / 100);
    const remainder = Math.abs(cents) % 100;
    const sign = cents < 0 ? '-' : '';
    const prefix = getCurrencyPrefix(accountName);
    return `${prefix} ${sign}${whole.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
  };

  // 🎈 Derry Horror Sequence — phased state
  const [derryPhase, setDerryPhase] = useState(0);

  useEffect(() => {
    if (!derryActive) { setDerryPhase(0); return; }

    // Phase 1: Blackout + heartbeat (0s)
    setDerryPhase(1);
    NativeHaptics.creepyHeartbeat();

    // Phase 2: Blood drip (2s)
    const t2 = setTimeout(() => setDerryPhase(2), 2000);

    // Phase 3: Jump scare (4.5s) — maximum vibration
    const t3 = setTimeout(() => {
      setDerryPhase(3);
      import("@capacitor/haptics").then(({ Haptics }) => {
        Haptics.vibrate({ duration: 800 });
      }).catch(() => {
        if (navigator.vibrate) navigator.vibrate(800);
      });
    }, 4500);

    // Phase 4: Fade out (5s)
    const t4 = setTimeout(() => setDerryPhase(4), 5000);

    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [derryActive]);

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* 🎈 Derry Horror Overlay */}
      <AnimatePresence>
        {derryActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: derryPhase === 4 ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: derryPhase === 4 ? 3 : 0.3 }}
            className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none"
          >
            {/* Phase 1: Blackout with blood vignette */}
            <div className="absolute inset-0 horror-blackout" />

            {/* Phase 1 text: "We all float down here..." */}
            {derryPhase >= 1 && derryPhase < 3 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 0.8, 0.8, 0.4], y: 0 }}
                transition={{ duration: 2, times: [0, 0.3, 0.7, 1] }}
                className="absolute inset-0 flex items-center justify-center text-xl font-bold tracking-wider"
                style={{ color: '#6b0000', textShadow: '0 0 30px #4a0000, 0 0 60px #2a0000' }}
              >
                We all float down here...
              </motion.p>
            )}

            {/* Phase 2: Blood drip */}
            {derryPhase >= 2 && (
              <div className="absolute top-0 left-0 right-0 blood-drip" />
            )}

            {/* Phase 3: Jump scare — massive emoji flash */}
            {derryPhase === 3 && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: 'jumpScare 0.5s forwards' }}
              >
                <span className="text-[200px] leading-none" style={{ filter: 'contrast(1.5) saturate(2)' }}>🤡</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Matrix Konami Effect */}
      <AnimatePresence>
        {matrixFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, #000000, #003300)' }}
          >
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", damping: 12 }}
              className="text-3xl font-black tracking-widest"
              style={{ color: '#00ff00', textShadow: '0 0 10px #00ff00, 0 0 30px #00ff00, 0 0 60px #003300' }}
            >
              GOD MODE
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Main Wallet Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={handleRevealBalance}
        className="bg-primary text-primary-foreground py-3 px-4 rounded-[2rem] shadow-heavy shadow-primary/20 relative overflow-hidden dark:bg-zinc-900 dark:text-zinc-100 border border-transparent dark:border-white/5 cursor-pointer"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
        
        {derryActive ? (
          <>
            <p className="text-primary-foreground/70 font-medium mb-1 relative z-10 text-sm">🎈</p>
            <h2 className="text-4xl font-black mb-4 relative z-10 tracking-tight text-red-600">YOU'LL FLOAT TOO.</h2>
          </>
        ) : (
          <>
            {/* Per-account balances — compact horizontal carousel */}
            <div className="relative z-10 -mx-1 px-1 flex overflow-x-auto snap-x hide-scrollbar gap-3 pb-1 mb-2">
              {orderedAccountCards.map(({ name, balance }) => (
                <div key={name} className="flex-shrink-0 w-fit min-w-[130px] p-3 pr-8 bg-gray-800/60 rounded-xl snap-start border border-gray-700/50">
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">{name}</span>
                  <span className={`text-lg font-bold tracking-tight block mt-0.5 ${balance < 0 ? 'text-rose-400' : 'text-white'}`}>
                    {isGodMode
                      ? `${getCurrencyPrefix(name)} 99,999.00`
                      : balanceRevealed
                        ? formatAccountBalance(name, balance)
                        : `${getCurrencyPrefix(name)} •••••`
                    }
                  </span>
                </div>
              ))}
              {orderedAccountCards.length === 0 && (
                <p className="text-gray-500 text-sm font-medium min-w-full text-center py-2">No active accounts</p>
              )}
            </div>

            {/* Net Total — subtle */}
            <div className="relative z-10 pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Net Total</span>
              <span className="text-sm font-bold text-gray-300 tracking-tight">
                {isGodMode ? `${currency} 99,999,999.00` : balanceRevealed ? formatCurrency(totalBalance) : `${currency} •••••`}
              </span>
            </div>
          </>
        )}
        
        {pendingIncome > 0 && !derryActive && (
          <div className="relative z-10 mt-2">
            <div className="flex items-center gap-2 bg-amber-400/20 px-3 py-1 rounded-full backdrop-blur-md w-fit">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300">{formatCurrency(pendingIncome)} Pending</span>
              <button onClick={(e) => { e.stopPropagation(); setShowPendingTip(!showPendingTip); }} className="pointer-events-auto">
                <HelpCircle className="w-3 h-3 text-amber-400/60" />
              </button>
            </div>
            {showPendingTip && (
              <div className="absolute left-0 top-full mt-1.5 bg-foreground text-background text-[10px] font-medium px-3 py-2 rounded-xl shadow-heavy max-w-[250px] leading-snug pointer-events-auto z-20" onClick={(e) => { e.stopPropagation(); setShowPendingTip(false); }}>
                Pending funds do not affect your total balance until marked as cleared.
              </div>
            )}
          </div>
        )}
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
