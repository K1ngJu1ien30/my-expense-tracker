"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

const KEYS: Array<string> = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/**
 * 6-digit PIN setup with confirm step. Self-contained: stores its own
 * `tempPin`, `confirmPin`, `step`, and `error`. Calls `onSuccess(pin)` once
 * the user confirms a matching PIN; the parent persists it.
 */
export function PinSetupModal({
  onSuccess,
  onClose,
}: {
  onSuccess: (pin: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [tempPin, setTempPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const handleKey = (key: string) => {
    setError("");
    if (key === "del") {
      if (step === "enter") setTempPin((prev) => prev.slice(0, -1));
      else setConfirmPin((prev) => prev.slice(0, -1));
      return;
    }
    if (step === "enter") {
      const next = tempPin + key;
      if (next.length > 6) return;
      setTempPin(next);
      if (next.length === 6) setStep("confirm");
    } else {
      const next = confirmPin + key;
      if (next.length > 6) return;
      setConfirmPin(next);
      if (next.length === 6) {
        if (next === tempPin) {
          onSuccess(next);
        } else {
          setError("PINs do not match");
          setConfirmPin("");
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
        }
      }
    }
  };

  const currentVal = step === "enter" ? tempPin : confirmPin;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-setup-title"
        className="bg-card w-full max-w-xs rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5 flex flex-col items-center"
      >
        <div className="bg-primary/10 p-3 rounded-2xl">
          <Lock className="w-6 h-6 text-primary" aria-hidden="true" />
        </div>
        <div className="text-center">
          <h3 id="pin-setup-title" className="font-bold text-lg text-foreground">
            {step === "enter" ? "Set a PIN" : "Confirm PIN"}
          </h3>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            {step === "enter"
              ? "Enter a 6-digit fallback PIN"
              : "Re-enter your PIN to confirm"}
          </p>
        </div>

        <div
          className="flex gap-3"
          role="status"
          aria-live="polite"
          aria-label={`${currentVal.length} of 6 digits entered`}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < currentVal.length ? "bg-primary border-primary" : "border-border"
              }`}
            />
          ))}
        </div>

        {error && (
          <p role="alert" className="text-rose-500 text-xs font-bold">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 w-full">
          {KEYS.map((key, i) => {
            if (key === "") return <div key={`empty-${i}`} />;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                aria-label={key === "del" ? "Delete digit" : `Digit ${key}`}
                className="h-14 rounded-2xl bg-muted/50 border border-border/50 text-lg font-bold text-foreground hover:bg-muted active:scale-95 transition-all"
              >
                {key === "del" ? "⌫" : key}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
