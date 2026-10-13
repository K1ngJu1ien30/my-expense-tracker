"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, ShieldAlert, Pin, Trash2, X, Check, CreditCard, Zap, MonitorPlay, Music, Wifi, Smartphone, Droplet } from "lucide-react";
import { useAppContext } from "@/lib/context";
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
    enableFoodBudget, enableSalaryPlanner, currency
  } = useAppContext();
  
  // Goal modals state
  const [activeAddFunds, setActiveAddFunds] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");

  const handleAddFunds = (id: string, currentAmount: number) => {
    if (!fundAmount) return;
    const added = Number(fundAmount);
    if (isNaN(added)) return;
    const nextCurrent = Math.round((currentAmount + added) * 100) / 100;
    updateGoal(id, { current: nextCurrent });
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
    <div className="p-4 sm:p-6 lg:p-0 animate-in fade-in duration-500 space-y-6 relative pb-32">
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-2xl font-bold">Financial Planning</h1>
        <button type="button" aria-label="Create new goal" onClick={() => setIsCreating(true)} className="bg-primary text-primary-foreground p-2 rounded-full shadow-soft hover:scale-105 active:scale-95 transition-transform cursor-pointer">
          <Plus className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} role="dialog" aria-labelledby="new-goal-title" className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 relative mb-4 max-w-xl">
            <button type="button" aria-label="Close" onClick={() => setIsCreating(false)} className="absolute top-4 right-4 text-muted-foreground"><X className="w-4 h-4" aria-hidden="true" /></button>
            <h3 id="new-goal-title" className="font-bold text-sm">Create New Goal</h3>
            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} aria-label="Goal title" className="w-full bg-muted p-2 rounded-lg text-sm font-semibold outline-none" placeholder="Goal Title (e.g. Dream Car)" />
            <input value={newTarget} onChange={e=>setNewTarget(e.target.value)} type="number" aria-label="Target amount" className="w-full bg-muted p-2 rounded-lg text-sm font-semibold outline-none" placeholder="Target Amount" />
            <button type="button" onClick={handleCreate} className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-sm font-bold mt-2 hover:opacity-90">Create Goal</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={goals.length === 0 ? "w-full pb-6" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6"}>
        {goals.length === 0 ? (
          <div className="bg-card/60 border border-dashed border-border/80 rounded-3xl p-8 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">No Savings Goals Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Set milestone targets for emergency funds, vacations, or major purchases to stay on track.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="text-xs font-bold bg-primary text-primary-foreground px-4 py-2 rounded-xl shadow-soft hover:opacity-90 active:scale-95 transition-transform"
            >
              + Create First Goal
            </button>
          </div>
        ) : (
          goals.map(g => {
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
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground text-base leading-tight truncate">{g.title}</h3>
                    <p className="text-primary font-black mt-0.5 text-xs truncate">{currency} {g.current.toLocaleString()} <span className="text-muted-foreground font-medium text-[10px]">/ {currency} {g.target.toLocaleString()}</span></p>
                  </div>
                </div>
                
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${g.color} rounded-full`}
                  />
                </div>

                {activeAddFunds === g.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input autoFocus value={fundAmount} onChange={e=>setFundAmount(e.target.value)} type="number" aria-label="Amount to add" className="flex-1 bg-muted p-2 rounded-lg text-xs outline-none font-bold" placeholder="Amount to add" />
                    <button type="button" aria-label="Confirm add funds" onClick={() => handleAddFunds(g.id, g.current)} className="p-2 bg-primary text-primary-foreground rounded-xl cursor-pointer"><Check className="w-4 h-4" aria-hidden="true" /></button>
                    <button type="button" aria-label="Cancel" onClick={() => setActiveAddFunds(null)} className="p-2 bg-muted rounded-xl text-muted-foreground cursor-pointer"><X className="w-4 h-4" aria-hidden="true" /></button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground">{progress.toFixed(0)}% Completed</span>
                    <button type="button" onClick={() => setActiveAddFunds(g.id)} className="text-[10px] font-bold bg-muted/50 text-foreground px-3 py-1.5 rounded-xl hover:bg-border transition-colors cursor-pointer active:scale-95">
                      + Add Funds
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {(enableFoodBudget || enableSalaryPlanner) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {enableFoodBudget && <FoodBudgetCard />}
          {enableSalaryPlanner && <SalaryPlanner />}
        </div>
      )}
    </div>
  );
}
