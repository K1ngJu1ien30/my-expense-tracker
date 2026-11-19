"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Loader2 } from "lucide-react";
import MonthlyReceipt from "./MonthlyReceipt";
import { useAppData } from "@/lib/context";
import { deriveReceiptPayload, type ReceiptMonth } from "@/lib/receiptData";
import { shareReceipt } from "@/lib/receiptShare";
import { NativeHaptics } from "@/lib/haptics";

/**
 * Full-screen viewer for a monthly receipt. Renders the receipt inside a
 * scrollable panel with a single "Share" CTA. The receipt DOM node is
 * captured via html2canvas when the user taps Share — see `receiptShare.ts`.
 *
 * The parent controls open/close via `isOpen` + `onClose`. The `target` prop
 * names which month to show; omitting it defaults to the *previous* month
 * (the natural "recap" target — the month that just closed).
 */
export default function MonthlyReceiptModal({
  isOpen,
  onClose,
  target,
}: {
  isOpen: boolean;
  onClose: () => void;
  target?: ReceiptMonth;
}) {
  const { transactions, userName, formatCurrency, triggerToast, accentColor } = useAppData();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  // Default target = previous month (the one that just ended).
  const targetYear = target?.year;
  const targetMonth = target?.month;
  const payload = useMemo(() => {
    if (!isOpen) return null;
    const now = new Date();
    const resolvedTarget: ReceiptMonth =
      targetYear !== undefined && targetMonth !== undefined
        ? { year: targetYear, month: targetMonth }
        : {
            year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
            month: now.getMonth() === 0 ? 11 : now.getMonth() - 1,
          };
    return deriveReceiptPayload(transactions, resolvedTarget);
  }, [isOpen, transactions, targetYear, targetMonth]);

  const handleShare = async () => {
    if (!receiptRef.current) return;
    setSharing(true);
    try {
      await shareReceipt(
        receiptRef.current,
        `tracker_receipt_${payload?.receiptId}.png`,
        `My ${payload?.label} receipt 🧾`
      );
      NativeHaptics.successMedium();
      // No toast on success — the native share sheet is its own feedback.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to share receipt";
      triggerToast(msg);
    } finally {
      setSharing(false);
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

  return (
    <AnimatePresence>
      {isOpen && payload && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            className="relative z-10 max-h-[90vh] w-full max-w-sm flex flex-col"
          >
            {/* Close button floats above the receipt */}
            <div className="flex justify-between items-center px-4 pb-3">
              <h2
                id="receipt-modal-title"
                className="text-white text-sm font-black uppercase tracking-wider"
              >
                {payload.label} Recap
              </h2>
              <button
                type="button"
                aria-label="Close receipt"
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable receipt preview */}
            <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col items-center pb-4">
              <MonthlyReceipt
                ref={receiptRef}
                payload={payload}
                userName={userName}
                formatCurrency={formatCurrency}
              />
            </div>

            {/* Share CTA */}
            <div className="px-4 pt-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                aria-label="Share monthly receipt"
                style={{ backgroundColor: accentColor }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-wider shadow-heavy active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {sharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                )}
                {sharing ? "Rendering..." : "Share as PNG"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
