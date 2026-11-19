"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "./BottomNav";
import TransactionModal from "./TransactionModal";
import CreditCardPaymentModal from "./CreditCardPaymentModal";
import AuthScreen from "./AuthScreen";
import InstallPrompt from "./InstallPrompt";
import AuthGate from "./AuthGate";
import { useAppContext } from "@/lib/context";
import { AnimatePresence, motion } from "framer-motion";

import DesktopSidebar from "./DesktopSidebar";
import { WifiOff, RefreshCw } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    toast,
    session,
    authLoading,
    isOffline,
    isSyncing,
    showTransactionModal,
    setShowTransactionModal,
    showCreditCardPaymentModal,
    setShowCreditCardPaymentModal,
    activePaymentCardId,
  } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();

  // Global desktop keyboard shortcut: Press "N" to quickly add transaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowTransactionModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setShowTransactionModal]);

  // Capacitor hardware back button — uses Next.js router
  useEffect(() => {
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;
    try {
      import('@capacitor/app').then(async ({ App }) => {
        const listener = await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
          if (canGoBack) {
            router.back();
          } else {
            App.exitApp();
          }
        });
        if (cancelled) {
          listener.remove().catch(() => {});
        } else {
          handle = listener;
        }
      }).catch(() => {});
    } catch {}
    return () => {
      cancelled = true;
      handle?.remove().catch(() => {});
    };
  }, [router]);

  useEffect(() => {
    setShowTransactionModal(false);
    setShowCreditCardPaymentModal(false);
    // `setShowTransactionModal` and `setShowCreditCardPaymentModal` are stable context setters.
    // Excluded here to keep this effect's intent (reset-on-route-change) clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    }
    // Restore AMOLED mode
    if (localStorage.getItem('amoled') === 'true') {
      document.documentElement.classList.add('amoled');
    }
  }, []);

  // Dynamic SystemBars status bar contrast sync for light, dark, and AMOLED themes
  useEffect(() => {
    const updateSystemBars = async () => {
      try {
        const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
        const isDark =
          document.documentElement.classList.contains('dark') ||
          document.documentElement.classList.contains('amoled');
        await SystemBars.setStyle({
          style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        });
      } catch {
        // Fallback or non-capacitor environment
      }
    };

    updateSystemBars();

    const observer = new MutationObserver(() => {
      updateSystemBars();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Block Android WebView long-press context menu
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', prevent);
    return () => window.removeEventListener('contextmenu', prevent);
  }, []);

  // App-Switcher Privacy Blur + greeting refresh on resume.
  // We also clear the legacy `localStorage` greeting key (pre-v1.8 builds
  // persisted it across runs) so users upgrading from old APKs don't get
  // stuck with a stale "RM 0 spent this month" string forever.
  useEffect(() => {
    try { localStorage.removeItem("ai_greeting_cache"); } catch {}

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;
    let backgroundedAt: number | null = null;
    try {
      import('@capacitor/app').then(async ({ App }) => {
        const listener = await App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
          const el = document.getElementById('app-privacy-blur');
          if (el) el.style.display = isActive ? 'none' : 'block';

          if (!isActive) {
            backgroundedAt = Date.now();
          } else if (backgroundedAt != null) {
            const awayMs = Date.now() - backgroundedAt;
            if (awayMs > 5 * 60 * 1000) {
              try { localStorage.removeItem("ai_greeting_cache"); } catch {}
            }
            backgroundedAt = null;
          }
        });
        if (cancelled) {
          listener.remove().catch(() => {});
        } else {
          handle = listener;
        }
      }).catch(() => {});
    } catch {}
    return () => {
      cancelled = true;
      handle?.remove().catch(() => {});
    };
  }, []);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>;

  if (!session) return (
    <div className="relative w-full min-h-screen bg-background flex items-center justify-center p-4 overflow-x-hidden pt-safe pb-safe">
      <AuthScreen />
      <InstallPrompt />
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
            className="fixed top-[calc(0.5rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] sm:top-3 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 dark:bg-amber-600/90 text-white backdrop-blur-md shadow-md text-[11px] font-bold tracking-tight pointer-events-none"
          >
            <WifiOff className="w-3 h-3 text-white shrink-0" />
            <span>Offline — Changes saved locally</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} role="status" aria-live="polite" aria-atomic="true" className="fixed pt-[calc(1.5rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] lg:pt-8 top-0 left-0 right-0 z-[10000] flex justify-center px-4 pointer-events-none">
            <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-heavy font-bold text-sm tracking-wide flex gap-2 items-center text-center">
               <span className="text-emerald-400" aria-hidden="true">⚡</span> {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <AuthGate>
      <div className="relative w-full min-h-screen bg-background flex flex-col lg:flex-row overflow-x-hidden">
        {/* Persistent Offline / Background Sync Status Indicator */}
        <AnimatePresence>
          {isOffline ? (
            <motion.div
              key="offline-pill"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="status"
              aria-live="polite"
              className="fixed top-[calc(0.5rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] sm:top-3 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 dark:bg-amber-600/90 text-white backdrop-blur-md shadow-md text-[11px] font-bold tracking-tight pointer-events-none"
            >
              <WifiOff className="w-3 h-3 text-white shrink-0" />
              <span>Offline — Changes saved locally</span>
            </motion.div>
          ) : isSyncing && !toast ? (
            <motion.div
              key="syncing-pill"
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 0.9 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="status"
              aria-live="polite"
              className="fixed top-[calc(0.5rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] sm:top-3 left-1/2 -translate-x-1/2 z-[40] flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-card/85 text-muted-foreground border border-border/50 backdrop-blur-md shadow-sm text-[10px] font-semibold tracking-tight pointer-events-none"
            >
              <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" aria-hidden="true" />
              <span>Syncing…</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Global Toast live region (fixed top center) */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} role="status" aria-live="polite" aria-atomic="true" className="fixed pt-[calc(1.5rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] lg:pt-8 top-0 left-0 right-0 z-[10000] flex justify-center px-4 pointer-events-none">
              <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-heavy font-bold text-sm tracking-wide flex gap-2 items-center text-center">
                 <span className="text-emerald-400" aria-hidden="true">✅</span> {toast.message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar (hidden on mobile, visible on lg+) */}
        <DesktopSidebar onOpenAdd={() => setShowTransactionModal(true)} />

        {/* Main Content Canvas */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <main className="flex-1 w-full overflow-y-auto hide-scrollbar relative pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))] pb-[calc(7rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] lg:pt-0 lg:pb-12">
            <div className="w-full max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>

        <InstallPrompt />
        <TransactionModal isOpen={showTransactionModal} onClose={() => setShowTransactionModal(false)} />
        <CreditCardPaymentModal
          isOpen={showCreditCardPaymentModal}
          onClose={() => setShowCreditCardPaymentModal(false)}
          initialCardId={activePaymentCardId}
        />
        <BottomNav onOpenAdd={() => setShowTransactionModal(true)} />
        <div id="app-privacy-blur" aria-hidden="true" style={{ display: 'none' }} className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-2xl pointer-events-none" />
      </div>
    </AuthGate>
  );
}
