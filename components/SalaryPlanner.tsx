"use client";

import { useState, useMemo } from "react";
import { Trash2, Plus, MonitorPlay, FileText, Zap, Repeat, Check, Edit2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { NativeHaptics } from "@/lib/haptics";
import type { Subscription } from "@/lib/types";
import CustomSelect from "@/components/CustomSelect";

const getItemSubtext = (items: Array<{ name: string }>) => {
  if (!items || items.length === 0) return "No items added yet.";
  const names = items.slice(0, 3).map((i) => i.name).join(", ");
  return items.length > 3 ? `${names}, ...` : names;
};

export default function SalaryPlanner() {
  const {
    subscriptions, addSubscription, updateSubscription, deleteSubscription,
    fixedBills, addFixedBill, updateFixedBill, deleteFixedBill,
    utilities, addUtility, updateUtility, deleteUtility,
    confirmAction, accentColor, transactions, accounts, includeSavings, currency, formatCurrency, triggerToast
  } = useAppContext();

  // Current Month for Paid/Pending tracking (YYYY-MM)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Active category inline add state
  const [activeAddCategory, setActiveAddCategory] = useState<"subscriptions" | "fixedBills" | "utilities" | null>(null);
  const [newName, setNewName] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newSourceAccount, setNewSourceAccount] = useState("");

  // Edit modal state
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    cost: number;
    billingDay?: number;
    sourceAccount?: string;
    autoDeduct?: boolean;
    kind: "subscriptions" | "fixedBills" | "utilities";
  } | null>(null);

  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editSourceAccount, setEditSourceAccount] = useState("");
  const [editBillingDay, setEditBillingDay] = useState("15");
  const [editAutoDeduct, setEditAutoDeduct] = useState(true);
  const [editKind, setEditKind] = useState<"subscriptions" | "fixedBills" | "utilities">("subscriptions");

  const totalBalance = useMemo(() => {
    const activeAccounts = includeSavings
      ? accounts
      : accounts.filter(acc => acc && !acc.toLowerCase().includes("saving"));

    return activeAccounts.reduce((total, accountName) => {
      const balance = transactions.reduce((acc, tx) => {
        let newAcc = acc;
        if (tx.account?.toLowerCase().trim() === accountName?.toLowerCase()?.trim()) {
          if (tx.type === "Income" && tx.status !== "pending") newAcc += Number(tx.amount);
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

  // Section Totals (All vs Pending)
  const subTotal = useMemo(() => (subscriptions || []).reduce((sum, s) => sum + Number(s.cost), 0), [subscriptions]);
  const billTotal = useMemo(() => (fixedBills || []).reduce((sum, b) => sum + Number(b.cost), 0), [fixedBills]);
  const utilTotal = useMemo(() => (utilities || []).reduce((sum, u) => sum + Number(u.cost), 0), [utilities]);
  const grandTotal = subTotal + billTotal + utilTotal;

  const subPendingTotal = useMemo(
    () => (subscriptions || []).filter(s => s.lastPaidMonth !== currentMonthStr).reduce((sum, s) => sum + Number(s.cost), 0),
    [subscriptions, currentMonthStr]
  );
  const billPendingTotal = useMemo(
    () => (fixedBills || []).filter(b => b.lastPaidMonth !== currentMonthStr).reduce((sum, b) => sum + Number(b.cost), 0),
    [fixedBills, currentMonthStr]
  );
  const utilPendingTotal = useMemo(
    () => (utilities || []).filter(u => u.lastPaidMonth !== currentMonthStr).reduce((sum, u) => sum + Number(u.cost), 0),
    [utilities, currentMonthStr]
  );

  const pendingGrandTotal = subPendingTotal + billPendingTotal + utilPendingTotal;

  // Available Cash Flow Math ONLY sums recurring items where lastPaidMonth is NOT equal to current month!
  const availableCashFlow = totalBalance - pendingGrandTotal;

  // Toggle Paid/Pending status
  const togglePaidStatus = async (item: Subscription, kind: "subscriptions" | "fixedBills" | "utilities") => {
    const isPaid = item.lastPaidMonth === currentMonthStr;
    const newMonth = isPaid ? "" : currentMonthStr;

    if (kind === "subscriptions") {
      await updateSubscription(item.id, { lastPaidMonth: newMonth });
    } else if (kind === "fixedBills") {
      await updateFixedBill(item.id, { lastPaidMonth: newMonth });
    } else if (kind === "utilities") {
      await updateUtility(item.id, { lastPaidMonth: newMonth });
    }

    if (!isPaid) {
      NativeHaptics.successMedium();
    } else {
      NativeHaptics.lightTick();
    }
  };

  // Submit Add Handler
  const handleAddItem = async (targetCategory: "subscriptions" | "fixedBills" | "utilities") => {
    if (!newName.trim() || !newCost || Number(newCost) <= 0) return;

    const payload: Partial<Subscription> = {
      name: newName.trim(),
      cost: Number(newCost),
      sourceAccount: newSourceAccount || accounts[0] || "Cash",
      autoDeduct: true,
      billingDay: 15,
    };

    if (targetCategory === "subscriptions") {
      await addSubscription(payload);
    } else if (targetCategory === "fixedBills") {
      await addFixedBill(payload);
    } else if (targetCategory === "utilities") {
      await addUtility(payload);
    }

    NativeHaptics.successMedium();
    setNewName("");
    setNewCost("");
    setNewSourceAccount("");
    setActiveAddCategory(null);
  };

  // Open Edit Modal
  const openEditModal = (item: Subscription, kind: "subscriptions" | "fixedBills" | "utilities") => {
    setEditingItem({ ...item, kind });
    setEditName(item.name);
    setEditCost(String(item.cost));
    setEditSourceAccount(item.sourceAccount || accounts[0] || "Cash");
    setEditBillingDay(String(item.billingDay || 15));
    setEditAutoDeduct(item.autoDeduct ?? true);
    setEditKind(kind);
    NativeHaptics.lightTick();
  };

  // Handle Edit Save
  const handleUpdateItem = async () => {
    if (!editingItem || !editName.trim() || !editCost || Number(editCost) <= 0) return;

    const patch: Partial<Subscription> = {
      name: editName.trim(),
      cost: Number(editCost),
      sourceAccount: editSourceAccount,
      billingDay: Number(editBillingDay),
      autoDeduct: editAutoDeduct,
    };

    if (editKind === editingItem.kind) {
      if (editKind === "subscriptions") await updateSubscription(editingItem.id, patch);
      else if (editKind === "fixedBills") await updateFixedBill(editingItem.id, patch);
      else if (editKind === "utilities") await updateUtility(editingItem.id, patch);
    } else {
      if (editingItem.kind === "subscriptions") await deleteSubscription(editingItem.id);
      else if (editingItem.kind === "fixedBills") await deleteFixedBill(editingItem.id);
      else if (editingItem.kind === "utilities") await deleteUtility(editingItem.id);

      if (editKind === "subscriptions") await addSubscription(patch);
      else if (editKind === "fixedBills") await addFixedBill(patch);
      else if (editKind === "utilities") await addUtility(patch);
    }

    NativeHaptics.successMedium();
    triggerToast("Updated successfully!");
    setEditingItem(null);
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    categoryKey: "subscriptions" | "fixedBills" | "utilities",
    items: Subscription[],
    sectionTotal: number,
    sectionPendingTotal: number,
    badgeBg: string,
    badgeColor: string,
    deleteFn: (id: string) => void
  ) => {
    return (
      <div className="bg-muted/20 p-4 rounded-3xl border border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${badgeBg} ${badgeColor}`}>
              {icon}
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">{title}</h4>
              <p className="text-[10px] text-muted-foreground font-semibold">
                {getItemSubtext(items)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-black text-foreground">{formatCurrency(sectionPendingTotal)}</span>
              {sectionPendingTotal !== sectionTotal && (
                <span className="text-[10px] text-muted-foreground font-medium block leading-none">
                  of {formatCurrency(sectionTotal)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveAddCategory(activeAddCategory === categoryKey ? null : categoryKey);
                NativeHaptics.lightTick();
              }}
              className={`p-1.5 rounded-full ${badgeBg} ${badgeColor} transition-colors`}
              aria-label={`Add ${title}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Add Form */}
        {activeAddCategory === categoryKey && (
          <div className="p-3.5 rounded-2xl bg-card border border-border/60 space-y-3 animate-in fade-in duration-200">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Add {title}</p>
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-xl px-3 py-2">
                <span className="text-xs font-bold text-muted-foreground">{currency}</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-foreground outline-none"
                />
              </div>
              <CustomSelect
                value={newSourceAccount}
                onChange={setNewSourceAccount}
                options={accounts}
                placeholder="Account"
                size="sm"
                accentColor={accentColor}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveAddCategory(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAddItem(categoryKey)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm ${
                  categoryKey === "subscriptions" ? "bg-red-500" : categoryKey === "fixedBills" ? "bg-purple-500" : "bg-yellow-500"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Item List */}
        {items.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            {items.map((item) => {
              const isPaid = item.lastPaidMonth === currentMonthStr;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-2xl bg-card border transition-all ${
                    isPaid ? "opacity-60 border-emerald-500/30 bg-emerald-500/5" : "border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Checkmark Paid/Pending Toggle */}
                    <button
                      type="button"
                      onClick={() => togglePaidStatus(item, categoryKey)}
                      aria-label={isPaid ? "Mark as Pending" : "Mark as Paid"}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                        isPaid
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "border border-border/60 hover:border-emerald-500 text-transparent hover:text-emerald-500/50"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <div className="min-w-0">
                      <p className={`text-xs font-bold text-foreground truncate ${isPaid ? "line-through text-muted-foreground" : ""}`}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {item.sourceAccount || "Cash"} • Day {item.billingDay || 1}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-xs font-black ${isPaid ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {formatCurrency(item.cost)}
                    </span>

                    {/* Edit Pencil Icon */}
                    <button
                      type="button"
                      onClick={() => openEditModal(item, categoryKey)}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Trash Icon */}
                    <button
                      type="button"
                      onClick={() => confirmAction("Delete Item", `Remove "${item.name}"?`, () => deleteFn(item.id))}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-2 font-medium">No items added yet.</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card p-6 rounded-3xl shadow-soft border border-border/40 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Repeat className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg leading-tight">Recurring Costs Manager</h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Organize subscriptions, fixed bills &amp; utilities
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            {pendingGrandTotal !== grandTotal ? "Pending / Total" : "Monthly Total"}
          </span>
          <span className="text-lg font-black text-foreground">
            {formatCurrency(pendingGrandTotal)}
          </span>
          {pendingGrandTotal !== grandTotal && (
            <span className="text-[10px] text-muted-foreground font-semibold block leading-none">
              of {formatCurrency(grandTotal)}
            </span>
          )}
        </div>
      </div>

      {/* Subscriptions */}
      {renderSection(
        "Subscriptions",
        <MonitorPlay className="w-4 h-4" />,
        "subscriptions",
        subscriptions,
        subTotal,
        subPendingTotal,
        "bg-red-500/15",
        "text-red-500",
        deleteSubscription
      )}

      {/* Fixed Bills */}
      {renderSection(
        "Fixed Bills",
        <FileText className="w-4 h-4" />,
        "fixedBills",
        fixedBills,
        billTotal,
        billPendingTotal,
        "bg-purple-500/15",
        "text-purple-500",
        deleteFixedBill
      )}

      {/* Utilities */}
      {renderSection(
        "Utilities",
        <Zap className="w-4 h-4" />,
        "utilities",
        utilities,
        utilTotal,
        utilPendingTotal,
        "bg-yellow-500/15",
        "text-yellow-500",
        deleteUtility
      )}

      {/* Cash Flow Reserve Math (sums PENDING items only) */}
      <div className="p-4 rounded-2xl border border-border/50 space-y-3 bg-muted/10">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cash Flow Reserves</p>
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-muted-foreground">Current Balance</span>
          <span className="text-foreground">{formatCurrency(totalBalance)}</span>
        </div>
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-muted-foreground">Pending Recurring Commitments</span>
          <span className="text-rose-500 font-bold">- {formatCurrency(pendingGrandTotal)}</span>
        </div>
        <div className="border-t border-border/50 pt-3 flex justify-between items-baseline">
          <span className="font-bold text-foreground text-xs">Available Cash Flow</span>
          <span
            style={availableCashFlow >= 0 ? { color: accentColor } : {}}
            className={`text-lg font-black ${availableCashFlow < 0 ? "text-rose-500" : ""}`}
          >
            {formatCurrency(availableCashFlow)}
          </span>
        </div>
      </div>

      {/* Edit Item Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative z-10 w-full max-w-sm bg-card border border-border/60 rounded-3xl shadow-2xl p-5 space-y-4 text-foreground overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <h3 className="font-black text-foreground text-base">Edit Recurring Item</h3>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Monthly Amount ({currency})
                  </label>
                  <input
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Category
                    </label>
                    <CustomSelect
                      value={editKind}
                      onChange={(val) => setEditKind(val as any)}
                      options={[
                        { value: "subscriptions", label: "Subscription" },
                        { value: "fixedBills", label: "Fixed Bill" },
                        { value: "utilities", label: "Utility" },
                      ]}
                      size="sm"
                      accentColor={accentColor}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Billing Day
                    </label>
                    <CustomSelect
                      value={String(editBillingDay)}
                      onChange={setEditBillingDay}
                      options={Array.from({ length: 28 }, (_, i) => ({
                        value: String(i + 1),
                        label: `Day ${i + 1}`,
                      }))}
                      size="sm"
                      accentColor={accentColor}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Source Account
                  </label>
                  <CustomSelect
                    value={editSourceAccount}
                    onChange={setEditSourceAccount}
                    options={accounts}
                    placeholder="Select Account"
                    size="sm"
                    accentColor={accentColor}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-foreground">Auto-Deduct Monthly</span>
                  <button
                    type="button"
                    onClick={() => setEditAutoDeduct(!editAutoDeduct)}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${
                      editAutoDeduct ? "bg-emerald-500" : "bg-muted border border-border"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow-sm absolute transition-transform ${
                        editAutoDeduct ? "translate-x-[22px]" : "translate-x-[2px]"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 rounded-2xl bg-muted hover:bg-border text-muted-foreground font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateItem}
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all"
                >
                  Update
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
