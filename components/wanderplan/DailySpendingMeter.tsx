"use client";

import { useMemo } from "react";
import { useAppContext } from "@/lib/context";
import { isToday, parseISO } from "date-fns";
import type { WPTrip } from "@/lib/types";

/**
 * Daily spending meter for an active trip. Shows today's spending vs the
 * daily budget (total budget ÷ trip days). Renders as a minimal bar that
 * changes color as you approach or exceed the daily limit.
 */
export default function DailySpendingMeter({ trip }: { trip: WPTrip }) {
  const { wpAllocations, wpExpenses, getWPTripDays } = useAppContext();

  const { todaySpent, dailyBudget, pct, color } = useMemo(() => {
    const days = getWPTripDays(trip.id);
    const totalBudget = wpAllocations.filter(a => a.trip_id === trip.id).reduce((s, a) => s + a.allocated_cents, 0);
    const daily = days.length > 0 ? totalBudget / days.length : 0;

    const todayExp = wpExpenses.filter(e => {
      if (e.trip_id !== trip.id) return false;
      try { return isToday(parseISO(e.date)); } catch { return false; }
    });
    const spent = todayExp.reduce((s, e) => s + e.amount_cents, 0);

    const ratio = daily > 0 ? spent / daily : 0;
    let c = "#22c55e"; // green
    if (ratio > 0.75) c = "#f97316"; // orange
    if (ratio > 1) c = "#ef4444"; // red

    return { todaySpent: spent, dailyBudget: daily, pct: Math.min(ratio * 100, 100), color: c };
  }, [trip.id, wpAllocations, wpExpenses, getWPTripDays]);

  if (dailyBudget === 0) return null;

  return (
    <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today&apos;s Spending</span>
        <span className="text-xs font-black" style={{ color }}>
          {trip.currency_code} {(todaySpent / 100).toFixed(0)} <span className="text-muted-foreground font-medium">/ {(dailyBudget / 100).toFixed(0)}</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
