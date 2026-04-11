"use client";

import { Package, Target, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";

export default function HubPage() {
  const { accentColor, enableFoodBudget, enableSalaryPlanner, isVaultEnabled, isRadarEnabled } = useAppContext();

  const modules = [
    {
      href: "/goals",
      icon: "🎯",
      title: "Financial Goals",
      description: "Savings goals, food budget & salary planner",
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
  ];

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Hub</h1>
        <p className="text-sm text-muted-foreground font-medium mt-1">Your workspace modules</p>
      </div>

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
      </div>
    </div>
  );
}
