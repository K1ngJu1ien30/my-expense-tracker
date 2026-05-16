"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CookMateProvider } from "@/lib/cookmate/context";

const ACCENT = "#f97316";
const tabs = [
  { href: "/cookmate", label: "Cook", icon: "🍳" },
  { href: "/cookmate/ask", label: "Ask AI", icon: "🤖" },
  { href: "/cookmate/pantry", label: "Pantry", icon: "🧊" },
  { href: "/cookmate/shopping", label: "Shop", icon: "🛒" },
  { href: "/cookmate/settings", label: "More", icon: "⚙️" },
];

export default function CookMateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <CookMateProvider>
      <div className="flex flex-col h-full">
        <div className="px-6 pt-6 pb-2 flex items-center gap-3">
          <Link href="/hub" className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">CookMate</h1>
            <p className="text-[10px] text-muted-foreground font-medium">Smart kitchen companion</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {children}
        </div>

        {/* Bottom nav */}
        <div className="border-t border-border/40 bg-card px-4 py-2 flex justify-around pb-safe">
          {tabs.map(tab => {
            const isActive = pathname === tab.href || (tab.href !== "/cookmate" && pathname.startsWith(tab.href));
            const isExactCook = tab.href === "/cookmate" && pathname === "/cookmate";
            const active = isActive || isExactCook;
            return (
              <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-0.5 py-1 px-2">
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[10px] font-bold" style={{ color: active ? ACCENT : "var(--color-muted-foreground)" }}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </CookMateProvider>
  );
}
