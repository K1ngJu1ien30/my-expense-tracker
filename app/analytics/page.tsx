"use client";

import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppContext } from "@/lib/context";
import { Sparkles, Receipt, Calendar as CalendarIcon, Filter, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MonthlyReceiptModal from "@/components/MonthlyReceiptModal";
import CustomDateRangeModal from "@/components/CustomDateRangeModal";
import type { ReceiptMonth } from "@/lib/receiptData";
import { NativeHaptics } from "@/lib/haptics";
import { countsTowardVelocity, velocityFilterExplainer } from "@/lib/velocity";
import { getCategoryColor } from "@/lib/utils";

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
    const pct = first.payload?.percentage !== undefined ? Number(first.payload.percentage).toFixed(1) : "0";
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[150px]">
        <p className="text-xs font-bold text-muted-foreground mb-1.5 pb-1 border-b border-border/40">{name}</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-black text-foreground">{pct}%</span>
          </div>
          <span className="text-xs font-black text-red-500">
            {first.payload?.currency || 'RM'} {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-3 text-white min-w-[150px]">
        <p className="text-xs font-bold text-slate-400 mb-2 pb-1.5 border-b border-slate-800">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
                <span className="text-xs font-semibold text-slate-300 truncate">{entry.dataKey}</span>
              </div>
              <span className="text-xs font-black text-white shrink-0">{entry.payload?.currency || ''} {Number(entry.value).toFixed(2)}</span>
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
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[130px]">
        <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">Day {label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.stroke || entry.color }} />
            <span className="text-xs font-black text-foreground">{entry.payload?.currency || ''} {Number(entry.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const IncomeTooltip = ({ active, payload, label, formatCurrency }: TooltipProps & { formatCurrency: (n: number) => string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy p-3 min-w-[130px]">
      <p className="text-xs font-bold text-muted-foreground mb-2 pb-2 border-b border-border/50">{label}</p>
      <span className="text-sm font-black text-emerald-500">{formatCurrency(Number(payload[0].value))}</span>
    </div>
  );
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatRangeLabel = (startStr: string, endStr: string, fallback: string) => {
  if (!startStr || !endStr) return fallback;
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return fallback;
  const startFmt = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endFmt = e.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startFmt} - ${endFmt}`;
};

export default function AnalyticsPage() {
  const now = new Date();
  const {
    accentColor, transactions,
    accounts, currency, formatCurrency
  } = useAppContext();

  // Filter state: WEEK | MONTH | YEAR | CUSTOM
  const [timeFilter, setTimeFilter] = useState<"WEEK" | "MONTH" | "YEAR" | "CUSTOM">("MONTH");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Active Tab state: OVERVIEW vs COMPARE
  const [activeTab, setActiveTab] = useState<"overview" | "compare">("overview");

  // Compare Tab state
  const [comparePreset, setComparePreset] = useState<"MONTH" | "QUARTER" | "CUSTOM">("MONTH");
  const [comparePeriodAStart, setComparePeriodAStart] = useState<string>("");
  const [comparePeriodAEnd, setComparePeriodAEnd] = useState<string>("");
  const [comparePeriodBStart, setComparePeriodBStart] = useState<string>("");
  const [comparePeriodBEnd, setComparePeriodBEnd] = useState<string>("");

  // Custom Date Picker Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isCompareAModalOpen, setIsCompareAModalOpen] = useState(false);
  const [isCompareBModalOpen, setIsCompareBModalOpen] = useState(false);
  const [isHistoricModalOpen, setIsHistoricModalOpen] = useState(false);

  // Monthly Receipt trigger state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<ReceiptMonth | undefined>(undefined);

  const availableHistoricMonths = useMemo(() => {
    const map = new Map<string, { year: number; month: number; total: number; count: number }>();
    const now = new Date();
    
    transactions.forEach(t => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth();
      if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())) return;

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

  const openCurrentMonthReceipt = () => {
    const now = new Date();
    setReceiptTarget({ year: now.getFullYear(), month: now.getMonth() });
    setShowReceipt(true);
  };

  const openLastMonthReceipt = () => {
    const now = new Date();
    setReceiptTarget({
      year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      month: now.getMonth() === 0 ? 11 : now.getMonth() - 1,
    });
    setShowReceipt(true);
  };

  // Date Range Filtering
  const filteredTxs = useMemo(() => {
    const now = new Date();

    if (timeFilter === "WEEK") {
      const startOfWeek = new Date(now);
      const day = now.getDay() || 7;
      startOfWeek.setDate(now.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      return transactions.filter(t => {
        const d = new Date(t.date);
        return d >= startOfWeek && d <= now;
      });
    }

    if (timeFilter === "MONTH") {
      return transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }

    if (timeFilter === "YEAR") {
      return transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
    }

    if (timeFilter === "CUSTOM") {
      if (!customStartDate || !customEndDate) return transactions;
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);

      return transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
    }

    return transactions;
  }, [transactions, timeFilter, customStartDate, customEndDate]);

  // Expense Breakdown (Pie Chart Data) with Solid Red Fill Shades
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTxs.forEach(t => {
      if (t.type !== "Expense" || t.deleted_at) return;
      map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });

    const total = Object.values(map).reduce((acc, curr) => acc + curr, 0);

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: getCategoryColor(name),
        currency
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTxs, currency]);

  const totalExpense = useMemo(() => categoryData.reduce((acc, curr) => acc + curr.value, 0), [categoryData]);

  const dateRangeLabel = useMemo(() => {
    const now = new Date();
    if (timeFilter === "WEEK") return "Current Week";
    if (timeFilter === "MONTH") return now.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (timeFilter === "YEAR") return now.getFullYear().toString();
    if (timeFilter === "CUSTOM") {
      if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
      return "Custom Range";
    }
    return "All Time";
  }, [timeFilter, customStartDate, customEndDate]);

  // Cash flow stacked data
  const stackedCashFlow = useMemo(() => {
    type CashFlowRow = { name: string } & Record<string, string | number>;
    const data: CashFlowRow[] = [];
    const map: Record<string, CashFlowRow> = {};
    const uniqueCats = new Set<string>();
    
    const chronologicalTxs = [...filteredTxs].reverse();

    chronologicalTxs.forEach(t => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const d = new Date(t.date);
      
      const key = (timeFilter === "YEAR") 
        ? `${d.toLocaleString('default', { month: 'short' })} '${d.getFullYear().toString().slice(2)}`
        : `${d.getMonth()+1}/${d.getDate()}`;
            
      if (!map[key]) {
        map[key] = { name: key };
        data.push(map[key]);
      }
      uniqueCats.add(t.category);
      const prev = typeof map[key][t.category] === "number" ? (map[key][t.category] as number) : 0;
      map[key][t.category] = prev + Number(t.amount);
    });
    
    const categoriesArr = Array.from(uniqueCats);
    const colors = categoriesArr.map(cat => getCategoryColor(cat));
    return { data, categories: categoriesArr, colors };
  }, [filteredTxs, timeFilter]);

  // Smart Insights
  const smartInsightText = useMemo(() => {
    if (!transactions || transactions.length === 0) return "Start tracking to uncover your financial habits!";

    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
    const startOfLastWeek = startOfThisWeek - 7 * 86400000;

    const thisWeekExpenses: Record<string, number> = {};
    let thisWeekTotal = 0;
    let lastWeekTotal = 0;

    transactions.forEach(t => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const txTime = new Date(t.date).getTime();
      const amt = Number(t.amount);
      if (txTime >= startOfThisWeek) {
        thisWeekTotal += amt;
        const cat = t.category || "Other";
        thisWeekExpenses[cat] = (thisWeekExpenses[cat] || 0) + amt;
      } else if (txTime >= startOfLastWeek && txTime < startOfThisWeek) {
        lastWeekTotal += amt;
      }
    });

    if (lastWeekTotal === 0 && thisWeekTotal === 0) return "No spending data for the last two weeks yet.";
    if (lastWeekTotal === 0) return `You've spent ${formatCurrency(thisWeekTotal)} this week. Keep it up!`;

    const pctChange = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
    const topCategory = Object.entries(thisWeekExpenses).sort((a, b) => b[1] - a[1])[0];
    const direction = pctChange > 0 ? "more" : "less";
    const topCatStr = topCategory ? `, primarily driven by ${topCategory[0]}` : "";

    if (Math.abs(pctChange) < 2) return `Your spending is steady this week — almost identical to last week.`;
    return `You spent ${Math.abs(pctChange).toFixed(0)}% ${direction} this week${topCatStr}.`;
  }, [transactions, formatCurrency]);

  // Velocity projection
  const velocityData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const dailySpend: Record<number, number> = {};
    let excludedTotal = 0;
    let excludedCount = 0;
    transactions.forEach(t => {
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
        data.push({ day: d, actual: cumulative, projected: d === currentDay ? cumulative : undefined });
      } else {
        data.push({ day: d });
      }
    }

    const dailyAvg = currentDay > 0 ? cumulative / currentDay : 0;
    let projCumulative = cumulative;
    for (let d = currentDay + 1; d <= daysInMonth; d++) {
      projCumulative += dailyAvg;
      const existing = data.find(item => item.day === d);
      if (existing) existing.projected = Math.round(projCumulative * 100) / 100;
    }
    const todayEntry = data.find(item => item.day === currentDay);
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

  // Income by Account
  const incomeByAccount = useMemo(() => {
    const incomeTxs = filteredTxs.filter(t => t.type === "Income" && !t.deleted_at);
    const map: Record<string, number> = {};
    incomeTxs.forEach(t => {
      const acc = t.account || "Unknown";
      map[acc] = (map[acc] || 0) + Number(t.amount);
    });
    return Object.entries(map)
      .map(([account, amount]) => ({ account, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxs]);

  // ─── Compare Tab Variance & Period Analysis Derivation ──────────────────────
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
      labelA = comparePeriodAStart && comparePeriodAEnd ? formatRangeLabel(comparePeriodAStart, comparePeriodAEnd, "Period A") : "Period A";
      labelB = comparePeriodBStart && comparePeriodBEnd ? formatRangeLabel(comparePeriodBStart, comparePeriodBEnd, "Period B") : "Period B";

      if (comparePeriodAStart) {
        startA = new Date(comparePeriodAStart + "T00:00:00");
      } else {
        startA = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      }

      if (comparePeriodAEnd) {
        endA = new Date(comparePeriodAEnd + "T23:59:59.999");
      } else {
        endA = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      }

      if (comparePeriodBStart) {
        startB = new Date(comparePeriodBStart + "T00:00:00");
      } else {
        startB = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }

      if (comparePeriodBEnd) {
        endB = new Date(comparePeriodBEnd + "T23:59:59.999");
      } else {
        endB = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }
    }

    const txsA = transactions.filter(t => {
      if (t.type !== "Expense" || t.deleted_at) return false;
      const d = new Date(t.date);
      return d >= startA && d <= endA;
    });

    const txsB = transactions.filter(t => {
      if (t.type !== "Expense" || t.deleted_at) return false;
      const d = new Date(t.date);
      return d >= startB && d <= endB;
    });

    const totalA = txsA.reduce((s, t) => s + Number(t.amount), 0);
    const totalB = txsB.reduce((s, t) => s + Number(t.amount), 0);
    const netDiff = totalB - totalA;
    const pctChange = totalA > 0 ? (netDiff / totalA) * 100 : (totalB > 0 ? 100 : 0);

    const catMapA: Record<string, number> = {};
    const catMapB: Record<string, number> = {};
    const allCategories = new Set<string>();

    txsA.forEach(t => {
      catMapA[t.category] = (catMapA[t.category] || 0) + Number(t.amount);
      allCategories.add(t.category);
    });

    txsB.forEach(t => {
      catMapB[t.category] = (catMapB[t.category] || 0) + Number(t.amount);
      allCategories.add(t.category);
    });

    const categoryRows = Array.from(allCategories).map(cat => {
      const costA = catMapA[cat] || 0;
      const costB = catMapB[cat] || 0;
      const delta = costB - costA;
      const pct = costA > 0 ? (delta / costA) * 100 : (costB > 0 ? 100 : 0);
      return { category: cat, costA, costB, delta, pct };
    }).sort((a, b) => b.delta - a.delta); // Sort by largest spending increases at top!

    const positiveDrivers = categoryRows.filter(r => r.delta > 0);
    const totalPositiveDelta = positiveDrivers.reduce((s, r) => s + r.delta, 0);

    const topDrivers = positiveDrivers.slice(0, 3).map(driver => {
      const shareOfGrowth = totalPositiveDelta > 0 ? (driver.delta / totalPositiveDelta) * 100 : 0;
      const categoryTxsB = txsB.filter(t => t.category === driver.category);

      let largestTx: typeof transactions[0] | null = null;
      categoryTxsB.forEach(t => {
        if (!largestTx || Number(t.amount) > Number(largestTx.amount)) {
          largestTx = t;
        }
      });

      const largestAmt = largestTx ? Number((largestTx as any).amount) : 0;
      const largestName = largestTx ? ((largestTx as any).merchant || (largestTx as any).description || (largestTx as any).note || "").trim() : "";

      const merchantMap: Record<string, { count: number; total: number }> = {};
      categoryTxsB.forEach(t => {
        const name = ((t as any).merchant || (t as any).description || (t as any).note || "").trim();
        if (!name) return;
        if (!merchantMap[name]) merchantMap[name] = { count: 0, total: 0 };
        merchantMap[name].count += 1;
        merchantMap[name].total += Number(t.amount);
      });

      let topMerchant: { name: string; count: number; total: number } | null = null;
      Object.entries(merchantMap).forEach(([name, data]) => {
        if (!topMerchant || data.count > topMerchant.count || (data.count === topMerchant.count && data.total > topMerchant.total)) {
          topMerchant = { name, ...data };
        }
      });

      let insightText = "";
      const deltaFormatted = formatCurrency(driver.delta);
      const pctFormatted = driver.pct.toFixed(0);

      if (largestTx && largestName && (largestAmt >= 0.35 * driver.delta || categoryTxsB.length === 1)) {
        insightText = `${driver.category} increased by ${deltaFormatted} (+${pctFormatted}%), primarily driven by a ${formatCurrency(largestAmt)} transaction at ${largestName}.`;
      } else if (topMerchant && (topMerchant as any).count >= 2) {
        insightText = `${driver.category} increased by ${deltaFormatted} (+${pctFormatted}%), heavily driven by ${(topMerchant as any).count} repeated transactions at ${(topMerchant as any).name}.`;
      } else {
        const count = categoryTxsB.length || 1;
        insightText = `${driver.category} increased by ${deltaFormatted} (+${pctFormatted}%), distributed across ${count} regular payment${count > 1 ? "s" : ""}.`;
      }

      return {
        ...driver,
        shareOfGrowth,
        insightText,
      };
    });

    return {
      labelA,
      labelB,
      totalA,
      totalB,
      netDiff,
      pctChange,
      categoryRows,
      topDrivers,
      totalPositiveDelta
    };
  }, [transactions, comparePreset, comparePeriodAStart, comparePeriodAEnd, comparePeriodBStart, comparePeriodBEnd]);

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-[120px] relative min-h-screen overflow-x-hidden">
      
      {/* Header & Tab View Switcher */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            {activeTab === "overview" ? (
              <>Range: <span className="text-foreground font-bold">{dateRangeLabel}</span></>
            ) : (
              <>Period Comparison &amp; Variance Insights</>
            )}
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
          {/* Pill-Shaped Filter Control Bar */}
      <div className="bg-card p-1.5 rounded-full border border-border/50 shadow-soft flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar">
        {(["WEEK", "MONTH", "YEAR", "CUSTOM"] as const).map(filter => {
          const isSelected = timeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setTimeFilter(filter);
                NativeHaptics.lightTick();
              }}
              className={`flex-1 min-w-[70px] py-2 px-3 rounded-full text-xs font-bold transition-all text-center select-none ${
                isSelected
                  ? "bg-rose-500 text-white shadow-md scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground bg-transparent"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Custom Date Selector Trigger Card */}
      {timeFilter === "CUSTOM" && (
        <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-500" />
              Custom Date Range
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCustomModalOpen(true);
                NativeHaptics.lightTick();
              }}
              className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {customStartDate && customEndDate ? "Change Range" : "Select Range"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsCustomModalOpen(true);
                NativeHaptics.lightTick();
              }}
              className="p-3 rounded-2xl bg-muted/40 border border-border/50 text-left hover:border-emerald-500/50 transition-colors"
            >
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Start Date</span>
              <span className="text-xs font-black text-foreground mt-0.5 block">
                {customStartDate || "Select..."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCustomModalOpen(true);
                NativeHaptics.lightTick();
              }}
              className="p-3 rounded-2xl bg-muted/40 border border-border/50 text-left hover:border-emerald-500/50 transition-colors"
            >
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">End Date</span>
              <span className="text-xs font-black text-foreground mt-0.5 block">
                {customEndDate || "Select..."}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 && (
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 p-8 text-center space-y-3">
          <p className="text-5xl">📈</p>
          <p className="font-bold text-foreground text-lg">No data yet</p>
          <p className="text-sm text-muted-foreground font-medium">Start logging transactions with the <strong>+</strong> button to see spending breakdowns, trends, and smart insights here.</p>
        </div>
      )}

      {/* Smart Insights Banner */}
      <div style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}30` }} className="border p-4 rounded-2xl flex items-start gap-4">
        <div style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}60` }} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 pb-0.5 shadow-soft text-white">
          <Sparkles className="w-5 h-5"/>
        </div>
        <div className="flex-1 pr-2">
          <p style={{ color: accentColor }} className="text-xs font-black uppercase tracking-wider mb-1">Smart Insights</p>
          <p className="text-sm font-semibold text-foreground/90 leading-snug">{smartInsightText}</p>
        </div>
      </div>

      {/* Monthly Receipt trigger cards */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={openCurrentMonthReceipt}
            aria-label="Generate this month's receipt"
            className="bg-card p-4 rounded-2xl shadow-soft border border-border/40 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center mb-2">
              <Receipt className="w-4 h-4 text-amber-500" aria-hidden="true" />
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
            aria-label="Browse historic receipts"
            className="bg-card p-4 rounded-2xl shadow-soft border border-border/40 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center mb-2">
              <Receipt className="w-4 h-4 text-amber-500" aria-hidden="true" />
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

      {/* ─── EXPENSE BREAKDOWN VIEW (LARGE CENTERED RED PIE CHART) ──────────── */}
      <div className="bg-card p-6 rounded-[2.5rem] shadow-heavy border border-border/40 relative space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-foreground text-lg">Expense Breakdown</h3>
            <p className="text-xs font-semibold text-muted-foreground">Distribution by category</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
            {categoryData.length} Categories
          </span>
        </div>

        {/* Large Centered Pie Chart */}
        <div className="relative h-[280px] w-full flex items-center justify-center">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Spent</span>
            <span className="font-black text-2xl text-foreground mt-0.5">{formatCurrency(totalExpense)}</span>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Pie
                data={categoryData}
                innerRadius={75}
                outerRadius={105}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category List under Pie Chart with Percentage & RM Amount */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
            <span>Category</span>
            <span>Share & Total</span>
          </div>

          {categoryData.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground font-medium">
              No expenses recorded for this period.
            </div>
          ) : (
            categoryData.map((cat) => (
              <div
                key={cat.name}
                className="p-3.5 rounded-2xl bg-muted/30 border border-border/30 space-y-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-bold text-foreground truncate">{cat.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-foreground">{formatCurrency(cat.value)}</span>
                    <span className="text-[11px] font-bold text-rose-500 ml-2">
                      ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Progress bar visual for category share */}
                <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40">
        <h3 className="font-bold text-foreground mb-6">Cash Flow Trends</h3>
        <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
          <div className="h-[250px]" style={{ minWidth: `${Math.max(100, stackedCashFlow.data.length * 60)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedCashFlow.data} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                  interval="preserveStartEnd"
                  angle={-25}
                  textAnchor="end"
                  height={40}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <Tooltip 
                  content={<BarTooltip />}
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                  wrapperStyle={{ zIndex: 1000 }}
                  allowEscapeViewBox={{ x: true, y: true }}
                />
                {stackedCashFlow.categories.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={stackedCashFlow.colors[i % stackedCashFlow.colors.length]} radius={ i === stackedCashFlow.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0] } maxBarSize={20} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Income by Account Chart */}
      {incomeByAccount.length > 0 && (
        <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40 space-y-4">
          <div>
            <h3 className="font-bold text-foreground">Income by Account</h3>
            <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mt-1">
              Total: {formatCurrency(incomeByAccount.reduce((s, a) => s + a.amount, 0))} • {dateRangeLabel}
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeByAccount} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="account" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <Tooltip
                  content={
                    <IncomeTooltip formatCurrency={formatCurrency} />
                  }
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            {incomeByAccount.map((entry, i) => (
              <div key={entry.account} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" style={{ opacity: 1 - i * 0.15 }} />
                <div>
                  <p className="text-[10px] font-bold text-foreground leading-none">{entry.account}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{formatCurrency(entry.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Velocity Projection Chart */}
      {timeFilter === "MONTH" && velocityData.totalSoFar > 0 && (
        <div className="bg-card p-6 rounded-[2rem] shadow-soft border border-border/40 space-y-4">
          <div>
            <h3 className="font-bold text-foreground">Spending Velocity</h3>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              At your current pace of <span className="font-bold" style={{ color: accentColor }}>{currency} {velocityData.dailyAvg.toFixed(2)}/day</span>, you are projected to spend:
            </p>
            <p className="text-2xl font-black mt-2" style={{ color: accentColor }}>
              {formatCurrency(velocityData.projectedTotal)}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">end-of-month projection</p>
            <p className="text-[10px] font-medium text-muted-foreground/80 mt-3 leading-snug">
              {velocityData.excludedCount > 0 ? (
                <>
                  <span className="font-bold text-foreground/70">{formatCurrency(velocityData.excludedTotal)}</span>{" "}
                  ({velocityData.excludedCount} tx) excluded this month. {velocityFilterExplainer()}
                </>
              ) : (
                velocityFilterExplainer()
              )}
            </p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={velocityData.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                  interval={4}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                <Tooltip content={<VelocityTooltip />} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={accentColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: accentColor }}
                  connectNulls={false}
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
                  connectNulls={false}
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
              <div className="w-6 h-0.5 rounded-full opacity-40" style={{ backgroundColor: accentColor, borderTop: '2px dashed' }} />
              <span className="text-[10px] font-bold text-muted-foreground">Projected</span>
            </div>
          </div>
        </div>
      )}
        </>
      ) : (
        /* ─── COMPARE TAB VIEW ───────────────────────────────────────────────── */
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* 1. Comparison Header & Preset Selector */}
          <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm">Compare Timeframes</h3>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                Variance Analysis
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "MONTH", label: "Month vs Month" },
                { id: "QUARTER", label: "Quarter vs Quarter" },
                { id: "CUSTOM", label: "Custom Range" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setComparePreset(preset.id as any);
                    NativeHaptics.lightTick();
                  }}
                  className={`py-2 px-2 rounded-2xl text-xs font-bold transition-all text-center border ${
                    comparePreset === preset.id
                      ? "bg-rose-500 text-white border-rose-500 shadow-md scale-[1.02]"
                      : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Selection Controls for Compare Tab */}
          {comparePreset === "CUSTOM" && (
            <div className="bg-card p-4 rounded-3xl border border-border/40 shadow-soft space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <CalendarIcon className="w-3.5 h-3.5 text-rose-500" />
                Custom Compare Ranges
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Period A Selector Card */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Period A Range</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareAModalOpen(true);
                        NativeHaptics.lightTick();
                      }}
                      className="text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {comparePeriodAStart && comparePeriodAEnd ? "Change Period A" : "Set Period A"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareAModalOpen(true);
                        NativeHaptics.lightTick();
                      }}
                      className="p-2.5 rounded-xl bg-background/60 border border-border/40 hover:border-rose-500/50 transition-colors text-left"
                    >
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Start Date</span>
                      <span className="text-xs font-black text-foreground mt-0.5 block">{comparePeriodAStart || "Select..."}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareAModalOpen(true);
                        NativeHaptics.lightTick();
                      }}
                      className="p-2.5 rounded-xl bg-background/60 border border-border/40 hover:border-rose-500/50 transition-colors text-left"
                    >
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">End Date</span>
                      <span className="text-xs font-black text-foreground mt-0.5 block">{comparePeriodAEnd || "Select..."}</span>
                    </button>
                  </div>
                </div>

                {/* Period B Selector Card */}
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Period B Range</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareBModalOpen(true);
                        NativeHaptics.lightTick();
                      }}
                      className="text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {comparePeriodBStart && comparePeriodBEnd ? "Change Period B" : "Set Period B"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareBModalOpen(true);
                        NativeHaptics.lightTick();
                      }}
                      className="p-2.5 rounded-xl bg-background/60 border border-border/40 hover:border-rose-500/50 transition-colors text-left"
                    >
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Start Date</span>
                      <span className="text-xs font-black text-foreground mt-0.5 block">{comparePeriodBStart || "Select..."}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCompareBModalOpen(true);
                        NativeHaptics.lightTick();
                      }}
                      className="p-2.5 rounded-xl bg-background/60 border border-border/40 hover:border-rose-500/50 transition-colors text-left"
                    >
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">End Date</span>
                      <span className="text-xs font-black text-foreground mt-0.5 block">{comparePeriodBEnd || "Select..."}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. High-Level Summary Card */}
          <div className="bg-card p-6 rounded-[2.5rem] border border-border/40 shadow-heavy space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Total Spend Comparison
              </span>
              <span className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 ${
                comparisonData.netDiff > 0
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  : comparisonData.netDiff < 0
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-muted text-muted-foreground"
              }`}>
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
                  Period A: {comparisonData.labelA}
                </span>
                <p className="text-lg font-black text-foreground mt-0.5">
                  {formatCurrency(comparisonData.totalA)}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Period B: {comparisonData.labelB}
                </span>
                <p className="text-lg font-black text-foreground mt-0.5">
                  {formatCurrency(comparisonData.totalB)}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Net Variance ($\Delta$)</span>
              <span className={`text-base font-black ${
                comparisonData.netDiff > 0 ? "text-rose-500" : comparisonData.netDiff < 0 ? "text-emerald-500" : "text-foreground"
              }`}>
                {comparisonData.netDiff > 0 ? `+${formatCurrency(comparisonData.netDiff)}` : comparisonData.netDiff < 0 ? `-${formatCurrency(Math.abs(comparisonData.netDiff))}` : formatCurrency(0)}
              </span>
            </div>
          </div>

          {/* 3. Top Spending Drivers Insight Card */}
          <div className="bg-card p-6 rounded-[2.5rem] border border-border/40 shadow-soft space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-base">Top Spending Drivers</h3>
                <p className="text-[11px] font-semibold text-muted-foreground">Categories driving expense growth</p>
              </div>
            </div>

            {comparisonData.topDrivers.length > 0 ? (
              <div className="space-y-3 pt-1">
                {comparisonData.topDrivers.map((driver) => (
                  <div key={driver.category} className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(driver.category) }} />
                        <span className="font-bold text-sm text-foreground">{driver.category}</span>
                      </div>
                      <span className="text-xs font-black text-rose-500">
                        +{formatCurrency(driver.delta)} (+{driver.pct.toFixed(1)}%)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                      {driver.insightText}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <p className="text-xs font-bold text-emerald-400">Great Financial Discipline! 🎉</p>
                <p className="text-xs text-muted-foreground font-medium">
                  Your overall spending did not increase in Period B compared to Period A. No category contributed to expense growth.
                </p>
              </div>
            )}
          </div>

          {/* 4. Category Comparison Table */}
          <div className="bg-card p-6 rounded-[2.5rem] border border-border/40 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-foreground text-base">Category Comparison</h3>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Sorted by Highest Increase
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/40 hide-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border/40">
                  <tr>
                    <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Period A</th>
                    <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Period B</th>
                    <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Variance ($\Delta$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {comparisonData.categoryRows.map((row) => (
                    <tr key={row.category} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(row.category) }} />
                          <span className="truncate max-w-[100px]">{row.category}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium text-muted-foreground">{formatCurrency(row.costA)}</td>
                      <td className="p-3 text-right font-semibold text-foreground">{formatCurrency(row.costB)}</td>
                      <td className="p-3 text-right font-black">
                        <span className={row.delta > 0 ? "text-rose-500" : row.delta < 0 ? "text-emerald-500" : "text-muted-foreground"}>
                          {row.delta > 0 ? `+${formatCurrency(row.delta)}` : row.delta < 0 ? `-${formatCurrency(Math.abs(row.delta))}` : formatCurrency(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {comparisonData.categoryRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center p-6 text-muted-foreground font-semibold">
                        No category expense data found for selected periods.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Range Picker Modal for Overview */}
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

      {/* Custom Date Range Modal for Compare Period A */}
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

      {/* Custom Date Range Modal for Compare Period B */}
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
              className="relative z-10 w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-5 space-y-4 text-white overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-black text-white text-base">Historic Receipts</h3>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    Select a month to view or export receipt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoricModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 hide-scrollbar">
                {availableHistoricMonths.map(item => {
                  const label = `${MONTH_NAMES[item.month]} ${item.year}`;
                  const isCurrent = item.year === now.getFullYear() && item.month === now.getMonth();

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
                      className="w-full p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-xs">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            {label}
                            {isCurrent && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Current</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {item.count > 0 ? `${item.count} expenses logged` : "No expenses"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-amber-400">
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
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
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
