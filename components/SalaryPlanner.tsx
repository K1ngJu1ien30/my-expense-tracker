"use client";

import { useState, useMemo } from "react";
import { Trash2, Plus, TrendingUp } from "lucide-react";
import { useAppContext } from "@/lib/context";

export default function SalaryPlanner() {
  const {
    plannerItems, addPlannerItem, deletePlannerItem, confirmAction,
    categories, accentColor, transactions, accounts, includeSavings
  } = useAppContext();

  const [newCategory, setNewCategory] = useState("");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const totalBalance = useMemo(() => {
    const activeAccounts = includeSavings
      ? accounts
      : accounts.filter(acc => acc && !acc.toLowerCase().includes('saving'));

    return activeAccounts.reduce((total, accountName) => {
      const balance = transactions.reduce((acc, tx) => {
        let newAcc = acc;
        if (tx.account?.toLowerCase().trim() === accountName?.toLowerCase()?.trim()) {
          if (tx.type === "Income") newAcc += Number(tx.amount);
          if (tx.type === "Expense" || tx.type === "Transfer") newAcc -= Number(tx.amount);
        }
        if (tx.type === "Transfer" && tx.to_account?.toLowerCase().trim() === accountName?.toLowerCase()?.trim()) {
          newAcc += Number(tx.amount);
        }
        return newAcc;
      }, 0);
      return total + balance;
    }, 0);
  }, [transactions, includeSavings, accounts]);

  const totalPlanned = useMemo(() => plannerItems.reduce((sum, p) => sum + Number(p.amount), 0), [plannerItems]);
  const availableCashFlow = totalBalance - totalPlanned;

  const handleAdd = async () => {
    if (!newName || !newAmount) return;
    await addPlannerItem({ category: newCategory || "Uncategorized", item_name: newName, amount: Number(newAmount) });
    setNewCategory("");
    setNewName("");
    setNewAmount("");
  };

  return (
    <div className="bg-card p-6 rounded-3xl shadow-soft border border-border/40 space-y-5">
      <div className="flex items-center gap-3">
        <div style={{ backgroundColor: `${accentColor}1A` }} className="p-3 rounded-2xl">
          <TrendingUp style={{ color: accentColor }} className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight">Salary Planner</h3>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Plan your expenses and see what&apos;s left</p>
        </div>
      </div>

      {/* Add Form */}
      <div className="space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Add Planned Expense</p>
        <select
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          className="w-full bg-card text-sm font-semibold p-2.5 rounded-xl border border-border outline-none text-foreground"
        >
          <option value="">Select Category</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Item name (e.g. Rent)"
          className="w-full bg-card text-sm font-semibold p-2.5 rounded-xl border border-border outline-none text-foreground"
        />
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-card rounded-xl px-3 py-2.5 border border-border">
            <span className="font-bold text-muted-foreground text-sm">RM</span>
            <input
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              type="number"
              placeholder="0.00"
              className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground"
            />
          </div>
          <button
            onClick={handleAdd}
            style={{ backgroundColor: accentColor }}
            className="text-white px-4 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Items List */}
      {plannerItems.length > 0 ? (
        <div className="space-y-2">
          {plannerItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{item.item_name}</p>
                <p className="text-[10px] font-semibold text-muted-foreground">{item.category}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-black text-sm text-foreground">RM {Number(item.amount).toFixed(2)}</span>
                <button
                  onClick={() => confirmAction("Delete Item", `Remove "${item.item_name}"?`, () => deletePlannerItem(item.id))}
                  className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium text-muted-foreground text-center py-2">No planned expenses yet.</p>
      )}

      {/* Cash Flow Analysis Footer */}
      <div className="p-4 rounded-2xl border border-border/50 space-y-3 bg-muted/10">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cash Flow Analysis</p>
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-muted-foreground">Current Balance</span>
          <span className="font-bold text-foreground">RM {totalBalance.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-muted-foreground">Total Planned Reserves</span>
          <span className="font-bold text-rose-500">- RM {totalPlanned.toFixed(2)}</span>
        </div>
        <div className="border-t border-border/50 pt-3 flex justify-between items-baseline">
          <span className="font-bold text-foreground text-sm">Available Cash Flow</span>
          <span
            style={availableCashFlow >= 0 ? { color: accentColor } : {}}
            className={`text-xl font-black ${availableCashFlow < 0 ? "text-rose-500" : ""}`}
          >
            RM {availableCashFlow.toFixed(2)}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground font-medium text-center">
          {availableCashFlow >= 0 ? "Safe to spend" : "Over-allocated — review your planned expenses"}
        </p>
      </div>
    </div>
  );
}
