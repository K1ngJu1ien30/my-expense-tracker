"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
import { Ghost, Edit2, Trash2, Search, X } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { useAppContext } from "@/lib/context";
import type { Transaction } from "@/lib/types";
import {
  parseSearchQuery,
  applySearchQuery,
  describeChips,
  type SearchQuery,
} from "@/lib/searchParser";
import { NativeHaptics } from "@/lib/haptics";

type FilterType = "today" | "week" | "all";

/**
 * One transaction row with horizontal swipe-to-reveal actions. Swipe left
 * up to ~160px to expose Edit + Delete; release past a threshold to snap
 * open, otherwise spring back. Tap the body to close an open row. Explicit
 * buttons remain visible on hover/focus so keyboard users never need the
 * gesture.
 */
function SwipeableTransactionRow({
  tx,
  formatCurrency,
  accentColor,
  onEdit,
  onDelete,
  isOpen,
  onOpen,
  onClose,
}: {
  tx: Transaction;
  formatCurrency: (n: number) => string;
  accentColor: string;
  onEdit: () => void;
  onDelete: () => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-160, -40, 0], [1, 0.6, 0]);

  const OPEN = -160;
  const SNAP_THRESHOLD = -80;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const shouldOpen = info.offset.x < SNAP_THRESHOLD || info.velocity.x < -300;
    if (shouldOpen) {
      animate(x, OPEN, { type: "spring", damping: 28, stiffness: 280 });
      onOpen();
      NativeHaptics.lightTick();
    } else {
      animate(x, 0, { type: "spring", damping: 28, stiffness: 280 });
      onClose();
    }
  };

  // When another row opens, close this one.
  if (!isOpen && x.get() !== 0) {
    animate(x, 0, { type: "spring", damping: 30, stiffness: 320 });
  }

  return (
    <div className="relative overflow-hidden rounded-3xl">
      {/* Action panel behind the card */}
      <motion.div
        style={{ opacity: actionsOpacity }}
        className="absolute inset-0 flex items-center justify-end gap-2 pr-4 pointer-events-none"
        aria-hidden="true"
      >
        <button
          type="button"
          onClick={onEdit}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-full bg-primary/15 rounded-2xl text-primary"
        >
          <Edit2 className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Edit</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-full bg-rose-500/15 rounded-2xl text-rose-500"
        >
          <Trash2 className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Delete</span>
        </button>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: OPEN, right: 0 }}
        dragElastic={0.1}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={() => { if (isOpen) { animate(x, 0); onClose(); } }}
        className="relative bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 group hover:border-primary/20 transition-colors touch-pan-y w-full max-w-full"
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-3xl ${
            tx.type === "Income"
              ? "bg-emerald-500"
              : tx.type === "Expense"
                ? "bg-rose-500"
                : "bg-blue-500"
          }`}
          aria-hidden="true"
        />

        <div className="flex justify-between items-start gap-3 pl-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase mb-0.5 truncate">
              {tx.type} • {tx.account}
            </p>
            <h3 className="font-bold text-lg text-foreground truncate">
              {tx.category || (tx.type === "Income" ? "Income" : tx.type === "Transfer" ? "Transfer" : "General")}
            </h3>
            <p className="text-xs text-muted-foreground/70 font-medium mt-0.5 truncate">
              {new Date(tx.date).toLocaleDateString()} {tx.note ? `- ${tx.note}` : ""}
            </p>
          </div>
          <h3
            className={`font-black text-xl tracking-tight shrink-0 ${
              tx.type === "Income"
                ? "text-emerald-500"
                : tx.type === "Expense"
                  ? "text-rose-500"
                  : "text-blue-500"
            }`}
          >
            {tx.type === "Expense" && "-"}
            {tx.type === "Income" && "+"}
            {formatCurrency(Number(tx.amount))}
          </h3>
        </div>

        {/* Keyboard / mouse fallback controls */}
        <div className="flex justify-end gap-2 pl-2 border-t border-border/30 pt-3 opacity-0 group-hover:opacity-80 group-focus-within:opacity-80 transition-opacity">
          <button
            type="button"
            aria-label={`Edit ${tx.type.toLowerCase()} of ${formatCurrency(Number(tx.amount))}`}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none"
            style={{ borderColor: `${accentColor}15` }}
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${tx.type.toLowerCase()} of ${formatCurrency(Number(tx.amount))}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors focus:outline-none"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function HistoryPage() {
  const {
    transactions,
    deleteTransaction,
    setEditTransactionId,
    accentColor,
    confirmAction,
    formatCurrency,
    categories,
  } = useAppContext();

  // Legacy shortcut pills, still useful above the power-search bar.
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Power Search state
  const [searchRaw, setSearchRaw] = useState("");
  const parsedQuery: SearchQuery = useMemo(() => parseSearchQuery(searchRaw), [searchRaw]);
  const chips = useMemo(() => describeChips(parsedQuery), [parsedQuery]);

  // Track which row is in swipe-open state — only one at a time.
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Derive unique categories present in transactions + user-defined categories.
  const availableCategories = useMemo(() => {
    const txCats = new Set(transactions.map(tx => tx.category).filter(Boolean));
    categories.forEach(c => txCats.add(c));
    return Array.from(txCats).sort();
  }, [transactions, categories]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Legacy time filter — skipped if power-search already specifies a date range.
    if (filter !== "all" && !parsedQuery.date) {
      const now = new Date();
      if (filter === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfTomorrow = startOfToday + 86400000;
        result = result.filter(tx => {
          const t = new Date(tx.date).getTime();
          return t >= startOfToday && t < startOfTomorrow;
        });
      } else if (filter === "week") {
        const dayOfWeek = now.getDay();
        const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();
        const endOfWeek = startOfWeek + 7 * 86400000;
        result = result.filter(tx => {
          const t = new Date(tx.date).getTime();
          return t >= startOfWeek && t < endOfWeek;
        });
      }
    }

    // Legacy category pill — skipped if power-search specifies #category.
    if (categoryFilter !== "all" && parsedQuery.categories.length === 0) {
      result = result.filter(tx => tx.category === categoryFilter);
    }

    // Power-search filters AND-apply on top.
    result = applySearchQuery(result, parsedQuery);

    return result;
  }, [transactions, filter, categoryFilter, parsedQuery]);

  const hasAnyFilter =
    filter !== "all" || categoryFilter !== "all" || searchRaw.trim().length > 0;

  const clearAll = () => {
    setFilter("all");
    setCategoryFilter("all");
    setSearchRaw("");
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Stable per-row callbacks so Virtuoso's window-recycler doesn't churn
  // child memoisation.
  const handleEdit = useCallback(
    (id: string) => {
      setEditTransactionId(id);
      setOpenRowId(null);
    },
    [setEditTransactionId]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setOpenRowId(null);
      confirmAction("Delete Transaction", "Permanently wipe this transaction record?", () => {
        deleteTransaction(id);
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
      });
    },
    [confirmAction, deleteTransaction]
  );

  // IMPORTANT: the search bar + filter pills live OUTSIDE Virtuoso rather
  // than as its `Header` slot. Using Virtuoso's Header slot re-mounts the
  // search `<input>` on every keystroke (because the Header function would
  // close over the rapidly-changing `searchRaw` / `filteredTransactions`
  // values), which dismisses the soft keyboard after every character typed.
  // Keeping the input as a sibling of Virtuoso keeps the DOM node stable.
  //
  // ALSO IMPORTANT: Virtuoso uses AppLayout's `<main>` as its scroll parent
  // via `customScrollParent`. The alternative — giving Virtuoso its own
  // 100dvh scroller — creates nested scroll contexts that fight with the
  // parent's `overflow-x-hidden`, causing open/swiped rows to bleed past
  // the viewport edge. Using the parent's scroller makes the whole page
  // scroll naturally and keeps horizontal clipping correct.
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    // AppLayout wraps every page body in a <main> with overflow-y-auto.
    // This is a pure DOM-reference grab — no cascading renders because the
    // effect runs once (empty deps) and the scroll parent is effectively
    // immutable for the page's lifetime.
    const main = document.querySelector("main");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (main instanceof HTMLElement) setScrollParent(main);
  }, []);

  return (
    <div className="animate-in fade-in duration-500 pb-[120px] overflow-x-hidden">
      <div className="px-6 pt-2">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">History</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Showing <span className="font-black text-foreground">{filteredTransactions.length}</span>
              {transactions.length !== filteredTransactions.length && ` of ${transactions.length}`}{" "}
              transaction{filteredTransactions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Power Search bar */}
        <div className="flex items-center gap-2 bg-card rounded-2xl px-4 py-3 border border-border/50 shadow-sm mb-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder='Try: #food @bank >50 "last week"'
            aria-label="Search transactions"
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none text-foreground placeholder:text-muted-foreground"
          />
          {searchRaw && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setSearchRaw(""); searchInputRef.current?.focus(); }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Parsed query chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {chips.map((chip) => (
              <span
                key={chip.key}
                style={{ backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` }}
                className="text-[10px] font-black tracking-wide px-2.5 py-1 rounded-full border"
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* Time Filter Pills */}
        <div className="flex gap-2 mb-3">
          {(
            [
              { key: "today" as FilterType, label: "Today" },
              { key: "week" as FilterType, label: "This Week" },
              { key: "all" as FilterType, label: "Show All" },
            ]
          ).map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={active ? { backgroundColor: accentColor, color: "#fff" } : {}}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  active ? "shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Category Filter Pills — horizontal scroll, clipped to viewport */}
        <div className="-mx-6 px-6 overflow-x-auto hide-scrollbar mb-5">
          <div className="flex gap-2 w-max pb-1">
            <button
              onClick={() => setCategoryFilter("all")}
              style={
                categoryFilter === "all"
                  ? { backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` }
                  : {}
              }
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all border shrink-0 ${
                categoryFilter === "all" ? "border" : "border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              All Categories
            </button>
            {availableCategories.map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(active ? "all" : cat)}
                  style={
                    active
                      ? { backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` }
                      : {}
                  }
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all border shrink-0 ${
                    active ? "border" : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Virtualised transaction list. Only the rows currently in the viewport
          are mounted in the DOM; everything else is recycled by Virtuoso.
          Uses AppLayout's <main> as the scroll parent so the whole page
          scrolls naturally (no nested scroll contexts fighting the parent's
          overflow-x-hidden). */}
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 opacity-50 text-center px-6">
          <Ghost className="w-16 h-16 mb-4 text-muted-foreground stroke-[1.5]" aria-hidden="true" />
          <p className="text-sm font-bold text-muted-foreground w-2/3 mx-auto whitespace-pre-line">
            {!hasAnyFilter ? "No transactions yet.\nYou're saving money!" : "No transactions match your filters."}
          </p>
          {hasAnyFilter && (
            <button onClick={clearAll} style={{ color: accentColor }} className="text-sm font-bold mt-3">
              Clear All Filters
            </button>
          )}
        </div>
      ) : scrollParent ? (
        // Horizontal padding lives on the WRAPPER around <Virtuoso>, not on
        // Virtuoso's own className. Virtuoso renders its items inside an
        // absolutely-positioned sizer that doesn't reliably respect className
        // padding on Android WebView, which is why row cards were previously
        // rendering at full viewport width (100vw) instead of (viewport - 48px).
        // By wrapping Virtuoso in a `px-6` container we force the item width
        // to be (viewport - 48px) via the normal box model, which all
        // browsers agree on.
        <div className="px-6 w-full">
          <Virtuoso
            customScrollParent={scrollParent}
            className="w-full"
            data={filteredTransactions}
            increaseViewportBy={{ top: 200, bottom: 600 }}
            itemContent={(_index, tx) => (
              <div className="pb-4 w-full">
                <SwipeableTransactionRow
                  tx={tx}
                  formatCurrency={formatCurrency}
                  accentColor={accentColor}
                  isOpen={openRowId === tx.id}
                  onOpen={() => setOpenRowId(tx.id)}
                  onClose={() => setOpenRowId((prev) => (prev === tx.id ? null : prev))}
                  onEdit={() => handleEdit(tx.id)}
                  onDelete={() => handleDelete(tx.id)}
                />
              </div>
            )}
            computeItemKey={(_index, tx) => tx.id}
          />
        </div>
      ) : (
        // Brief interim (one render tick before the effect locates <main>).
        // Render nothing instead of a flash of unmounted list.
        null
      )}
    </div>
  );
}
