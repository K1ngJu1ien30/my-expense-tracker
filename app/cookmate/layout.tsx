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
  // Hide CookMate nav on recipe detail pages (they have their own back nav)
  const isRecipeDetail = pathname.startsWith("/cookmate/recipe/");

  return (
    <CookMateProvider>
      <div className="flex flex-col min-h-0 h-full">
        {/* Header */}
        {!isRecipeDetail && (
          <div className="px-6 pt-6 pb-2 flex items-center gap-3 shrink-0">
            <Link href="/hub" className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">CookMate</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Smart kitchen companion</p>
            </div>
          </div>
        )}

        {/* Content — extra bottom padding to clear the fixed nav */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-16">
          {children}
        </div>

        {/* Fixed bottom nav — sits above the app's main bottom nav */}
        {!isRecipeDetail && (
          <div className="fixed bottom-[72px] left-0 right-0 z-40 max-w-md mx-auto">
            <div className="mx-4 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-heavy px-2 py-1.5 flex justify-around">
              {tabs.map(tab => {
                const isActive = pathname === tab.href || (tab.href !== "/cookmate" && pathname.startsWith(tab.href));
                const isExactCook = tab.href === "/cookmate" && pathname === "/cookmate";
                const active = isActive || isExactCook;
                return (
                  <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors" style={active ? { backgroundColor: `${ACCENT}15` } : {}}>
                    <span className="text-base">{tab.icon}</span>
                    <span className="text-[9px] font-bold" style={{ color: active ? ACCENT : "var(--color-muted-foreground)" }}>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CookMateProvider>
  );
}
