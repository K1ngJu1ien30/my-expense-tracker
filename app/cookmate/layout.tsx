"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChefHat, Bot, Refrigerator, ShoppingCart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { CookMateProvider } from "@/lib/cookmate/context";

const ACCENT = "#f97316";

const tabs = [
  { href: "/cookmate", label: "Cook", Icon: ChefHat },
  { href: "/cookmate/ask", label: "Ask AI", Icon: Bot },
  { href: "/cookmate/pantry", label: "Pantry", Icon: Refrigerator },
  { href: "/cookmate/shopping", label: "Shop", Icon: ShoppingCart },
  { href: "/cookmate/settings", label: "More", Icon: Settings },
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

        {/* Content — extra bottom padding to clear the fixed nav */}
        <div className={cn("flex-1 overflow-y-auto hide-scrollbar", !isRecipeDetail && "pb-24")}>
          {children}
        </div>

        {/* Bottom nav — mirrors the app's native BottomNav design exactly */}
        {!isRecipeDetail && (
          <nav
            aria-label="CookMate navigation"
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 pb-safe border-t border-border shadow-up rounded-t-3xl px-6 py-4 flex justify-between items-center bg-opacity-90 dark:bg-opacity-90 backdrop-blur-xl max-w-md mx-auto"
          >
            {tabs.map(tab => {
              const isActive = pathname === tab.href || (tab.href !== "/cookmate" && pathname.startsWith(tab.href));
              const isExactCook = tab.href === "/cookmate" && pathname === "/cookmate";
              const active = isActive || isExactCook;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                  style={active ? { color: ACCENT } : {}}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-colors",
                    !active && "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </CookMateProvider>
  );
}
