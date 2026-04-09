"use client";

import { Ghost } from "lucide-react";
import { useAppContext } from "@/lib/context";

export default function HistoryPage() {
  const { transactions } = useAppContext();
  
  return (
    <div className="p-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold mb-4 pt-2">Transaction History</h1>
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-50 text-center">
           <Ghost className="w-16 h-16 mb-4 text-muted-foreground stroke-[1.5]" />
           <p className="text-sm font-bold text-muted-foreground w-2/3 mx-auto">No transactions yet.<br/>You&apos;re saving money!</p>
        </div>
      ) : (
        <div className="bg-card p-6 rounded-3xl shadow-soft border border-border/40">
          <p className="text-muted-foreground font-medium">Your localized transaction history timelines will appear here dynamically later.</p>
        </div>
      )}
    </div>
  )
}
