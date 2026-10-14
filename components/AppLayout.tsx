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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    toast,
    session,
    authLoading,
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
            const awayMs = Date.now() - backgroundedAt;
            if (awayMs > 5 * 60 * 1000) {
              try { localStorage.removeItem("ai_greeting_cache"); } catch {}
            }
            backgroundedAt = null;
          }
        });
        cleanup = () => {};
      }).catch(() => {});
    } catch {}
    return () => { if (cleanup) cleanup(); };
  }, []);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>;

  if (!session) return (
    <div className="relative w-full min-h-screen bg-background flex items-center justify-center p-4 overflow-x-hidden">
      <AuthScreen />
      <InstallPrompt />
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} role="status" aria-live="polite" aria-atomic="true" className="fixed pt-6 lg:pt-8 top-0 left-0 right-0 z-[10000] flex justify-center px-4 pointer-events-none">
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
        {/* Global Toast live region (fixed top center) */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} role="status" aria-live="polite" aria-atomic="true" className="fixed pt-6 lg:pt-8 top-0 left-0 right-0 z-[10000] flex justify-center px-4 pointer-events-none">
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
          <main className="flex-1 w-full overflow-y-auto hide-scrollbar relative pb-[calc(7rem+env(safe-area-inset-bottom,0px))] lg:pb-12">
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
