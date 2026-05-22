"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Home, PieChart, User, Plus, LayoutGrid, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { deriveQuickTemplates, type QuickTemplate } from "@/lib/quickTemplates";

/** How long (ms) the FAB must be held before the quick-templates sheet opens. */
const LONG_PRESS_MS = 450;

export default function BottomNav({ onOpenAdd }: { onOpenAdd: () => void }) {
  const pathname = usePathname();
  const { accentColor, transactions, addTransaction, triggerToast, formatCurrency } = useAppContext();
  const activeColor = accentColor || "#3b82f6";

  const isHome = pathname === "/";
  const isStats = pathname.startsWith("/analytics");
  const isHub =
    pathname.startsWith("/hub") ||
    pathname.startsWith("/vault") ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/wanderplan") ||
    pathname.startsWith("/cookmate") ||
    pathname.startsWith("/ai");
  const isProfile = pathname.startsWith("/profile");

  // ─── Long-press detection for the + FAB ────────────────────────────────
  // We start a timer on pointerdown; if it elapses without a pointerup, we
  // open the quick-templates sheet. Any tap shorter than the threshold falls
  // through to the existing `onOpenAdd` handler (full modal).
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const [showQuickSheet, setShowQuickSheet] = useState(false);

  // Derive templates only when the sheet is about to open — cheap even at
  // 5k transactions, but no point running it on every render.
  const quickTemplates: QuickTemplate[] = useMemo(
    () => (showQuickSheet ? deriveQuickTemplates(transactions) : []),
    [showQuickSheet, transactions]
  );

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    longPressFiredRef.current = false;
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      NativeHaptics.successMedium();
      setShowQuickSheet(true);
    }, LONG_PRESS_MS);
  }, [clearPressTimer]);

  const handlePointerUp = useCallback(() => {
    clearPressTimer();
    // If long-press already fired, the sheet is open — don't also open the
    // full modal. Otherwise, this is a normal tap.
    if (!longPressFiredRef.current) {
      onOpenAdd();
      NativeHaptics.lightTick();
    }
  }, [clearPressTimer, onOpenAdd]);

  const handlePointerCancel = useCallback(() => {
    clearPressTimer();
  }, [clearPressTimer]);

  const handleApplyTemplate = useCallback(
    (tpl: QuickTemplate) => {
      setShowQuickSheet(false);
      addTransaction({
        type: "Expense",
        amount: tpl.amount,
        category: tpl.category,
        account: tpl.account,
        note: tpl.note,
        date: new Date().toISOString(),
        status: "cleared",
        is_claimable: false,
        claim_status: "none",
      });
      triggerToast(`✅ Quick-added ${tpl.category}`);
      NativeHaptics.successMedium();
    },
    [addTransaction, triggerToast]
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 pb-safe border-t border-border shadow-up rounded-t-3xl px-6 py-4 flex justify-between items-center bg-opacity-90 dark:bg-opacity-90 backdrop-blur-xl"
      >
        <Link
          href="/"
          aria-label="Home"
          aria-current={isHome ? "page" : undefined}
          style={isHome ? { color: activeColor } : {}}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            !isHome && "text-muted-foreground hover:text-foreground"
          )}
        >
          <Home className="w-6 h-6" strokeWidth={isHome ? 2.5 : 2} aria-hidden="true" />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        <Link
          href="/analytics"
          aria-label="Stats"
          aria-current={isStats ? "page" : undefined}
          style={isStats ? { color: activeColor } : {}}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            !isStats && "text-muted-foreground hover:text-foreground"
          )}
        >
          <PieChart className="w-6 h-6" strokeWidth={isStats ? 2.5 : 2} aria-hidden="true" />
          <span className="text-[10px] font-medium">Stats</span>
        </Link>

        <div className="relative -top-6">
          <button
            type="button"
            aria-label="Add transaction — hold for quick templates"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerCancel}
            onPointerCancel={handlePointerCancel}
            // Prevent the browser's context menu on a long-press (Android WebView).
            onContextMenu={(e) => e.preventDefault()}
            style={{
              backgroundColor: activeColor,
              boxShadow: `0 0 20px ${activeColor}60`,
            }}
            className="text-white p-4 rounded-full hover:scale-105 active:scale-95 transition-transform select-none touch-none"
          >
            <Plus className="w-8 h-8" strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        <Link
          href="/hub"
          aria-label="Hub"
          aria-current={isHub ? "page" : undefined}
          style={isHub ? { color: activeColor } : {}}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            !isHub && "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid className="w-6 h-6" strokeWidth={isHub ? 2.5 : 2} aria-hidden="true" />
          <span className="text-[10px] font-medium">Hub</span>
        </Link>

        <Link
          href="/profile"
          aria-label="Profile"
          aria-current={isProfile ? "page" : undefined}
          style={isProfile ? { color: activeColor } : {}}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            !isProfile && "text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="w-6 h-6" strokeWidth={isProfile ? 2.5 : 2} aria-hidden="true" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>

      {/*
        Quick Templates sheet.
        Long-press the + FAB to open. Templates are derived on-demand from
        the last 30 days of expenses (in `lib/quickTemplates.ts`). Each
        button is one-tap — no further confirmation, but a full-modal
        option is always available at the bottom.
      */}
      <AnimatePresence>
        {showQuickSheet && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center pb-28">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickSheet(false)}
              aria-hidden="true"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-templates-title"
              className="relative w-full max-w-md mx-4 bg-card rounded-[2rem] border border-border/50 shadow-heavy p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: activeColor }} aria-hidden="true" />
                <h2
                  id="quick-templates-title"
                  className="text-sm font-black tracking-wide uppercase text-foreground"
                >
                  Quick Add
                </h2>
                <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                  Last 30 days
                </span>
              </div>

              {quickTemplates.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">
                    No repeat patterns yet.
                  </p>
                  <p className="text-xs text-muted-foreground/70 font-medium mt-1">
                    Log a few expenses and they&apos;ll appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {quickTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleApplyTemplate(t)}
                      className="text-left bg-muted/40 hover:bg-muted/70 border border-border/40 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all"
                      style={{ borderColor: `${activeColor}22` }}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {t.category}
                        {t.account && ` · ${t.account}`}
                      </p>
                      <p className="font-black text-base text-foreground leading-tight mt-0.5">
                        {formatCurrency(t.amount)}
                      </p>
                      {t.note && (
                        <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                          {t.note}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowQuickSheet(false);
                  onOpenAdd();
                }}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground font-bold text-xs active:scale-[0.99] transition-transform mt-2"
              >
                Full Form Instead →
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
