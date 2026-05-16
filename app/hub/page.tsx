"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronRight, Zap, Plus } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { supabase } from "@/lib/supabase";

export default function HubPage() {
  const { accentColor, enableFoodBudget, enableSalaryPlanner, isVaultEnabled, isRadarEnabled, isClaimsEnabled, isTradingEnabled, isWanderPlanEnabled, transactions, subscriptions, utilities, session, setShowTransactionModal, formatCurrency } = useAppContext();

  const [radarCount, setRadarCount] = useState(0);

  // Today's total expenses
  const todaySpent = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;
    return transactions
      .filter(t => {
        if (t.type !== "Expense") return false;
        const txTime = new Date(t.date).getTime();
        return txTime >= startOfToday && txTime < startOfTomorrow;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  // Upcoming recurring costs due before end of month (only auto-deducting items)
  const upcomingCosts = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const allRecurring = [...subscriptions, ...utilities];
    const upcoming = allRecurring.filter(item => {
      if (!item.autoDeduct) return false; // Only truly recurring items
      const billingDay = item.billingDay || 1;
      return billingDay > currentDay && billingDay <= daysInMonth;
    });
    const totalDue = upcoming.reduce((sum, item) => sum + item.cost, 0);
    return { count: upcoming.length, total: totalDue };
  }, [subscriptions, utilities]);

  // Fetch today's radar drops count
  useEffect(() => {
    if (!session?.user || !isRadarEnabled) return;
    const fetchRadarCount = async () => {
      try {
        const { data: sources } = await supabase
          .from("radar_sources")
          .select("url, source_type")
          .eq("user_id", session.user.id);
        if (!sources || sources.length === 0) return;

        const rssSources = sources.filter(s => s.source_type === "rss" && s.url);
        let count = 0;
        const today = new Date().toISOString().split("T")[0];

        const fetches = rssSources.slice(0, 5).map(async (src) => {
          try {
            const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(src.url!)}`);
            const data = await res.json();
            if (data.status === "ok" && data.items) {
              return (data.items as Array<{ pubDate?: string }>).filter((item) => (item.pubDate || "").startsWith(today)).length;
            }
          } catch { /* skip failed feeds */ }
          return 0;
        });

        const results = await Promise.all(fetches);
        count = results.reduce((a, b) => a + b, 0);

        // Add a rough TMDB count (new releases today)
        const tmdbSources = sources.filter(s => s.source_type === "tmdb_cinema" || s.source_type === "tmdb_streaming");
        if (tmdbSources.length > 0) count += tmdbSources.length * 2; // estimate 2 drops per tmdb source

        setRadarCount(count);
      } catch { /* silent */ }
    };
    fetchRadarCount();
  }, [session, isRadarEnabled]);

  const hour = new Date().getHours();
  const timeLabel = hour >= 5 && hour < 12 ? "Morning" : hour >= 12 && hour < 17 ? "Afternoon" : "Evening";

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
      href: "/vault",
      icon: "📦",
      title: "Asset Vault",
      description: "Track gear, maintenance logs & time-in-service",
      color: "bg-blue-500/10",
      enabled: isVaultEnabled,
      sub: [],
    },
    {
      href: "/hub/radar",
      icon: "📡",
      title: "Radar Tracker",
      description: "Filtered tech & entertainment news feed",
      color: "bg-purple-500/10",
      enabled: isRadarEnabled,
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
      href: "/trading",
      icon: "💱",
      title: "Trading / Flipping",
      description: "Buy low, sell high — track inventory & profits",
      color: "bg-rose-500/10",
      enabled: isTradingEnabled,
      sub: [],
    },
    {
      href: "/wanderplan",
      icon: "✈️",
      title: "WanderPlan",
      description: "Trip planner, itinerary, budget & on-trip companion",
      color: "bg-sky-500/10",
      enabled: isWanderPlanEnabled,
      sub: [],
    },
  ];

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Hub</h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">Your workspace modules</p>
      </div>

      {/* Morning Briefing Card */}
      <div className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: accentColor }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>{timeLabel} Briefing</p>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-4xl">📊</p>
              <p className="font-bold text-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground font-medium">Tap the <strong>+</strong> button below to log your first expense and start tracking!</p>
            </div>
          ) : (
            <div className="flex items-baseline gap-3">
              <div className="flex-1">
                <p className="text-3xl font-black text-foreground tracking-tight">{formatCurrency(todaySpent)}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">spent today</p>
              </div>
              {isRadarEnabled && radarCount > 0 && (
                <Link href="/hub/radar" className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1.5 rounded-full shrink-0">
                  <span className="text-sm">📡</span>
                  <span className="text-xs font-bold text-purple-500">{radarCount} New</span>
                </Link>
              )}
            </div>
          )}

          <button
            onClick={() => setShowTransactionModal(true)}
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 20px ${accentColor}40` }}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
          >
            <Plus className="w-5 h-5" />
            Quick Log Expense
          </button>
        </div>
      </div>

      {/* Upcoming Recurring Costs */}
      {upcomingCosts.count > 0 && (
        <div className="bg-card rounded-3xl shadow-soft border border-border/40 p-4 flex items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-2xl">
            <span className="text-2xl">📅</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Upcoming This Month</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {formatCurrency(upcomingCosts.total)} in {upcomingCosts.count} recurring payment{upcomingCosts.count !== 1 ? 's' : ''} due
            </p>
          </div>
        </div>
      )}

      {/* Modules */}
      <div className="space-y-4">
        {modules.map(mod => {
          if (!mod.enabled) return null;
          return (
            <Link key={mod.href} href={mod.href} className="block">
              <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 hover:scale-[1.01] active:scale-[0.98] transition-all">
                <div className="flex items-center gap-4">
                  <div className={`${mod.color} p-4 rounded-2xl text-3xl`}>{mod.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-lg leading-tight">{mod.title}</p>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">{mod.description}</p>
                    {mod.sub.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {mod.sub.map(s => (
                          <span key={s as string} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="text-[10px] font-bold px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}

        {!isVaultEnabled && (
          <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 opacity-50">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-4 rounded-2xl text-3xl">📦</div>
              <div className="flex-1">
                <p className="font-bold text-foreground text-lg leading-tight">Asset Vault</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Enable in Profile → Modules</p>
              </div>
            </div>
          </div>
        )}

        {!isRadarEnabled && (
          <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 opacity-50">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-4 rounded-2xl text-3xl">📡</div>
              <div className="flex-1">
                <p className="font-bold text-foreground text-lg leading-tight">Radar Tracker</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Enable in Profile → Modules</p>
              </div>
            </div>
          </div>
        )}

        {!isClaimsEnabled && (
          <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 opacity-50">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-4 rounded-2xl text-3xl">🧾</div>
              <div className="flex-1">
                <p className="font-bold text-foreground text-lg leading-tight">Claims & Splits</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Enable in Profile → Modules</p>
              </div>
            </div>
          </div>
        )}

        {!isTradingEnabled && (
          <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 opacity-50">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-4 rounded-2xl text-3xl">💱</div>
              <div className="flex-1">
                <p className="font-bold text-foreground text-lg leading-tight">Trading / Flipping</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Enable in Profile → Modules</p>
              </div>
            </div>
          </div>
        )}

        {!isWanderPlanEnabled && (
          <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 opacity-50">
            <div className="flex items-center gap-4">
              <div className="bg-muted p-4 rounded-2xl text-3xl">✈️</div>
              <div className="flex-1">
                <p className="font-bold text-foreground text-lg leading-tight">WanderPlan</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Enable in Profile → Modules</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
