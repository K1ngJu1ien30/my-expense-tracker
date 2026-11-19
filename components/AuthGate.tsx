"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Delete, ShieldCheck } from "lucide-react";
import { useAppData } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import { getUserPinKey, LEGACY_PIN_KEY } from "@/lib/cacheKeys";

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getStoredPin(userId?: string): Promise<string | null> {
  const pinKey = getUserPinKey(userId);
  try {
    if (await isNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      let { value } = await Preferences.get({ key: pinKey });
      if (!value && userId) {
        const legacy = await Preferences.get({ key: LEGACY_PIN_KEY });
        if (legacy?.value) {
          value = legacy.value;
          await Preferences.set({ key: pinKey, value });
          // Remove legacy unscoped PIN after migration so it never leaks to another user
          await Preferences.remove({ key: LEGACY_PIN_KEY }).catch(() => {});
        }
      }
      return value;
    }
  } catch {}
  if (typeof window !== "undefined") {
    let val = localStorage.getItem(pinKey);
    if (!val && userId) {
      const legacy = localStorage.getItem(LEGACY_PIN_KEY);
      if (legacy) {
        val = legacy;
        localStorage.setItem(pinKey, legacy);
        try { localStorage.removeItem(LEGACY_PIN_KEY); } catch {}
      }
    }
    return val;
  }
  return null;
}

async function setStoredPin(pin: string, userId?: string): Promise<void> {
  const pinKey = getUserPinKey(userId);
  try {
    if (await isNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: pinKey, value: pin });
      return;
    }
  } catch {}
  if (typeof window !== "undefined") localStorage.setItem(pinKey, pin);
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
  const { isPinEnabled, isBiometricEnabled, session, authLoading } = useAppData();
  const userId = session?.user?.id ?? null;
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [nativePlatform, setNativePlatform] = useState(false);
  const unlockedUserIdRef = useRef<string | null>(null);
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    void isNative().then(setNativePlatform);
  }, []);

  const unlock = useCallback(() => {
    unlockedUserIdRef.current = userId;
    setIsLocked(false);
    setPinInput("");
    setError("");
  }, [userId]);

  // Re-lock after backgrounding for longer than 60s when PIN lock is enabled
  useEffect(() => {
    if (!isPinEnabled || !userId) return;
    const RELOCK_GRACE_MS = 60_000;
    let backgroundedAt: number | null = null;
    let cancelled = false;
    let appHandle: { remove: () => Promise<void> } | null = null;

    const handleBackground = () => {
      backgroundedAt = Date.now();
    };
    const handleForeground = () => {
      if (backgroundedAt !== null && Date.now() - backgroundedAt >= RELOCK_GRACE_MS) {
        unlockedUserIdRef.current = null;
        setIsLocked(true);
        setPinInput("");
        setError("");
      }
      backgroundedAt = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") handleBackground();
      else handleForeground();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    import("@capacitor/app")
      .then(async ({ App }) => {
        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) handleBackground();
          else handleForeground();
        });
        if (cancelled) listener.remove().catch(() => {});
        else appHandle = listener;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      appHandle?.remove().catch(() => {});
    };
  }, [isPinEnabled, userId]);

  useEffect(() => {
    if (!userId || authLoading) {
      if (!userId) unlockedUserIdRef.current = null;
      return;
    }

    if (!isPinEnabled) {
      setIsLocked(false);
      setChecking(false);
      return;
    }

    // Already unlocked for this user session — do not re-lock or re-prompt
    // biometrics on JWT token refresh or user_metadata updates.
    if (unlockedUserIdRef.current === userId) {
      setIsLocked(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    let cancelled = false;
    const attemptUnlock = async () => {
      if (isBiometricEnabled) {
        const success = await tryBiometric();
        if (!cancelled && success) {
          unlock();
          setChecking(false);
          return;
        }
      }
      if (!cancelled) setChecking(false);
    };
    void attemptUnlock();
    return () => {
      cancelled = true;
    };
  }, [isPinEnabled, isBiometricEnabled, userId, authLoading, unlock]);

  const verifyPin = useCallback(async (pin: string) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    try {
      const stored = await getStoredPin(userId ?? undefined);
      if (stored && pin === stored) {
        unlock();
        NativeHaptics.successMedium();
      } else {
        setError("Incorrect PIN");
        setPinInput("");
        NativeHaptics.errorShake();
      }
    } finally {
      isVerifyingRef.current = false;
    }
  }, [userId, unlock]);

  const handlePinDigit = useCallback((digit: string) => {
    if (isVerifyingRef.current || pinInput.length >= 6) return;
    const next = pinInput + digit;
    setPinInput(next);
    setError("");

    if (next.length === 6) {
      void verifyPin(next);
    }
  }, [pinInput, verifyPin]);

  const handleDelete = useCallback(() => {
    setPinInput(prev => prev.slice(0, -1));
    setError("");
  }, []);

  // Physical keyboard accessibility: enter PIN digits and backspace on desktop
  useEffect(() => {
    if (!isPinEnabled || !isLocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handlePinDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPinEnabled, isLocked, handlePinDigit, handleDelete]);

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
    <div data-auth-locked="true" role="dialog" aria-modal="true" aria-labelledby="app-lock-title" className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6">
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
          {isBiometricEnabled && nativePlatform ? (
            <button
              type="button"
              aria-label="Use biometric authentication"
              onClick={retryBiometric}
              className="h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-muted active:scale-95 transition-all shadow-sm"
            >
              <Fingerprint className="w-6 h-6" aria-hidden="true" />
            </button>
          ) : (
            <div aria-hidden="true" className="h-16" />
          )}
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
