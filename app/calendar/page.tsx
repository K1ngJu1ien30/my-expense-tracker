"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAppData } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { convertCurrencySafe } from "@/lib/balance";
import { getHeatmapTileStyle } from "@/lib/heatmap";
import type { Transaction } from "@/lib/types";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** Convert JS Date.getDay() (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun) */
function getMondayFirstDayIndex(year: number, monthIndex: number): number {
  const day = new Date(year, monthIndex, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatDateKey(year: number, monthIndex: number, day: number): string {
  const y = year;
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CalendarPage() {
  const { transactions, accountObjects, currency, exchangeRates, accentColor, formatCurrency } = useAppData();
  const activeAccent = accentColor || "#3b82f6";

  const accountCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accountObjects) {
      const code = a.currencyCode || currency;
      if (a.id) map.set(a.id, code);
      map.set(a.name.trim().toLowerCase(), code);
    }
    return map;
  }, [accountObjects, currency]);

  const now = new Date();
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  // Selected day state for bottom drawer breakdown
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // ─── Daily Aggregation Map (integer cents, base-currency safe) ──────────
  const dailyExpensesMap = useMemo(() => {
    const map = new Map<string, { totalCents: number; total: number; txs: Transaction[] }>();

    transactions.forEach((t) => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;

      const srcCur =
        (t.account_id ? accountCurrencyMap.get(t.account_id) : undefined) ||
        accountCurrencyMap.get((t.account || "").trim().toLowerCase()) ||
        currency;
      const conv = convertCurrencySafe(Number(t.amount), srcCur, currency, {
        liveRates: exchangeRates,
      });

      const existing = map.get(key) || { totalCents: 0, total: 0, txs: [] };
      if (conv.isKnown) {
        existing.totalCents += Math.round(conv.amount * 100);
        existing.total = existing.totalCents / 100;
      }
      existing.txs.push(t);
      map.set(key, existing);
    });

    return map;
  }, [transactions, accountCurrencyMap, currency, exchangeRates]);

  // ─── Month View Computations ───────────────────────────────────────────
  const daysInCurrentMonth = useMemo(
    () => getDaysInMonth(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const startOffset = useMemo(
    () => getMondayFirstDayIndex(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const monthlyTotal = useMemo(() => {
    let totalCents = 0;
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const key = formatDateKey(currentYear, currentMonth, day);
      const data = dailyExpensesMap.get(key);
      if (data) totalCents += data.totalCents;
    }
    return totalCents / 100;
  }, [currentYear, currentMonth, daysInCurrentMonth, dailyExpensesMap]);

  // ─── Year View Computations ────────────────────────────────────────────
  const yearlyTotal = useMemo(() => {
    let totalCents = 0;
    const yearPrefix = `${currentYear}-`;
    dailyExpensesMap.forEach((val, key) => {
      if (key.startsWith(yearPrefix)) totalCents += val.totalCents;
    });
    return totalCents / 100;
  }, [currentYear, dailyExpensesMap]);

  // Navigation handlers
  const handlePrev = () => {
    NativeHaptics.lightTick();
    if (viewMode === "month") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((y) => y - 1);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    } else {
      setCurrentYear((y) => y - 1);
    }
  };

  const handleNext = () => {
    NativeHaptics.lightTick();
    if (viewMode === "month") {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    } else {
      setCurrentYear((y) => y + 1);
    }
  };

  const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());

  // Selected day breakdown items
  const selectedDayData = selectedDayKey ? dailyExpensesMap.get(selectedDayKey) : null;

  return (
    <div className="p-6 space-y-6 pb-32 animate-in fade-in duration-500 min-h-[100dvh] max-w-4xl mx-auto">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/hub"
          onClick={() => NativeHaptics.lightTick()}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Hub
        </Link>

        {/* Month / Year Segmented Toggle */}
        <div className="bg-card p-1 rounded-2xl border border-border/50 shadow-soft flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setViewMode("month");
              NativeHaptics.lightTick();
            }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === "month"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("year");
              NativeHaptics.lightTick();
            }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === "year"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Year
          </button>
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="bg-card rounded-3xl p-5 border border-border/40 shadow-soft space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {viewMode === "month" ? "Monthly Heatmap" : "Yearly Summary"}
            </span>
            <h1 className="text-2xl font-black text-foreground mt-0.5">
              {viewMode === "month"
                ? `${MONTH_NAMES[currentMonth]} ${currentYear}`
                : `${currentYear} Overview`}
            </h1>
          </div>
          <div className="bg-muted/80 p-3 rounded-2xl text-foreground">
            <CalendarIcon className="w-6 h-6" style={{ color: activeAccent }} />
          </div>
        </div>

        {/* Date Selector Navigation Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 rounded-xl bg-muted/60 hover:bg-muted active:scale-95 transition-all text-foreground"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-muted-foreground">
              {viewMode === "month" ? `${MONTH_NAMES[currentMonth]} ${currentYear}` : currentYear}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-2 rounded-xl bg-muted/60 hover:bg-muted active:scale-95 transition-all text-foreground"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Spent
            </p>
            <p className="text-lg font-black text-foreground">
              {formatCurrency(viewMode === "month" ? monthlyTotal : yearlyTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* ─── MONTH VIEW ─────────────────────────────────────────────────── */}
      {viewMode === "month" && (
        <motion.div
          key={`month-${currentYear}-${currentMonth}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-4"
        >
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* 7-Column Sleek Rounded-LG Square Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Leading offset cells */}
            {Array.from({ length: startOffset }).map((_, idx) => (
              <div
                key={`offset-${idx}`}
                className="aspect-square rounded-lg bg-muted/20 border border-transparent pointer-events-none"
              />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = formatDateKey(currentYear, currentMonth, dayNum);
              const data = dailyExpensesMap.get(dateKey);
              const amt = data ? data.total : 0;
              const hasExpenses = amt > 0;
              const isToday = dateKey === todayKey;
              const style = getHeatmapTileStyle(amt);

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    if (hasExpenses) {
                      NativeHaptics.lightTick();
                      setSelectedDayKey(dateKey);
                    }
                  }}
                  className={`aspect-square rounded-lg p-1 flex flex-col justify-between transition-all select-none relative overflow-hidden text-left ${style.tileClass}`}
                  style={isToday ? { borderColor: activeAccent, borderWidth: 2 } : {}}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] leading-none ${isToday ? "text-foreground font-black" : style.numClass}`}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: activeAccent }}
                      />
                    )}
                  </div>

                  {hasExpenses ? (
                    <span className={`text-[8px] leading-none tracking-tighter truncate w-full ${style.amtClass}`}>
                      {currency}{Math.round(amt)}
                    </span>
                  ) : (
                    <span className="text-[8px] opacity-0 select-none">-</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dynamic Color Intensity Scale Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-[10px] font-bold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-muted/40 dark:bg-zinc-900/60 border border-border/30" />
              <span>0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-rose-500/15 dark:bg-rose-950/40 border border-rose-500/30 dark:border-rose-900/50" />
              <span className="text-rose-700 dark:text-rose-300">&lt; {currency}50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-br from-rose-500/30 to-red-500/35 dark:from-rose-900/60 dark:to-red-950/70 border border-rose-500/50 dark:border-rose-700/60" />
              <span className="text-rose-800 dark:text-rose-200">{currency}50-150</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-br from-rose-600 to-red-600 border border-rose-400" />
              <span className="text-foreground">&gt; {currency}150</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── YEAR VIEW ──────────────────────────────────────────────────── */}
      {viewMode === "year" && (
        <motion.div
          key={`year-${currentYear}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="grid grid-cols-2 gap-3"
        >
          {MONTH_NAMES.map((monthName, mIdx) => {
            const daysInM = getDaysInMonth(currentYear, mIdx);
            let mTotal = 0;
            let activeDaysCount = 0;

            for (let d = 1; d <= daysInM; d++) {
              const k = formatDateKey(currentYear, mIdx, d);
              const data = dailyExpensesMap.get(k);
              if (data && data.total > 0) {
                mTotal += data.total;
                activeDaysCount++;
              }
            }

            const isCurrentMonth = currentYear === now.getFullYear() && mIdx === now.getMonth();

            return (
              <button
                key={monthName}
                type="button"
                onClick={() => {
                  setCurrentMonth(mIdx);
                  setViewMode("month");
                  NativeHaptics.lightTick();
                }}
                className={`bg-card p-4 rounded-3xl border transition-all text-left space-y-2 hover:scale-[1.02] active:scale-95 ${
                  isCurrentMonth
                    ? "border-primary/50 shadow-soft"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-foreground">{monthName}</span>
                  {isCurrentMonth && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Now
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-black text-foreground">{formatCurrency(mTotal)}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {activeDaysCount} day{activeDaysCount !== 1 ? "s" : ""} active
                  </p>
                </div>

                {/* Mini Heatmap Preview Grid (all days of month, including 29–31) */}
                <div className="grid grid-cols-7 gap-0.5 pt-1">
                  {Array.from({ length: daysInM }).map((_, dayIdx) => {
                    const dayNum = dayIdx + 1;
                    const dateKey = formatDateKey(currentYear, mIdx, dayNum);
                    const data = dailyExpensesMap.get(dateKey);
                    const amt = data ? data.total : 0;
                    return (
                      <div
                        key={dayIdx}
                        className={`h-1.5 rounded-sm ${
                          amt > 150 ? "bg-red-500" : amt > 50 ? "bg-rose-600" : amt > 0 ? "bg-rose-800/80" : "bg-muted/40"
                        }`}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* ─── DAY BREAKDOWN BOTTOM DRAWER ────────────────────────────────── */}
      <AnimatePresence>
        {selectedDayKey && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center pb-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDayKey(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md mx-4 bg-card rounded-[2rem] border border-border/50 shadow-heavy p-5 space-y-4 max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
                    Daily Expenses
                  </span>
                  <h3 className="text-base font-black text-foreground">
                    {new Date(`${selectedDayKey}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDayKey(null)}
                  className="p-2 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2.5">
                {selectedDayData?.txs.map((tx) => {
                  const txCur =
                    (tx.account_id ? accountCurrencyMap.get(tx.account_id) : undefined) ||
                    accountCurrencyMap.get((tx.account || "").trim().toLowerCase()) ||
                    currency;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border/30"
                    >
                      <div>
                        <p className="text-sm font-bold text-foreground">{tx.category}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {tx.account} {tx.note && `· ${tx.note}`}
                        </p>
                      </div>
                      <span className="text-sm font-black text-rose-500">
                        -{formatCurrency(tx.amount, txCur)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Total Expenses</span>
                <span className="text-base font-black text-red-400">
                  {formatCurrency(selectedDayData?.total || 0)}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
