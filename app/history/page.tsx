"use client";

import { Ghost, Edit2, Trash2, ArrowRight } from "lucide-react";
import { useAppContext } from "@/lib/context";

export default function HistoryPage() {
  const { transactions, deleteTransaction, setEditTransactionId, accentColor } = useAppContext();
  
  return (
    <div className="p-6 animate-in fade-in duration-500 pb-[120px]">
      <div className="flex justify-between items-center mb-6 pt-2">
         <h1 className="text-2xl font-bold">Transaction History</h1>
      </div>
      
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-50 text-center">
           <Ghost className="w-16 h-16 mb-4 text-muted-foreground stroke-[1.5]" />
           <p className="text-sm font-bold text-muted-foreground w-2/3 mx-auto">No transactions yet.<br/>You&apos;re saving money!</p>
        </div>
      ) : (
        <div className="space-y-4">
           {transactions.map(tx => (
             <div key={tx.id} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 relative overflow-hidden group hover:border-primary/20 transition-colors">
                {/* Visual marker slice tied to type */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${tx.type === "Income" ? "bg-emerald-500" : tx.type === "Expense" ? "bg-rose-500" : "bg-blue-500"}`} />
                
                <div className="flex justify-between items-start pl-2">
                   <div>
                      <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase mb-0.5">{tx.type} • {tx.account}</p>
                      <h3 className="font-bold text-lg text-foreground">{tx.category || "General"}</h3>
                      <p className="text-xs text-muted-foreground/70 font-medium mt-0.5">{new Date(tx.date).toLocaleDateString()} {tx.note ? `- ${tx.note}` : ""}</p>
                   </div>
                   <h3 className={`font-black text-xl tracking-tight ${tx.type === "Income" ? "text-emerald-500" : tx.type === "Expense" ? "text-rose-500" : "text-blue-500"}`}>
                      {tx.type === "Expense" && "-"}{tx.type === "Income" && "+"}RM {Number(tx.amount).toFixed(2)}
                   </h3>
                </div>

                {/* Edit & Delete Action Row */}
                <div className="flex justify-end gap-2 pl-2 border-t border-border/30 pt-3 opacity-80 group-hover:opacity-100 transition-opacity">
                   <button 
                      onClick={() => setEditTransactionId(tx.id)}
                      className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none"
                   >
                      <Edit2 className="w-4 h-4" />
                   </button>
                   <button 
                      onClick={() => {
                         if (confirm("Permanently wipe this transaction record?")) {
                            deleteTransaction(tx.id);
                            if(navigator.vibrate) navigator.vibrate(20);
                         }
                      }}
                      className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors focus:outline-none"
                   >
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  )
}
