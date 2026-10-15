"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  PlusCircle,
  FileText,
  Info,
  Check,
} from "lucide-react";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import CustomDatePicker from "@/components/CustomDatePicker";
import {
  calculateStatementRemaining,
  calculateMinimumRemaining,
} from "@/lib/hooks/useCreditCardPayments";
import { calculateAccountBalances, convertCurrencySafe } from "@/lib/balance";
import type { CreditCardPaymentType } from "@/lib/types";

export default function CreditCardPaymentModal({
  isOpen,
  onClose,
  initialCardId,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialCardId?: string | null;
}) {
  const {
    accountObjects,
    transactions,
    currency,
    accentColor,
    isOffline,
    triggerToast,
    statements,
    creditCardPayments,
    creditCardAllocations,
    addCreditCardStatement,
    recordCreditCardPayment,
    exchangeRates,
  } = useAppContext();

  // ─── Filter credit cards & liquid payment sources ────────────────────────
  const creditCards = useMemo(
    () => accountObjects.filter((a) => a.kind === "credit_card" && !a.isArchived),
    [accountObjects]
  );

  const liquidSources = useMemo(
    () =>
      accountObjects.filter(
        (a) =>
          a.kind !== "credit_card" &&
          a.kind !== "investment" &&
          !a.isArchived
      ),
    [accountObjects]
  );

  // ─── Active selections ───────────────────────────────────────────────────
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [step, setStep] = useState<"edit" | "review" | "success">("edit");

  // Form inputs
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [preset, setPreset] = useState<CreditCardPaymentType>("custom");
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline "Record Statement" drawer state
  const [showAddStatement, setShowAddStatement] = useState(false);
  const [stDate, setStDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>(() =>
    new Date(Date.now() + 20 * 86400000).toISOString().split("T")[0]
  );
  const [closingBalance, setClosingBalance] = useState<string>("");
  const [minimumPayment, setMinimumPayment] = useState<string>("");
  const [stNote, setStNote] = useState<string>("");
  const [isSavingStatement, setIsSavingStatement] = useState(false);
  const paymentOperationIdRef = useRef<string | null>(null);

  // ─── Initialize selected card and source ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Form reset on modal dismissal: syncs external visibility prop with internal step state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep("edit");
      setErrorMessage(null);
      setShowAddStatement(false);
      paymentOperationIdRef.current = null;
      return;
    }

    if (initialCardId && creditCards.some((c) => c.id === initialCardId || c.name === initialCardId)) {
      const match = creditCards.find((c) => c.id === initialCardId || c.name === initialCardId);
      setSelectedCardId(match?.id || initialCardId);
    } else if (creditCards.length > 0 && (!selectedCardId || !creditCards.some((c) => c.id === selectedCardId))) {
      setSelectedCardId(creditCards[0].id || creditCards[0].name);
    }

    if (liquidSources.length > 0 && (!sourceAccountId || !liquidSources.some((s) => s.id === sourceAccountId))) {
      setSourceAccountId(liquidSources[0].id || liquidSources[0].name);
    }
  }, [isOpen, initialCardId, creditCards, liquidSources, selectedCardId, sourceAccountId]);

  // Selected card object
  const currentCard = useMemo(
    () => creditCards.find((c) => c.id === selectedCardId || c.name === selectedCardId),
    [creditCards, selectedCardId]
  );

  // Selected source account object
  const currentSource = useMemo(
    () => liquidSources.find((s) => s.id === sourceAccountId || s.name === sourceAccountId),
    [liquidSources, sourceAccountId]
  );

  // Multi-currency resolution
  const cardCurrency = (currentCard?.currencyCode || currency).trim().toUpperCase();
  const sourceCurrency = (currentSource?.currencyCode || currency).trim().toUpperCase();
  const isCurrencyMismatch = cardCurrency !== sourceCurrency;

  const conversionEstimate = useMemo(() => {
    if (!isCurrencyMismatch || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return null;
    return convertCurrencySafe(Number(amount), cardCurrency, sourceCurrency, { liveRates: exchangeRates });
  }, [isCurrencyMismatch, amount, cardCurrency, sourceCurrency, exchangeRates]);

  // Balances calculation
  const balancesData = useMemo(
    () => calculateAccountBalances(accountObjects, transactions),
    [accountObjects, transactions]
  );

  // Live card debt: in balance engine, credit card debt is negative balance
  const currentCardDebt = useMemo(() => {
    if (!currentCard) return 0;
    const bal =
      balancesData.balancesByName[currentCard.name] ??
      (Number(currentCard.openingBalance) || 0);
    return bal < 0 ? Math.round(Math.abs(bal) * 100) / 100 : 0;
  }, [currentCard, balancesData]);

  // Source account live balance
  const sourceBalance = useMemo(() => {
    if (!currentSource) return 0;
    return (
      balancesData.balancesByName[currentSource.name] ??
      (Number(currentSource.openingBalance) || 0)
    );
  }, [currentSource, balancesData]);

  // Filter statements belonging to this card
  const cardStatements = useMemo(() => {
    if (!currentCard) return [];
    return statements
      .filter((s) => s.accountId === currentCard.id || s.accountId === currentCard.name)
      .sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());
  }, [statements, currentCard]);

  // Find latest active / unsettled statement
  const activeStatement = useMemo(() => {
    if (!selectedStatementId) {
      // Find oldest unsettled statement or latest statement
      const unsettled = cardStatements.find(
        (s) =>
          !s.isSettled &&
          calculateStatementRemaining(s, creditCardPayments, creditCardAllocations) > 0
      );
      return unsettled || cardStatements[0] || null;
    }
    return cardStatements.find((s) => s.id === selectedStatementId) || null;
  }, [cardStatements, selectedStatementId, creditCardPayments, creditCardAllocations]);

  // Statement calculations
  const statementRemaining = useMemo(() => {
    if (!activeStatement) return 0;
    return calculateStatementRemaining(
      activeStatement,
      creditCardPayments,
      creditCardAllocations
    );
  }, [activeStatement, creditCardPayments, creditCardAllocations]);

  const minimumRemaining = useMemo(() => {
    if (!activeStatement) return 0;
    return calculateMinimumRemaining(
      activeStatement,
      creditCardPayments,
      creditCardAllocations
    );
  }, [activeStatement, creditCardPayments, creditCardAllocations]);

  // Is statement overdue?
  const isStatementOverdue = useMemo(() => {
    if (!activeStatement || activeStatement.isSettled || statementRemaining <= 0) return false;
    const dueTime = new Date(activeStatement.dueDate).getTime();
    const todayTime = new Date(new Date().toISOString().split("T")[0]).getTime();
    return dueTime < todayTime;
  }, [activeStatement, statementRemaining]);

  // Newer unbilled purchases after statement closing date
  const newerUnbilledPurchases = useMemo(() => {
    if (!activeStatement) return currentCardDebt;
    return Math.max(0, Math.round((currentCardDebt - statementRemaining) * 100) / 100);
  }, [currentCardDebt, statementRemaining, activeStatement]);

  // Auto-apply presets when preset button is clicked
  const handleSelectPreset = (p: CreditCardPaymentType) => {
    setPreset(p);
    setErrorMessage(null);
    NativeHaptics.lightTick();

    if (p === "full_statement") {
      setAmount(statementRemaining > 0 ? statementRemaining.toFixed(2) : "");
    } else if (p === "minimum_due") {
      setAmount(minimumRemaining > 0 ? minimumRemaining.toFixed(2) : "");
    } else if (p === "full_outstanding") {
      setAmount(currentCardDebt > 0 ? currentCardDebt.toFixed(2) : "");
    } else if (p === "custom") {
      // Keep existing amount or clear if 0
    }
  };

  // Switch card handler
  const handleCardChange = (cardId: string) => {
    setSelectedCardId(cardId);
    setSelectedStatementId(null);
    setPreset("custom");
    setAmount("");
    setErrorMessage(null);
  };

  // Review validation
  const handleProceedToReview = () => {
    setErrorMessage(null);
    const num = Number(amount);
    if (isNaN(num) || num <= 0) {
      NativeHaptics.errorShake();
      setErrorMessage("Please enter a valid positive payment amount.");
      return;
    }
    if (!currentCard) {
      NativeHaptics.errorShake();
      setErrorMessage("Please select a credit card.");
      return;
    }
    if (!currentSource) {
      NativeHaptics.errorShake();
      setErrorMessage("Please select a source payment account.");
      return;
    }

    // Check unsupported overpayment (> current outstanding debt when debt > 0)
    if (currentCardDebt > 0 && num > currentCardDebt + 0.01) {
      NativeHaptics.errorShake();
      setErrorMessage(
        `Amount exceeds current total card debt (${cardCurrency} ${currentCardDebt.toFixed(2)}). Unsupported overpayment.`
      );
      return;
    }

    if (!paymentOperationIdRef.current) {
      paymentOperationIdRef.current = crypto.randomUUID();
    }
    NativeHaptics.successMedium();
    setStep("review");
  };

  // Confirm and execute payment
  const handleConfirmPayment = async () => {
    if (!currentCard || !currentSource) return;
    if (isOffline) {
      NativeHaptics.errorShake();
      setErrorMessage(
        "Credit card repayments require an active connection. Please connect to the internet."
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!paymentOperationIdRef.current) {
      paymentOperationIdRef.current = crypto.randomUUID();
    }

    const numAmount = Number(amount);
    const res = await recordCreditCardPayment({
      accountId: currentCard.id || currentCard.name,
      sourceAccountId: currentSource.id || currentSource.name,
      statementId: activeStatement?.id || null,
      paymentDate,
      amount: numAmount,
      paymentType: preset,
      note: note ? note.trim() : undefined,
      operationId: paymentOperationIdRef.current,
    });

    setIsSubmitting(false);

    if (res.success) {
      paymentOperationIdRef.current = null;
      NativeHaptics.successMedium();
      setStep("success");
      triggerToast(
        res.status === "pending_sync"
          ? "Payment saved locally (offline sync pending)"
          : "Credit card payment recorded successfully"
      );
    } else {
      NativeHaptics.errorShake();
      setErrorMessage(res.error || "Failed to record payment. Please try again.");
    }
  };

  // Add statement handler
  const handleSaveStatement = async () => {
    if (!currentCard) return;
    const closing = Number(closingBalance);
    const minDue = Number(minimumPayment || 0);

    if (isNaN(closing) || closing <= 0) {
      NativeHaptics.errorShake();
      triggerToast("Please enter a valid statement closing balance.");
      return;
    }
    if (new Date(dueDate) < new Date(stDate)) {
      NativeHaptics.errorShake();
      triggerToast("Due date cannot be earlier than statement date.");
      return;
    }

    setIsSavingStatement(true);
    const res = await addCreditCardStatement({
      accountId: currentCard.id || currentCard.name,
      statementDate: stDate,
      dueDate,
      closingBalance: closing,
      minimumPayment: isNaN(minDue) ? 0 : minDue,
      note: stNote ? stNote.trim() : undefined,
    });

    setIsSavingStatement(false);

    if (res.success && res.statement) {
      NativeHaptics.successMedium();
      setShowAddStatement(false);
      setSelectedStatementId(res.statement.id);
      setClosingBalance("");
      setMinimumPayment("");
      setStNote("");
      // Suggest full statement preset
      setPreset("full_statement");
      setAmount(closing.toFixed(2));
    } else {
      triggerToast(res.error || "Failed to record statement.");
    }
  };

  // Reset form
  const handleResetForm = () => {
    setStep("edit");
    setAmount("");
    setNote("");
    setPreset("custom");
    setErrorMessage(null);
  };

  // Drag handle for bottom sheet
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  };

  // Keyboard accessibility: dismiss modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-payment-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="bg-card w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-heavy border border-border/50 max-h-[92vh] flex flex-col overflow-hidden text-foreground"
        >
          {/* Header */}
          <div className="pt-3 px-6 pb-4 border-b border-border/30 bg-muted/20 relative">
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing sm:hidden" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-soft"
                  style={{ backgroundColor: accentColor || "#3b82f6" }}
                >
                  <CreditCard className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="cc-payment-modal-title" className="text-lg font-black tracking-tight leading-tight">
                    Pay Credit Card
                  </h2>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Statement settlement & ledger repayment
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Tabs: Payment vs History */}
                <div className="flex bg-muted p-0.5 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("form")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all",
                      activeTab === "form"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all",
                      activeTab === "history"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    History
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close payment modal"
                  className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-4 pb-[calc(1.25rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] sm:pb-5">
            {creditCards.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base">No Credit Cards Configured</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Add a credit card account from Profile → Manage Accounts to track card limits, statements, and repayments.
                </p>
              </div>
            ) : activeTab === "history" ? (
              /* Payment History View */
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                  Recent Repayments for {currentCard?.name}
                </h3>
                {creditCardPayments.filter(
                  (p) =>
                    p.accountId === currentCard?.id ||
                    p.accountId === currentCard?.name
                ).length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-xs font-medium bg-muted/20 rounded-2xl border border-dashed border-border/60">
                    No payment history recorded for this card yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {creditCardPayments
                      .filter(
                        (p) =>
                          p.accountId === currentCard?.id ||
                          p.accountId === currentCard?.name
                      )
                      .map((p) => {
                        const src = accountObjects.find(
                          (a) => a.id === p.sourceAccountId || a.name === p.sourceAccountId
                        );
                        const paymentAllocations = creditCardAllocations.filter(
                          (a) => a.paymentId === p.id
                        );
                        const totalAllocated = paymentAllocations.reduce(
                          (sum, a) => sum + Number(a.allocatedAmount || 0),
                          0
                        );
                        const unbilledAmount = Math.max(
                          0,
                          Math.round((Number(p.amount) - totalAllocated) * 100) / 100
                        );

                        return (
                          <div
                            key={p.id}
                            className="bg-card p-3.5 rounded-2xl border border-border/60 flex items-center justify-between shadow-sm"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">
                                  From {src?.name || "Bank Account"}
                                </span>
                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                  {p.paymentType.replace("_", " ")}
                                </span>
                                {p.transactionId && (
                                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">
                                    Ledger Linked
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(p.paymentDate).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                                {p.note ? ` • ${p.note}` : ""}
                              </p>
                              {paymentAllocations.length > 0 && (
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  Allocated to statement: {currency} {totalAllocated.toFixed(2)}
                                  {unbilledAmount > 0.01
                                    ? ` • Unbilled: ${currency} ${unbilledAmount.toFixed(2)}`
                                    : ""}
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              +{currency} {Number(p.amount).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : step === "success" ? (
              /* Success State */
              <div className="text-center py-10 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-soft">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black tracking-tight">Payment Recorded!</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Repayment transfer posted to general ledger. Your credit card liability and bank balance have been updated.
                  </p>
                </div>
                {isOffline && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2 justify-center">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Saved locally. Will synchronize with cloud automatically once back online.</span>
                  </div>
                )}
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="flex-1 py-3 text-xs font-bold bg-muted hover:bg-border rounded-xl transition-colors"
                  >
                    Make Another Payment
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 text-xs font-bold text-white bg-primary rounded-xl transition-all shadow-soft"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : step === "review" ? (
              /* Confirmation Summary Step */
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-2xl border border-border/60 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
                    Review Payment Confirmation
                  </h3>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">From Account</span>
                    <span className="font-bold text-foreground">{currentSource?.name}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">To Credit Card</span>
                    <span className="font-bold text-foreground">
                      {currentCard?.name} {currentCard?.cardDetails?.cardLastFour ? `(•• ${currentCard.cardDetails.cardLastFour})` : ""}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Payment Date</span>
                    <span className="font-bold text-foreground">{paymentDate}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Payment Preset</span>
                    <span className="font-bold text-primary uppercase text-xs">
                      {preset.replace("_", " ")}
                    </span>
                  </div>

                  {activeStatement && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Statement Cycle</span>
                      <span className="font-semibold text-foreground text-xs">
                        {activeStatement.statementDate} (Due: {activeStatement.dueDate})
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                    <span className="font-bold text-foreground">Payment Amount</span>
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {cardCurrency} {Number(amount).toFixed(2)}
                      </span>
                      {isCurrencyMismatch && conversionEstimate && conversionEstimate.isKnown && (
                        <span className="text-[10px] text-muted-foreground block font-medium">
                          ≈ {sourceCurrency} {conversionEstimate.amount.toFixed(2)} (estimated debit)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Impact projection */}
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs space-y-1.5 text-blue-600 dark:text-blue-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Projected Balances Post-Payment:</span>
                  </div>
                  <div className="flex justify-between pl-5">
                    <span>{currentSource?.name} Balance:</span>
                    <span className="font-mono font-bold">
                      {sourceCurrency}{" "}
                      {isCurrencyMismatch && conversionEstimate && conversionEstimate.isKnown
                        ? `${(sourceBalance - conversionEstimate.amount).toFixed(2)} (est.)`
                        : (sourceBalance - Number(amount)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pl-5">
                    <span>{currentCard?.name} Debt:</span>
                    <span className="font-mono font-bold">
                      {cardCurrency} {Math.max(0, currentCardDebt - Number(amount)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      paymentOperationIdRef.current = null;
                      setStep("edit");
                    }}
                    className="flex-1 py-3 text-xs font-bold bg-muted hover:bg-border rounded-xl transition-colors disabled:opacity-50"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting || isOffline}
                    onClick={handleConfirmPayment}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold rounded-xl transition-all shadow-soft flex items-center justify-center gap-2",
                      isOffline
                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                        : "bg-primary text-white hover:opacity-95 cursor-pointer disabled:opacity-50"
                    )}
                  >
                    {isOffline ? (
                      <span>Offline — Connect to Submit</span>
                    ) : isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Pay</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Main Form View */
              <div className="space-y-4">
                {/* 1. Credit Card Picker */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Select Credit Card
                  </label>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    {creditCards.map((card) => {
                      const isSelected = (card.id || card.name) === selectedCardId;
                      const cardDebt =
                        balancesData.balancesByName[card.name] < 0
                          ? Math.abs(balancesData.balancesByName[card.name])
                          : 0;
                      const cCur = (card.currencyCode || currency).trim().toUpperCase();
                      return (
                        <button
                          key={card.id || card.name}
                          type="button"
                          onClick={() => handleCardChange(card.id || card.name)}
                          className={cn(
                            "flex-1 min-w-[150px] p-3 rounded-2xl border text-left transition-all shrink-0",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-soft"
                              : "border-border/60 bg-muted/20 hover:border-border"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-bold text-foreground truncate block">
                              {card.name}
                            </span>
                            {card.cardDetails?.cardLastFour && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                ••{card.cardDetails.cardLastFour}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs font-black font-mono block",
                              cardDebt > 0 ? "text-rose-500" : "text-emerald-500"
                            )}
                          >
                            {cCur} {cardDebt.toFixed(2)} debt
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Card Status & Statement Overview Card */}
                <div className="p-4 bg-muted/20 rounded-2xl border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      Statement & Debt Status
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddStatement(!showAddStatement)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      {showAddStatement ? "Cancel" : "Record Statement"}
                    </button>
                  </div>

                  {/* Inline Statement Form */}
                  {showAddStatement && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3.5 bg-card rounded-xl border border-border space-y-3"
                    >
                      <span className="text-xs font-bold text-foreground block">
                        Record New Issued Statement
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                            Statement Date
                          </label>
                          <CustomDatePicker value={stDate} onChange={setStDate} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                            Due Date
                          </label>
                          <CustomDatePicker value={dueDate} onChange={setDueDate} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                            Closing Balance ({cardCurrency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="500.00"
                            value={closingBalance}
                            onChange={(e) => setClosingBalance(e.target.value)}
                            className="w-full bg-muted px-3 py-2 rounded-xl text-xs font-semibold outline-none border border-border text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                            Minimum Payment ({cardCurrency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="50.00"
                            value={minimumPayment}
                            onChange={(e) => setMinimumPayment(e.target.value)}
                            className="w-full bg-muted px-3 py-2 rounded-xl text-xs font-semibold outline-none border border-border text-foreground"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSavingStatement}
                        onClick={handleSaveStatement}
                        className="w-full py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                      >
                        {isSavingStatement ? "Saving..." : "Save Statement"}
                      </button>
                    </motion.div>
                  )}

                  {/* Statement Selection Dropdown if multiple exist */}
                  {cardStatements.length > 1 && !showAddStatement && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-semibold">Cycle:</span>
                      <select
                        value={activeStatement?.id || ""}
                        onChange={(e) => setSelectedStatementId(e.target.value)}
                        className="bg-card text-xs font-semibold px-2 py-1 rounded-lg border border-border outline-none text-foreground flex-1"
                      >
                        {cardStatements.map((st) => (
                          <option key={st.id} value={st.id}>
                            Stmt: {st.statementDate} (Due {st.dueDate}) — {st.isSettled ? "Settled" : `${cardCurrency} ${st.closingBalance}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Contextual Status Badges & Descriptions */}
                  {!activeStatement ? (
                    /* State: No issued statement */
                    <div className="p-3 bg-card rounded-xl border border-border/80 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <Info className="w-4 h-4 text-blue-500" />
                        <span>No issued statement on file</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-6">
                        You can pay your current outstanding card balance directly without creating a fake statement.
                      </p>
                    </div>
                  ) : activeStatement.isSettled || statementRemaining <= 0 ? (
                    /* State: Statement fully paid */
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1 text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          Statement Fully Paid
                        </span>
                        <span className="font-mono">{cardCurrency} 0.00 due</span>
                      </div>
                      {newerUnbilledPurchases > 0 ? (
                        <p className="text-[11px] text-muted-foreground pl-5.5">
                          Statement is settled, but you have{" "}
                          <strong className="text-foreground">
                            {cardCurrency} {newerUnbilledPurchases.toFixed(2)}
                          </strong>{" "}
                          in newer unbilled purchases made after statement closing.
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground pl-5.5">
                          Card has zero outstanding debt.
                        </p>
                      )}
                    </div>
                  ) : isStatementOverdue ? (
                    /* State: Statement overdue */
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1 text-rose-500">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Statement Overdue
                        </span>
                        <span className="font-mono">Due: {activeStatement.dueDate}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pl-5.5 font-medium">
                        <span>Remaining: {cardCurrency} {statementRemaining.toFixed(2)}</span>
                        <span>Min Due: {cardCurrency} {minimumRemaining.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    /* State: Statement partially paid or active */
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 text-amber-600 dark:text-amber-400">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 shrink-0" />
                          Statement Payment Due
                        </span>
                        <span className="font-mono">Due {activeStatement.dueDate}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] pl-5.5 font-medium">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Closing</span>
                          <span className="font-bold text-foreground">
                            {cardCurrency} {activeStatement.closingBalance.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Remaining</span>
                          <span className="font-bold text-amber-500">
                            {cardCurrency} {statementRemaining.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Min Due</span>
                          <span className="font-bold text-foreground">
                            {cardCurrency} {minimumRemaining.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Total Debt Summary */}
                  <div className="flex justify-between items-center text-xs pt-1 px-1">
                    <span className="text-muted-foreground">Current Card Total Outstanding:</span>
                    <span className="font-black text-sm text-foreground font-mono">
                      {cardCurrency} {currentCardDebt.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 3. The 4 Presets */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Payment Presets
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Preset 1: Pay Remaining Statement */}
                    <button
                      type="button"
                      disabled={!activeStatement || statementRemaining <= 0}
                      onClick={() => handleSelectPreset("full_statement")}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all relative overflow-hidden",
                        preset === "full_statement"
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-muted/20 hover:border-border",
                        (!activeStatement || statementRemaining <= 0) && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">Remaining Statement</span>
                        <span className="text-[10px] font-bold text-primary">#1</span>
                      </div>
                      <span className="text-xs font-black font-mono block text-foreground">
                        {cardCurrency} {statementRemaining.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                        Settle billing statement
                      </span>
                    </button>

                    {/* Preset 2: Pay Minimum Due */}
                    <button
                      type="button"
                      disabled={!activeStatement || minimumRemaining <= 0}
                      onClick={() => handleSelectPreset("minimum_due")}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all relative overflow-hidden",
                        preset === "minimum_due"
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-muted/20 hover:border-border",
                        (!activeStatement || minimumRemaining <= 0) && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">Minimum Due</span>
                        <span className="text-[10px] font-bold text-primary">#2</span>
                      </div>
                      <span className="text-xs font-black font-mono block text-foreground">
                        {cardCurrency} {minimumRemaining.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                        Avoid late penalties
                      </span>
                    </button>

                    {/* Preset 3: Custom Amount */}
                    <button
                      type="button"
                      onClick={() => handleSelectPreset("custom")}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all relative overflow-hidden",
                        preset === "custom"
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-muted/20 hover:border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">Custom / Partial</span>
                        <span className="text-[10px] font-bold text-primary">#3</span>
                      </div>
                      <span className="text-xs font-black font-mono block text-foreground">
                        Flexible
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                        Enter any amount
                      </span>
                    </button>

                    {/* Preset 4: Full Outstanding Debt */}
                    <button
                      type="button"
                      disabled={currentCardDebt <= 0}
                      onClick={() => handleSelectPreset("full_outstanding")}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all relative overflow-hidden",
                        preset === "full_outstanding"
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-muted/20 hover:border-border",
                        currentCardDebt <= 0 && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">Full Outstanding</span>
                        <span className="text-[10px] font-bold text-primary">#4</span>
                      </div>
                      <span className="text-xs font-black font-mono block text-foreground">
                        {cardCurrency} {currentCardDebt.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                        Zero out all card debt
                      </span>
                    </button>
                  </div>
                </div>

                {/* 4. Payment Amount Input */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Payment Amount ({cardCurrency})
                    </label>
                    {preset === "minimum_due" && (
                      <span className="text-[10px] text-amber-500 font-semibold">
                        Note: Minimum payment does not settle statement
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                      {cardCurrency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      aria-invalid={!!errorMessage}
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setPreset("custom");
                        setErrorMessage(null);
                      }}
                      className={cn(
                        "w-full bg-muted/30 border pl-14 pr-4 py-3 rounded-2xl text-lg font-black outline-none transition-all font-mono",
                        errorMessage && (isNaN(Number(amount)) || Number(amount) <= 0 || (currentCardDebt > 0 && Number(amount) > currentCardDebt + 0.01))
                          ? "border-rose-500/80 ring-2 ring-rose-500/20 text-rose-500"
                          : "border-border/80 focus:border-primary text-foreground"
                      )}
                    />
                  </div>

                  {/* Multi-Currency Repayment Notice Banner */}
                  {isCurrencyMismatch && (
                    <div className="mt-2.5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs space-y-1 text-blue-600 dark:text-blue-300">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Multi-Currency Repayment Notice</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Paying to <strong>{currentCard?.name}</strong> ({cardCurrency}) from{" "}
                        <strong>{currentSource?.name}</strong> ({sourceCurrency}).
                        {conversionEstimate && conversionEstimate.isKnown ? (
                          <span> Estimated deduction: <strong>{sourceCurrency} {conversionEstimate.amount.toFixed(2)}</strong> for {cardCurrency} {Number(amount || 0).toFixed(2)} payment.</span>
                        ) : (
                          <span> Exchange rate is unrated; repayment will be recorded with exact nominal units between accounts.</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* 5. Payment Source Account */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Payment Source Account
                  </label>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                    {liquidSources.map((acc) => {
                      const isSelected = (acc.id || acc.name) === sourceAccountId;
                      const bal =
                        balancesData.balancesByName[acc.name] ??
                        (Number(acc.openingBalance) || 0);
                      const accCur = (acc.currencyCode || currency).trim().toUpperCase();
                      return (
                        <button
                          key={acc.id || acc.name}
                          type="button"
                          onClick={() => {
                            setSourceAccountId(acc.id || acc.name);
                            setErrorMessage(null);
                          }}
                          className={cn(
                            "flex-1 min-w-[130px] p-2.5 rounded-2xl border text-left transition-all shrink-0",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-soft"
                              : "border-border/60 bg-muted/20 hover:border-border"
                          )}
                        >
                          <span className="text-xs font-bold text-foreground truncate block">
                            {acc.name}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                            {accCur} {bal.toFixed(2)} avail
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Insufficient Source Balance Warning (Non-blocking) */}
                  {((!isCurrencyMismatch && Number(amount) > sourceBalance) ||
                    (isCurrencyMismatch && conversionEstimate?.isKnown && conversionEstimate.amount > sourceBalance)) &&
                    sourceBalance > 0 && (
                    <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Source balance appears insufficient ({sourceCurrency} {sourceBalance.toFixed(2)} available
                        {isCurrencyMismatch && conversionEstimate?.isKnown ? `, estimated required: ${sourceCurrency} ${conversionEstimate.amount.toFixed(2)}` : ""}).
                        You may still proceed if your account has external funds.
                      </span>
                    </div>
                  )}
                </div>

                {/* 6. Payment Date & Optional Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Payment Date
                    </label>
                    <CustomDatePicker value={paymentDate} onChange={setPaymentDate} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Optional Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. October partial payment"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full bg-muted/30 border border-border/80 px-3 py-2.5 rounded-2xl text-xs font-semibold outline-none text-foreground"
                    />
                  </div>
                </div>

                {/* Offline Notice Banner */}
                {isOffline && (
                  <div
                    role="status"
                    className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>
                      You are currently offline. Credit card repayments require an active connection to ensure statement settlements and ledger balances settle atomically. All your entered details are preserved.
                    </span>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div role="alert" className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Button: Review Payment */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isOffline}
                    onClick={handleProceedToReview}
                    className={cn(
                      "w-full py-3.5 rounded-2xl font-bold text-sm shadow-soft transition-all flex items-center justify-center gap-2",
                      isOffline
                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                        : "bg-primary text-white hover:opacity-95 cursor-pointer"
                    )}
                  >
                    {isOffline ? (
                      <span>Offline — Connect to Submit</span>
                    ) : (
                      <>
                        <span>Review Payment</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
