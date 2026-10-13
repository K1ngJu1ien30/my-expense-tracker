"use client";

import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAppContext } from "@/lib/context";
import {
  Receipt,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MonthlyReceiptModal from "@/components/MonthlyReceiptModal";
import CustomDateRangeModal from "@/components/CustomDateRangeModal";
import CustomSelect from "@/components/CustomSelect";
import type { ReceiptMonth } from "@/lib/receiptData";
import { NativeHaptics } from "@/lib/haptics";
import { countsTowardVelocity, velocityFilterExplainer } from "@/lib/velocity";
import { getCategoryColor } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

type ChartPayload = {
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
  fill?: string;
  stroke?: string;
  color?: string;
  payload?: { fill?: string; color?: string; currency?: string; percentage?: number };
};

type TooltipProps = {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string | number;
};

const PieTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const first = payload[0];
    const { name, value } = first;
    const color = first.payload?.fill || first.payload?.color || "#ef4444";
    const pct =
      first.payload?.percentage !== undefined
        ? Number(first.payload.percentage).toFixed(1)
        : "0";
    return (
      <div className="bg-card/95 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-heavy p-3 min-w-[160px]">
        <p className="text-xs font-bold text-muted-foreground mb-1.5 pb-1 border-b border-border/40">
          {name}
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-black text-foreground">{pct}%</span>
          </div>
          <span className="text-xs font-black text-foreground">
            {first.payload?.currency || "RM"}{" "}
            {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-heavy p-3 min-w-[150px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-1.5 border-b border-border/40">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.fill || entry.color }}
                />
                <span className="text-xs font-semibold text-muted-foreground truncate">
                  {entry.dataKey}
                </span>
              </div>
              <span className="text-xs font-black text-foreground shrink-0">
                {entry.payload?.currency || ""} {Number(entry.value).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const VelocityTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-heavy p-3 min-w-[130px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/40">
          Day {label}
        </p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.stroke || entry.color }}
            />
            <span className="text-xs font-black text-foreground">
              {entry.payload?.currency || ""} {Number(entry.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalyticsPage() {
  const { accentColor, transactions, currency, formatCurrency } = useAppContext();

  // Navigation & Filter state
  const [activeTab, setActiveTab] = useState<"overview" | "compare">("overview");
  const [timeFilter, setTimeFilter] = useState<"WEEK" | "MONTH" | "YEAR" | "CUSTOM">("MONTH");
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [breakdownType, setBreakdownType] = useState<"expense" | "income">("expense");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Custom Date Range state
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Compare Tab state
  const [comparePreset, setComparePreset] = useState<"MONTH" | "QUARTER" | "CUSTOM">("MONTH");
  const [comparePeriodAStart, setComparePeriodAStart] = useState<string>("");
  const [comparePeriodAEnd, setComparePeriodAEnd] = useState<string>("");
  const [comparePeriodBStart, setComparePeriodBStart] = useState<string>("");
  const [comparePeriodBEnd, setComparePeriodBEnd] = useState<string>("");
  const [isCompareAModalOpen, setIsCompareAModalOpen] = useState(false);
  const [isCompareBModalOpen, setIsCompareBModalOpen] = useState(false);

  // Monthly Receipts
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<ReceiptMonth | undefined>(undefined);
  const [isHistoricModalOpen, setIsHistoricModalOpen] = useState(false);

  // Reset offset when switching filters
  const handleFilterChange = (filter: "WEEK" | "MONTH" | "YEAR" | "CUSTOM") => {
    setTimeFilter(filter);
    setPeriodOffset(0);
    NativeHaptics.lightTick();
  };

  // ─── Period Date Calculation ──────────────────────────────────────────────
  const { periodStart, periodEnd, periodLabel, prevPeriodStart, prevPeriodEnd } = useMemo(() => {
    const now = new Date();

    if (timeFilter === "WEEK") {
      // Calculate target week based on offset
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + periodOffset * 7);

      const dayOfWeek = targetDate.getDay() || 7; // Monday = 1
      const start = new Date(targetDate);
      start.setDate(targetDate.getDate() - dayOfWeek + 1);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      // Previous period matching (the week before)
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);

      const isCurrentWeek = periodOffset === 0;
      const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endFmt = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const label = isCurrentWeek ? `This Week (${startFmt} – ${endFmt})` : `${startFmt} – ${endFmt}`;

      return {
        periodStart: start,
        periodEnd: end,
        periodLabel: label,
        prevPeriodStart: prevStart,
        prevPeriodEnd: prevEnd,
      };
    }

    if (timeFilter === "MONTH") {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const prevStart = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1, 0, 0, 0, 0);
      const prevEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0, 23, 59, 59, 999);

      const label = `${MONTH_NAMES[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

      return {
        periodStart: start,
        periodEnd: end,
        periodLabel: label,
        prevPeriodStart: prevStart,
        prevPeriodEnd: prevEnd,
      };
    }

    if (timeFilter === "YEAR") {
      const targetYear = now.getFullYear() + periodOffset;
      const start = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const end = new Date(targetYear, 11, 31, 23, 59, 59, 999);

      const prevStart = new Date(targetYear - 1, 0, 1, 0, 0, 0, 0);
      const prevEnd = new Date(targetYear - 1, 11, 31, 23, 59, 59, 999);

      return {
        periodStart: start,
        periodEnd: end,
        periodLabel: `${targetYear}`,
        prevPeriodStart: prevStart,
        prevPeriodEnd: prevEnd,
      };
    }

    // CUSTOM Range
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate + "T00:00:00");
      const end = new Date(customEndDate + "T23:59:59");
      const diffMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1000);
      const prevStart = new Date(prevEnd.getTime() - diffMs);

      const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endFmt = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return {
        periodStart: start,
        periodEnd: end,
        periodLabel: `${startFmt} – ${endFmt}`,
        prevPeriodStart: prevStart,
        prevPeriodEnd: prevEnd,
      };
    }

    // Fallback: Current month
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      periodStart: start,
      periodEnd: end,
      periodLabel: "Custom Range",
      prevPeriodStart: start,
      prevPeriodEnd: end,
    };
  }, [timeFilter, periodOffset, customStartDate, customEndDate]);

  // ─── Filtered Transactions (Current Period & Previous Period) ─────────────
  const { currentPeriodTxs, prevPeriodTxs } = useMemo(() => {
    const cur: Transaction[] = [];
    const prev: Transaction[] = [];

    transactions.forEach((tx) => {
      if (tx.deleted_at) return;
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;

      if (d >= periodStart && d <= periodEnd) {
        cur.push(tx);
      } else if (d >= prevPeriodStart && d <= prevPeriodEnd) {
        prev.push(tx);
      }
    });

    return { currentPeriodTxs: cur, prevPeriodTxs: prev };
  }, [transactions, periodStart, periodEnd, prevPeriodStart, prevPeriodEnd]);

  // ─── KPI Scorecard Computations ──────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalExpenses = 0;
    let totalIncome = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    currentPeriodTxs.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "Expense") {
        totalExpenses += amt;
        expenseCount++;
      } else if (tx.type === "Income") {
        totalIncome += amt;
        incomeCount++;
      }
    });

    let prevTotalExpenses = 0;
    let prevTotalIncome = 0;
    prevPeriodTxs.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "Expense") prevTotalExpenses += amt;
      else if (tx.type === "Income") prevTotalIncome += amt;
    });

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;

    const expenseDiff = totalExpenses - prevTotalExpenses;
    const expensePctChange =
      prevTotalExpenses > 0 ? (expenseDiff / prevTotalExpenses) * 100 : null;

    const incomeDiff = totalIncome - prevTotalIncome;
    const incomePctChange =
      prevTotalIncome > 0 ? (incomeDiff / prevTotalIncome) * 100 : null;

    // Calculate days in period up to current date or period end
    const now = new Date();
    const effectiveEnd = periodEnd > now ? now : periodEnd;
    const daysElapsed = Math.max(
      1,
      Math.ceil((effectiveEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const dailyAvgSpend = totalExpenses / daysElapsed;

    return {
      totalExpenses,
      expenseCount,
      totalIncome,
      incomeCount,
      netSavings,
      savingsRate,
      expensePctChange,
      incomePctChange,
      dailyAvgSpend,
      daysElapsed,
    };
  }, [currentPeriodTxs, prevPeriodTxs, periodStart, periodEnd]);

  // ─── Category Breakdown Data (Expense or Income) ─────────────────────────
  const breakdownData = useMemo(() => {
    const map: Record<string, { total: number; count: number; txs: Transaction[] }> = {};
    const targetType = breakdownType === "expense" ? "Expense" : "Income";

    currentPeriodTxs.forEach((tx) => {
      if (tx.type !== targetType) return;
      const cat = tx.category || (targetType === "Income" ? "Income" : "General");
      const amt = Number(tx.amount) || 0;

      if (!map[cat]) map[cat] = { total: 0, count: 0, txs: [] };
      map[cat].total += amt;
      map[cat].count += 1;
      map[cat].txs.push(tx);
    });

    const grandTotal = Object.values(map).reduce((acc, c) => acc + c.total, 0);

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        value: data.total,
        count: data.count,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
        color: getCategoryColor(name),
        currency,
        avg: data.count > 0 ? data.total / data.count : 0,
        topTxs: [...data.txs].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3),
      }))
      .sort((a, b) => b.value - a.value);
  }, [currentPeriodTxs, breakdownType, currency]);

  const totalBreakdownAmount = useMemo(
    () => breakdownData.reduce((acc, curr) => acc + curr.value, 0),
    [breakdownData]
  );

  // ─── Top Merchants & Payees Leaderboard ──────────────────────────────────
  const topMerchants = useMemo(() => {
    const map: Record<string, { total: number; count: number; category: string }> = {};

    currentPeriodTxs.forEach((tx) => {
      if (tx.type !== "Expense") return;
      const rawName = (tx.note || tx.category || "General").trim();
      // Clean merchant name
      const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const amt = Number(tx.amount) || 0;

      if (!map[name]) map[name] = { total: 0, count: 0, category: tx.category };
      map[name].total += amt;
      map[name].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        category: data.category,
        pct: kpis.totalExpenses > 0 ? (data.total / kpis.totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [currentPeriodTxs, kpis.totalExpenses]);

  // ─── Day of Week Spending Rhythm ─────────────────────────────────────────
  const weekdaySpending = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    let weekdayTotal = 0;
    let weekendTotal = 0;

    currentPeriodTxs.forEach((tx) => {
      if (tx.type !== "Expense") return;
      const d = new Date(tx.date);
      const day = d.getDay();
      const idx = day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
      const amt = Number(tx.amount) || 0;
      totals[idx] += amt;

      if (idx >= 5) weekendTotal += amt;
      else weekdayTotal += amt;
    });

    const maxVal = Math.max(...totals, 1);
    const data = WEEKDAY_NAMES.map((name, i) => ({
      name,
      amount: totals[i],
      pctOfMax: (totals[i] / maxVal) * 100,
    }));

    const totalSpent = weekdayTotal + weekendTotal;
    const weekendPct = totalSpent > 0 ? Math.round((weekendTotal / totalSpent) * 100) : 0;

    return { data, weekdayTotal, weekendTotal, weekendPct };
  }, [currentPeriodTxs]);

  // ─── Largest Single Purchases ────────────────────────────────────────────
  const largestPurchases = useMemo(() => {
    return currentPeriodTxs
      .filter((tx) => tx.type === "Expense")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 4);
  }, [currentPeriodTxs]);

  // ─── Cash Flow Stacked Trends Chart ──────────────────────────────────────
  const stackedCashFlow = useMemo(() => {
    type CashFlowRow = { name: string } & Record<string, string | number>;
    const data: CashFlowRow[] = [];
    const map: Record<string, CashFlowRow> = {};
    const uniqueCats = new Set<string>();

    const chronologicalTxs = [...currentPeriodTxs].reverse();

    chronologicalTxs.forEach((t) => {
      if (t.type !== "Expense") return;
      const d = new Date(t.date);

      const key =
        timeFilter === "YEAR"
          ? `${d.toLocaleString("default", { month: "short" })}`
          : `${d.getMonth() + 1}/${d.getDate()}`;

      if (!map[key]) {
        map[key] = { name: key };
        data.push(map[key]);
      }
      uniqueCats.add(t.category);
      const prev =
        typeof map[key][t.category] === "number" ? (map[key][t.category] as number) : 0;
      map[key][t.category] = prev + Number(t.amount);
    });

    const categoriesArr = Array.from(uniqueCats);
    const colors = categoriesArr.map((cat) => getCategoryColor(cat));
    return { data, categories: categoriesArr, colors };
  }, [currentPeriodTxs, timeFilter]);

  // ─── Velocity Projection (Month view) ────────────────────────────────────
  const velocityData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const dailySpend: Record<number, number> = {};
    let excludedTotal = 0;
    let excludedCount = 0;
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
      if (t.type !== "Expense" || t.deleted_at) return;
      if (countsTowardVelocity(t)) {
        const day = d.getDate();
        dailySpend[day] = (dailySpend[day] || 0) + Number(t.amount);
      } else {
        excludedTotal += Number(t.amount);
        excludedCount += 1;
      }
    });

    let cumulative = 0;
    const data: { day: number; actual?: number; projected?: number }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= currentDay) {
        cumulative += dailySpend[d] || 0;
        data.push({
          day: d,
          actual: cumulative,
          projected: d === currentDay ? cumulative : undefined,
        });
      } else {
        data.push({ day: d });
      }
    }

    const dailyAvg = currentDay > 0 ? cumulative / currentDay : 0;
    let projCumulative = cumulative;
    for (let d = currentDay + 1; d <= daysInMonth; d++) {
      projCumulative += dailyAvg;
      const existing = data.find((item) => item.day === d);
      if (existing) existing.projected = Math.round(projCumulative * 100) / 100;
    }
    const todayEntry = data.find((item) => item.day === currentDay);
    if (todayEntry) todayEntry.projected = cumulative;

    const projectedTotal = Math.round(dailyAvg * daysInMonth * 100) / 100;

    return {
      data,
      projectedTotal,
      dailyAvg,
      currentDay,
      daysInMonth,
      totalSoFar: cumulative,
      excludedTotal,
      excludedCount,
    };
  }, [transactions]);

  // ─── Available Historic Months ───────────────────────────────────────────
  const availableHistoricMonths = useMemo(() => {
    const map = new Map<string, { year: number; month: number; total: number; count: number }>();
    const now = new Date();

    transactions.forEach((t) => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth();
      if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth()))
        return;

      const key = `${year}-${month}`;
      const prev = map.get(key) || { year, month, total: 0, count: 0 };
      prev.total += Number(t.amount);
      prev.count += 1;
      map.set(key, prev);
    });

    const list = Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    if (list.length > 0) return list;

    const fallbackList = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      fallbackList.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        total: 0,
        count: 0,
      });
    }
    return fallbackList;
  }, [transactions]);

  // Month selector options for quick jumping in Month mode
  const monthPickerOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = -12; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: String(i),
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        badge: i === 0 ? "Current" : undefined,
      });
    }
    return options.reverse();
  }, []);

  // ─── Compare Tab Computations ────────────────────────────────────────────
  const comparisonData = useMemo(() => {
    const now = new Date();
    let labelA = "Period A";
    let labelB = "Period B";
    let startA: Date;
    let endA: Date;
    let startB: Date;
    let endB: Date;

    if (comparePreset === "MONTH") {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      labelA = prevMonth.toLocaleString("default", { month: "short", year: "numeric" });
      labelB = now.toLocaleString("default", { month: "short", year: "numeric" });

      startA = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endA = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      startB = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endB = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (comparePreset === "QUARTER") {
      const q = Math.floor(now.getMonth() / 3);
      const prevQYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevQ = q === 0 ? 3 : q - 1;

      labelA = `Q${prevQ + 1} ${prevQYear}`;
      labelB = `Q${q + 1} ${now.getFullYear()}`;

      startA = new Date(prevQYear, prevQ * 3, 1, 0, 0, 0, 0);
      endA = new Date(prevQYear, (prevQ + 1) * 3, 0, 23, 59, 59, 999);

      startB = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
      endB = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59, 999);
    } else {
      labelA = comparePeriodAStart && comparePeriodAEnd ? `${comparePeriodAStart} – ${comparePeriodAEnd}` : "Period A";
      labelB = comparePeriodBStart && comparePeriodBEnd ? `${comparePeriodBStart} – ${comparePeriodBEnd}` : "Period B";

      startA = comparePeriodAStart ? new Date(comparePeriodAStart + "T00:00:00") : new Date();
      endA = comparePeriodAEnd ? new Date(comparePeriodAEnd + "T23:59:59") : new Date();

      startB = comparePeriodBStart ? new Date(comparePeriodBStart + "T00:00:00") : new Date();
      endB = comparePeriodBEnd ? new Date(comparePeriodBEnd + "T23:59:59") : new Date();
    }

    const catMapA: Record<string, number> = {};
    const catMapB: Record<string, number> = {};
    let totalA = 0;
    let totalB = 0;

    transactions.forEach((t) => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const d = new Date(t.date);
      const amt = Number(t.amount) || 0;

      if (d >= startA && d <= endA) {
        catMapA[t.category] = (catMapA[t.category] || 0) + amt;
        totalA += amt;
      }
      if (d >= startB && d <= endB) {
        catMapB[t.category] = (catMapB[t.category] || 0) + amt;
        totalB += amt;
      }
    });

    const netDiff = totalB - totalA;
    const pctChange = totalA > 0 ? (netDiff / totalA) * 100 : 0;

    const allCats = Array.from(new Set([...Object.keys(catMapA), ...Object.keys(catMapB)]));
    const categoryRows = allCats
      .map((cat) => {
        const costA = catMapA[cat] || 0;
        const costB = catMapB[cat] || 0;
        const delta = costB - costA;
        const pct = costA > 0 ? (delta / costA) * 100 : costB > 0 ? 100 : 0;
        return { category: cat, costA, costB, delta, pct };
      })
      .sort((a, b) => b.delta - a.delta);

    return { labelA, labelB, totalA, totalB, netDiff, pctChange, categoryRows };
  }, [transactions, comparePreset, comparePeriodAStart, comparePeriodAEnd, comparePeriodBStart, comparePeriodBEnd]);

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-[120px] relative min-h-screen overflow-x-hidden">
      {/* ─── Header & Top Tab Switcher ────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            {activeTab === "overview" ? "Financial intelligence & breakdown" : "Period comparison & variance"}
          </p>
        </div>

        <div className="bg-card p-1 rounded-2xl border border-border/50 shadow-soft flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("overview");
              NativeHaptics.lightTick();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "overview"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("compare");
              NativeHaptics.lightTick();
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "compare"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Compare
          </button>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* ─── Filter Pills ──────────────────────────────────────────────── */}
          <div className="bg-card p-1.5 rounded-full border border-border/50 shadow-soft flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar">
            {(["WEEK", "MONTH", "YEAR", "CUSTOM"] as const).map((filter) => {
              const isSelected = timeFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => handleFilterChange(filter)}
                  className={`flex-1 min-w-[70px] py-2 px-3 rounded-full text-xs font-bold transition-all text-center select-none active:scale-95 ${
                    isSelected
                      ? "bg-rose-500 text-white shadow-md font-black scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          {/* ─── Period Navigation Toolbar ─────────────────────────────────── */}
          <div className="bg-card p-3.5 rounded-2xl border border-border/40 shadow-soft flex items-center justify-between gap-3">
            {timeFilter !== "CUSTOM" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodOffset((prev) => prev - 1);
                    NativeHaptics.lightTick();
                  }}
                  className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-95 shrink-0"
                  aria-label="Previous period"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-center min-w-0 flex-1">
                  <p className="text-xs font-black text-foreground truncate">{periodLabel}</p>
                  {periodOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodOffset(0);
                        NativeHaptics.lightTick();
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:underline flex items-center justify-center gap-1 mx-auto mt-0.5"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Back to Current
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {timeFilter === "MONTH" && (
                    <div className="w-32 hidden sm:block">
                      <CustomSelect
                        value={String(periodOffset)}
                        onChange={(val) => {
                          setPeriodOffset(Number(val));
                          NativeHaptics.lightTick();
                        }}
                        options={monthPickerOptions}
                        size="sm"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPeriodOffset((prev) => prev + 1);
                      NativeHaptics.lightTick();
                    }}
                    className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-95 shrink-0"
                    aria-label="Next period"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{periodLabel}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">Custom Range</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold hover:bg-primary/20 transition-all shrink-0 active:scale-95"
                >
                  Change Dates
                </button>
              </div>
            )}
          </div>

          {/* ─── 4 KPI SCORECARDS ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* 1. Total Expenses */}
            <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Total Spent
                </span>
                <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-rose-500 tracking-tight leading-none">
                {formatCurrency(kpis.totalExpenses)}
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] font-semibold text-muted-foreground">
                <span>{kpis.expenseCount} transactions</span>
                {kpis.expensePctChange !== null && (
                  <span
                    className={`font-black ${
                      kpis.expensePctChange > 0
                        ? "text-rose-500"
                        : kpis.expensePctChange < 0
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {kpis.expensePctChange > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(kpis.expensePctChange).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {/* 2. Total Income */}
            <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Income
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-emerald-500 tracking-tight leading-none">
                {formatCurrency(kpis.totalIncome)}
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] font-semibold text-muted-foreground">
                <span>{kpis.incomeCount} credits</span>
                {kpis.incomePctChange !== null && (
                  <span
                    className={`font-black ${
                      kpis.incomePctChange >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {kpis.incomePctChange > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(kpis.incomePctChange).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {/* 3. Net Savings */}
            <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Net Savings
                </span>
                <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-500">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <p
                className={`text-lg font-black tracking-tight leading-none ${
                  kpis.netSavings >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {kpis.netSavings < 0 && "-"}
                {formatCurrency(Math.abs(kpis.netSavings))}
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] font-semibold text-muted-foreground">
                <span>Savings Rate</span>
                <span className="font-black text-foreground">
                  {kpis.savingsRate.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* 4. Daily Average Spend */}
            <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Daily Pace
                </span>
                <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-foreground tracking-tight leading-none">
                {formatCurrency(kpis.dailyAvgSpend)}
                <span className="text-xs font-semibold text-muted-foreground">/day</span>
              </p>
              <div className="flex items-center justify-between pt-1 text-[10px] font-semibold text-muted-foreground">
                <span>Active Period</span>
                <span className="font-black text-foreground">{kpis.daysElapsed} days</span>
              </div>
            </div>
          </div>

          {/* ─── Empty State ──────────────────────────────────────────────── */}
          {currentPeriodTxs.length === 0 && (
            <div className="bg-card rounded-3xl shadow-soft border border-border/40 p-8 text-center space-y-3">
              <p className="text-4xl">📊</p>
              <p className="font-bold text-foreground text-base">No activity in this period</p>
              <p className="text-xs text-muted-foreground font-medium max-w-xs mx-auto">
                No transactions recorded for {periodLabel}. Use the <strong>+</strong> button to add a record or navigate to another timeframe.
              </p>
            </div>
          )}

          {/* ─── Monthly Receipt Shortcuts ─────────────────────────────────── */}
          {transactions.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setReceiptTarget({ year: now.getFullYear(), month: now.getMonth() });
                  setShowReceipt(true);
                  NativeHaptics.lightTick();
                }}
                className="bg-card p-4 rounded-2xl shadow-soft border border-border/40 text-left active:scale-[0.98] transition-all hover:border-amber-500/30"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center mb-2">
                  <Receipt className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Receipt
                </p>
                <p className="text-sm font-bold text-foreground leading-tight mt-0.5">
                  This Month&apos;s Receipt
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsHistoricModalOpen(true);
                  NativeHaptics.lightTick();
                }}
                className="bg-card p-4 rounded-2xl shadow-soft border border-border/40 text-left active:scale-[0.98] transition-all hover:border-amber-500/30"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center mb-2">
                  <Receipt className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Archive
                </p>
                <p className="text-sm font-bold text-foreground leading-tight mt-0.5">
                  Historic Receipts
                </p>
              </button>
            </div>
          )}

          <MonthlyReceiptModal
            isOpen={showReceipt}
            onClose={() => setShowReceipt(false)}
            target={receiptTarget}
          />

          {/* ─── EXPENSE & INCOME BREAKDOWN (DONUT + DEEP DIVE) ─────────────── */}
          <div className="bg-card p-6 rounded-[2.5rem] shadow-heavy border border-border/40 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-foreground text-lg">Category Breakdown</h3>
                <p className="text-xs font-semibold text-muted-foreground">Distribution &amp; shares</p>
              </div>

              {/* Expense vs Income toggle */}
              <div className="bg-muted p-1 rounded-xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setBreakdownType("expense");
                    NativeHaptics.lightTick();
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    breakdownType === "expense"
                      ? "bg-rose-500 text-white shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBreakdownType("income");
                    NativeHaptics.lightTick();
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    breakdownType === "income"
                      ? "bg-emerald-500 text-white shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Income
                </button>
              </div>
            </div>

            {/* Donut Chart */}
            <div className="relative h-[280px] w-full flex items-center justify-center">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Total {breakdownType === "expense" ? "Spent" : "Earned"}
                </span>
                <span className="font-black text-2xl text-foreground mt-0.5">
                  {formatCurrency(totalBreakdownAmount)}
                </span>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie
                    data={breakdownData}
                    innerRadius={78}
                    outerRadius={108}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Category List with Click-to-Expand Deep Dive */}
            <div className="space-y-2.5 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
                <span>Category</span>
                <span>Share &amp; Total</span>
              </div>

              {breakdownData.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground font-medium">
                  No {breakdownType} records in this period.
                </div>
              ) : (
                breakdownData.map((cat) => {
                  const isExpanded = expandedCategory === cat.name;
                  return (
                    <div
                      key={cat.name}
                      className="rounded-2xl bg-muted/30 border border-border/30 overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedCategory(isExpanded ? null : cat.name);
                          NativeHaptics.lightTick();
                        }}
                        className="w-full p-3.5 text-left space-y-2 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs font-bold text-foreground truncate">
                              {cat.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              ({cat.count} tx)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-black text-foreground">
                                {formatCurrency(cat.value)}
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground ml-1.5">
                                ({cat.percentage.toFixed(1)}%)
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </button>

                      {/* Expanded Category Transactions Deep Dive */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-border/20 bg-muted/20 text-xs"
                          >
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold">
                              <span>Average: {formatCurrency(cat.avg)}</span>
                              <span>Top Transactions:</span>
                            </div>

                            <div className="space-y-1.5">
                              {cat.topTxs.map((tx) => (
                                <div
                                  key={tx.id}
                                  className="flex items-center justify-between bg-card p-2 rounded-xl border border-border/30"
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold text-foreground text-xs truncate">
                                      {tx.note || tx.category}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">
                                      {new Date(tx.date).toLocaleDateString()} • {tx.account}
                                    </p>
                                  </div>
                                  <span className="font-black text-foreground shrink-0 text-xs">
                                    {formatCurrency(Number(tx.amount))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── TOP MERCHANTS LEADERBOARD ─────────────────────────────────── */}
          {topMerchants.length > 0 && (
            <div className="bg-card p-6 rounded-[2.5rem] shadow-soft border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-foreground text-base">Top Spending Destinations</h3>
                    <p className="text-[11px] font-semibold text-muted-foreground">Where your money went most</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {topMerchants.map((m, idx) => (
                  <div
                    key={m.name}
                    className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center font-black text-xs text-muted-foreground shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-xs truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          {m.count} purchase{m.count > 1 ? "s" : ""} • {m.category}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-foreground text-xs">
                        {formatCurrency(m.total)}
                      </p>
                      <p className="text-[10px] font-bold text-rose-500">
                        {m.pct.toFixed(1)}% of expenses
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── DAY OF THE WEEK SPENDING RHYTHM ────────────────────────────── */}
          {kpis.totalExpenses > 0 && (
            <div className="bg-card p-6 rounded-[2.5rem] shadow-soft border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-foreground text-base">Spending Rhythm</h3>
                  <p className="text-[11px] font-semibold text-muted-foreground">Daily spending habits</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  {weekdaySpending.weekendPct}% on Weekends
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 pt-2">
                {weekdaySpending.data.map((day) => (
                  <div key={day.name} className="flex flex-col items-center gap-2">
                    <div className="w-full h-24 bg-muted/40 rounded-xl flex items-end p-1 overflow-hidden relative">
                      <div
                        className="w-full rounded-lg bg-rose-500 transition-all duration-500"
                        style={{ height: `${Math.max(8, day.pctOfMax)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black uppercase text-muted-foreground">
                      {day.name}
                    </span>
                    <span className="text-[9px] font-bold text-foreground truncate w-full text-center">
                      RM{Math.round(day.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── LARGEST SINGLE PURCHASES ──────────────────────────────────── */}
          {largestPurchases.length > 0 && (
            <div className="bg-card p-6 rounded-[2.5rem] shadow-soft border border-border/40 space-y-4">
              <div>
                <h3 className="font-black text-foreground text-base">Biggest Purchases</h3>
                <p className="text-[11px] font-semibold text-muted-foreground">Highest ticket items logged</p>
              </div>

              <div className="space-y-2">
                {largestPurchases.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {tx.note || tx.category}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                        {new Date(tx.date).toLocaleDateString()} • {tx.account}
                      </p>
                    </div>

                    <span className="text-sm font-black text-rose-500 shrink-0">
                      -{formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── CASH FLOW TRENDS (Stacked Bar Chart) ──────────────────────── */}
          {stackedCashFlow.data.length > 0 && (
            <div className="bg-card p-6 rounded-[2.5rem] shadow-soft border border-border/40 space-y-4">
              <div>
                <h3 className="font-black text-foreground text-base">Cash Flow Trends</h3>
                <p className="text-[11px] font-semibold text-muted-foreground">Expenses over time</p>
              </div>

              <div className="w-full overflow-x-auto pb-2 hide-scrollbar">
                <div
                  className="h-[240px]"
                  style={{ minWidth: `${Math.max(100, stackedCashFlow.data.length * 50)}px` }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stackedCashFlow.data}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        opacity={0.4}
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }}
                      />
                      <Tooltip
                        content={<BarTooltip />}
                        cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                      />
                      {stackedCashFlow.categories.map((cat, i) => (
                        <Bar
                          key={cat}
                          dataKey={cat}
                          stackId="a"
                          fill={stackedCashFlow.colors[i % stackedCashFlow.colors.length]}
                          radius={
                            i === stackedCashFlow.categories.length - 1
                              ? [4, 4, 0, 0]
                              : [0, 0, 0, 0]
                          }
                          maxBarSize={22}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ─── VELOCITY PROJECTION CHART (Month View) ────────────────────── */}
          {timeFilter === "MONTH" && velocityData.totalSoFar > 0 && (
            <div className="bg-card p-6 rounded-[2.5rem] shadow-soft border border-border/40 space-y-4">
              <div>
                <h3 className="font-bold text-foreground">Spending Velocity</h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  At your current pace of{" "}
                  <span className="font-bold" style={{ color: accentColor }}>
                    {currency} {velocityData.dailyAvg.toFixed(2)}/day
                  </span>
                  , you are projected to spend:
                </p>
                <p className="text-2xl font-black mt-2" style={{ color: accentColor }}>
                  {formatCurrency(velocityData.projectedTotal)}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                  end-of-month projection
                </p>
                <p className="text-[10px] font-medium text-muted-foreground/80 mt-2 leading-snug">
                  {velocityFilterExplainer()}
                </p>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={velocityData.data}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }}
                      interval={4}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 600 }}
                    />
                    <Tooltip content={<VelocityTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke={accentColor}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: accentColor }}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected"
                      stroke={accentColor}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.4}
                      dot={false}
                      activeDot={{ r: 4, fill: accentColor, strokeOpacity: 0.4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span className="text-[10px] font-bold text-muted-foreground">Actual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-0.5 rounded-full opacity-40"
                    style={{ backgroundColor: accentColor, borderTop: "2px dashed" }}
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">Projected</span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ─── COMPARE TAB VIEW ─────────────────────────────────────────────── */
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm">Compare Timeframes</h3>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                Variance Analysis
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "MONTH", label: "Month vs Month" },
                  { id: "QUARTER", label: "Quarter vs Quarter" },
                  { id: "CUSTOM", label: "Custom Range" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setComparePreset(preset.id);
                    NativeHaptics.lightTick();
                  }}
                  className={`py-2 px-2 rounded-2xl text-xs font-bold transition-all text-center border active:scale-95 ${
                    comparePreset === preset.id
                      ? "bg-rose-500 text-white border-rose-500 shadow-md font-black"
                      : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {comparePreset === "CUSTOM" && (
            <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsCompareAModalOpen(true)}
                  className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 text-left hover:border-primary transition-colors"
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Period A
                  </span>
                  <span className="text-xs font-black text-foreground mt-0.5 block">
                    {comparisonData.labelA}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCompareBModalOpen(true)}
                  className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 text-left hover:border-primary transition-colors"
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Period B
                  </span>
                  <span className="text-xs font-black text-foreground mt-0.5 block">
                    {comparisonData.labelB}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* High-Level Comparison Summary */}
          <div className="bg-card p-6 rounded-[2.5rem] border border-border/40 shadow-heavy space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Spend Comparison
              </span>
              <span
                className={`text-xs font-black px-3 py-1 rounded-full ${
                  comparisonData.netDiff > 0
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    : comparisonData.netDiff < 0
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {comparisonData.netDiff > 0
                  ? `+${formatCurrency(comparisonData.netDiff)} (+${comparisonData.pctChange.toFixed(1)}%) 📈`
                  : comparisonData.netDiff < 0
                  ? `-${formatCurrency(Math.abs(comparisonData.netDiff))} (${comparisonData.pctChange.toFixed(1)}%) 📉`
                  : "0.0%"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {comparisonData.labelA}
                </span>
                <p className="text-lg font-black text-foreground mt-0.5">
                  {formatCurrency(comparisonData.totalA)}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {comparisonData.labelB}
                </span>
                <p className="text-lg font-black text-foreground mt-0.5">
                  {formatCurrency(comparisonData.totalB)}
                </p>
              </div>
            </div>
          </div>

          {/* Category Variance Table */}
          <div className="bg-card p-6 rounded-[2.5rem] border border-border/40 shadow-soft space-y-4">
            <h3 className="font-black text-foreground text-base">Category Variance</h3>
            <div className="overflow-x-auto rounded-2xl border border-border/40 hide-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border/40">
                  <tr>
                    <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">
                      Category
                    </th>
                    <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">
                      Period A
                    </th>
                    <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">
                      Period B
                    </th>
                    <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {comparisonData.categoryRows.map((row) => (
                    <tr key={row.category} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: getCategoryColor(row.category) }}
                          />
                          <span className="truncate max-w-[100px]">{row.category}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium text-muted-foreground">
                        {formatCurrency(row.costA)}
                      </td>
                      <td className="p-3 text-right font-semibold text-foreground">
                        {formatCurrency(row.costB)}
                      </td>
                      <td className="p-3 text-right font-black">
                        <span
                          className={
                            row.delta > 0
                              ? "text-rose-500"
                              : row.delta < 0
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          }
                        >
                          {row.delta > 0
                            ? `+${formatCurrency(row.delta)}`
                            : row.delta < 0
                            ? `-${formatCurrency(Math.abs(row.delta))}`
                            : formatCurrency(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {comparisonData.categoryRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center p-6 text-muted-foreground font-semibold">
                        No data found for selected periods.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Range Modals */}
      <CustomDateRangeModal
        isOpen={isCustomModalOpen}
        startDate={customStartDate}
        endDate={customEndDate}
        onClose={() => setIsCustomModalOpen(false)}
        onApply={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
          setIsCustomModalOpen(false);
        }}
      />

      <CustomDateRangeModal
        isOpen={isCompareAModalOpen}
        startDate={comparePeriodAStart}
        endDate={comparePeriodAEnd}
        onClose={() => setIsCompareAModalOpen(false)}
        onApply={(start, end) => {
          setComparePeriodAStart(start);
          setComparePeriodAEnd(end);
          setIsCompareAModalOpen(false);
        }}
      />

      <CustomDateRangeModal
        isOpen={isCompareBModalOpen}
        startDate={comparePeriodBStart}
        endDate={comparePeriodBEnd}
        onClose={() => setIsCompareBModalOpen(false)}
        onApply={(start, end) => {
          setComparePeriodBStart(start);
          setComparePeriodBEnd(end);
          setIsCompareBModalOpen(false);
        }}
      />

      {/* Historic Receipts Selection Modal */}
      <AnimatePresence>
        {isHistoricModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoricModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-sm bg-card border border-border/70 rounded-3xl shadow-heavy p-5 space-y-4 text-foreground overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <h3 className="font-black text-foreground text-base">Historic Receipts</h3>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                    Select a month to view or export receipt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoricModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 hide-scrollbar">
                {availableHistoricMonths.map((item) => {
                  const now = new Date();
                  const label = `${MONTH_NAMES[item.month]} ${item.year}`;
                  const isCurrent =
                    item.year === now.getFullYear() && item.month === now.getMonth();

                  return (
                    <button
                      key={`${item.year}-${item.month}`}
                      type="button"
                      onClick={() => {
                        setIsHistoricModalOpen(false);
                        setReceiptTarget({ year: item.year, month: item.month });
                        setShowReceipt(true);
                        NativeHaptics.lightTick();
                      }}
                      className="w-full p-3 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/40 flex items-center justify-between transition-colors text-left group active:scale-95"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-xs">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            {label}
                            {isCurrent && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                            {item.count > 0 ? `${item.count} expenses logged` : "No expenses"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-foreground">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsHistoricModalOpen(false)}
                className="w-full py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
