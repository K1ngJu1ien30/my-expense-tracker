"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  Percent,
  AlertTriangle,
  Receipt,
  Check,
  CreditCard,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { Account, FinanceChargeType } from "@/lib/types";
import { NativeHaptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type CreditCardFinanceChargeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  card: Account;
  currency: string;
  accentColor: string;
  onReconcile: (params: {
    card: Account;
    chargeType: FinanceChargeType;
    amount: number;
    date: string;
    note?: string;
  }) => Promise<{ success: boolean; error?: string }>;
};

const CHARGE_TYPES: {
  type: FinanceChargeType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: "interest",
    label: "Finance Charge / Interest",
    desc: "Interest charged on revolving / carried statement balances",
    icon: Percent,
  },
  {
    type: "late_fee",
    label: "Late Payment Fee",
    desc: "Penalty charged for missing the payment due date",
    icon: AlertTriangle,
  },
  {
    type: "annual_fee",
    label: "Annual / Service Fee",
    desc: "Card renewal, SST, or annual membership fee",
    icon: Receipt,
  },
  {
    type: "other_fee",
    label: "Other Bank Fee",
    desc: "Cash advance fee, foreign exchange fee, or admin charge",
    icon: FileText,
  },
];

export default function CreditCardFinanceChargeModal({
  isOpen,
  onClose,
  card,
  currency,
  accentColor,
  onReconcile,
}: CreditCardFinanceChargeModalProps) {
  const [chargeType, setChargeType] = useState<FinanceChargeType>("interest");
  const [amountStr, setAmountStr] = useState("");
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      NativeHaptics.errorShake();
      setFormError("Please enter a valid positive charge amount.");
      return;
    }

    setIsSubmitting(true);
    NativeHaptics.lightTick();

    const result = await onReconcile({
      card,
      chargeType,
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
      setFormError(result.error || "Failed to record finance charge.");
    }
  };

  const selectedMeta = CHARGE_TYPES.find((c) => c.type === chargeType) || CHARGE_TYPES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-finance-charge-modal-title"
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
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cc-finance-charge-modal-title" className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Reconcile Bank Fee / Interest</span>
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto hide-scrollbar">
          {formError && (
            <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2 text-rose-500 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Charge Type Radio Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">
              Select Fee / Charge Classification
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHARGE_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = chargeType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setChargeType(item.type);
                      NativeHaptics.lightTick();
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block text-foreground">
                        {item.label}
                      </span>
                      <span className="text-[10px] opacity-75 line-clamp-1">
                        {item.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              Actual Assessed Amount
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

          {/* Date & Note Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Statement / Charge Date
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder={`e.g. ${selectedMeta.label}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground text-xs font-medium outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Accounting Explainer Box */}
          <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 text-xs text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground block mb-0.5">
              Accounting Impact:
            </span>
            <p>
              A classified Expense of{" "}
              <span className="font-bold text-foreground">
                {currency} {Number(amountStr || 0).toFixed(2)}
              </span>{" "}
              will post to <span className="font-bold text-foreground">{card.name}</span> under{" "}
              <span className="font-semibold text-foreground">&quot;Fees &amp; Charges&quot;</span>.
              This increases your card liability to match your bank statement without touching your cash balances.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-xs shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Recording Charge...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm &amp; Post Bank Charge</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
