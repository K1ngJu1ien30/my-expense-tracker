"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ArrowRight, Sparkles, ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { loadModel, predict, type Prediction, type PredictorModel } from "@/lib/categoryPredictor";
import { AUTO_EXCLUDE_CATEGORIES } from "@/lib/velocity";
import CustomDatePicker from "@/components/CustomDatePicker";

type TxType = "Expense" | "Income" | "Transfer";


function SegmentedControl({ value, onChange }: { value: TxType; onChange: (val: TxType) => void }) {
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
}

/**
 * Single-row horizontal-scroll pill picker.
 *
 * Replaces the old `flex-wrap` grid that stacked 10 categories into 4 rows.
 * Keeps every option discoverable (scrolls with momentum) while collapsing
 * the visual footprint to a single row — roughly 1/3 of the old height for
 * users with many categories.
 *
 * On selection change we smoothly scroll the picked chip into view so a
 * user who picks something that was off-screen sees it confirmed. This is
 * especially important for the Category row since favorites are sorted to
 * the front — a rarely-used category at the end of the list would otherwise
 * vanish the instant it's tapped.
 */
function ScrollPillSelector({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  ariaLabel?: string;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Center the selected chip whenever selection changes. `block: "nearest"`
  // on the cross axis keeps vertical scroll of the parent modal untouched.
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [value]);

  return (
    // Stays inside the parent's padding — we deliberately DON'T use the
    // classic `-mx-6 px-6` bleed-to-edge trick here. That trick broke two
    // things in practice:
    //   1. On Android WebView the `padding-right` on a horizontally-
    //      scrollable flex container is routinely dropped, which made the
    //      last chip touch the screen edge while all other form fields
    //      had proper 24px insets — visually jarring.
    //   2. For Transfer, this selector is nested inside a bordered card
    //      with its own padding. The negative margin pulled chips OUT
    //      of that card's visual bounds.
    // Keeping the row within normal padding sacrifices the subtle "chips
    // fade into the edge" effect but gains predictable alignment across
    // every variant — which is what the user actually notices.
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 snap-x"
    >
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <button
            key={opt}
            ref={isActive ? selectedRef : null}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 snap-start",
              isActive
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-muted text-muted-foreground hover:bg-border"
            )}
          >
            {opt}
          </button>
        );
      })}
      {/* Invisible trailing spacer — gives scroll-snap a bit of breathing
          room past the last chip so the final option doesn't land flush
          against the parent's right padding. Zero visual weight. */}
      <div className="shrink-0 w-2" aria-hidden="true" />
    </div>
  );
}

/**
 * Compact option-chip used for the condensed Options row. Replaces the
 * old full-width toggle-card pattern — saves ~60px of vertical space per
 * chip and reads as a single glanceable row rather than a stack of cards.
 */
function OptionChip({
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
        "relative flex-1 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all border active:scale-[0.97]",
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
}

export default function TransactionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { categories, triggerToast, accentColor, addTransaction, updateTransaction, transactions, editTransactionId, setEditTransactionId, accounts, currency, exchangeRates, triggerDerry, session } = useAppContext();

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    // Seed default accounts once the accounts list arrives from the
    // context loader. This effect is a one-shot form initializer, not a
    // render-driven update — silencing the linter is intentional here.

    if (!account && accounts.length > 0) setAccount(accounts[0]);

    if (!toAccount && accounts.length > 1) setToAccount(accounts[1] || accounts[0]);
    // `account`/`toAccount` deliberately excluded — including them would
    // re-trigger the seed on every pick and overwrite user selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  useEffect(() => {
    if (editTransactionId) {
       const tx = transactions.find(t => t.id === editTransactionId);
       if (tx) {
         // Load-into-form-on-edit — a form initializer, same rationale as
         // the accounts seed above. Not a cascading-render pattern.

         setTxType(tx.type as TxType);
         setCategory(tx.category || categories[0]);
         setAccount(tx.account || "Bank (MBB)");
         if (tx.to_account) setToAccount(tx.to_account);
         setAmount(String(tx.amount));
         setNote(tx.note || "");
         setDate(tx.date ? new Date(tx.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
         setStatus((tx.status as "cleared" | "pending") || "cleared");
         setIsClaimable(tx.is_claimable === true);
         // Normalise undefined to null (see state declaration comment).
         setExcludeFromVelocity(
           tx.exclude_from_velocity === true || tx.exclude_from_velocity === false
             ? tx.exclude_from_velocity
             : null
         );
         // If this row has a manual velocity override, auto-expand "More
         // options" so the user doesn't have to go hunting for the state
         // they set previously.
         if (tx.exclude_from_velocity === true || tx.exclude_from_velocity === false) {
           setShowMoreOptions(true);
         }
         setUserPickedCategory(true); // Editing an existing tx — respect its category
       }
    } else {

       setAmount("");
       setNote("");
       setDate(new Date().toISOString().split("T")[0]);
       setStatus("cleared");
       setIsClaimable(false);
       setExcludeFromVelocity(null);
       setShowMoreOptions(false);
       setUserPickedCategory(false);
       setDismissedForNote("");

    }
  }, [editTransactionId, transactions, categories]);

  // Defensive reset on every fresh open (add-mode, not edit).
  //
  // Why this is separate from the effect above: `AppLayout` keeps this
  // component mounted across opens — it only toggles `isOpen`. Without
  // this effect, transient state set during one session (isClaimable,
  // excludeFromVelocity, the draft amount/note) could leak into the
  // next "New Transaction" session if the `transactions` array didn't
  // happen to change between opens. That's the reported "claimable
  // toggle sometimes ticks itself on without me touching it" bug.
  //
  // We only reset when transitioning from closed → open (tracked below)
  // AND we're in add-mode (no editTransactionId). Edits have their own
  // loader in the effect above.
  useEffect(() => {
    if (isActuallyOpen && !editTransactionId) {
      setIsClaimable(false);
      setExcludeFromVelocity(null);
      setShowMoreOptions(false);
      setShowCurrencyPicker(false);
      setStatus("cleared");
      // Don't reset amount/note/category/account here — those are
      // seeded elsewhere and resetting them would wipe a quick-template
      // pre-fill on the way in.

      // Actively blur whatever the browser thinks is focused.
      //
      // Why: AppLayout keeps this modal mounted across opens. If the
      // user saved a transaction with a note in a previous session,
      // Android WebView sometimes auto-restores focus to that note
      // <input> when the modal re-appears — which makes the Android
      // keyboard spring up on the wrong field. Blurring on open
      // guarantees no field is focused and no keyboard opens. The
      // user can then tap whichever field they actually want to edit.
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    // Only depend on isActuallyOpen / editTransactionId — we want this
    // to fire exactly once per "open as fresh add" transition.
  }, [isActuallyOpen, editTransactionId]);

  // Load the predictor model once when the modal opens. Reload on every open
  // so freshly-learned associations from the previous save are available.
  useEffect(() => {
    if (!isActuallyOpen) return;
    loadModel(session?.user?.id).then(setPredictorModel).catch(() => setPredictorModel({}));
  }, [isActuallyOpen, session?.user?.id]);

  // Re-score the note whenever it changes. Only suggests for new expenses
  // (editing a transaction respects its saved category) and hides the pill
  // once the user has dismissed it or manually changed the category.
  useEffect(() => {

    if (!predictorModel) { setPrediction(null); return; }
    if (txType !== "Expense") { setPrediction(null); return; }
    if (editTransactionId) { setPrediction(null); return; }
    if (userPickedCategory) { setPrediction(null); return; }
    if (!note || note === dismissedForNote) { setPrediction(null); return; }

    const p = predict(predictorModel, note, transactions.length);
    // Don't suggest what's already selected — no value in reaffirming.
    if (p && p.category === category) { setPrediction(null); return; }
    // Also skip if the suggested category isn't in the user's current list
    // (e.g. they renamed/deleted a category after training).
    if (p && !categories.includes(p.category)) { setPrediction(null); return; }
    setPrediction(p);

  }, [note, txType, editTransactionId, userPickedCategory, dismissedForNote, predictorModel, transactions.length, category, categories]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) handleClose();
  };

  const handleClose = () => {
    setIsSubmitting(false);
    setEditTransactionId(null);
    onClose();
  };

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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 rounded-[inherit]"
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
            className="absolute bottom-0 left-0 right-0 bg-card z-[51] rounded-t-[2rem] shadow-heavy flex flex-col max-h-[90vh]"
          >
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 mb-4 cursor-grab active:cursor-grabbing" aria-hidden="true" />

            <div className="px-6 pb-8 overflow-y-auto hide-scrollbar">
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
              <div className="mb-4 py-4 px-4 bg-muted/50 rounded-3xl">
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-5xl font-black text-foreground outline-none flex-1 min-w-0 text-center placeholder:text-muted"
                  />
                </div>

                <AnimatePresence initial={false}>
                  {showCurrencyPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex bg-muted p-1 rounded-xl mt-3 mx-auto w-fit">
                        {["RM", "SGD", "USD", "JPY"].map(c => (
                          <button
                            key={c}
                            onClick={() => { setModalCurrency(c); setShowCurrencyPicker(false); }}
                            style={modalCurrency === c ? { backgroundColor: accentColor, color: "#fff" } : {}}
                            className={`px-3 py-1.5 text-[10px] font-black tracking-wider rounded-lg transition-all ${modalCurrency === c ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {modalCurrency !== currency && amount && (() => {
                  // Convert: amount is in modalCurrency, show equivalent in base (MYR)
                  // exchangeRates is based on MYR, so rates[X] = how many X per 1 MYR
                  const rateMap: Record<string, string> = { "RM": "MYR", "MYR": "MYR", "USD": "USD", "SGD": "SGD", "JPY": "JPY" };
                  const foreignCode = rateMap[modalCurrency] || modalCurrency;
                  const foreignRate = exchangeRates[foreignCode];
                  const converted = foreignRate ? (Number(amount) / foreignRate) : null;
                  return converted !== null ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs font-bold text-muted-foreground bg-background px-3 py-1 rounded-lg border border-border/50 w-fit mx-auto">
                      ≈ {currency} {converted.toFixed(2)}
                    </motion.p>
                  ) : null;
                })()}
              </div>

              <div className="space-y-5">
                {txType === "Transfer" ? (
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 flex flex-col gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">From Account</label>
                      <ScrollPillSelector options={accounts} value={account} onChange={setAccount} ariaLabel="From account" />
                    </div>
                    <div className="flex justify-center rounded-full relative z-10 w-full -my-0.5">
                      <div className="bg-card border border-border p-1 rounded-full shadow-sm text-muted-foreground">
                        <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">To Account</label>
                      <ScrollPillSelector options={accounts} value={toAccount} onChange={setToAccount} ariaLabel="To account" />
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
                    <ScrollPillSelector options={accounts} value={account} onChange={setAccount} ariaLabel="Account" />
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
                      onChange={(c) => { setCategory(c); setUserPickedCategory(true); }}
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
                        onClick={() => setIsClaimable(!isClaimable)}
                        accentColor={accentColor}
                        ariaLabel="Mark as claimable or split bill"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMoreOptions(v => !v)}
                        aria-label="More options"
                        aria-expanded={showMoreOptions}
                        className={cn(
                          "px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all border active:scale-[0.97] flex items-center gap-1.5 shrink-0",
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

                    {/* Velocity-override disclosure — hidden by default since
                        the category auto-rule handles ~90% of cases. Users
                        who DO want to override for a one-off can tap "More"
                        to reveal it. An amber dot on the More button and on
                        the toggle itself marks an active manual override. */}
                    <AnimatePresence initial={false}>
                      {showMoreOptions && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 cursor-pointer"
                            onClick={cycleVelocity}
                            role="button"
                            tabIndex={0}
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
                                {/* Two-state descriptor: shows effective
                                    state + whether the user has overridden
                                    the category auto-rule. Keeping this
                                    flat (no three-way branch) prevents the
                                    "toggle off but dot still there" UX
                                    surprise that the old three-state
                                    cycle produced. */}
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
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                    onChange={e=>setNote(e.target.value)}
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
                      triggerToast("⚠️ Please enter a valid positive amount.");
                      return;
                    }
                    if (parsedAmount > 999999999.99) {
                      triggerToast("⚠️ Amount exceeds maximum supported limit.");
                      return;
                    }

                    if (!account || !account.trim()) {
                      triggerToast("⚠️ Please select an account.");
                      return;
                    }

                    if (txType === "Transfer") {
                      if (accounts.length < 2) {
                        triggerToast("⚠️ Transfers require at least two accounts.");
                        return;
                      }
                      if (!toAccount || !toAccount.trim()) {
                        triggerToast("⚠️ Please select a destination account.");
                        return;
                      }
                      if (account.trim().toLowerCase() === toAccount.trim().toLowerCase()) {
                        triggerToast("⚠️ Source and destination accounts cannot be the same.");
                        return;
                      }
                    }

                    if (txType === "Expense" && (!category || !category.trim())) {
                      triggerToast("⚠️ Please select a category.");
                      return;
                    }

                    const parsedDate = new Date(date);
                    if (isNaN(parsedDate.getTime())) {
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
                         to_account: txType === "Transfer" ? toAccount : undefined,
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
                      };

                      if (editTransactionId) {
                         const updateRes = await updateTransaction(editTransactionId, payload);
                         if (updateRes.success) {
                           triggerToast(`✅ ${txType} updated successfully!`);
                           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                           handleClose();
                         } else {
                           triggerToast(`❌ Update failed: ${updateRes.error || "Please try again."}`);
                           // Input preserved — modal remains open
                         }
                      } else {
                         const saveRes = await addTransaction(payload);
                         if (saveRes.success) {
                           if (saveRes.status === "synced") {
                             triggerToast(`✅ ${txType} saved!`);
                           } else {
                             triggerToast(`⏳ ${txType} saved offline (Pending Sync)`);
                           }
                           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                           handleClose();
                         } else {
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
