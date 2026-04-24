"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Database, X } from "lucide-react";
import type { Transaction, Subscription, Goal } from "@/lib/types";

type RawTab = "Tx" | "Subs/Goals";

/**
 * Developer-style "see-the-raw-tables" inspector. Useful for the user to
 * verify what's actually stored, and as a triage aid during bug reports.
 * Two tabs: transactions, and subscriptions / utilities / goals combined.
 *
 * Note: at very large datasets (10k+) this DOM table is the only place in
 * the app that does a non-virtualised render. We deliberately keep it that
 * way because (a) it's behind a manual "Database View" tap, (b) it's only
 * opened by power-users who want raw data, (c) virtualising a wide table
 * with sticky headers + horizontal scroll fights ergonomics. We slice the
 * row count to a sane cap with a "showing N of M" footer.
 */
const TX_DISPLAY_CAP = 500;

export function RawDataModal({
  transactions,
  subscriptions,
  utilities,
  goals,
  currency,
  accentColor,
  onClose,
}: {
  transactions: Transaction[];
  subscriptions: Subscription[];
  utilities: Subscription[];
  goals: Goal[];
  currency: string;
  accentColor: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<RawTab>("Tx");

  const txDisplayed = transactions.slice(0, TX_DISPLAY_CAP);
  const truncated = transactions.length > TX_DISPLAY_CAP;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rawdata-title"
      className="fixed inset-0 z-[101] bg-card flex flex-col pt-12 pb-6 px-4"
    >
      <div className="flex justify-between items-center pb-4 border-b border-border/50">
        <h3 id="rawdata-title" className="font-bold text-xl text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Database View
        </h3>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="p-2 bg-muted hover:bg-border rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>

      <div className="flex bg-muted/60 p-1.5 rounded-xl my-6">
        {(["Tx", "Subs/Goals"] as RawTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={tab === t ? { backgroundColor: accentColor, color: "#fff" } : {}}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              tab === t ? "shadow-sm scale-[1.02] z-10" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "Tx" ? "Transactions" : "Subscriptions & Goals"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto hide-scrollbar rounded-xl border border-border/50 shadow-inner bg-muted/10 relative">
        {tab === "Tx" ? (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted text-muted-foreground font-bold sticky top-0 z-10">
              <tr>
                <th className="p-3 border-b border-border/50">ID</th>
                <th className="p-3 border-b border-border/50">Date</th>
                <th className="p-3 border-b border-border/50">Type</th>
                <th className="p-3 border-b border-border/50">Category</th>
                <th className="p-3 border-b border-border/50">Sub Category</th>
                <th className="p-3 border-b border-border/50">Amount</th>
                <th className="p-3 border-b border-border/50">Account</th>
                <th className="p-3 border-b border-border/50">To Account</th>
                <th className="p-3 border-b border-border/50">Note</th>
              </tr>
            </thead>
            <tbody>
              {txDisplayed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground font-medium">
                    No transaction records found.
                  </td>
                </tr>
              ) : (
                txDisplayed.map((tx, i) => (
                  <tr key={tx.id || i} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                    <td className="p-3 border-b border-border/30 font-mono text-xs max-w-[100px] truncate" title={tx.id}>{tx.id || "N/A"}</td>
                    <td className="p-3 border-b border-border/30 text-muted-foreground">{tx.date}</td>
                    <td className="p-3 border-b border-border/30 font-semibold">{tx.type}</td>
                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[100px] truncate">{tx.category}</td>
                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[100px] truncate">{tx.sub_category || "-"}</td>
                    <td className="p-3 border-b border-border/30">{currency} {tx.amount}</td>
                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[90px] truncate">{tx.account || "-"}</td>
                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[90px] truncate">{tx.to_account || "-"}</td>
                    <td className="p-3 border-b border-border/30 text-muted-foreground max-w-[120px] truncate">{tx.note || "-"}</td>
                  </tr>
                ))
              )}
              {truncated && (
                <tr>
                  <td colSpan={9} className="p-3 text-center text-xs font-medium text-muted-foreground bg-muted/40">
                    Showing first {TX_DISPLAY_CAP} of {transactions.length} transactions. Use Export for the full set.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted text-muted-foreground font-bold sticky top-0 z-10">
              <tr>
                <th className="p-4 border-b border-border/50">Type</th>
                <th className="p-4 border-b border-border/50">Name</th>
                <th className="p-4 border-b border-border/50">Amount/Target</th>
                <th className="p-4 border-b border-border/50">Meta Config</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={`sub-${s.id}`} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4 border-b border-border/30 font-semibold text-purple-500">Subscription</td>
                  <td className="p-4 border-b border-border/30 font-bold">{s.name}</td>
                  <td className="p-4 border-b border-border/30">{currency} {s.cost}</td>
                  <td className="p-4 border-b border-border/30 text-xs text-muted-foreground border-l border-border/50">
                    Day {s.billingDay} | {s.sourceAccount}
                  </td>
                </tr>
              ))}
              {utilities.map((u) => (
                <tr key={`u-${u.id}`} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4 border-b border-border/30 font-semibold text-yellow-500">Utility</td>
                  <td className="p-4 border-b border-border/30 font-bold">{u.name}</td>
                  <td className="p-4 border-b border-border/30">{currency} {u.cost}</td>
                  <td className="p-4 border-b border-border/30 text-xs text-muted-foreground border-l border-border/50">
                    Day {u.billingDay} | {u.sourceAccount}
                  </td>
                </tr>
              ))}
              {goals.map((g) => (
                <tr key={`g-${g.id}`} className="even:bg-muted/30 hover:bg-muted/50 transition-colors">
                  <td className="p-4 border-b border-border/30 font-semibold text-emerald-500">Goal</td>
                  <td className="p-4 border-b border-border/30 font-bold">{g.title}</td>
                  <td className="p-4 border-b border-border/30">{currency} {g.current} / {g.target}</td>
                  <td className="p-4 border-b border-border/30 text-xs text-muted-foreground border-l border-border/50">
                    {g.isPinned ? "Pinned" : "Not Pinned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}
