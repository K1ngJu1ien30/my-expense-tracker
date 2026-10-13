"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";
import { useAppContext } from "@/lib/context";
import { roundCurrency } from "@/lib/utils";

export default function FoodBudgetCard() {
  const { currency, transactions, foodDailyLimit, foodMonthlyLimit, accentColor } = useAppContext();

  const { spentToday, spentThisMonth } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;
    let daily = 0;
    let monthly = 0;

    transactions.forEach(tx => {
      if (tx.type !== "Expense") return;
      if (!tx.category?.toLowerCase().includes("food")) return;
      const d = new Date(tx.date);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        monthly += Number(tx.amount || 0);
        const txTime = d.getTime();
        if (txTime >= startOfToday && txTime < startOfTomorrow) {
          daily += Number(tx.amount || 0);
        }
      }
    });

    return { spentToday: roundCurrency(daily), spentThisMonth: roundCurrency(monthly) };
  }, [transactions]);

  const dailyRemaining = roundCurrency(foodDailyLimit - spentToday);
  const monthlyRemaining = roundCurrency(foodMonthlyLimit - spentThisMonth);
  const dailyPct = foodDailyLimit > 0 ? Math.min((spentToday / foodDailyLimit) * 100, 100) : 0;
  const monthlyPct = foodMonthlyLimit > 0 ? Math.min((spentThisMonth / foodMonthlyLimit) * 100, 100) : 0;

  const getBarColor = (pct: number) => {
    if (pct >= 100) return "bg-rose-500";
    if (pct >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="bg-card p-6 rounded-3xl shadow-soft border border-border/40 space-y-5">
      <div className="flex items-center gap-3">
        <div style={{ backgroundColor: `${accentColor}1A` }} className="p-3 rounded-2xl">
          <UtensilsCrossed style={{ color: accentColor }} className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight">Food Budget</h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Track your daily & monthly food spending</p>
        </div>
      </div>

      {/* Daily Budget */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Daily</span>
          <span className={`text-sm font-black ${dailyRemaining < 0 ? "text-rose-500" : "text-foreground"}`}>
            {currency} {Math.abs(dailyRemaining).toFixed(2)}{" "}
            <span className="text-muted-foreground font-medium text-xs">
              {dailyRemaining < 0 ? "over budget" : "remaining"}
            </span>
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dailyPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${getBarColor(dailyPct)}`}
          />
        </div>
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>Spent: {currency} {spentToday.toFixed(2)}</span>
          <span>Limit: {currency} {foodDailyLimit.toFixed(2)}</span>
        </div>
      </div>

      {/* Monthly Budget */}
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly</span>
          <span className={`text-sm font-black ${monthlyRemaining < 0 ? "text-rose-500" : "text-foreground"}`}>
            {currency} {Math.abs(monthlyRemaining).toFixed(2)}{" "}
            <span className="text-muted-foreground font-medium text-xs">
              {monthlyRemaining < 0 ? "over budget" : "remaining"}
            </span>
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${monthlyPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${getBarColor(monthlyPct)}`}
          />
        </div>
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>Spent: {currency} {spentThisMonth.toFixed(2)}</span>
          <span>Limit: {currency} {foodMonthlyLimit.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
