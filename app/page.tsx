"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, Wallet, Target, Clock, HelpCircle, Receipt, CreditCard } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { getTimeTheme } from "@/lib/timeTheme";
import MonthlyReceiptModal from "@/components/MonthlyReceiptModal";
import { calculateFinancialPosition } from "@/lib/balance";
import { cn } from "@/lib/utils";

/**
 * Currency value that smoothly animates from its previous value to the new
 * one over ~500ms. Uses framer-motion's `animate(motionValue)` so we don't
 * re-render on every tween frame — only the text node updates.
 *
 * Gracefully no-ops if the user prefers reduced motion (respects the OS
 * setting via `prefers-reduced-motion`).
 */
function AnimatedCurrency({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const mv = useMotionValue(value);
  const rendered = useTransform(mv, (latest) => format(latest));

  useEffect(() => {
    // Respect the OS "reduce motion" preference — skip the tween entirely.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      mv.set(value);
      return;
    }

    const controls = animate(mv, value, {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1], // easeOutQuint-ish, feels natural
    });
    return () => controls.stop();
  }, [value, mv]);

  return <motion.span>{rendered}</motion.span>;
}

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
  const {
    userName,
    goals,
    transactions,
    includeSavings,
    accounts,
    accountObjects,
    formatCurrency,
    currency,
    isGodMode,
    derryActive,
    isClaimsEnabled,
    enableTimeBasedGreeting,
    openCreditCardPayment,
  } = useAppContext();
  const pinnedGoals = isGodMode ? goals.map(g => ({ ...g, current: g.target })) : goals.filter(g => g.isPinned);

  // ─── Monthly Receipt auto-prompt ───────────────────────────────────────
  // Shows a dismissible card on days 1–7 of each month advertising the
  // previous month's recap. Dismissal is keyed by `YYYY-MM` so a user who
  // dismisses April's recap still sees May's. The modal itself can also be
  // opened on demand (see state below).
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRecapPrompt, setShowRecapPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const day = now.getDate();
    if (day > 7) return; // Only remind in the first week of a new month.

    // The recap targets the *previous* month.
    const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const targetMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const key = `recap_dismissed_${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
    if (localStorage.getItem(key) === "true") return;

    // Don't show the prompt if the user had literally zero activity last
    // month — an empty receipt is more annoying than useful.
    const monthStart = new Date(targetYear, targetMonth, 1).getTime();
    const monthEnd = new Date(targetYear, targetMonth + 1, 1).getTime() - 1;
    const hasActivity = transactions.some((t) => {
      if (t.deleted_at) return false;
      const when = new Date(t.date).getTime();
      return when >= monthStart && when <= monthEnd;
    });
    if (!hasActivity) return;

    setShowRecapPrompt(true);
  }, [transactions]);

  const dismissRecapPrompt = () => {
    const now = new Date();
    const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const targetMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const key = `recap_dismissed_${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
    localStorage.setItem(key, "true");
    setShowRecapPrompt(false);
  };

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
      godTapTimer.current = setTimeout(() => {
        godTapCount.current = 0;
        godTapTimer.current = null;
      }, 3000);
    }
    if (godTapCount.current >= 7) {
      godTapCount.current = 0;
      if (godTapTimer.current) {
        clearTimeout(godTapTimer.current);
        godTapTimer.current = null;
      }
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

  // Time-theme: gradient + greeting based on time of day
  const timeTheme = useMemo(() => {
    const hour = new Date().getHours();
    return getTimeTheme(hour, enableTimeBasedGreeting);
  }, [enableTimeBasedGreeting]);
  const greeting = timeTheme.greeting;

  const displayGreeting = greeting;

  // Centralized Financial Position & Multi-Currency Engine (Phase 1C)
  const financialPosition = useMemo(() => {
    return calculateFinancialPosition(accountObjects, transactions, {
      includeSavings,
      baseCurrency: currency,
    });
  }, [accountObjects, transactions, includeSavings, currency]);

  // === Single-pass transaction computation (Today/Week stats & Trend data) ===
  const dashData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
    const endOfWeek = startOfWeek + 7 * 86400000;
    const weekAgoMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();

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

    // Single pass over all transactions for pending income and trends
    transactions.forEach(t => {
      const amtCents = Math.round(Number(t.amount) * 100);
      const txTime = new Date(t.date).getTime();
      const isSavingsAcc = t.account?.toLowerCase().includes('saving');

      // Pending income
      if (t.type === "Income" && t.status === "pending") {
        pendingIncomeCents += amtCents;
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

    return {
      totalBalance: financialPosition.netFinancialPosition,
      accountBalances: financialPosition.accountBalances,
      pendingIncome: pendingIncomeCents / 100,
      todayTotal: todayTotalCents / 100,
      todayTransactions: todayTxs,
      weeklyTotal: weeklyTotalCents / 100,
      dynamicTrendData: transactions.length > 0 ? trendData : [],
    };
  }, [transactions, includeSavings, currency, financialPosition]);

  const { totalBalance, accountBalances, pendingIncome, todayTotal, todayTransactions, weeklyTotal, dynamicTrendData } = dashData;

  // Outstanding claims — drives the split-bill widget. Computed separately
  // from dashData so it only re-runs when claims-related fields change.
  const claimsSummary = useMemo(() => {
    if (!isClaimsEnabled) return null;
    const pending = transactions.filter(
      (t) => t.is_claimable === true && t.claim_status === "pending"
    );
    if (pending.length === 0) return null;
    const total = pending.reduce((sum, t) => sum + Number(t.amount), 0);
    // Count distinct payees (the `note` field is where users jot down who owes).
    // Fall back to transaction count if notes are empty.
    const payees = new Set<string>();
    for (const t of pending) {
      const payee = (t.note || "").trim().toLowerCase();
      if (payee) payees.add(payee);
    }
    return {
      total,
      count: pending.length,
      distinctPayees: payees.size,
    };
  }, [transactions, isClaimsEnabled]);

  // Credit card summary — drives the credit card companion card on Home
  const creditCardSummary = useMemo(() => {
    const cCards = accountObjects.filter((a) => a.kind === "credit_card" && !a.isArchived);
    if (cCards.length === 0) return null;

    let totalDebt = 0;
    let totalLimit = 0;

    cCards.forEach((c) => {
      const bal = accountBalances[c.name] ?? (Number(c.openingBalance) || 0);
      if (bal < 0) totalDebt += Math.abs(bal);
      const lim = Number(c.creditLimit || 0);
      if (lim > 0) totalLimit += lim;
    });

    const utilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

    return {
      cardCount: cCards.length,
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalLimit: Math.round(totalLimit * 100) / 100,
      utilization: Math.round(utilization * 10) / 10,
    };
  }, [accountObjects, accountBalances]);

  // Ordered account list: official order first, ghost accounts appended
  const orderedAccountCards = useMemo(() => {
    const activeAccounts = includeSavings
      ? accounts
      : accounts.filter(acc => {
          const accObj = accountObjects.find(a => a.name.toLowerCase() === acc.toLowerCase());
          return accObj ? accObj.kind !== 'savings' : !acc.toLowerCase().includes('saving');
        });

    const officialCards = activeAccounts.map(name => {
      const accObj = accountObjects.find(a => a.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        balance: accountBalances[name] !== undefined ? accountBalances[name] : (Number(accObj?.openingBalance || 0)),
        kind: accObj?.kind || 'bank',
        currencyCode: accObj?.currencyCode || currency,
      };
    });

    const officialSet = new Set(activeAccounts.map(a => a.toLowerCase()));
    const ghostCards = Object.entries(accountBalances)
      .filter(([name]) => !officialSet.has(name.toLowerCase()))
      .map(([name, balance]) => ({ name, balance, kind: 'bank' as const, currencyCode: currency }));

    return [...officialCards, ...ghostCards];
  }, [accountBalances, accounts, accountObjects, includeSavings, currency]);

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
    <div className="p-4 sm:p-6 lg:p-0 space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      {/* 🎈 Derry Horror Overlay — purely decorative easter egg */}
      <AnimatePresence>
        {derryActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: derryPhase === 4 ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: derryPhase === 4 ? 3 : 0.3 }}
            aria-hidden="true"
            className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none"
          >
            <div className="absolute inset-0 horror-blackout" />
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
            {derryPhase >= 2 && (
              <div className="absolute top-0 left-0 right-0 blood-drip" />
            )}
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
            aria-hidden="true"
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

      <MonthlyReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />

      {/* Responsive Grid: 2 columns on desktop (8 cols left, 4 cols right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ─── LEFT COLUMN: Header, Accounts Wallet & Trends ──────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Header Banner with Time-of-Day theme */}
          <div
            className="relative rounded-3xl px-5 py-4 transition-colors duration-700 overflow-hidden shadow-soft border border-border/30"
            style={{
              background: timeTheme.gradient,
            }}
            data-time-bucket={timeTheme.bucket}
          >
            <div className="flex justify-between items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground font-semibold text-sm flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-base">{timeTheme.icon}</span>
                  <span className="truncate">{displayGreeting}</span>
                </p>
                <h1 className="text-2xl lg:text-3xl font-bold truncate mt-0.5">{userName}</h1>
              </div>

              <button
                type="button"
                aria-label="User avatar"
                onClick={handleAvatarTap}
                className="w-11 h-11 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center border-2 border-primary/20 shadow-sm active:scale-95 transition-transform shrink-0 cursor-pointer"
                style={{ boxShadow: `0 0 18px ${timeTheme.accent}` }}
              >
                <span className="font-bold text-primary text-base">{userName.charAt(0).toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Main Wallet Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={handleRevealBalance}
            role="button"
            tabIndex={0}
            aria-label={balanceRevealed ? "Hide account balances" : "Reveal account balances"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRevealBalance();
              }
            }}
            className="bg-primary text-primary-foreground p-5 rounded-[2rem] shadow-heavy shadow-primary/20 relative overflow-hidden dark:bg-zinc-900 dark:text-zinc-100 border border-transparent dark:border-white/5 cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-xl -ml-12 -mb-12 pointer-events-none" />
            
            {derryActive ? (
              <>
                <p className="text-primary-foreground/70 font-medium mb-1 relative z-10 text-sm">🎈</p>
                <h2 className="text-4xl font-black mb-4 relative z-10 tracking-tight text-red-600">YOU&rsquo;LL FLOAT TOO.</h2>
              </>
            ) : (
              <>
                {/* Per-account balances — carousel on mobile, responsive grid on desktop */}
                <div className="relative z-10 -mx-1 px-1 flex lg:grid lg:grid-cols-2 xl:grid-cols-3 overflow-x-auto lg:overflow-x-visible snap-x hide-scrollbar gap-3 pb-2 mb-3">
                  {orderedAccountCards.map(({ name, balance, kind }) => (
                    <div key={name} className="flex-shrink-0 w-fit min-w-[140px] lg:w-full lg:min-w-0 p-3.5 pr-6 bg-gray-800/60 rounded-2xl snap-start border border-gray-700/50 hover:border-gray-600 transition-colors">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block truncate">{name}</span>
                        {kind === "credit_card" && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded">Card</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreditCardPayment(name);
                              }}
                              aria-label={`Pay ${name}`}
                              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/20 hover:bg-white/30 active:scale-95 text-white rounded transition-all cursor-pointer"
                            >
                              Pay
                            </button>
                          </div>
                        )}
                        {kind === "savings" && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded shrink-0">Save</span>
                        )}
                      </div>
                      <span className={`text-lg font-bold tracking-tight block mt-0.5 ${balance < 0 ? 'text-rose-400' : 'text-white'}`}>
                        {isGodMode
                          ? `${getCurrencyPrefix(name)} 99,999.00`
                          : balanceRevealed
                            ? <AnimatedCurrency value={balance} format={(n) => formatAccountBalance(name, n)} />
                            : `${getCurrencyPrefix(name)} •••••`
                        }
                      </span>
                    </div>
                  ))}
                  {orderedAccountCards.length === 0 && (
                    <p className="text-gray-500 text-sm font-medium min-w-full text-center py-2">No active accounts</p>
                  )}
                </div>

                {/* Net Total */}
                <div
                  className={`relative z-10 pt-3 border-t border-white/[0.08] flex items-center justify-between ${
                    !isGodMode && balanceRevealed && totalBalance < 0 ? "animate-glitch" : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                      {financialPosition.isMultiCurrency ? "Est. Net Total" : "Net Total"}
                    </span>
                    {financialPosition.isMultiCurrency && (
                      <span className="text-[10px] text-gray-400/80 font-medium">
                        Converted to {currency}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-base font-bold tracking-tight ${
                      !isGodMode && balanceRevealed && totalBalance > 1_000_000
                        ? "rich-sparkle text-amber-300"
                        : "text-gray-200"
                    }`}
                  >
                    {isGodMode
                      ? `${currency} 99,999,999.00`
                      : balanceRevealed
                        ? <AnimatedCurrency value={totalBalance} format={formatCurrency} />
                        : `${currency} •••••`}
                  </span>
                </div>

                {/* Multi-currency breakdown pills */}
                {financialPosition.isMultiCurrency && balanceRevealed && !isGodMode && (
                  <div className="relative z-10 mt-2.5 pt-2 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                    {Object.entries(financialPosition.byCurrency).map(([cur, totals]) => (
                      <span key={cur} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                        {cur}: {totals.netFinancialPosition < 0 ? '-' : ''}{cur} {Math.abs(totals.netFinancialPosition).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {pendingIncome > 0 && !derryActive && (
              <div className="relative z-10 mt-3">
                <div className="flex items-center gap-2 bg-amber-400/20 px-3 py-1 rounded-full backdrop-blur-md w-fit">
                  <Clock className="w-3 h-3 text-amber-400" aria-hidden="true" />
                  <span className="text-[10px] font-bold text-amber-300">{formatCurrency(pendingIncome)} Pending</span>
                  <button type="button" aria-label="About pending funds" aria-expanded={showPendingTip} onClick={(e) => { e.stopPropagation(); setShowPendingTip(!showPendingTip); }} className="pointer-events-auto cursor-pointer">
                    <HelpCircle className="w-3 h-3 text-amber-400/60" aria-hidden="true" />
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

          {/* Spending Trend Chart */}
          <div className="bg-card p-6 rounded-3xl shadow-soft border border-border/40">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground text-base">Spending Trend</h3>
              <span className="text-xs font-semibold text-muted-foreground">Past 7 Days</span>
            </div>
            <div className="h-[140px] lg:h-[220px] w-full" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
            <div className="flex justify-between text-xs text-muted-foreground font-medium px-2 mt-3 pt-2 border-t border-border/30">
              {dynamicTrendData.map((d, i) => <span key={i}>{d.name}</span>)}
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Insights, Claims & Goals ─────────────────────── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Insights Row */}
          <div className="grid grid-cols-2 gap-4">
            <Link href="/history" className="bg-card w-full text-left p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer block group">
              <div className="bg-primary/5 w-9 h-9 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                <Wallet className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Today</p>
              {todayTransactions.length === 0 ? (
                <p className="text-xs font-medium text-muted-foreground">No transactions</p>
              ) : (
                <p className="text-lg font-black dark:text-foreground">{formatCurrency(todayTotal)}</p>
              )}
            </Link>
            <Link href="/history" className="bg-card w-full text-left p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer block group">
              <div className="bg-rose-500/10 w-9 h-9 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-rose-500/20 transition-colors">
                <TrendingUp className="w-4 h-4 text-rose-500" aria-hidden="true" />
              </div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Weekly</p>
              <p className="text-lg font-black dark:text-foreground">{formatCurrency(weeklyTotal)}</p>
            </Link>
          </div>

          {/* Monthly-Recap Auto-Prompt */}
          <AnimatePresence>
            {showRecapPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ type: "spring", damping: 26, stiffness: 300 }}
                className="relative rounded-3xl border border-amber-400/40 p-4 flex items-center gap-3 overflow-hidden shadow-soft"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(253, 248, 235, 0.95) 0%, rgba(248, 241, 222, 0.95) 100%)",
                  color: "#3a3a37",
                }}
              >
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-amber-700" aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="flex-1 text-left active:scale-[0.99] transition-transform cursor-pointer"
                  aria-label="Open last month's receipt"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                    Your monthly receipt is ready
                  </p>
                  <p className="text-sm font-bold mt-0.5">Tap to view & share →</p>
                </button>
                <button
                  type="button"
                  aria-label="Dismiss recap prompt"
                  onClick={dismissRecapPrompt}
                  className="p-1.5 text-stone-500 hover:text-stone-800 transition-colors shrink-0 text-lg leading-none font-bold cursor-pointer"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Split-Bill Widget */}
          {claimsSummary && (
            <Link
              href="/hub/claims"
              className="bg-card p-4 rounded-3xl shadow-soft border border-amber-500/30 flex items-center gap-4 hover:border-amber-500/60 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="bg-amber-500/10 w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-amber-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-500">Unclaimed</p>
                <p className="text-base font-black text-foreground leading-tight">
                  {formatCurrency(claimsSummary.total)}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {claimsSummary.count} expense{claimsSummary.count !== 1 ? "s" : ""}
                  {claimsSummary.distinctPayees > 0 && ` · ${claimsSummary.distinctPayees} payee${claimsSummary.distinctPayees !== 1 ? "s" : ""}`}
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider shrink-0">Review →</span>
            </Link>
          )}

          {/* Credit Card Overview Widget (Phase 2E) */}
          {creditCardSummary && (
            <Link
              href="/hub/credit-cards"
              className="bg-card p-4 rounded-3xl shadow-soft border border-rose-500/20 hover:border-rose-500/50 flex flex-col gap-3 transition-all cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-rose-500/10 w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-rose-500">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">
                      Credit Cards ({creditCardSummary.cardCount})
                    </span>
                    <span className="text-sm font-black text-foreground font-mono">
                      {formatCurrency(creditCardSummary.totalDebt)} Outstanding
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-rose-500 hover:underline">
                  Dashboard →
                </span>
              </div>

              {creditCardSummary.totalLimit > 0 && (
                <div className="space-y-1 bg-muted/20 p-2.5 rounded-2xl border border-border/40">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground font-medium">Utilization:</span>
                    <span className="font-mono font-bold text-foreground">
                      {creditCardSummary.utilization.toFixed(1)}% of {formatCurrency(creditCardSummary.totalLimit)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        creditCardSummary.utilization > 70
                          ? "bg-rose-500"
                          : creditCardSummary.utilization > 30
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(2, creditCardSummary.utilization))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </Link>
          )}

          {/* Savings Goals Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-bold text-foreground text-sm">Savings Goals</h3>
              <Link href="/goals" className="text-xs font-bold text-primary uppercase hover:underline transition-all">View All</Link>
            </div>
            <div className="space-y-3">
              {pinnedGoals.length === 0 && (
                <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 text-center">
                  <p className="text-muted-foreground text-xs font-medium">No pinned goals yet. Pin them in Goals!</p>
                </div>
              )}
              {pinnedGoals.map(g => (
                <div key={`${g.id}-${g.current}`} className="bg-card p-4 rounded-2xl shadow-soft border border-border/40 relative space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`${g.bg} p-2 rounded-xl shrink-0`}>
                        <Target className={`w-4 h-4 ${g.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{g.title}</p>
                        <p className="text-[10px] text-muted-foreground font-medium truncate">{g.subtitle}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-primary">{currency} {g.current.toLocaleString()} <span className="text-muted-foreground font-medium text-[10px]">/ {g.target >= 1000 ? `${g.target/1000}k` : g.target}</span></p>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
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
        </div>
      </div>
    </div>
  );
}
