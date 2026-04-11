"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Delete, ShieldCheck } from "lucide-react";
import { useAppContext } from "@/lib/context";

async function isNative(): Promise<boolean> {
  try {
    // @ts-ignore - Capacitor core may not exist in web builds
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getStoredPin(): Promise<string | null> {
  try {
    if (await isNative()) {
      // @ts-ignore - Native plugin, not available in web builds
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
      // @ts-ignore - Native plugin, not available in web builds
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
    // @ts-ignore - Native plugin, not available in web builds
    const { BiometricAuth } = await import("@capacitor-community/biometric-auth");
    if (!BiometricAuth) return false;
    await BiometricAuth.authenticate({
      reason: "Unlock Tracker",
      cancelTitle: "Use PIN",
    });
    return true;
  } catch {
    return false;
  }
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAppLockEnabled, session, authLoading } = useAppContext();
  const [isLocked, setIsLocked] = useState(true);
  const [showPinPad, setShowPinPad] = useState(false);
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

    if (!isAppLockEnabled) {
      setIsLocked(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    const attemptBiometric = async () => {
      const success = await tryBiometric();
      if (success) {
        unlock();
      } else {
        setShowPinPad(true);
      }
      setChecking(false);
    };
    attemptBiometric();
  }, [isAppLockEnabled, session, authLoading, unlock]);

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
    } else {
      setError("Incorrect PIN");
      setPinInput("");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
    }
  };

  const retryBiometric = async () => {
    const success = await tryBiometric();
    if (success) unlock();
  };

  if (!isAppLockEnabled || !isLocked) return <>{children}</>;
  if (authLoading || checking) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background max-w-md mx-auto">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center w-full max-w-xs"
      >
        <div className="bg-primary/10 p-5 rounded-3xl mb-6">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-xl font-black text-foreground mb-1">App Locked</h2>
        <p className="text-sm text-muted-foreground font-medium mb-8">Enter your 6-digit PIN to unlock</p>

        {/* PIN Dots */}
        <div className="flex gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
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
              onClick={() => handlePinDigit(digit)}
              className="h-16 rounded-2xl bg-card border border-border/50 text-2xl font-bold text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={retryBiometric}
            className="h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-muted active:scale-95 transition-all shadow-sm"
          >
            <Fingerprint className="w-6 h-6" />
          </button>
          <button
            onClick={() => handlePinDigit("0")}
            className="h-16 rounded-2xl bg-card border border-border/50 text-2xl font-bold text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export { getStoredPin, setStoredPin, tryBiometric, isNative };
