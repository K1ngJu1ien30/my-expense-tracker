"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "./BottomNav";
import TransactionModal from "./TransactionModal";
import AuthScreen from "./AuthScreen";
import InstallPrompt from "./InstallPrompt";
import AuthGate from "./AuthGate";
import { useAppContext } from "@/lib/context";
import { clearGreetingCache } from "@/lib/ai/greeting";
import { AnimatePresence, motion } from "framer-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { toast, session, authLoading, showTransactionModal, setShowTransactionModal } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();

  // Capacitor hardware back button — uses Next.js router
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
          if (canGoBack) {
            router.back();
          } else {
            App.exitApp();
          }
        });
        cleanup = () => { App.removeAllListeners().catch(() => {}); };
      }).catch(() => {});
    } catch {}
    return () => { if (cleanup) cleanup(); };
  }, [router]);

  useEffect(() => {
    setShowTransactionModal(false);
    // `setShowTransactionModal` is a stable context setter — re-adding it
    // to the deps array would cause React 19's linter to suggest wrapping
    // it in useCallback inside the provider, which is already the case.
    // Excluded here to keep this effect's intent (reset-on-route-change)
    // clear.
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

    let cleanup: (() => void) | undefined;
    let backgroundedAt: number | null = null;
    try {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
          const el = document.getElementById('app-privacy-blur');
          if (el) el.style.display = isActive ? 'none' : 'block';

          if (!isActive) {
            backgroundedAt = Date.now();
          } else if (backgroundedAt != null) {
            // If the app was in the background for > 5 minutes, treat
            // resume like a cold-open and force a fresh greeting on the
            // next dashboard render.
            const awayMs = Date.now() - backgroundedAt;
            if (awayMs > 5 * 60 * 1000) {
              clearGreetingCache();
            }
            backgroundedAt = null;
          }
        });
        cleanup = () => {};
      }).catch(() => {});
    } catch {}
    return () => { if (cleanup) cleanup(); };
  }, []);

  if (authLoading) return <div className="h-[100dvh] flex items-center justify-center bg-background max-w-md mx-auto"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>;

  if (!session) return (
    <div className="relative mx-auto w-full max-w-md h-[100dvh] lg:min-h-0 lg:h-[844px] lg:my-8 bg-background shadow-2xl flex flex-col overflow-hidden lg:rounded-[3rem] lg:border-[12px] lg:border-white/10 ring-1 ring-black/5 dark:ring-white/10">
      <AuthScreen />
      <InstallPrompt />
      {/*
        Toast lives in an ARIA live region so screen readers announce it
        without stealing focus. `aria-live="polite"` waits for the user to
        finish their current task before reading it; `role="status"` makes
        this explicit for older assistive tech.
      */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} role="status" aria-live="polite" aria-atomic="true" className="absolute pt-12 top-0 left-0 right-0 z-[10000] flex justify-center px-4 pointer-events-none">
            <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-heavy font-bold text-sm tracking-wide flex gap-2 items-center text-center">
               <span className="text-emerald-400" aria-hidden="true">⚡</span> {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Routes that have their own sub-navigation — hide the main bottom nav
  // and transaction FAB to avoid double-bar. These modules render their
  // own tab bar inside their layout.tsx.
  const hasOwnNav = pathname.startsWith("/cookmate") || pathname.startsWith("/wanderplan");

  return (
    <AuthGate>
    <div className="relative mx-auto w-full max-w-md h-[100dvh] lg:min-h-0 lg:h-[844px] lg:my-8 bg-background shadow-2xl flex flex-col overflow-hidden lg:rounded-[3rem] lg:border-[12px] lg:border-white/10 ring-1 ring-black/5 dark:ring-white/10">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} role="status" aria-live="polite" aria-atomic="true" className="absolute pt-12 top-0 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
            <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-heavy font-bold text-sm tracking-wide flex gap-2 items-center text-center">
               <span className="text-emerald-400" aria-hidden="true">✅</span> {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className={`flex-1 overflow-x-hidden overflow-y-auto hide-scrollbar relative ${hasOwnNav ? "pb-0" : "pb-28"}`}>
        {children}
      </main>
      
      <InstallPrompt />
      {!hasOwnNav && <TransactionModal isOpen={showTransactionModal} onClose={() => setShowTransactionModal(false)} />}
      {!hasOwnNav && <BottomNav onOpenAdd={() => setShowTransactionModal(true)} />}
      <div id="app-privacy-blur" aria-hidden="true" style={{ display: 'none' }} className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-2xl pointer-events-none" />
    </div>
    </AuthGate>
  );
}
