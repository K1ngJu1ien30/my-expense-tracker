"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, ShieldAlert, Pin, Trash2, X, Check, Edit2, CreditCard, Zap, MonitorPlay, Music, Wifi, Smartphone, Droplet } from "lucide-react";
import { useAppContext } from "@/lib/context";
import type { Subscription } from "@/lib/context";
import FoodBudgetCard from "@/components/FoodBudgetCard";
import SalaryPlanner from "@/components/SalaryPlanner";

// Map strings back to icons for rendering
const ICONS: Record<string, React.ReactNode> = {
  Target: <Target className="w-5 h-5 text-blue-500" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5 text-emerald-500" />,
  MonitorPlay: <MonitorPlay className="w-4 h-4" />,
  Music: <Music className="w-4 h-4" />,
  Wifi: <Wifi className="w-4 h-4" />,
  CreditCard: <CreditCard className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Smartphone: <Smartphone className="w-4 h-4" />,
  Droplet: <Droplet className="w-4 h-4" />
};

export default function GoalsPage() {
  const { 
    goals, addGoal, updateGoal, deleteGoal, confirmAction, 
    enableFoodBudget, enableSalaryPlanner, currency, 
    subscriptions, addSubscription, deleteSubscription, updateSubscription,
    utilities, addUtility, deleteUtility, updateUtility,
    formatCurrency, accentColor, accounts, triggerToast
  } = useAppContext();
  
  // Goal modals state
  const [activeAddFunds, setActiveAddFunds] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");

  // Sub/Util CRUD state
  const [showAddModal, setShowAddModal] = useState<"Sub" | "Util" | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [autoDeduct, setAutoDeduct] = useState(true);
  const [billingDay, setBillingDay] = useState("15");
  const [sourceAcc, setSourceAcc] = useState("Bank");

  const openAddModal = (type: "Sub" | "Util") => {
    setShowAddModal(type); setEditItemId(null); setNewItemName(""); setNewItemCost("");
    setAutoDeduct(true); setBillingDay("15"); setSourceAcc(accounts[0] || "Bank");
  };
  const openEditModal = (type: "Sub" | "Util", item: Subscription) => {
    setShowAddModal(type); setEditItemId(item.id); setNewItemName(item.name); setNewItemCost(String(item.cost));
    setAutoDeduct(item.autoDeduct ?? true); setBillingDay(String(item.billingDay || 15)); setSourceAcc(item.sourceAccount || accounts[0] || "Bank");
  };
  const handleSave = () => {
    if (!newItemName || !newItemCost) return;
    const payload = { name: newItemName, cost: Number(newItemCost), autoDeduct, billingDay: Number(billingDay), sourceAccount: sourceAcc };
    if (editItemId) {
      if (showAddModal === "Sub") updateSubscription(editItemId, payload); else updateUtility(editItemId, payload);
      triggerToast("Updated successfully!");
    } else {
      const newItem = { ...payload, icon: showAddModal === "Sub" ? "CreditCard" : "Zap", bg: "bg-muted", color: "text-foreground" };
      if (showAddModal === "Sub") addSubscription(newItem); else addUtility(newItem);
      triggerToast(`${newItemName} added!`);
    }
    setShowAddModal(null);
  };

  const handleAddFunds = (id: string, currentAmount: number) => {
    if (!fundAmount) return;
    updateGoal(id, { current: currentAmount + Number(fundAmount) });
    setFundAmount("");
    setActiveAddFunds(null);
  };

  const handleCreate = () => {
    if (!newTitle || !newTarget) return;
    addGoal({
      title: newTitle,
      subtitle: "Custom Goal",
      current: 0,
      target: Number(newTarget),
      isPinned: false,
      color: "bg-purple-500",
      bg: "bg-purple-500/10",
      iconName: "Target"
    });
    setIsCreating(false);
    setNewTitle("");
    setNewTarget("");
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 relative pb-32">
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-2xl font-bold">Financial Planning</h1>
        <button type="button" aria-label="Create new goal" onClick={() => setIsCreating(true)} className="bg-primary text-primary-foreground p-2 rounded-full shadow-soft hover:scale-105 active:scale-95 transition-transform cursor-pointer">
          <Plus className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} role="dialog" aria-labelledby="new-goal-title" className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 relative mb-4">
            <button type="button" aria-label="Close" onClick={() => setIsCreating(false)} className="absolute top-4 right-4 text-muted-foreground"><X className="w-4 h-4" aria-hidden="true" /></button>
            <h3 id="new-goal-title" className="font-bold text-sm">Create New Goal</h3>
            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} aria-label="Goal title" className="w-full bg-muted p-2 rounded-lg text-sm font-semibold outline-none" placeholder="Goal Title (e.g. Dream Car)" />
            <input value={newTarget} onChange={e=>setNewTarget(e.target.value)} type="number" aria-label="Target amount" className="w-full bg-muted p-2 rounded-lg text-sm font-semibold outline-none" placeholder="Target Amount" />
            <button type="button" onClick={handleCreate} className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-sm font-bold mt-2 hover:opacity-90">Create Goal</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3 pb-6">
        {goals.map(g => {
          const progress = Math.min((g.current / g.target) * 100, 100);
          return (
            <div key={g.id} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 relative">
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <button
                  type="button"
                  aria-label={g.isPinned ? `Unpin ${g.title}` : `Pin ${g.title}`}
                  aria-pressed={g.isPinned}
                  onClick={() => updateGoal(g.id, { isPinned: !g.isPinned })}
                  className={`transition-colors cursor-pointer ${g.isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Pin className="w-4 h-4" fill={g.isPinned ? "currentColor" : "none"} aria-hidden="true" />
                </button>
                <button type="button" aria-label={`Delete ${g.title}`} onClick={() => confirmAction("Delete Goal", `Are you sure you want to delete "${g.title}"?`, () => deleteGoal(g.id))} className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex gap-4 items-center pr-16">
                <div className={`${g.bg} p-3 rounded-2xl`}>
                  {ICONS[g.iconName] || <Target className="w-5 h-5 text-foreground" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-lg leading-tight">{g.title}</h3>
                  <p className="text-primary font-black mt-0.5">{currency} {g.current.toLocaleString()} <span className="text-muted-foreground font-medium text-xs">/ {currency} {g.target.toLocaleString()}</span></p>
                </div>
              </div>
              
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full ${g.color} rounded-full`}
                />
              </div>

              {activeAddFunds === g.id ? (
                <div className="flex items-center gap-2 pt-1">
                  <input autoFocus value={fundAmount} onChange={e=>setFundAmount(e.target.value)} type="number" aria-label="Amount to add" className="flex-1 bg-muted p-2 rounded-lg text-sm outline-none" placeholder="Amount to add" />
                  <button type="button" aria-label="Confirm add funds" onClick={() => handleAddFunds(g.id, g.current)} className="p-2 bg-primary text-primary-foreground rounded-xl"><Check className="w-4 h-4" aria-hidden="true" /></button>
                  <button type="button" aria-label="Cancel" onClick={() => setActiveAddFunds(null)} className="p-2 bg-muted rounded-xl text-muted-foreground"><X className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-bold text-muted-foreground">{progress.toFixed(0)}% Completed</span>
                  <button type="button" onClick={() => setActiveAddFunds(g.id)} className="text-xs font-bold bg-muted/50 text-foreground px-4 py-2 rounded-xl hover:bg-border transition-colors cursor-pointer active:scale-95">
                    + Add Funds
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Subscriptions & Utilities */}
      <div className="space-y-4">
        {/* Subscriptions */}
        <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm">Subscriptions</h3>
              <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mt-0.5">Total: {formatCurrency(subscriptions.reduce((s, sub) => s + sub.cost, 0))} / mo</p>
            </div>
            <button type="button" aria-label="Add subscription" onClick={() => openAddModal("Sub")} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="p-2 rounded-full hover:scale-105 active:scale-95 transition-all"><Plus className="w-4 h-4" aria-hidden="true" /></button>
          </div>
          <div className="space-y-2">
            {subscriptions.map(sub => (
              <div key={sub.id} className="flex flex-col bg-muted/20 p-3 rounded-2xl border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`${sub.bg} p-2 rounded-xl ${sub.color}`}>{ICONS[sub.icon] || <CreditCard className="w-4 h-4" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{sub.name}</p>
                    <p className="font-semibold text-xs text-primary mt-0.5">{formatCurrency(sub.cost)} {sub.autoDeduct ? '/mo' : ''}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button type="button" aria-label={`Edit ${sub.name}`} onClick={() => openEditModal("Sub", sub)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    <button type="button" aria-label={`Delete ${sub.name}`} onClick={() => confirmAction("Delete Subscription", `Remove ${sub.name}?`, () => deleteSubscription(sub.id))} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
                {sub.autoDeduct && (
                  <div className="mt-2 ml-[44px] bg-muted/60 px-3 py-1.5 rounded-lg text-[10px] font-bold text-muted-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Day {sub.billingDay || 1} via {sub.sourceAccount || "Bank"}</span>
                  </div>
                )}
              </div>
            ))}
            {subscriptions.length === 0 && <p className="text-xs font-semibold text-center text-muted-foreground py-2">No active subscriptions</p>}
          </div>
        </div>

        {/* Utilities */}
        <div className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm">Utilities</h3>
              <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mt-0.5">Total: {formatCurrency(utilities.reduce((s, u) => s + u.cost, 0))} / mo</p>
            </div>
            <button type="button" aria-label="Add utility" onClick={() => openAddModal("Util")} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="p-2 rounded-full hover:scale-105 active:scale-95 transition-all"><Plus className="w-4 h-4" aria-hidden="true" /></button>
          </div>
          <div className="space-y-2">
            {utilities.map(u => (
              <div key={u.id} className="flex flex-col bg-muted/20 p-3 rounded-2xl border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`${u.bg} p-2 rounded-xl ${u.color}`}>{ICONS[u.icon] || <Zap className="w-4 h-4" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{u.name}</p>
                    <p className="font-semibold text-xs text-primary mt-0.5">{formatCurrency(u.cost)}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button type="button" aria-label={`Edit ${u.name}`} onClick={() => openEditModal("Util", u)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    <button type="button" aria-label={`Delete ${u.name}`} onClick={() => confirmAction("Delete Utility", `Remove ${u.name}?`, () => deleteUtility(u.id))} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
                {u.autoDeduct && (
                  <div className="mt-2 ml-[44px] bg-muted/60 px-3 py-1.5 rounded-lg text-[10px] font-bold text-muted-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Day {u.billingDay || 1} via {u.sourceAccount || "Bank"}</span>
                  </div>
                )}
              </div>
            ))}
            {utilities.length === 0 && <p className="text-xs font-semibold text-center text-muted-foreground py-2">No active utilities</p>}
          </div>
        </div>
      </div>

      {enableFoodBudget && <FoodBudgetCard />}
      {enableSalaryPlanner && <SalaryPlanner />}

      {/* Add/Edit Subscription/Utility Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(null)} aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} role="dialog" aria-modal="true" aria-labelledby="sub-util-modal-title" className="bg-card w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col p-6 space-y-5 max-h-[85vh] overflow-y-auto hide-scrollbar">
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-2 shrink-0 sm:hidden" aria-hidden="true" />
              <div className="flex justify-between items-center pb-2">
                <h3 id="sub-util-modal-title" className="font-bold text-lg text-foreground">{editItemId ? "Edit" : "Add"} {showAddModal === "Sub" ? "Subscription" : "Utility"}</h3>
                <button type="button" aria-label="Close" onClick={() => setShowAddModal(null)} className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"><X className="w-5 h-5 text-muted-foreground" aria-hidden="true" /></button>
              </div>
              <div className="space-y-4">
                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} type="text" placeholder="Name (e.g. Netflix)" aria-label="Name" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" autoFocus />
                <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 border border-border">
                  <span className="font-bold text-muted-foreground text-sm">{currency}</span>
                  <input value={newItemCost} onChange={e => setNewItemCost(e.target.value)} type="number" placeholder="0.00" aria-label="Monthly cost" className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground" />
                </div>
                <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-4">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setAutoDeduct(!autoDeduct)}>
                    <span className="text-sm font-bold">Auto-Deduct Monthly</span>
                    <button type="button" role="switch" aria-checked={autoDeduct} aria-label="Auto-deduct monthly" className={`w-12 h-7 rounded-full transition-colors relative flex items-center pointer-events-none ${autoDeduct ? '' : 'bg-muted border border-border'}`} style={autoDeduct ? { backgroundColor: accentColor } : {}}>
                      <div className={`w-5 h-5 bg-card rounded-full shadow-sm absolute transition-transform ${autoDeduct ? 'translate-x-[24px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {autoDeduct && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden pt-4 border-t border-border/50">
                        <div className="flex flex-col gap-2 relative">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Billing Date</span>
                          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                              <button key={d} onClick={() => setBillingDay(String(d))} style={billingDay === String(d) ? { backgroundColor: accentColor, color: '#fff' } : {}} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${billingDay === String(d) ? 'shadow-soft scale-105' : 'bg-muted/50 text-muted-foreground'}`}>Day {d}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source Account</span>
                          <div className="flex flex-wrap gap-2">
                            {accounts.map(acc => (
                              <button key={acc} onClick={() => setSourceAcc(acc)} style={sourceAcc === acc ? { backgroundColor: accentColor, color: '#fff' } : {}} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 ${sourceAcc === acc ? 'shadow-soft' : 'bg-muted/50 text-muted-foreground'}`}>{acc}</button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button style={{ backgroundColor: accentColor }} onClick={handleSave} className="w-full text-white py-4 rounded-xl font-bold active:scale-[0.98] transition-all mt-2">{editItemId ? "Update" : "Add"} {showAddModal === "Sub" ? "Subscription" : "Utility"}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
