"use client";

import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
  useDeferredValue,
  memo,
} from "react";
import { Ghost, Edit2, Trash2, Search, X, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Virtuoso } from "react-virtuoso";
import { useAppData } from "@/lib/context";
import type { Transaction } from "@/lib/types";
import {
  parseSearchQuery,
  applySearchQuery,
  describeChips,
  type SearchQuery,
} from "@/lib/searchParser";
import { NativeHaptics } from "@/lib/haptics";
import { TransactionSkeletonList } from "@/components/Skeleton";

type FilterType = "today" | "week" | "all";

// ─── Module-level Intl.DateTimeFormat singletons + date-string cache ─────────
// Reusing formatter instances avoids re-initializing ICU formatters on every
// row (10–30x faster on Android WebView) and lets History open in O(visible)
// instead of pre-formatting all N transactions upfront.
const SHORT_DATE_FMT = new Intl.DateTimeFormat(undefined);
const HEADER_DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

type CachedDateMeta = {
  dayKey: string;
  shortDate: string;
  headerBase: string;
};

const DATE_META_CACHE = new Map<string, CachedDateMeta>();

function getDateMeta(isoDate: string): CachedDateMeta {
  const cached = DATE_META_CACHE.get(isoDate);
  if (cached) return cached;

  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    const fallback = { dayKey: "", shortDate: "", headerBase: "Unknown Date" };
    return fallback;
  }

  const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const meta: CachedDateMeta = {
    dayKey,
    shortDate: SHORT_DATE_FMT.format(d),
    headerBase: HEADER_DATE_FMT.format(d),
  };

  // Cap cache size to prevent unbounded growth over very long sessions
  if (DATE_META_CACHE.size > 4000) {
    DATE_META_CACHE.clear();
  }
  DATE_META_CACHE.set(isoDate, meta);
  return meta;
}

const SWIPE_OPEN_X = -160;
const SWIPE_SNAP_THRESHOLD = -72;

/**
 * High-performance swipeable transaction row using native touch gestures +
 * GPU CSS `translate3d(...)` instead of per-row Framer Motion drag controllers.
 *
 * - Zero Framer Motion instances mounted per row → dramatically faster History
 *   open and 60/120fps fling scrolling on Android WebView.
 * - Zero React re-renders during horizontal swipe drag.
 * - Vertical scroll locks out horizontal swipe immediately so native scrolling
 *   is never impeded.
 */
const SwipeableTransactionRow = memo(function SwipeableTransactionRow({
  tx,
  txCurrency,
  formattedDate,
  formatCurrency,
  accentColor,
  onEdit,
  onDelete,
  isOpen,
  onOpen,
  onClose,
}: {
  tx: Transaction;
  txCurrency?: string;
  formattedDate: string;
  formatCurrency: (n: number, overrideCurrency?: string) => string;
  accentColor: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef<{
    active: boolean;
    locked: "none" | "horizontal" | "vertical";
    startX: number;
    startY: number;
    baseX: number;
    currentX: number;
    startTime: number;
  }>({
    active: false,
    locked: "none",
    startX: 0,
    startY: 0,
    baseX: 0,
    currentX: 0,
    startTime: 0,
  });

  const applyOffset = (px: number, animateTransition: boolean) => {
    const card = cardRef.current;
    const actions = actionsRef.current;
    if (card) {
      card.style.transition = animateTransition
        ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
      card.style.transform = `translate3d(${px}px, 0, 0)`;
    }
    if (actions) {
      const progress = Math.min(1, Math.max(0, -px / Math.abs(SWIPE_OPEN_X)));
      actions.style.transition = animateTransition ? "opacity 180ms ease-out" : "none";
      actions.style.opacity = String(progress);
    }
  };

  // Sync external `isOpen` changes (e.g. when another row opens, close this one)
  useLayoutEffect(() => {
    const targetX = isOpen ? SWIPE_OPEN_X : 0;
    gestureRef.current.currentX = targetX;
    applyOffset(targetX, true);
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const g = gestureRef.current;
    g.active = true;
    g.locked = "none";
    g.startX = touch.clientX;
    g.startY = touch.clientY;
    g.baseX = isOpen ? SWIPE_OPEN_X : 0;
    g.currentX = g.baseX;
    g.startTime = performance.now();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;

    if (g.locked === "none") {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        g.locked = "vertical";
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.locked = "horizontal";
      } else {
        return;
      }
    }

    if (g.locked !== "horizontal") return;

    const rawX = g.baseX + dx;
    // Slight rubber-band resistance beyond bounds
    const clampedX =
      rawX > 0
        ? Math.min(16, rawX * 0.15)
        : rawX < SWIPE_OPEN_X
          ? SWIPE_OPEN_X + (rawX - SWIPE_OPEN_X) * 0.15
          : rawX;

    g.currentX = clampedX;
    applyOffset(clampedX, false);
  };

  const finishSwipe = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;
    if (g.locked !== "horizontal") return;
    g.locked = "none";

    const elapsed = Math.max(1, performance.now() - g.startTime);
    const velocityX = ((g.currentX - g.baseX) / elapsed) * 1000;
    const shouldOpen = g.currentX < SWIPE_SNAP_THRESHOLD || velocityX < -320;

    if (shouldOpen) {
      g.currentX = SWIPE_OPEN_X;
      applyOffset(SWIPE_OPEN_X, true);
      if (!isOpen) {
        onOpen(tx.id);
        NativeHaptics.lightTick();
      }
    } else {
      g.currentX = 0;
      applyOffset(0, true);
      if (isOpen) {
        onClose(tx.id);
      }
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl">
      {/* Action panel behind the card */}
      <div
        ref={actionsRef}
        style={{ opacity: isOpen ? 1 : 0 }}
        className="absolute inset-0 flex items-center justify-end gap-2 pr-4 pointer-events-none"
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={() => onEdit(tx.id)}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-full bg-primary/15 rounded-2xl text-primary"
        >
          <Edit2 className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Edit</span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(tx.id)}
          className="pointer-events-auto flex flex-col items-center justify-center w-16 h-full bg-rose-500/15 rounded-2xl text-rose-500"
        >
          <Trash2 className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] font-black uppercase tracking-wider">Delete</span>
        </button>
      </div>

      {/* Swipeable card */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishSwipe}
        onTouchCancel={finishSwipe}
        onClick={() => {
          if (isOpen) {
            applyOffset(0, true);
            onClose(tx.id);
          }
        }}
        className="relative bg-card p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-soft border border-border/40 group hover:border-primary/20 transition-colors touch-pan-y w-full max-w-full will-change-transform"
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl sm:rounded-l-3xl ${
            tx.type === "Income"
              ? "bg-emerald-500"
              : tx.type === "Expense"
                ? "bg-rose-500"
                : "bg-blue-500"
          }`}
          aria-hidden="true"
        />

        <div className="flex justify-between items-center gap-3 pl-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase truncate">
                {tx.type === "Transfer" && tx.to_account
                  ? `${tx.account} → ${tx.to_account}`
                  : `${tx.type} • ${tx.account}`}
              </span>
              {tx.credit_card_tx_type && (
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5",
                    tx.credit_card_tx_type === "repayment"
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      : tx.credit_card_tx_type === "refund" || tx.credit_card_tx_type === "cashback"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                  )}
                >
                  <CreditCard className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                  {tx.credit_card_tx_type === "repayment"
                    ? "Repayment"
                    : tx.credit_card_tx_type === "purchase"
                      ? "Card Swipe"
                      : tx.credit_card_tx_type}
                </span>
              )}
            </div>
            <h3 className="font-bold text-base text-foreground truncate leading-tight">
              {tx.credit_card_tx_type === "repayment"
                ? "Card Repayment"
                : tx.category || (tx.type === "Income" ? "Income" : tx.type === "Transfer" ? "Transfer" : "General")}
            </h3>
            <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 truncate">
              {formattedDate} {tx.note ? `- ${tx.note}` : ""}
            </p>
          </div>
          <h3
            className={`font-black text-lg tracking-tight shrink-0 ${
              tx.type === "Income"
                ? "text-emerald-500"
                : tx.type === "Expense"
                  ? "text-rose-500"
                  : "text-blue-500"
            }`}
          >
            {tx.type === "Expense" && "-"}
            {tx.type === "Income" && "+"}
            {formatCurrency(Number(tx.amount), txCurrency)}
          </h3>
        </div>

        {/* Keyboard / mouse fallback controls — desktop only. */}
        <div className="hidden md:flex justify-end gap-2 pl-2 mt-3 border-t border-border/30 pt-3 opacity-0 group-hover:opacity-80 group-focus-within:opacity-80 transition-opacity">
          <button
            type="button"
            aria-label={`Edit ${tx.type.toLowerCase()} of ${formatCurrency(Number(tx.amount), txCurrency)}`}
            onClick={(e) => { e.stopPropagation(); onEdit(tx.id); }}
            className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none"
            style={{ borderColor: `${accentColor}15` }}
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${tx.type.toLowerCase()} of ${formatCurrency(Number(tx.amount), txCurrency)}`}
            onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
            className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors focus:outline-none"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function HistoryPage() {
  const {
    transactions,
    accountObjects,
    currency,
    deleteTransaction,
    setEditTransactionId,
    accentColor,
    confirmAction,
    formatCurrency,
    categories,
    setShowTransactionModal,
  } = useAppData();

  const accountCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accountObjects) {
      const code = a.currencyCode || currency;
      if (a.id) map.set(a.id, code);
      map.set(a.name.trim().toLowerCase(), code);
    }
    return map;
  }, [accountObjects, currency]);

  // Legacy shortcut pills, still useful above the power-search bar.
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Power Search state — keep controlled input synchronous/instant while
  // deferring query parsing & full-list filtering so typing never stutters.
  const [searchRaw, setSearchRaw] = useState("");
  const deferredSearch = useDeferredValue(searchRaw);
  const parsedQuery: SearchQuery = useMemo(() => parseSearchQuery(deferredSearch), [deferredSearch]);
  const chips = useMemo(() => describeChips(parsedQuery), [parsedQuery]);

  // Track which row is in swipe-open state — only one at a time.
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Derive unique categories present in transactions + user-defined categories.
  const availableCategories = useMemo(() => {
    const txCats = new Set<string>(categories);
    for (const tx of transactions) {
      if (tx.category) txCats.add(tx.category);
    }
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
          const t = Date.parse(tx.date);
          return t >= startOfToday && t < startOfTomorrow;
        });
      } else if (filter === "week") {
        const dayOfWeek = now.getDay();
        const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();
        const endOfWeek = startOfWeek + 7 * 86400000;
        result = result.filter(tx => {
          const t = Date.parse(tx.date);
          return t >= startOfWeek && t < endOfWeek;
        });
      }
    }

    // Legacy category pill — skipped if power-search specifies #category.
    if (categoryFilter !== "all" && parsedQuery.categories.length === 0) {
      result = result.filter(tx => tx.category === categoryFilter);
    }

    // Power-search filters AND-apply on top.
    if (
      parsedQuery.terms.length > 0 ||
      parsedQuery.categories.length > 0 ||
      parsedQuery.accounts.length > 0 ||
      parsedQuery.amount ||
      parsedQuery.date
    ) {
      result = applySearchQuery(result, parsedQuery);
    }

    return result;
  }, [transactions, filter, categoryFilter, parsedQuery]);

  const handleOpenRow = useCallback((id: string) => {
    setOpenRowId(id);
  }, []);

  const handleCloseRow = useCallback((id: string) => {
    setOpenRowId((prev) => (prev === id ? null : prev));
  }, []);

  const hasAnyFilter =
    filter !== "all" || categoryFilter !== "all" || searchRaw.trim().length > 0;

  const clearAll = () => {
    setFilter("all");
    setCategoryFilter("all");
    setSearchRaw("");
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Resolve AppLayout's `<main>` synchronously on first client render so
  // Virtuoso mounts immediately with ZERO skeleton flash and ZERO rAF delay.
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(() => {
    if (typeof document === "undefined") return null;
    const main = document.querySelector("main");
    return main instanceof HTMLElement ? main : null;
  });

  useLayoutEffect(() => {
    if (scrollParent || typeof document === "undefined") return;
    const main = document.querySelector("main");
    if (main instanceof HTMLElement) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrollParent(main);
    }
  }, [scrollParent]);

  const { todayDayKey, yesterdayDayKey } = useMemo(() => {
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const y = new Date(d);
    y.setDate(d.getDate() - 1);
    const yesterdayKey = `${y.getFullYear()}-${y.getMonth()}-${y.getDate()}`;
    return { todayDayKey: todayKey, yesterdayDayKey: yesterdayKey };
  }, []);

  return (
    <div className="pb-24 overflow-x-hidden max-w-4xl mx-auto">
      <div className="px-3.5 sm:px-6 pt-1 sm:pt-2">
        <div className="flex justify-between items-center mb-2.5 sm:mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">History</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
              Showing <span className="font-black text-foreground">{filteredTransactions.length}</span>
              {transactions.length !== filteredTransactions.length && ` of ${transactions.length}`}{" "}
              transaction{filteredTransactions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Power Search bar */}
        <div className="flex items-center gap-2 bg-card rounded-xl sm:rounded-2xl px-3.5 py-2.5 border border-border/50 shadow-sm mb-2.5">
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
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {chips.map((chip) => (
              <span
                key={chip.key}
                style={{ backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` }}
                className="text-[10px] font-black tracking-wide px-2.5 py-0.5 rounded-full border"
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* Time Filter Pills */}
        <div className="flex gap-1.5 sm:gap-2 mb-2.5">
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
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-colors ${
                  active ? "shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Category Filter Pills — horizontal scroll, clipped to viewport */}
        <div className="-mx-3.5 px-3.5 sm:-mx-6 sm:px-6 overflow-x-auto hide-scrollbar mb-3 sm:mb-4">
          <div className="flex gap-1.5 sm:gap-2 w-max pb-1">
            <button
              onClick={() => setCategoryFilter("all")}
              style={
                categoryFilter === "all"
                  ? { backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` }
                  : {}
              }
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-colors border shrink-0 ${
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
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-colors border shrink-0 ${
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

      {/* Virtualised transaction list — mounts immediately on first paint */}
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6 space-y-4 max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-muted/60 flex items-center justify-center text-muted-foreground shadow-xs">
            {hasAnyFilter ? (
              <Search className="w-8 h-8 stroke-[1.75]" aria-hidden="true" />
            ) : (
              <Ghost className="w-8 h-8 stroke-[1.75]" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              {hasAnyFilter ? "No Matching Transactions" : "No Transactions Recorded"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hasAnyFilter
                ? "No records match your current keyword or category filters. Try clearing filters to see all entries."
                : "Log daily expenses, income, or transfers to start seeing your spending history and cash flow insights."}
            </p>
          </div>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              style={{ backgroundColor: accentColor || "#3b82f6" }}
              className="px-5 py-2.5 rounded-2xl text-white font-bold text-xs shadow-soft hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Reset Filters &amp; Search
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowTransactionModal(true);
                NativeHaptics.lightTick();
              }}
              style={{ backgroundColor: accentColor || "#3b82f6" }}
              className="px-5 py-2.5 rounded-2xl text-white font-bold text-xs shadow-soft hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              + Record First Expense
            </button>
          )}
        </div>
      ) : scrollParent ? (
        <div className="px-6 w-full">
          <Virtuoso
            customScrollParent={scrollParent}
            className="w-full"
            data={filteredTransactions}
            defaultItemHeight={84}
            increaseViewportBy={{ top: 100, bottom: 250 }}
            itemContent={(index, tx) => {
              const meta = getDateMeta(tx.date);
              const prevTx = index > 0 ? filteredTransactions[index - 1] : null;
              const showDateHeader = index === 0 || (prevTx ? meta.dayKey !== getDateMeta(prevTx.date).dayKey : true);
              const dateLabel = showDateHeader
                ? meta.dayKey === todayDayKey
                  ? "Today"
                  : meta.dayKey === yesterdayDayKey
                    ? "Yesterday"
                    : meta.headerBase
                : "";

              return (
                <div className="w-full">
                  {showDateHeader && (
                    <div className="flex items-center gap-3 pt-3 pb-2">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">{dateLabel}</span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                  )}
                  <div className="pb-2.5">
                    <SwipeableTransactionRow
                      tx={tx}
                      txCurrency={
                        (tx.account_id ? accountCurrencyMap.get(tx.account_id) : undefined) ||
                        accountCurrencyMap.get((tx.account || "").trim().toLowerCase()) ||
                        currency
                      }
                      formattedDate={meta.shortDate}
                      formatCurrency={formatCurrency}
                      accentColor={accentColor}
                      isOpen={openRowId === tx.id}
                      onOpen={handleOpenRow}
                      onClose={handleCloseRow}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              );
            }}
            computeItemKey={(_index, tx) => tx.id}
          />
        </div>
      ) : (
        <TransactionSkeletonList count={5} />
      )}
    </div>
  );
}
