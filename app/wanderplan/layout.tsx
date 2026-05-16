"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAppContext } from "@/lib/context";

const tabs = [
  { href: "/wanderplan", label: "Trips", icon: "🗺️" },
  { href: "/wanderplan/itinerary", label: "Itinerary", icon: "📋" },
  { href: "/wanderplan/map", label: "Map", icon: "📍" },
  { href: "/wanderplan/budget", label: "Budget", icon: "💰" },
  { href: "/wanderplan/places", label: "Places", icon: "⭐" },
  { href: "/wanderplan/documents", label: "Docs", icon: "📄" },
  { href: "/wanderplan/packing", label: "Packing", icon: "🎒" },
];

export default function WanderPlanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accentColor } = useAppContext();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-center gap-3">
        <Link href="/hub" className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">WanderPlan</h1>
          <p className="text-[10px] text-muted-foreground font-medium">Trip planner & companion</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-2 overflow-x-auto hide-scrollbar">
        <div className="flex gap-1.5 min-w-max">
          {tabs.map(tab => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0"
                style={isActive ? { backgroundColor: `${accentColor}1A`, color: accentColor } : {}}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className={isActive ? "" : "text-muted-foreground"}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {children}
      </div>
    </div>
  );
}
