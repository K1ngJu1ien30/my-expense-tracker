"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PieChart,
  History,
  Calendar,
  Target,
  Package,
  LayoutGrid,
  User,
  Plus,
  Moon,
  Sun,
  Sparkles,
  Wifi,
  WifiOff,
  Flame,
} from "lucide-react";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";

interface DesktopSidebarProps {
  onOpenAdd: () => void;
}

export default function DesktopSidebar({ onOpenAdd }: DesktopSidebarProps) {
  const pathname = usePathname();
  const {
    userName,
    accentColor,
    isOffline,
    currency,
  } = useAppContext();

  const activeColor = accentColor || "#3b82f6";

  const toggleTheme = () => {
    NativeHaptics.lightTick();
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove("amoled");
      localStorage.setItem("theme", "light");
      localStorage.removeItem("amoled");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      href: "/analytics",
      label: "Analytics",
      icon: PieChart,
      isActive: pathname.startsWith("/analytics"),
    },
    {
      href: "/history",
      label: "History",
      icon: History,
      isActive: pathname.startsWith("/history"),
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: Calendar,
      isActive: pathname.startsWith("/calendar"),
    },
    {
      href: "/goals",
      label: "Planning",
      icon: Target,
      isActive: pathname.startsWith("/goals"),
    },
    {
      href: "/vault",
      label: "Vault",
      icon: Package,
      isActive: pathname.startsWith("/vault"),
    },
    {
      href: "/hub",
      label: "Hub",
      icon: LayoutGrid,
      isActive: pathname.startsWith("/hub"),
    },
    {
      href: "/profile",
      label: "Profile",
      icon: User,
      isActive: pathname.startsWith("/profile"),
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-border/50 bg-card/60 backdrop-blur-2xl h-screen sticky top-0 p-6 z-40 select-none">
      {/* Brand & App Title */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="flex items-center gap-3 group"
          onClick={() => NativeHaptics.lightTick()}
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-soft transition-transform group-hover:scale-105"
            style={{
              backgroundColor: activeColor,
              boxShadow: `0 4px 20px ${activeColor}40`,
            }}
          >
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-foreground text-base tracking-tight leading-none group-hover:text-primary transition-colors">
              Tracker
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Personal Finance
            </p>
          </div>
        </Link>

        {/* Currency badge */}
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
          {currency}
        </span>
      </div>

      {/* User Profile Quick Tile */}
      <Link
        href="/profile"
        className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border/30 transition-all mb-6 group"
        onClick={() => NativeHaptics.lightTick()}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm"
          style={{ backgroundColor: activeColor }}
        >
          {userName ? userName.charAt(0).toUpperCase() : "U"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
            {userName || "User"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOffline ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            <span className="text-[10px] font-semibold text-muted-foreground">
              {isOffline ? "Offline" : "Synced"}
            </span>
          </div>
        </div>
        <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-500 transition-colors shrink-0" />
      </Link>

      {/* Primary Action Button: Add Transaction */}
      <button
        type="button"
        onClick={() => {
          NativeHaptics.successMedium();
          onOpenAdd();
        }}
        style={{
          backgroundColor: activeColor,
          boxShadow: `0 8px 24px -4px ${activeColor}50`,
        }}
        className="w-full text-white font-bold text-sm py-3 px-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shadow-soft mb-6"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>New Transaction</span>
        <kbd className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/20 text-white border border-white/20">
          N
        </kbd>
      </button>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto hide-scrollbar -mx-2 px-2" aria-label="Desktop Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => NativeHaptics.lightTick()}
              style={
                item.isActive
                  ? {
                      backgroundColor: `${activeColor}15`,
                      color: activeColor,
                      borderColor: `${activeColor}30`,
                    }
                  : undefined
              }
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                item.isActive
                  ? "shadow-sm font-black"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
              }`}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                strokeWidth={item.isActive ? 2.5 : 2}
                style={item.isActive ? { color: activeColor } : undefined}
              />
              <span className="truncate">{item.label}</span>
              {item.isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full ml-auto shrink-0"
                  style={{ backgroundColor: activeColor }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Utilities */}
      <div className="pt-4 border-t border-border/40 mt-auto space-y-3">
        <div className="flex items-center justify-between">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Offline mode</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cloud connected</span>
              </>
            )}
          </div>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-95 cursor-pointer"
            aria-label="Toggle theme"
          >
            <Sun className="w-4 h-4 hidden dark:block" />
            <Moon className="w-4 h-4 block dark:hidden" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/70 font-medium text-center">
          Desktop mode active · press <kbd className="font-bold text-foreground">N</kbd> to add
        </p>
      </div>
    </aside>
  );
}
