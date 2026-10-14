"use client";

import { useMemo } from "react";
import { ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { getHeatmapTileStyle } from "../calendar/page";

export default function HubPage() {
  const {
    accentColor, enableFoodBudget, enableSalaryPlanner, isVaultEnabled,
    isClaimsEnabled, transactions, accountObjects,
  } = useAppContext();

  // ─── Heatmap Calendar Data Derivation ──────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startOffset = (() => {
    const day = new Date(currentYear, currentMonth, 1).getDay();
    return day === 0 ? 6 : day - 1;
  })();

  const formatDateKey = (year: number, monthIndex: number, day: number) => {
    const m = String(monthIndex + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };
  const todayKey = formatDateKey(currentYear, currentMonth, now.getDate());

  const dailyExpensesMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.type !== "Expense" || t.deleted_at) return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;

      map.set(key, (map.get(key) || 0) + Number(t.amount));
    });
    return map;
  }, [transactions]);

  const modules = [
    {
      href: "/goals",
      icon: "🎯",
      title: "Financial Planning",
      description: "Goals, budgets, recurring costs & salary planner",
      color: "bg-emerald-500/10",
      enabled: true,
      sub: [
        enableFoodBudget && "Food Budget",
        enableSalaryPlanner && "Salary Planner",
      ].filter(Boolean),
    },
    {
      href: "/hub/credit-cards",
      icon: "💳",
      title: "Credit Cards",
      description: "Limits, utilization, statements & unbilled spending",
      color: "bg-rose-500/10",
      enabled: true,
      sub: (() => {
        const cCards = accountObjects.filter((a) => a.kind === "credit_card" && !a.isArchived);
        return cCards.length > 0 ? [`${cCards.length} Active Card${cCards.length > 1 ? "s" : ""}`] : [];
      })(),
    },
    {
      href: "/vault",
      icon: "📦",
      title: "Asset Vault",
      description: "Track gear, maintenance logs & time-in-service",
      color: "bg-blue-500/10",
      enabled: isVaultEnabled,
      sub: [],
    },
    {
      href: "/hub/claims",
      icon: "🧾",
      title: "Claims & Splits",
      description: "Track reimbursable & shared expenses",
      color: "bg-amber-500/10",
      enabled: isClaimsEnabled,
      sub: [],
    },
    {
      href: "/calendar",
      icon: "📅",
      title: "Heatmap Calendar",
      description: "Visual daily spending intensity & date breakdown",
      color: "bg-rose-500/10",
      enabled: true,
      sub: [],
    },
    {
      href: "/hub/statement-import",
      icon: "📄",
      title: "Statement Import",
      description: "Parse & import PDF/image bank statements using AI",
      color: "bg-purple-500/10",
      enabled: true,
      sub: [],
    },
  ];

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Hub</h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">Your workspace modules</p>
      </div>

      {/* ─── 1. HEATMAP CALENDAR (VERY FIRST SECTION AT TOP OF HUB) ──────────── */}
      <div className="bg-card rounded-3xl p-5 border border-border/40 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-500">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">Spending Heatmap</h2>
              <p className="text-[11px] text-muted-foreground font-semibold">
                {now.toLocaleString('default', { month: 'long' })} {now.getFullYear()}
              </p>
            </div>
          </div>

          <Link
            href="/calendar"
            className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline"
          >
            Full View
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[9px] font-black uppercase text-muted-foreground/60">
              {d}
            </span>
          ))}
        </div>

        {/* 7-Column Sleek Rounded-LG Square Grid Tiles */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Offset cells */}
          {Array.from({ length: startOffset }).map((_, idx) => (
            <div key={`offset-${idx}`} className="aspect-square rounded-lg bg-muted/20 border border-transparent" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateKey = formatDateKey(currentYear, currentMonth, dayNum);
            const amt = dailyExpensesMap.get(dateKey) || 0;
            const isToday = dateKey === todayKey;
            const style = getHeatmapTileStyle(amt);

            return (
              <Link
                key={dateKey}
                href="/calendar"
                className={`aspect-square rounded-lg p-1 flex flex-col justify-between transition-all relative select-none ${style.tileClass}`}
                style={isToday ? { borderColor: accentColor || "#3b82f6", borderWidth: 2 } : {}}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] leading-none ${isToday ? "text-foreground font-black" : style.numClass}`}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accentColor || "#3b82f6" }} />
                  )}
                </div>

                {amt > 0 ? (
                  <span className={`text-[8px] leading-none tracking-tighter truncate w-full ${style.amtClass}`}>
                    RM{Math.round(amt)}
                  </span>
                ) : (
                  <span className="text-[8px] opacity-0 select-none">-</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── 2. WORKSPACE MODULES ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          Modules &amp; Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            if (!m.enabled) return null;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 flex items-center justify-between hover:border-border hover:shadow-md transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${m.color} flex items-center justify-center text-2xl shrink-0`}>
                    {m.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">{m.title}</p>
                    <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">{m.description}</p>
                    {m.sub.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {m.sub.map((s, i) => (
                          <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
