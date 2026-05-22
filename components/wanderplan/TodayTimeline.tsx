"use client";

import { useMemo } from "react";
import { useAppContext } from "@/lib/context";
import { format, isToday, parseISO, differenceInMinutes } from "date-fns";
import type { WPTrip } from "@/lib/types";
import { ACTIVITY_CATEGORY_COLORS } from "@/lib/wanderplanConstants";

export default function TodayTimeline({ trip }: { trip: WPTrip }) {
  const { wpActivities, getWPTripDays, toggleWPActivityCompleted } = useAppContext();

  const todayDay = useMemo(() => {
    const days = getWPTripDays(trip.id);
    return days.find(d => { try { return isToday(parseISO(d.date)); } catch { return false; } });
  }, [trip.id, getWPTripDays]);

  const todayActivities = useMemo(() => {
    if (!todayDay) return [];
    return wpActivities
      .filter(a => a.trip_day_id === todayDay.id)
      .sort((a, b) => a.order_index - b.order_index);
  }, [todayDay, wpActivities]);

  const completedCount = todayActivities.filter(a => a.is_completed).length;

  const now = new Date();
  const currentActivity = todayActivities.find(a => {
    if (!a.start_time || !a.end_time || a.is_completed) return false;
    try {
      const start = parseISO(`${todayDay!.date}T${a.start_time}`);
      const end = parseISO(`${todayDay!.date}T${a.end_time}`);
      return now >= start && now <= end;
    } catch { return false; }
  });

  const nextActivity = todayActivities.find(a => {
    if (a.is_completed) return false;
    if (!a.start_time) return !a.is_completed;
    try {
      const start = parseISO(`${todayDay!.date}T${a.start_time}`);
      return now < start;
    } catch { return false; }
  });

  if (!todayDay) return null;

  return (
    <div className="bg-card rounded-3xl shadow-soft border border-border/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Day {todayDay.day_number}</p>
          <p className="text-sm font-bold text-foreground">{format(parseISO(todayDay.date), "EEEE, MMM d")}</p>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{completedCount}/{todayActivities.length} done</span>
      </div>

      {/* Happening Now */}
      {currentActivity && (
        <div className="border-2 border-emerald-500 rounded-2xl p-3 relative">
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase">Now</span>
          </div>
          <p className="font-bold text-foreground text-sm">{currentActivity.title}</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{currentActivity.start_time} — {currentActivity.end_time}</p>
        </div>
      )}

      {/* Next Up */}
      {nextActivity && !currentActivity && (
        <div className="border-2 border-sky-500 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold text-sky-500 uppercase">Next Up</span>
            {nextActivity.start_time && todayDay && (() => {
              try {
                const start = parseISO(`${todayDay.date}T${nextActivity.start_time}`);
                const mins = differenceInMinutes(start, now);
                return mins > 0 ? <span className="text-[10px] text-muted-foreground font-medium">in {mins} min</span> : null;
              } catch { return null; }
            })()}
          </div>
          <p className="font-bold text-foreground text-sm">{nextActivity.title}</p>
        </div>
      )}

      {/* Activity list */}
      <div className="space-y-2">
        {todayActivities.map(act => (
          <button
            key={act.id}
            onClick={() => toggleWPActivityCompleted(act.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: ACTIVITY_CATEGORY_COLORS[act.category] }} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${act.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{act.title}</p>
              {act.start_time && <p className="text-[10px] text-muted-foreground font-medium">{act.start_time}{act.end_time ? ` — ${act.end_time}` : ""}</p>}
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${act.is_completed ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
              {act.is_completed && <span className="text-white text-[10px]">✓</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
