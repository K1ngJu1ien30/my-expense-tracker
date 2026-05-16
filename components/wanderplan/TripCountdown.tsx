"use client";

import { useMemo } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import type { WPTrip } from "@/lib/types";

/**
 * Countdown widget that shows days until a planning trip starts, or
 * the day progress of an active trip. Renders as a compact visual bar.
 */
export default function TripCountdown({ trip }: { trip: WPTrip }) {
  const { label, value, max, color, subtext } = useMemo(() => {
    const now = new Date();
    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);
    const totalDays = differenceInDays(end, start) + 1;

    if (trip.status === "planning") {
      const daysUntil = differenceInDays(start, now);
      if (daysUntil < 0) return { label: "Overdue", value: 0, max: 1, color: "#ef4444", subtext: `Started ${format(start, "MMM d")}` };
      if (daysUntil === 0) return { label: "Tomorrow!", value: 1, max: 1, color: "#f97316", subtext: format(start, "EEEE") };
      return {
        label: `${daysUntil}d`,
        value: Math.max(0, 30 - daysUntil),
        max: 30,
        color: daysUntil <= 7 ? "#f97316" : "#3b82f6",
        subtext: `${format(start, "MMM d")} · ${daysUntil} days away`,
      };
    }

    if (trip.status === "active") {
      const daysPassed = differenceInDays(now, start) + 1;
      const clamped = Math.min(Math.max(daysPassed, 0), totalDays);
      return {
        label: `Day ${clamped}/${totalDays}`,
        value: clamped,
        max: totalDays,
        color: "#22c55e",
        subtext: `${totalDays - clamped} days left`,
      };
    }

    return { label: "Completed", value: totalDays, max: totalDays, color: "#9ca3af", subtext: `${format(start, "MMM d")} — ${format(end, "MMM d")}` };
  }, [trip]);

  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black" style={{ color }}>{label}</span>
        <span className="text-[10px] text-muted-foreground font-medium">{subtext}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
