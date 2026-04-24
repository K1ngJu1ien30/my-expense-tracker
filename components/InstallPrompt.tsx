"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { useAppContext } from "@/lib/context";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const { accentColor = "#3b82f6" } = useAppContext();

  useEffect(() => {
    // Skip the entire PWA-install flow inside the Capacitor native shell —
    // the app is already installed as a real APK, so offering to "install"
    // makes no sense.
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) return; // cancelled below via the flag
      } catch {
        // web build — fall through to the normal PWA prompt path
      }
      if (cancelled) return;

      // Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        if (!localStorage.getItem("pwa_prompt_dismissed")) {
          setShowPrompt(true);
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      // Show manual prompt on iOS if not standalone
      if (isIOSDevice && !window.matchMedia("(display-mode: standalone)").matches) {
        if (!localStorage.getItem("pwa_prompt_dismissed")) {
          setShowPrompt(true);
        }
      }

      // Store cleanup on the outer scope via a closure trick
      (window as unknown as { __installPromptCleanup?: () => void }).__installPromptCleanup = () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    })();

    return () => {
      cancelled = true;
      const w = window as unknown as { __installPromptCleanup?: () => void };
      if (w.__installPromptCleanup) {
        w.__installPromptCleanup();
        delete w.__installPromptCleanup;
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          role="dialog"
          aria-labelledby="install-prompt-title"
          className="fixed bottom-24 left-4 right-4 z-[9900] bg-background/90 backdrop-blur-2xl border border-border/80 shadow-heavy rounded-[2rem] p-4 flex items-center justify-between pointer-events-auto"
        >
          <div className="flex items-center gap-4">
            <div style={{ backgroundColor: `${accentColor}1A`, color: accentColor }} className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0">
               <Download className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <p id="install-prompt-title" className="text-sm font-bold text-foreground">Install App</p>
              {isIOS ? (
                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Tap Share <span className="inline-block translate-y-[2px]" aria-hidden="true">⍐</span> then &ldquo;Add to Home Screen&rdquo;</p>
              ) : (
                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Add to home screen for native experience</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS && (
              <button
                type="button"
                onClick={handleInstallClick}
                style={{ backgroundColor: accentColor }}
                className="text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-soft"
              >
                Install
              </button>
            )}
            <button type="button" aria-label="Dismiss install prompt" onClick={dismissPrompt} className="p-2.5 bg-muted/80 hover:bg-muted text-muted-foreground rounded-full transition-colors ml-1">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
