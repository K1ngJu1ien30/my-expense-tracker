"use client";

import { useState } from "react";
import BottomNav from "./BottomNav";
import TransactionModal from "./TransactionModal";
import LockScreen from "./LockScreen";
import { useAppContext } from "@/lib/context";
import { AnimatePresence, motion } from "framer-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setModalOpen] = useState(false);
  const { toast } = useAppContext();

  return (
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
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-[100px] hide-scrollbar relative">
        {children}
      </main>
      
      <BottomNav onOpenAdd={() => setModalOpen(true)} />
      <TransactionModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
      
      <LockScreen />
    </div>
  );
}
