"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  Gift,
  Sliders,
  Plus,
  Trash2,
  Check,
  CreditCard,
  Landmark,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type {
  Account,
  CardRewardRule,
  CardRewardsConfig,
  CashbackDestination,
  CashbackRecord,
} from "@/lib/types";
import { NativeHaptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { DEFAULT_CASHBACK_RULES } from "@/lib/cashbackEngine";
import { useAppContext } from "@/lib/context";

export type CreditCardCashbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  card: Account;
  accountObjects: Account[];
  currency: string;
  accentColor: string;
  config?: CardRewardsConfig | null;
  cashbackRecords: CashbackRecord[];
  onSaveConfig: (config: CardRewardsConfig) => Promise<void>;
  onRecordCashback: (params: {
    card: Account;
    destinationAccount: Account;
    creditDestination: CashbackDestination;
    amount: number;
    date: string;
    note?: string;
  }) => Promise<{ success: boolean; error?: string }>;
};

export default function CreditCardCashbackModal({
  isOpen,
  onClose,
  card,
  accountObjects,
  currency,
  accentColor,
  config,
  cashbackRecords,
  onSaveConfig,
  onRecordCashback,
}: CreditCardCashbackModalProps) {
  const { isOffline } = useAppContext();
  const [activeTab, setActiveTab] = useState<"record" | "rules">("record");

  // ─── Record Cashback State ───────────────────────────────────────────────
  const [amountStr, setAmountStr] = useState("");
  const [destination, setDestination] = useState<CashbackDestination>("card_statement_credit");
  const [destAccountId, setDestAccountId] = useState<string>(() => {
    const bank = accountObjects.find(
      (a) => a.kind !== "credit_card" && !a.isArchived && a.name !== card.name
    );
    return bank ? bank.id || bank.name : "";
  });
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Rules Config State ──────────────────────────────────────────────────
  const [isEnabled, setIsEnabled] = useState<boolean>(() => config?.isEnabled ?? true);
  const [monthlyCapStr, setMonthlyCapStr] = useState<string>(() =>
    config?.monthlyCap ? String(config.monthlyCap) : ""
  );
  const [minSpendStr, setMinSpendStr] = useState<string>(() =>
    config?.minSpendThreshold ? String(config.minSpendThreshold) : ""
  );
  const [rules, setRules] = useState<CardRewardRule[]>(() =>
    config?.rules && config.rules.length > 0 ? config.rules : DEFAULT_CASHBACK_RULES
  );
  const [newCatName, setNewCatName] = useState("");
  const [newCatRate, setNewCatRate] = useState("");
  const [isSavingRules, setIsSavingRules] = useState(false);

  // Filter valid bank / cash accounts for deposit destination
  const bankAccounts = useMemo(
    () => accountObjects.filter((a) => a.kind !== "credit_card" && !a.isArchived),
    [accountObjects]
  );

  // Find target destination account object
  const targetDestAccount = useMemo(() => {
    if (destination === "card_statement_credit") return card;
    return (
      bankAccounts.find((a) => a.id === destAccountId || a.name === destAccountId) ||
      bankAccounts[0] ||
      card
    );
  }, [destination, destAccountId, bankAccounts, card]);

  // Filter records for this card
  const cardCashbackHistory = useMemo(() => {
    const cardId = card.id || card.name;
    return cashbackRecords.filter(
      (r) => r.cardId === cardId || r.cardName.toLowerCase() === card.name.toLowerCase()
    );
  }, [cashbackRecords, card]);

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

  // Handle Record Cashback Submit
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isOffline) {
      NativeHaptics.errorShake();
      setFormError("⚠️ Offline: An active network connection is required to record confirmed cashback redemptions.");
      return;
    }

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      NativeHaptics.errorShake();
      setFormError("Please enter a valid positive cashback amount.");
      return;
    }

    if (!targetDestAccount) {
      NativeHaptics.errorShake();
      setFormError("Please select a valid destination account.");
      return;
    }

    setIsSubmitting(true);
    NativeHaptics.lightTick();

    const result = await onRecordCashback({
      card,
      destinationAccount: targetDestAccount,
      creditDestination: destination,
      amount: amt,
      date: dateStr,
      note: note.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      NativeHaptics.successMedium();
      setAmountStr("");
      setNote("");
      onClose();
    } else {
      NativeHaptics.errorShake();
      setFormError(result.error || "Failed to record cashback.");
    }
  };

  // Handle Save Rules Submit
  const handleSaveRules = async () => {
    setIsSavingRules(true);
    NativeHaptics.lightTick();

    const parsedCap = monthlyCapStr.trim() ? parseFloat(monthlyCapStr) : null;
    const cleanCap = parsedCap !== null && !isNaN(parsedCap) && parsedCap >= 0 ? parsedCap : null;

    const parsedMin = minSpendStr.trim() ? parseFloat(minSpendStr) : null;
    const cleanMin = parsedMin !== null && !isNaN(parsedMin) && parsedMin >= 0 ? parsedMin : null;

    const updatedConfig: CardRewardsConfig = {
      accountId: card.id || card.name,
      isEnabled,
      rules,
      monthlyCap: cleanCap,
      minSpendThreshold: cleanMin,
    };

    await onSaveConfig(updatedConfig);
    setIsSavingRules(false);
    NativeHaptics.successMedium();
    setActiveTab("record");
  };

  // Add category rule
  const handleAddRule = () => {
    const cat = newCatName.trim();
    const rate = parseFloat(newCatRate);
    if (!cat || isNaN(rate) || rate <= 0) return;

    setRules((prev) => [
      ...prev.filter((r) => r.category.toLowerCase() !== cat.toLowerCase()),
      { category: cat, ratePct: rate },
    ]);
    setNewCatName("");
    setNewCatRate("");
  };

  const handleDeleteRule = (category: string) => {
    setRules((prev) => prev.filter((r) => r.category !== category));
  };

  const handleApplyDefaults = () => {
    setRules(DEFAULT_CASHBACK_RULES);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-cashback-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border/80 shadow-heavy overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-soft"
              style={{ backgroundColor: card.cardDetails?.cardColor || accentColor || "#3b82f6" }}
            >
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cc-cashback-modal-title" className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Cashback & Rewards</span>
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {card.name} ••{card.cardDetails?.cardLastFour || "0000"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-1 border-b border-border/40 flex gap-2 bg-muted/10">
          <button
            type="button"
            onClick={() => {
              setActiveTab("record");
              NativeHaptics.lightTick();
            }}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === "record"
                ? "bg-primary text-white shadow-soft"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Record Confirmed Cashback</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("rules");
              NativeHaptics.lightTick();
            }}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              activeTab === "rules"
                ? "bg-primary text-white shadow-soft"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Reward Rules & Rates</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 hide-scrollbar">
          {activeTab === "record" ? (
            /* ─── TAB 1: RECORD CONFIRMED CASHBACK ───────────────────────── */
            <form onSubmit={handleRecordSubmit} className="space-y-4">
              {formError && (
                <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2 text-rose-500 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">
                  Cashback Amount Received
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground text-sm">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    aria-invalid={!!formError}
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className={cn(
                      "w-full pl-12 pr-4 py-3 rounded-2xl bg-muted/40 border font-mono font-black text-lg outline-none transition-colors",
                      formError
                        ? "border-rose-500/80 ring-2 ring-rose-500/20 text-rose-500"
                        : "border-border/80 focus:border-primary text-foreground"
                    )}
                  />
                </div>
              </div>

              {/* Destination Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">
                  Where was this cashback credited?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDestination("card_statement_credit");
                      NativeHaptics.lightTick();
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                      destination === "card_statement_credit"
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <CreditCard className="w-4 h-4" />
                      <span>Statement Credit</span>
                    </div>
                    <span className="text-[10px] opacity-75">
                      Directly offsets & reduces card debt
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDestination("bank_deposit");
                      NativeHaptics.lightTick();
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                      destination === "bank_deposit"
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Landmark className="w-4 h-4" />
                      <span>Bank Deposit</span>
                    </div>
                    <span className="text-[10px] opacity-75">
                      Deposited to your savings / checking
                    </span>
                  </button>
                </div>
              </div>

              {/* Destination Bank Account (if Bank Deposit) */}
              {destination === "bank_deposit" && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-xs font-bold text-muted-foreground">
                    Target Bank Account
                  </label>
                  <select
                    value={destAccountId}
                    onChange={(e) => setDestAccountId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-muted/40 border border-border/80 text-foreground font-semibold text-xs outline-none focus:border-primary"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id || acc.name} value={acc.id || acc.name}>
                        {acc.name} ({acc.kind})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date & Note Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Reward Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground text-xs font-semibold outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dining Cashback"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground text-xs font-medium outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Confirmation Explainer Box */}
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 text-xs text-muted-foreground leading-relaxed">
                <span className="font-bold text-foreground block mb-0.5">
                  Accounting Impact:
                </span>
                {destination === "card_statement_credit" ? (
                  <p>
                    A ledger Income of{" "}
                    <span className="font-bold text-foreground">
                      {currency} {Number(amountStr || 0).toFixed(2)}
                    </span>{" "}
                    will post to{" "}
                    <span className="font-bold text-foreground">{card.name}</span>, reducing your
                    card debt without touching your cash balances.
                  </p>
                ) : (
                  <p>
                    A ledger Income of{" "}
                    <span className="font-bold text-foreground">
                      {currency} {Number(amountStr || 0).toFixed(2)}
                    </span>{" "}
                    will deposit into{" "}
                    <span className="font-bold text-foreground">
                      {targetDestAccount?.name || "Bank Account"}
                    </span>
                    , increasing your available cash.
                  </p>
                )}
              </div>

              {/* Offline Warning Banner */}
              {isOffline && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Offline Mode:</strong> An active internet connection is required to atomically record cashback redemptions and synchronize your card ledger.
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isOffline}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-xs shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Recording Cashback...</span>
                ) : isOffline ? (
                  <span>Offline (Network Required)</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Post Cashback</span>
                  </>
                )}
              </button>

              {/* History Preview */}
              {cardCashbackHistory.length > 0 && (
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Recent Confirmed Cashbacks ({cardCashbackHistory.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto hide-scrollbar">
                    {cardCashbackHistory.slice(0, 5).map((rec) => (
                      <div
                        key={rec.id}
                        className="p-2.5 bg-muted/20 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-foreground truncate block">
                            {rec.creditDestination === "card_statement_credit"
                              ? "Statement Credit"
                              : `Deposit → ${rec.destinationAccountName}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {rec.date} {rec.note ? `• ${rec.note}` : ""}
                          </span>
                        </div>
                        <span className="font-mono font-black text-emerald-500">
                          +{currency} {Number(rec.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* ─── TAB 2: REWARD RULES & RATES CONFIG ─────────────────────── */
            <div className="space-y-5">
              {/* Enable Switch */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground block">
                    Cashback Tracking for {card.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Estimate cashback earned based on qualifying spending categories
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-5 h-5 rounded-md accent-primary cursor-pointer"
                />
              </div>

              {/* Thresholds Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Monthly Cashback Cap ({currency})
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 50 (Optional)"
                    value={monthlyCapStr}
                    onChange={(e) => setMonthlyCapStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground text-xs font-semibold outline-none focus:border-primary"
                  />
                  <span className="text-[9px] text-muted-foreground block">
                    Limits maximum estimated reward per cycle
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Min Spend Required ({currency})
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 500 (Optional)"
                    value={minSpendStr}
                    onChange={(e) => setMinSpendStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground text-xs font-semibold outline-none focus:border-primary"
                  />
                  <span className="text-[9px] text-muted-foreground block">
                    Card spend needed to unlock cashback
                  </span>
                </div>
              </div>

              {/* Category Rate Rules */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground">
                    Category Cashback Rates
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyDefaults}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Reset to Malaysian Bank Template
                  </button>
                </div>

                {/* Rules List */}
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div
                      key={rule.category}
                      className="p-3 bg-card border border-border/80 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span className="font-bold text-xs text-foreground">
                          {rule.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {rule.ratePct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.category)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                          aria-label={`Delete ${rule.category} rule`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Rule Row */}
                <div className="p-3 bg-muted/20 border border-dashed border-border/80 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Add Category Rate
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Category (e.g. Dining, Petrol)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold outline-none text-foreground placeholder:text-muted-foreground/60"
                    />
                    <div className="relative w-24">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="5.0"
                        value={newCatRate}
                        onChange={(e) => setNewCatRate(e.target.value)}
                        className="w-full pl-3 pr-6 py-2 rounded-xl bg-card border border-border text-xs font-mono font-bold outline-none text-foreground"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">
                        %
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center cursor-pointer"
                      aria-label="Add category rate rule"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Rules Button */}
              <button
                type="button"
                onClick={handleSaveRules}
                disabled={isSavingRules}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-xs shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingRules ? (
                  <span>Saving Rules...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Cashback Rules</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
