"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import BottomNav from "./BottomNav";
import TransactionModal from "./TransactionModal";
import AuthScreen from "./AuthScreen";
import InstallPrompt from "./InstallPrompt";
import AuthGate from "./AuthGate";
import { useAppContext } from "@/lib/context";
import { AnimatePresence, motion } from "framer-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { toast, session, authLoading, showTransactionModal, setShowTransactionModal } = useAppContext();
  const pathname = usePathname();
  const router = useRouter();

  // Capacitor hardware back button — uses Next.js router
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      // @ts-ignore
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

  // App-Switcher Privacy Blur
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      // @ts-ignore
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
          const el = document.getElementById('app-privacy-blur');
          if (el) el.style.display = isActive ? 'none' : 'block';
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
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} className="absolute pt-12 top-0 left-0 right-0 z-[10000] flex justify-center px-4 pointer-events-none">
            <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-heavy font-bold text-sm tracking-wide flex gap-2 items-center text-center">
               <span className="text-emerald-400">⚡</span> {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <AuthGate>
    <div className="relative mx-auto w-full max-w-md h-[100dvh] lg:min-h-0 lg:h-[844px] lg:my-8 bg-background shadow-2xl flex flex-col overflow-hidden lg:rounded-[3rem] lg:border-[12px] lg:border-white/10 ring-1 ring-black/5 dark:ring-white/10">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0}} animate={{ y: 0, opacity: 1}} exit={{ y: -50, opacity: 0 }} className="absolute pt-12 top-0 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
            <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-heavy font-bold text-sm tracking-wide flex gap-2 items-center text-center">
               <span className="text-emerald-400">✅</span> {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-28 hide-scrollbar relative">
        {children}
      </main>
      
      <InstallPrompt />
      <TransactionModal isOpen={showTransactionModal} onClose={() => setShowTransactionModal(false)} />
      <BottomNav onOpenAdd={() => setShowTransactionModal(true)} />
      <div id="app-privacy-blur" style={{ display: 'none' }} className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-2xl pointer-events-none" />
    </div>
    </AuthGate>
  );
}
