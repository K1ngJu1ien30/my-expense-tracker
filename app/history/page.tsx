"use client";

import { useState, useMemo } from "react";
import { Ghost, Edit2, Trash2 } from "lucide-react";
import { useAppContext } from "@/lib/context";

type FilterType = "today" | "week" | "all";

export default function HistoryPage() {
  const { transactions, deleteTransaction, setEditTransactionId, accentColor, confirmAction, formatCurrency, categories } = useAppContext();
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Derive unique categories actually present in transactions (union with user categories)
  const availableCategories = useMemo(() => {
    const txCats = new Set(transactions.map(tx => tx.category).filter(Boolean));
    categories.forEach(c => txCats.add(c));
    return Array.from(txCats).sort();
  }, [transactions, categories]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Time filter
    if (filter !== "all") {
      const now = new Date();
      if (filter === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfTomorrow = startOfToday + 86400000;
        result = result.filter(tx => {
          const t = new Date(tx.date).getTime();
          return t >= startOfToday && t < startOfTomorrow;
        });
      } else if (filter === "week") {
        const dayOfWeek = now.getDay();
        const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();
        const endOfWeek = startOfWeek + 7 * 86400000;
        result = result.filter(tx => {
          const t = new Date(tx.date).getTime();
          return t >= startOfWeek && t < endOfWeek;
        });
      }
    }

    // Category filter (AND logic)
    if (categoryFilter !== "all") {
      result = result.filter(tx => tx.category === categoryFilter);
    }

    return result;
  }, [transactions, filter, categoryFilter]);

  const filterLabel = filter === "today" ? "Today" : filter === "week" ? "This Week" : "All Time";

  return (
    <div className="p-6 animate-in fade-in duration-500 pb-[120px]">
      <div className="flex justify-between items-center mb-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {filterLabel}{categoryFilter !== "all" ? ` • ${categoryFilter}` : ""} — {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Time Filter Pills */}
      <div className="flex gap-2 mb-3">
        {([
          { key: "today" as FilterType, label: "Today" },
          { key: "week" as FilterType, label: "This Week" },
          { key: "all" as FilterType, label: "Show All" },
        ]).map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={active ? { backgroundColor: accentColor, color: "#fff" } : {}}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? "shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Category Filter Pills */}
      <div className="-mx-6 px-6 overflow-x-auto hide-scrollbar mb-5">
        <div className="flex gap-2 w-max pb-1">
          <button
            onClick={() => setCategoryFilter("all")}
            style={categoryFilter === "all" ? { backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` } : {}}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all border shrink-0 ${
              categoryFilter === "all" ? "border" : "border-border/50 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            All Categories
          </button>
          {availableCategories.map(cat => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(active ? "all" : cat)}
                style={active ? { backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: `${accentColor}33` } : {}}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all border shrink-0 ${
                  active ? "border" : "border-border/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
      
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 opacity-50 text-center">
          <Ghost className="w-16 h-16 mb-4 text-muted-foreground stroke-[1.5]" />
          <p className="text-sm font-bold text-muted-foreground w-2/3 mx-auto">
            {filter === "all" && categoryFilter === "all" ? "No transactions yet.\nYou're saving money!" : "No transactions match your filters."}
          </p>
          {(filter !== "all" || categoryFilter !== "all") && (
            <button onClick={() => { setFilter("all"); setCategoryFilter("all"); }} style={{ color: accentColor }} className="text-sm font-bold mt-3">
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map(tx => (
            <div key={tx.id} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 relative overflow-hidden group hover:border-primary/20 transition-colors">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${tx.type === "Income" ? "bg-emerald-500" : tx.type === "Expense" ? "bg-rose-500" : "bg-blue-500"}`} />
              
              <div className="flex justify-between items-start pl-2">
                <div>
                  <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase mb-0.5">{tx.type} • {tx.account}</p>
                  <h3 className="font-bold text-lg text-foreground">{tx.category || "General"}</h3>
                  <p className="text-xs text-muted-foreground/70 font-medium mt-0.5">{new Date(tx.date).toLocaleDateString()} {tx.note ? `- ${tx.note}` : ""}</p>
                </div>
                <h3 className={`font-black text-xl tracking-tight ${tx.type === "Income" ? "text-emerald-500" : tx.type === "Expense" ? "text-rose-500" : "text-blue-500"}`}>
                  {tx.type === "Expense" && "-"}{tx.type === "Income" && "+"}{formatCurrency(Number(tx.amount))}
                </h3>
              </div>

              <div className="flex justify-end gap-2 pl-2 border-t border-border/30 pt-3 opacity-80 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setEditTransactionId(tx.id)}
                  className="flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    confirmAction("Delete Transaction", "Permanently wipe this transaction record?", () => {
                      deleteTransaction(tx.id);
                      if(navigator.vibrate) navigator.vibrate(20);
                    });
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
  );
}
