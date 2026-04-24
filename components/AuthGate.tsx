"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Delete, ShieldCheck } from "lucide-react";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getStoredPin(): Promise<string | null> {
  try {
    if (await isNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: "app_lock_pin" });
      return value;
    }
  } catch {}
  if (typeof window !== "undefined") return localStorage.getItem("app_lock_pin");
  return null;
}

async function setStoredPin(pin: string): Promise<void> {
  try {
    if (await isNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: "app_lock_pin", value: pin });
      return;
    }
  } catch {}
  if (typeof window !== "undefined") localStorage.setItem("app_lock_pin", pin);
}

async function tryBiometric(): Promise<boolean> {
  try {
    if (!(await isNative())) return false;
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    if (!BiometricAuth) return false;
    await BiometricAuth.authenticate({
      reason: "Unlock Tracker",
      cancelTitle: "Cancel",
      allowDeviceCredential: false,
      androidConfirmationRequired: true,
    });
    return true;
  } catch {
    return false;
  }
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isPinEnabled, isBiometricEnabled, session, authLoading } = useAppContext();
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setPinInput("");
    setError("");
  }, []);

  useEffect(() => {
    if (!session || authLoading) return;

    if (!isPinEnabled) {
      // PIN-gate disabled → unlock synchronously. This is a legitimate
      // "sync external config into UI lock state" pattern; it runs once
      // per toggle so there's no cascading-render risk.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLocked(false);
       
      setChecking(false);
      return;
    }

     
    setChecking(true);
    const attemptUnlock = async () => {
      if (isBiometricEnabled) {
        const success = await tryBiometric();
        if (success) {
          unlock();
          setChecking(false);
          return;
        }
      }
      // Biometric not available or failed — fall through to PIN pad
      // (the locked UI below is always rendered whenever checking=false).
      setChecking(false);
    };
    attemptUnlock();
  }, [isPinEnabled, isBiometricEnabled, session, authLoading, unlock]);

  const handlePinDigit = (digit: string) => {
    if (pinInput.length >= 6) return;
    const next = pinInput + digit;
    setPinInput(next);
    setError("");

    if (next.length === 6) {
      verifyPin(next);
    }
  };

  const handleDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
    setError("");
  };

  const verifyPin = async (pin: string) => {
    const stored = await getStoredPin();
    if (stored && pin === stored) {
      unlock();
      NativeHaptics.successMedium();
    } else {
      setError("Incorrect PIN");
      setPinInput("");
      NativeHaptics.errorShake();
    }
  };

  const retryBiometric = async () => {
    const success = await tryBiometric();
    if (success) unlock();
  };

  if (!isPinEnabled || !isLocked) return <>{children}</>;
  if (authLoading || checking) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background max-w-md mx-auto">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="app-lock-title" className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center w-full max-w-xs"
      >
        <div className="bg-primary/10 p-5 rounded-3xl mb-6">
          <ShieldCheck className="w-10 h-10 text-primary" aria-hidden="true" />
        </div>

        <h2 id="app-lock-title" className="text-xl font-black text-foreground mb-1">App Locked</h2>
        <p className="text-sm text-muted-foreground font-medium mb-8">Enter your 6-digit PIN to unlock</p>

        {/* PIN Dots — `aria-live="polite"` announces progress to screen readers as each digit is entered. */}
        <div className="flex gap-3 mb-8" role="status" aria-live="polite" aria-label={`${pinInput.length} of 6 digits entered`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              aria-hidden="true"
              animate={error && i === 0 ? { x: [0, -8, 8, -4, 4, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pinInput.length
                  ? "bg-primary border-primary scale-110"
                  : "border-border bg-transparent"
              }`}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="text-rose-500 text-xs font-bold mb-4"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(digit => (
            <button
              key={digit}
              type="button"
              aria-label={`PIN digit ${digit}`}
              onClick={() => handlePinDigit(digit)}
              className="h-16 rounded-2xl bg-card border border-border/50 text-2xl font-bold text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            aria-label="Use biometric authentication"
            onClick={retryBiometric}
            className="h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-muted active:scale-95 transition-all shadow-sm"
          >
            <Fingerprint className="w-6 h-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="PIN digit 0"
            onClick={() => handlePinDigit("0")}
            className="h-16 rounded-2xl bg-card border border-border/50 text-2xl font-bold text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            aria-label="Delete last digit"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
          >
            <Delete className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export { getStoredPin, setStoredPin, tryBiometric, isNative };
