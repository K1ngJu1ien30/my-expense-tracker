"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Clock, Receipt } from "lucide-react";
import Link from "next/link";
import { useAppData } from "@/lib/context";

type TabType = "pending" | "cleared";

export default function ClaimsPage() {
  const { transactions, updateTransaction, addTransaction, accentColor, formatCurrency, triggerToast, confirmAction } = useAppData();
  const [activeTab, setActiveTab] = useState<TabType>("pending");

  const claimableTransactions = useMemo(
    () => transactions.filter(tx => tx.is_claimable === true),
    [transactions]
  );

  const pendingClaims = useMemo(
    () => claimableTransactions.filter(tx => tx.claim_status === "pending"),
    [claimableTransactions]
  );

  const clearedClaims = useMemo(
    () => claimableTransactions.filter(tx => tx.claim_status === "cleared"),
    [claimableTransactions]
  );

  const totalPending = useMemo(
    () => pendingClaims.reduce((sum, tx) => sum + Number(tx.amount), 0),
    [pendingClaims]
  );

  const displayedClaims = activeTab === "pending" ? pendingClaims : clearedClaims;

  const handleMarkCleared = (tx: typeof transactions[0]) => {
    confirmAction(
      "Mark as Cleared",
      `Confirm reimbursement of ${formatCurrency(Number(tx.amount))} for "${tx.category}"?`,
      async () => {
        const updateRes = await updateTransaction(tx.id, { claim_status: "cleared" });
        if (!updateRes.success) {
          triggerToast(`❌ Failed to update claim status: ${updateRes.error || "Please try again."}`);
          return;
        }

        const addRes = await addTransaction({
          type: "Income",
          amount: Number(tx.amount),
          account: tx.account,
          account_id: tx.account_id,
          category: "Reimbursement",
          note: `Claim Cleared: ${tx.category}${tx.note ? ` - ${tx.note}` : ""}`,
          date: new Date().toISOString(),
          status: "cleared",
          is_claimable: false,
          claim_status: "none",
        });

        if (addRes.success) {
          triggerToast(
            addRes.status === "synced"
              ? "Claim cleared & reimbursement logged!"
              : "Claim cleared & logged offline (Pending Sync)"
          );
        } else {
          triggerToast(`⚠️ Claim marked cleared, but reimbursement record failed: ${addRes.error || "Please log manually."}`);
        }
      }
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/hub" className="p-2 bg-muted rounded-xl hover:bg-border transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Claims & Splits</h1>
          <p className="text-xs text-muted-foreground font-medium">Track reimbursable expenses</p>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card p-4 rounded-2xl shadow-soft border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Pending</p>
          <p className="text-lg font-black" style={{ color: accentColor }}>{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl shadow-soft border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pending Count</p>
          <p className="text-lg font-black text-foreground">{pendingClaims.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-muted p-1 rounded-2xl">
        {(["pending", "cleared"] as const).map(tab => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${active ? "text-white shadow-sm" : "text-muted-foreground"
                }`}
              style={active ? { backgroundColor: accentColor } : {}}
            >
              <span className="flex items-center justify-center gap-1.5">
                {tab === "pending" ? <Clock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                {tab === "pending" ? "Pending" : "Cleared"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Claims List */}
      {displayedClaims.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl shadow-soft border border-border/40 text-center">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-medium">
            {activeTab === "pending"
              ? "No pending claims. Mark expenses as claimable when adding them."
              : "No cleared claims yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedClaims.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="bg-card p-4 rounded-2xl shadow-sm border border-border/40 relative overflow-hidden"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${activeTab === "pending" ? "bg-amber-500" : "bg-emerald-500"}`} />
              <div className="pl-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{tx.account}</p>
                    <p className="font-bold text-foreground">{tx.category || "General"}</p>
                    {tx.note && <p className="text-xs text-muted-foreground font-medium mt-0.5">{tx.note}</p>}
                    <p className="text-[10px] text-muted-foreground font-medium mt-1">{formatDate(tx.date)}</p>
                  </div>
                  <p className="font-black text-lg text-rose-500 shrink-0">{formatCurrency(Number(tx.amount))}</p>
                </div>

                {activeTab === "pending" && (
                  <button
                    onClick={() => handleMarkCleared(tx)}
                    className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Check className="w-4 h-4" />
                    Mark as Cleared
                  </button>
                )}

                {activeTab === "cleared" && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-bold text-emerald-500">Reimbursed</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
