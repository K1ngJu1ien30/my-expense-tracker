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
  const isRecipeDetail = pathname.startsWith("/cookmate/recipe/");

  return (
    <CookMateProvider>
      <div className="flex flex-col h-full">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {children}
        </div>

        {/* Bottom nav — replaces the app's main nav (hidden by AppLayout) */}
        {!isRecipeDetail && (
          <nav className="border-t border-border/40 bg-white dark:bg-zinc-950 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-xl px-6 py-3 flex justify-around pb-safe shrink-0">
            {tabs.map(tab => {
              const isActive = pathname === tab.href || (tab.href !== "/cookmate" && pathname.startsWith(tab.href));
              const isExactCook = tab.href === "/cookmate" && pathname === "/cookmate";
              const active = isActive || isExactCook;
              return (
                <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 transition-colors">
                  <span className={`text-lg ${active ? "" : "grayscale opacity-60"}`}>{tab.icon}</span>
                  <span className="text-[10px] font-semibold" style={{ color: active ? ACCENT : "var(--color-muted-foreground)" }}>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </CookMateProvider>
  );
}
