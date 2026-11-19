"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ArrowRight, Sparkles, ChevronDown, SlidersHorizontal, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { getCachedModel, loadModel, predict, type Prediction, type PredictorModel } from "@/lib/categoryPredictor";
import { AUTO_EXCLUDE_CATEGORIES } from "@/lib/velocity";
import CustomDatePicker from "@/components/CustomDatePicker";
import type { CreditCardTxType, Account } from "@/lib/types";

type TxType = "Expense" | "Income" | "Transfer";


const SegmentedControl = memo(function SegmentedControl({
  value,
  onChange,
}: {
  value: TxType;
  onChange: (val: TxType) => void;
}) {
  const options: TxType[] = ["Expense", "Income", "Transfer"];
  return (
    <div className="flex bg-muted p-1 rounded-2xl relative w-full mb-5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 py-2 text-sm font-semibold rounded-xl relative z-10 transition-colors",
            value === opt ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value === opt && (
            <motion.div
              layoutId="segment-active"
              className="absolute inset-0 bg-primary rounded-xl -z-10 shadow-sm"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          )}
          {opt}
        </button>
      ))}
    </div>
  );
});

/**
 * Single-row horizontal-scroll pill picker.
 *
 * Replaces the old `flex-wrap` grid that stacked 10 categories into 4 rows.
 * Keeps every option discoverable (scrolls with momentum) while collapsing
 * the visual footprint to a single row — roughly 1/3 of the old height for
 * users with many categories.
 */
const ScrollPillSelector = memo(function ScrollPillSelector({
  options,
  value,
  onChange,
  ariaLabel,
  creditCardKeys,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  ariaLabel?: string;
  creditCardKeys?: ReadonlySet<string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Center the selected chip inside the horizontal row whenever selection changes.
  useEffect(() => {
    const container = containerRef.current;
    const selected = selectedRef.current;
    if (!container || !selected) return;

    const frame = requestAnimationFrame(() => {
      if (!container || !selected || container.clientWidth === 0) return;
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const relativeLeft = selectedRect.left - containerRect.left + container.scrollLeft;
      const targetScrollLeft = relativeLeft - (container.clientWidth / 2) + (selectedRect.width / 2);

      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 snap-x"
    >
      {options.map((opt) => {
        const isActive = value === opt;
        const isCard = creditCardKeys ? creditCardKeys.has(opt.trim().toLowerCase()) : false;

        return (
          <button
            key={opt}
            ref={isActive ? selectedRef : null}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 snap-start inline-flex items-center gap-1.5",
              isActive
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-muted text-muted-foreground hover:bg-border"
            )}
          >
            {isCard && <CreditCard className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />}
            <span>{opt}</span>
          </button>
        );
      })}
      {/* Invisible trailing spacer — gives scroll-snap a bit of breathing
          room past the last chip so the final option doesn't land flush
          against the parent's right padding. Zero visual weight. */}
      <div className="shrink-0 w-2" aria-hidden="true" />
    </div>
  );
});

/**
 * Compact option-chip used for the condensed Options row. Replaces the
 * old full-width toggle-card pattern — saves ~60px of vertical space per
 * chip and reads as a single glanceable row rather than a stack of cards.
 */
const OptionChip = memo(function OptionChip({
  active,
  label,
  onClick,
  accentColor,
  badge,
  ariaLabel,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  accentColor: string;
  badge?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel || label}
      onClick={onClick}
      className={cn(
        "relative flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-colors border active:scale-[0.97]",
        active
          ? "text-white shadow-sm"
          : "bg-muted text-muted-foreground border-border hover:bg-border"
      )}
      style={active ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
    >
      {label}
      {badge && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card"
        />
      )}
    </button>
  );
});

export default function TransactionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { categories, triggerToast, accentColor, addTransaction, updateTransaction, transactions, editTransactionId, setEditTransactionId, accounts, accountObjects, currency, exchangeRates, triggerDerry, session, openCreditCardPayment } = useAppContext();

  const [txType, setTxType] = useState<TxType>("Expense");
  const [modalCurrency, setModalCurrency] = useState(currency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [account, setAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [category, setCategory] = useState(categories[0] || "Food");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<"cleared" | "pending">("cleared");
  const [isClaimable, setIsClaimable] = useState(false);
  // Per-transaction override for Spending Velocity.
  //   • null  → defer to the category auto-rule
  //   • true  → explicitly excluded from velocity
  //   • false → explicitly included (overrides the auto-rule)
  const [excludeFromVelocity, setExcludeFromVelocity] = useState<boolean | null>(null);
  // "More options" disclosure — hides the velocity-override control behind
  // a single tap since the category auto-rule handles the ~90% case.
  // Collapsed by default; expands only when the user wants to override.
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [creditCardTxType, setCreditCardTxType] = useState<CreditCardTxType>("purchase");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Pre-indexed account lookup maps so keystrokes never linearly scan accountObjects
  const { accountLookup, creditCardKeys } = useMemo(() => {
    const byKey = new Map<string, Account>();
    const ccKeys = new Set<string>();
    for (const a of accountObjects) {
      const lower = a.name.trim().toLowerCase();
      byKey.set(lower, a);
      if (a.id) byKey.set(a.id, a);
      if (a.kind === "credit_card") {
        ccKeys.add(lower);
        if (a.id) ccKeys.add(a.id.toLowerCase());
      }
    }
    return { accountLookup: byKey, creditCardKeys: ccKeys };
  }, [accountObjects]);

  const selectedAcc =
    accountLookup.get(account) || accountLookup.get(account.trim().toLowerCase());
  const selectedToAcc =
    accountLookup.get(toAccount) || accountLookup.get(toAccount.trim().toLowerCase());
  const isCreditCardSource = selectedAcc?.kind === "credit_card";
  const isCreditCardDest = selectedToAcc?.kind === "credit_card";

  // Imperative ref for the amount <input>, kept for future use if we ever
  // want to programmatically focus it. NOT auto-focused on open — see the
  // rationale below.
  //
  // UX decision: the modal does NOT auto-focus any field on open.
  //   - `autoFocus` is unreliable because AppLayout keeps the modal
  //     mounted across opens, so it only fires the first time.
  //   - Programmatic focus-on-open is worse: on Android WebView the
  //     keyboard then animates up immediately and covers the form,
  //     and (critically) whichever field Android decides to restore
  //     focus to — amount, note, or nothing — is non-deterministic.
  //     Users reported the keyboard popping up on the wrong field
  //     (note instead of amount) intermittently.
  //   - Doing nothing on open is both simpler and what the user
  //     actually wants: the modal just appears, they tap what they
  //     want to edit. No phantom keyboards.
  const amountInputRef = useRef<HTMLInputElement>(null);

  // ─── Category auto-suggest state ───────────────────────────────────────
  // Loaded once when the modal opens; refreshed on close so learnings from
  // the previous save appear on the next open.
  const [predictorModel, setPredictorModel] = useState<PredictorModel | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  // Dismissed suggestions shouldn't re-appear for the same note in this session.
  const [dismissedForNote, setDismissedForNote] = useState<string>("");
  // Track whether the user manually picked a category so we don't overwrite
  // their choice with a later prediction.
  const [userPickedCategory, setUserPickedCategory] = useState(false);

  const isActuallyOpen = isOpen || editTransactionId !== null;

  // Refs for reading the latest defaults inside one-shot open/edit effects
  // without adding volatile collections to effect dependency arrays.
  const accountsRef = useRef(accounts);
  const accountObjectsRef = useRef(accountObjects);
  const categoriesRef = useRef(categories);
  const currencyRef = useRef(currency);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { accountObjectsRef.current = accountObjects; }, [accountObjects]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { currencyRef.current = currency; }, [currency]);

  // Lifecycle & draft-protection refs:
  //   • wasOpenRef: detects closed → open transitions so add-mode resets
  //     happen ONLY when the modal opens fresh, never on background updates.
  //   • initializedEditIdRef: tracks which editTransactionId has already been
  //     loaded into the form so background `transactions` refreshes cannot
  //     overwrite in-progress edits.
  //   • hasUserDraftRef: set as soon as the user types into amount or note,
  //     guaranteeing background state hydration never erases user input.
  const wasOpenRef = useRef(false);
  const initializedEditIdRef = useRef<string | null>(null);
  const hasUserDraftRef = useRef(false);
  const userPickedAccountRef = useRef(false);
  const userPickedToAccountRef = useRef(false);

  // Resolve ONLY the specific transaction being edited (always null in add
  // mode so changes to `transactions` never even trigger the edit effect).
  const editTransaction = useMemo(
    () => (editTransactionId ? transactions.find(t => t.id === editTransactionId) ?? null : null),
    [editTransactionId, transactions]
  );

  // Category order intentionally follows the user's Settings → Manage
  // Categories drag-order VERBATIM. An earlier iteration tried to
  // re-sort by last-30-day usage frequency, but in practice that:
  //   1. Actively fought the user's explicit drag-order (they already
  //      sorted categories by personal frequency when setting them up).
  //   2. Shifted positions on every save, preventing muscle memory.
  //   3. Pushed rarely-used categories (e.g. "Misc.") off-screen in a
  //      horizontal scroll row, making them easy to miss.
  // Now we trust the user's own ordering — stable, predictable, tappable
  // by position, and aligned with what Settings shows.

  // Seed default account/toAccount/category ONLY when currently empty or
  // still holding a stale placeholder default before user selection (e.g.
  // real accounts arriving right after cold start). Never touches amount,
  // note, or any user-selected field.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!editTransactionId && (!account || (!userPickedAccountRef.current && !accounts.includes(account)))) {
      setAccount(accounts[0]);
    }
    if (!editTransactionId && (!toAccount || (!userPickedToAccountRef.current && !accounts.includes(toAccount)))) {
      setToAccount(accounts[1] || accounts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  useEffect(() => {
    if (categories.length === 0) return;
    if (!editTransactionId && (!category || (!userPickedCategory && !categories.includes(category)))) {
      setCategory(categories[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // Responsibility A: Modal open/close transitions & fresh Add-mode reset.
  // Runs ONLY when `isActuallyOpen` or `editTransactionId` changes — never
  // when transactions, accounts, categories, exchange rates, sync, or
  // predictor state change in the background.
  useEffect(() => {
    if (!isActuallyOpen) {
      wasOpenRef.current = false;
      initializedEditIdRef.current = null;
      hasUserDraftRef.current = false;
      userPickedAccountRef.current = false;
      userPickedToAccountRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (justOpened) {
      // Actively blur whatever the browser thinks is focused (e.g. the "Edit"
      // button just tapped in History or a previously focused input).
      // Blurring on open guarantees no lingering focus pulls the viewport or
      // triggers unwanted soft keyboards.
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }

    // Reset the add form ONLY on closed → open (or edit → add) transition.
    if (!editTransactionId && (justOpened || initializedEditIdRef.current !== null)) {
      initializedEditIdRef.current = null;
      hasUserDraftRef.current = false;
      userPickedAccountRef.current = false;
      userPickedToAccountRef.current = false;

      const curAccounts = accountsRef.current;
      const curCategories = categoriesRef.current;

      setTxType("Expense");
      setModalCurrency(currencyRef.current);
      setShowCurrencyPicker(false);
      setAmount("");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      setStatus("cleared");
      setIsClaimable(false);
      setExcludeFromVelocity(null);
      setShowMoreOptions(false);
      setCreditCardTxType("purchase");
      setUserPickedCategory(false);
      setDismissedForNote("");
      setPrediction(null);
      setAmountError(null);
      setAccountError(null);

      setAccount(prev => (prev && curAccounts.includes(prev) ? prev : curAccounts[0] || ""));
      setToAccount(prev => (prev && curAccounts.includes(prev) ? prev : curAccounts[1] || curAccounts[0] || ""));
      setCategory(prev => (prev && curCategories.includes(prev) ? prev : curCategories[0] || "Food"));
    }
  }, [isActuallyOpen, editTransactionId]);

  // Responsibility B: Load existing transaction in Edit mode.
  // Fires ONLY when `editTransactionId` changes to X or when X first becomes
  // available before the form has been initialized for X. Never overwrites
  // once initialized or if the user already started typing into the current tx.
  useEffect(() => {
    if (!isActuallyOpen || !editTransactionId || !editTransaction) return;
    if (initializedEditIdRef.current === editTransactionId) return;
    // If switching directly from one edit ID to another while open, allow
    // loading the new target transaction and clear the prior draft flag.
    const switchingEditTarget =
      initializedEditIdRef.current !== null && initializedEditIdRef.current !== editTransactionId;
    if (!switchingEditTarget && hasUserDraftRef.current) return;

    initializedEditIdRef.current = editTransactionId;
    hasUserDraftRef.current = false;
    userPickedAccountRef.current = true;
    userPickedToAccountRef.current = true;

    const curAccounts = accountsRef.current;
    const curAccountObjects = accountObjectsRef.current;
    const curCategories = categoriesRef.current;

    setTxType(editTransaction.type as TxType);
    setModalCurrency(currencyRef.current);
    setShowCurrencyPicker(false);
    setCategory(editTransaction.category || curCategories[0] || "Food");

    const matchedAcc = editTransaction.account_id
      ? curAccountObjects.find(a => a.id === editTransaction.account_id)?.name || editTransaction.account
      : editTransaction.account;
    setAccount(matchedAcc || curAccounts[0] || "Bank (MBB)");

    if (editTransaction.to_account || editTransaction.to_account_id) {
      const matchedTo = editTransaction.to_account_id
        ? curAccountObjects.find(a => a.id === editTransaction.to_account_id)?.name || editTransaction.to_account
        : editTransaction.to_account;
      setToAccount(matchedTo || curAccounts[1] || curAccounts[0] || "");
    }

    setAmount(String(editTransaction.amount));
    setNote(editTransaction.note || "");
    setDate(
      editTransaction.date
        ? new Date(editTransaction.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setStatus((editTransaction.status as "cleared" | "pending") || "cleared");
    setIsClaimable(editTransaction.is_claimable === true);
    setExcludeFromVelocity(
      editTransaction.exclude_from_velocity === true || editTransaction.exclude_from_velocity === false
        ? editTransaction.exclude_from_velocity
        : null
    );
    setShowMoreOptions(
      editTransaction.exclude_from_velocity === true || editTransaction.exclude_from_velocity === false
    );
    setCreditCardTxType(editTransaction.credit_card_tx_type || "purchase");
    setUserPickedCategory(true); // Editing an existing tx — respect its category
    setDismissedForNote("");
    setPrediction(null);
    setAmountError(null);
    setAccountError(null);
  }, [isActuallyOpen, editTransactionId, editTransaction]);

  // Load the predictor model from in-memory cache first; only read IndexedDB
  // once in the background if not yet cached. Never blocks typing.
  useEffect(() => {
    if (!isActuallyOpen) return;
    const userId = session?.user?.id;
    const cached = getCachedModel(userId);
    if (cached) {
      setPredictorModel(cached);
      return;
    }
    let cancelled = false;
    loadModel(userId)
      .then((m) => {
        if (!cancelled) setPredictorModel(m);
      })
      .catch(() => {
        if (!cancelled) setPredictorModel({});
      });
    return () => {
      cancelled = true;
    };
  }, [isActuallyOpen, session?.user?.id]);

  // Debounced category prediction (200ms) so typing in the note field stays
  // instantaneous — controlled `note` state updates synchronously, while
  // tokenisation & scoring run only after a brief pause.
  const txCount = transactions.length;
  useEffect(() => {
    if (!predictorModel || txType !== "Expense" || editTransactionId || userPickedCategory || !note || note === dismissedForNote) {
      setPrediction(null);
      return;
    }

    const timer = setTimeout(() => {
      const p = predict(predictorModel, note, txCount);
      if (p && p.category === category) {
        setPrediction(null);
        return;
      }
      if (p && !categories.includes(p.category)) {
        setPrediction(null);
        return;
      }
      setPrediction(p);
    }, 200);

    return () => clearTimeout(timer);
  }, [note, txType, editTransactionId, userPickedCategory, dismissedForNote, predictorModel, txCount, category, categories]);

  const handleSelectAccount = useCallback((val: string) => {
    userPickedAccountRef.current = true;
    setAccount(val);
    setAccountError(prev => (prev ? null : prev));
  }, []);

  const handleSelectToAccount = useCallback((val: string) => {
    userPickedToAccountRef.current = true;
    setToAccount(val);
  }, []);

  const handleSelectCategory = useCallback((c: string) => {
    setCategory(c);
    setUserPickedCategory(true);
  }, []);

  const handleToggleClaimable = useCallback(() => {
    setIsClaimable(prev => !prev);
  }, []);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) handleClose();
  };

  const handleClose = useCallback(() => {
    setIsSubmitting(false);
    setAmountError(null);
    setAccountError(null);
    setEditTransactionId(null);
    onClose();
  }, [onClose, setEditTransactionId]);

  // Keyboard accessibility: dismiss modal on Escape key
  useEffect(() => {
    if (!isActuallyOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActuallyOpen, handleClose]);

  // ─── Derived state for the Options row ─────────────────────────────────
  //
  // Velocity exclusion semantics (simplified from an earlier three-state
  // cycle that proved confusing in practice):
  //
  //   • `null` — defer to the category rule (Bills / Subs / Utilities /
  //     Savings / Transfer auto-exclude; everything else auto-includes).
  //   • `true` / `false` — user-set override that DIFFERS from the
  //     category rule. We never store a `true` when the category already
  //     auto-excludes, nor a `false` when the category already auto-
  //     includes — those cases collapse back to `null` so the override
  //     badge only ever appears when it's meaningful.
  //
  // The UI is therefore a plain two-state toggle: it shows the EFFECTIVE
  // excluded-or-not state, and tapping flips against whatever the
  // category rule says. An amber dot appears when (and only when) the
  // user has actively overridden the category rule.
  const catLower = (category || "").trim().toLowerCase();
  const isCategoryAutoExcluded = AUTO_EXCLUDE_CATEGORIES.has(catLower);
  const effectivelyExcluded =
    excludeFromVelocity === true
      ? true
      : excludeFromVelocity === false
        ? false
        : isCategoryAutoExcluded;
  // "Override active" = user has set the row to something other than what
  // the category rule would produce on its own.
  const isVelocityOverride =
    excludeFromVelocity !== null &&
    excludeFromVelocity !== isCategoryAutoExcluded;

  const cycleVelocity = () => {
    // Simple flip of the EFFECTIVE state.
    //   - If flipping lands on the category-rule default → store null
    //     (no override). This automatically clears a stale badge when the
    //     user toggles back to the default.
    //   - Otherwise store the flipped boolean.
    const nextEffective = !effectivelyExcluded;
    setExcludeFromVelocity(
      nextEffective === isCategoryAutoExcluded ? null : nextEffective
    );
    NativeHaptics.lightTick();
  };

  return (
    <AnimatePresence>
      {isActuallyOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            aria-hidden="true"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-modal-title"
            className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-card z-[51] rounded-t-[2rem] shadow-heavy flex flex-col max-h-[90vh]"
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 mb-4 cursor-grab active:cursor-grabbing" aria-hidden="true" />

            <div className="px-6 pb-[calc(2rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] overflow-y-auto hide-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <h2 id="tx-modal-title" className="text-xl font-bold">{editTransactionId ? "Edit" : "New"} Transaction</h2>
                <button type="button" aria-label="Close" onClick={handleClose} className="p-2 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              <SegmentedControl value={txType} onChange={setTxType} />

              {/* Amount block — tightened padding (py-4 vs old py-6). The RM/SGD/USD/JPY
                  picker that was a row of 4 full-size pills is now collapsed into a
                  single compact currency chip next to the amount. Tapping the chip
                  expands the picker inline only when the user actually needs a
                  non-base currency — which in practice is <5% of saves. */}
              <div
                className={cn(
                  "mb-4 py-4 px-4 rounded-3xl transition-all border",
                  amountError
                    ? "bg-rose-500/10 border-rose-500/80 ring-2 ring-rose-500/20"
                    : "bg-muted/50 border-transparent"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCurrencyPicker(v => !v)}
                    aria-label={`Currency ${modalCurrency} — tap to change`}
                    aria-expanded={showCurrencyPicker}
                    className="flex items-center gap-1 bg-card border border-border/50 rounded-lg px-2 py-1 shrink-0 shadow-sm active:scale-95 transition-all"
                  >
                    <span className="text-[10px] font-black tracking-wider text-foreground">
                      {modalCurrency}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-muted-foreground transition-transform ${showCurrencyPicker ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  <input
                    ref={amountInputRef}
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Amount"
                    aria-invalid={!!amountError}
                    value={amount}
                    onChange={(e) => {
                      hasUserDraftRef.current = true;
                      setAmount(e.target.value);
                      if (amountError) setAmountError(null);
                    }}
                    className={cn(
                      "bg-transparent text-5xl font-black outline-none flex-1 min-w-0 text-center placeholder:text-muted",
                      amountError ? "text-rose-500" : "text-foreground"
                    )}
                  />
                </div>

                {amountError && (
                  <p role="alert" className="text-xs font-bold text-rose-500 text-center mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {amountError}
                  </p>
                )}

                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    showCurrencyPicker ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                  )}
                  aria-hidden={!showCurrencyPicker}
                >
                  <div className="overflow-hidden">
                    <div className="flex bg-muted p-1 rounded-xl mt-3 mx-auto w-fit">
                      {["RM", "SGD", "USD", "JPY"].map(c => (
                        <button
                          key={c}
                          type="button"
                          tabIndex={showCurrencyPicker ? 0 : -1}
                          onClick={() => { setModalCurrency(c); setShowCurrencyPicker(false); }}
                          style={modalCurrency === c ? { backgroundColor: accentColor, color: "#fff" } : {}}
                          className={`px-3 py-1.5 text-[10px] font-black tracking-wider rounded-lg transition-colors ${modalCurrency === c ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {modalCurrency !== currency && amount && (() => {
                  // Convert: amount is in modalCurrency, show equivalent in base (MYR)
                  // exchangeRates is based on MYR, so rates[X] = how many X per 1 MYR
                  const rateMap: Record<string, string> = { "RM": "MYR", "MYR": "MYR", "USD": "USD", "SGD": "SGD", "JPY": "JPY" };
                  const foreignCode = rateMap[modalCurrency] || modalCurrency;
                  const foreignRate = exchangeRates[foreignCode];
                  const converted = foreignRate ? (Number(amount) / foreignRate) : null;
                  return converted !== null ? (
                    <p className="mt-2 text-xs font-bold text-muted-foreground bg-background px-3 py-1 rounded-lg border border-border/50 w-fit mx-auto">
                      ≈ {currency} {converted.toFixed(2)}
                    </p>
                  ) : null;
                })()}
              </div>

              <div className="space-y-5">
                {txType === "Transfer" ? (
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 flex flex-col gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">From Account</label>
                      <ScrollPillSelector options={accounts} value={account} onChange={handleSelectAccount} ariaLabel="From account" creditCardKeys={creditCardKeys} />
                    </div>
                    <div className="flex justify-center rounded-full relative z-10 w-full -my-0.5">
                      <div className="bg-card border border-border p-1 rounded-full shadow-sm text-muted-foreground">
                        <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">To Account</label>
                      <ScrollPillSelector options={accounts} value={toAccount} onChange={handleSelectToAccount} ariaLabel="To account" creditCardKeys={creditCardKeys} />
                    </div>
                    {accounts.length < 2 ? (
                      <p className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl text-center mt-1">
                        ⚠️ Transfers require at least two accounts.
                      </p>
                    ) : account && toAccount && account === toAccount ? (
                      <p className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl text-center mt-1">
                        ⚠️ Source and destination accounts cannot be the same.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Account</label>
                    <ScrollPillSelector
                      options={accounts}
                      value={account}
                      onChange={handleSelectAccount}
                      ariaLabel="Account"
                      creditCardKeys={creditCardKeys}
                    />
                    {accountError && (
                      <p role="alert" className="text-[11px] font-semibold text-rose-500 mt-1 animate-in fade-in">
                        {accountError}
                      </p>
                    )}
                  </div>
                )}

                {/* Credit Card Transaction Context & Classification */}
                {txType === "Expense" && isCreditCardSource && (
                  <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                        <CreditCard className="w-4 h-4 shrink-0 text-purple-500" aria-hidden="true" />
                        <span>Credit Card Expense</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-500/15 px-2 py-0.5 rounded-full">
                        Increases Debt
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Card swipe increases liability. <strong>Does not deduct liquid cash</strong> until you settle the bill.
                    </p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                        Type:
                      </span>
                      {(["purchase", "fee", "interest"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCreditCardTxType(t)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all",
                            creditCardTxType === t
                              ? "bg-purple-600 text-white shadow-xs font-black"
                              : "bg-card text-muted-foreground hover:bg-muted border border-border/60"
                          )}
                        >
                          {t === "purchase" ? "🛒 Purchase" : t === "fee" ? "🏦 Fee" : "📈 Interest"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {txType === "Transfer" && isCreditCardDest && (
                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                        <CreditCard className="w-4 h-4 shrink-0 text-blue-500" aria-hidden="true" />
                        <span>Credit Card Repayment</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                        Reduces Debt
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Transfers funds from <strong>{account || "bank"}</strong> to pay down <strong>{toAccount}</strong> debt. Does not create an extra expense.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        openCreditCardPayment(toAccount);
                      }}
                      className="mt-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 w-fit cursor-pointer"
                    >
                      <span>Open Detailed Credit Card Payment Form</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {txType === "Income" && isCreditCardSource && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <CreditCard className="w-4 h-4 shrink-0 text-emerald-500" aria-hidden="true" />
                        <span>Card Credit / Refund</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                        Reduces Debt
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Credit applied to <strong>{account}</strong>. Lowers your outstanding card liability.
                    </p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                        Type:
                      </span>
                      {(["refund", "cashback"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCreditCardTxType(t)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all",
                            creditCardTxType === t
                              ? "bg-emerald-600 text-white shadow-xs font-black"
                              : "bg-card text-muted-foreground hover:bg-muted border border-border/60"
                          )}
                        >
                          {t === "refund" ? "↩️ Refund" : "🎁 Cashback"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {txType !== "Transfer" && txType !== "Income" && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Category</label>
                    {/*
                      Smart Suggestion Pill — appears only when the predictor
                      is confident. One tap applies the suggestion (and also
                      teaches the model by later save). X dismisses for the
                      current note only.
                    */}
                    <AnimatePresence>
                      {prediction && (
                        <motion.button
                          key={prediction.category}
                          type="button"
                          initial={{ opacity: 0, y: -4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          transition={{ type: "spring", damping: 20, stiffness: 320 }}
                          onClick={() => {
                            setCategory(prediction.category);
                            setUserPickedCategory(true);
                            setPrediction(null);
                            NativeHaptics.lightTick();
                          }}
                          aria-label={`Use suggested category ${prediction.category}`}
                          className="w-full mb-2 flex items-center gap-2.5 bg-card border border-border/50 rounded-xl px-3 py-2 shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all text-left"
                          style={{ borderColor: `${accentColor}33` }}
                        >
                          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Looks like{" "}
                            <span className="font-black" style={{ color: accentColor }}>
                              {prediction.category}
                            </span>
                            ?
                          </span>
                          <span
                            role="presentation"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDismissedForNote(note);
                              setPrediction(null);
                            }}
                            className="ml-auto text-muted-foreground/70 hover:text-muted-foreground p-0.5 cursor-pointer"
                            aria-hidden="true"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <ScrollPillSelector
                      options={categories}
                      value={category}
                      onChange={handleSelectCategory}
                      ariaLabel="Category"
                    />
                  </div>
                )}

                {txType === "Income" && (
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Status</label>
                    <div className="flex bg-muted p-1 rounded-2xl w-full">
                      {(["cleared", "pending"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          className={cn(
                            "flex-1 py-2 text-sm font-semibold rounded-xl relative z-10 transition-colors",
                            status === s ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {status === s && (
                            <motion.div
                              layoutId="status-active"
                              className={`absolute inset-0 rounded-xl -z-10 shadow-sm ${s === "cleared" ? "bg-emerald-500" : "bg-amber-500"}`}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            />
                          )}
                          {s === "cleared" ? "Cleared (In Bank)" : "Pending"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compact Options row — Claimable as a glanceable chip, and
                    a "More" disclosure that reveals velocity override +
                    any future per-tx flags. Replaces the two full-width
                    toggle cards that were stacking ~180px of height. */}
                {txType === "Expense" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <OptionChip
                        active={isClaimable}
                        label={isClaimable ? "✓ Claimable" : "Claimable"}
                        onClick={handleToggleClaimable}
                        accentColor={accentColor}
                        ariaLabel="Mark as claimable or split bill"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMoreOptions(v => !v)}
                        aria-label="More options"
                        aria-expanded={showMoreOptions}
                        className={cn(
                          "px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-colors border active:scale-[0.97] flex items-center gap-1.5 shrink-0",
                          showMoreOptions || isVelocityOverride
                            ? "bg-muted text-foreground border-border"
                            : "bg-muted/60 text-muted-foreground border-border/60 hover:bg-muted"
                        )}
                      >
                        <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                        More
                        {isVelocityOverride && (
                          <span
                            aria-hidden="true"
                            className="w-1.5 h-1.5 rounded-full bg-amber-500"
                          />
                        )}
                      </button>
                    </div>

                    {/* Velocity-override disclosure — CSS grid transition avoids
                        JS height:auto layout measurement on every frame. */}
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                        showMoreOptions ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                      )}
                      aria-hidden={!showMoreOptions}
                    >
                      <div className="overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 cursor-pointer"
                          onClick={cycleVelocity}
                          role="button"
                          tabIndex={showMoreOptions ? 0 : -1}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              cycleVelocity();
                            }
                          }}
                          aria-label={`Exclude from spending velocity — currently ${
                            effectivelyExcluded ? "excluded" : "included"
                          }${isVelocityOverride ? " (manual override)" : " (by category rule)"}`}
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="text-xs font-bold text-foreground">Exclude from Velocity</p>
                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-snug">
                              {effectivelyExcluded ? (
                                <span className="font-semibold" style={{ color: accentColor }}>
                                  Excluded
                                </span>
                              ) : (
                                <span className="font-semibold">Included</span>
                              )}
                              <span className="ml-1 text-muted-foreground/70">
                                {isVelocityOverride ? "— manual override" : "— category rule"}
                              </span>
                            </p>
                          </div>
                          <div
                            className={`w-10 h-6 rounded-full transition-colors relative flex items-center pointer-events-none shrink-0 ${
                              effectivelyExcluded ? "" : "bg-muted border border-border"
                            }`}
                            style={effectivelyExcluded ? { backgroundColor: accentColor } : {}}
                          >
                            <div
                              className={`w-4 h-4 bg-card rounded-full shadow-sm absolute transition-transform ${
                                effectivelyExcluded ? "translate-x-[20px]" : "translate-x-[3px]"
                              }`}
                            />
                            {isVelocityOverride && (
                              <div
                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <CustomDatePicker
                    value={date}
                    onChange={setDate}
                    accentColor={accentColor}
                  />

                  <input
                    type="text"
                    placeholder="Sub-category / Note (Optional)"
                    aria-label="Note"
                    value={note}
                    onChange={(e) => {
                      hasUserDraftRef.current = true;
                      setNote(e.target.value);
                    }}
                    className="w-full bg-muted text-sm px-4 py-2.5 rounded-xl border border-border/50 text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:text-muted-foreground/70"
                  />
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}4D` }}
                  className={cn(
                    "w-full text-white py-4 rounded-xl font-bold active:scale-[0.98] transition-all mt-2 flex items-center justify-center gap-2",
                    isSubmitting && "opacity-70 cursor-not-allowed pointer-events-none"
                  )}
                  onClick={async () => {
                    if (isSubmitting) return;
                    const parsedAmount = Number(amount);
                    if (!amount || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
                      setAmountError("Please enter a valid positive amount.");
                      NativeHaptics.errorShake();
                      triggerToast("⚠️ Please enter a valid positive amount.");
                      return;
                    }
                    if (parsedAmount > 999999999.99) {
                      setAmountError("Amount exceeds maximum supported limit.");
                      NativeHaptics.errorShake();
                      triggerToast("⚠️ Amount exceeds maximum supported limit.");
                      return;
                    }

                    if (!account || !account.trim()) {
                      setAccountError("Please select an account.");
                      NativeHaptics.errorShake();
                      triggerToast("⚠️ Please select an account.");
                      return;
                    }

                    if (txType === "Transfer") {
                      if (accounts.length < 2) {
                        NativeHaptics.errorShake();
                        triggerToast("⚠️ Transfers require at least two accounts.");
                        return;
                      }
                      if (!toAccount || !toAccount.trim()) {
                        NativeHaptics.errorShake();
                        triggerToast("⚠️ Please select a destination account.");
                        return;
                      }
                      if (account.trim().toLowerCase() === toAccount.trim().toLowerCase()) {
                        NativeHaptics.errorShake();
                        triggerToast("⚠️ Source and destination accounts cannot be the same.");
                        return;
                      }
                    }

                    if (txType === "Expense" && (!category || !category.trim())) {
                      NativeHaptics.errorShake();
                      triggerToast("⚠️ Please select a category.");
                      return;
                    }

                    const parsedDate = new Date(date);
                    if (isNaN(parsedDate.getTime())) {
                      NativeHaptics.errorShake();
                      triggerToast("⚠️ Please enter a valid date.");
                      return;
                    }

                    setIsSubmitting(true);

                    try {
                      // 🎈 The Derry Easter Egg
                      const isDerry = Number(amount) === 6.66 || note.toLowerCase().includes('pennywise');
                      if (isDerry) {
                        triggerDerry();
                      }

                      const selectedAcc = accountObjects.find(a => a.name === account || a.id === account);
                      const selectedToAcc = txType === "Transfer"
                        ? accountObjects.find(a => a.name === toAccount || a.id === toAccount)
                        : undefined;

                      let effectiveCcTxType: CreditCardTxType | null = null;
                      if (txType === "Expense" && selectedAcc?.kind === "credit_card") {
                        effectiveCcTxType = creditCardTxType || "purchase";
                      } else if (txType === "Transfer" && selectedToAcc?.kind === "credit_card") {
                        effectiveCcTxType = "repayment";
                      } else if (txType === "Income" && selectedAcc?.kind === "credit_card") {
                        effectiveCcTxType = creditCardTxType === "cashback" ? "cashback" : "refund";
                      }

                      const payload = {
                         type: txType,
                         amount: Number(amount),
                         // Income is a top-level concept — it has no spending
                         // category (Salary, Bonus, etc. are tracked via notes,
                         // not category tags). Transfers get a canonical
                         // "Transfer" tag. Expenses carry the user-picked
                         // category.
                         category:
                           txType === "Transfer"
                             ? "Transfer"
                             : txType === "Income"
                               ? ""
                               : category,
                         account,
                         account_id: selectedAcc?.id,
                         to_account: txType === "Transfer" ? toAccount : undefined,
                         to_account_id: selectedToAcc?.id,
                         note,
                         date: new Date(date).toISOString(),
                         status: txType === "Income" ? status : "cleared",
                         is_claimable: txType === "Expense" ? isClaimable : false,
                         claim_status: txType === "Expense" && isClaimable ? "pending" : "none",
                         // Per-row velocity override. Only persisted when the
                         // user explicitly set it — otherwise we leave it null
                         // so the category auto-rule applies retroactively if
                         // the category is later renamed / reclassified.
                         exclude_from_velocity:
                           txType === "Expense" ? excludeFromVelocity : null,
                         credit_card_tx_type: effectiveCcTxType,
                      };

                      const actionLabel =
                        txType === "Transfer" && selectedToAcc?.kind === "credit_card"
                          ? "Repayment"
                          : txType;

                      if (editTransactionId) {
                         const updateRes = await updateTransaction(editTransactionId, payload);
                         if (updateRes.success) {
                           NativeHaptics.successMedium();
                           triggerToast(`✅ ${actionLabel} updated successfully!`);
                           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                           handleClose();
                         } else {
                           NativeHaptics.errorShake();
                           triggerToast(`❌ Update failed: ${updateRes.error || "Please try again."}`);
                           // Input preserved — modal remains open
                         }
                      } else {
                         const saveRes = await addTransaction(payload);
                         if (saveRes.success) {
                           NativeHaptics.successMedium();
                           if (saveRes.status === "synced") {
                             triggerToast(`✅ ${actionLabel} saved!`);
                           } else {
                             triggerToast(`⏳ ${actionLabel} saved offline (Pending Sync)`);
                           }
                           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                           handleClose();
                         } else {
                           NativeHaptics.errorShake();
                           triggerToast(`❌ Save failed: ${saveRes.error || "Please try again."}`);
                           // Input preserved — modal remains open
                         }
                      }
                    } catch (err) {
                      console.error("Save transaction error:", err);
                      triggerToast("❌ An unexpected error occurred while saving.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editTransactionId
                      ? "Update Record"
                      : txType === "Transfer" && selectedToAcc?.kind === "credit_card"
                        ? "Save Repayment"
                        : `Save ${txType}`}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
