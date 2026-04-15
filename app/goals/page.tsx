"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, ShieldAlert, Pin, Trash2, X, Check } from "lucide-react";
import { useAppContext } from "@/lib/context";
import FoodBudgetCard from "@/components/FoodBudgetCard";
import SalaryPlanner from "@/components/SalaryPlanner";

// Map strings back to icons for rendering
const ICONS: Record<string, React.ReactNode> = {
  Target: <Target className="w-5 h-5 text-blue-500" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5 text-emerald-500" />
};

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal, confirmAction, enableFoodBudget, enableSalaryPlanner, currency } = useAppContext();
  
  // Modals state
  const [activeAddFunds, setActiveAddFunds] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");

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
        <h1 className="text-2xl font-bold">Your Goals</h1>
        <button onClick={() => setIsCreating(true)} className="bg-primary text-primary-foreground p-2 rounded-full shadow-soft hover:scale-105 active:scale-95 transition-transform cursor-pointer">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card p-5 rounded-3xl shadow-soft border border-border/40 space-y-3 relative mb-4">
            <button onClick={() => setIsCreating(false)} className="absolute top-4 right-4 text-muted-foreground"><X className="w-4 h-4" /></button>
            <h3 className="font-bold text-sm">Create New Goal</h3>
            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} className="w-full bg-muted p-2 rounded-lg text-sm font-semibold outline-none" placeholder="Goal Title (e.g. Dream Car)" />
            <input value={newTarget} onChange={e=>setNewTarget(e.target.value)} type="number" className="w-full bg-muted p-2 rounded-lg text-sm font-semibold outline-none" placeholder="Target Amount" />
            <button onClick={handleCreate} className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-sm font-bold mt-2 hover:opacity-90">Create Goal</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4 pb-12">
        {goals.map(g => {
          const progress = Math.min((g.current / g.target) * 100, 100);
          return (
            <div key={g.id} className="bg-card p-6 rounded-3xl shadow-soft border border-border/40 space-y-4 relative">
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <button 
                  onClick={() => updateGoal(g.id, { isPinned: !g.isPinned })} 
                  className={`transition-colors cursor-pointer ${g.isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Pin className="w-4 h-4" fill={g.isPinned ? "currentColor" : "none"} />
                </button>
                <button onClick={() => confirmAction("Delete Goal", `Are you sure you want to delete "${g.title}"?`, () => deleteGoal(g.id))} className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
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
                <div className="flex items-center gap-2 pt-2">
                  <input autoFocus value={fundAmount} onChange={e=>setFundAmount(e.target.value)} type="number" className="flex-1 bg-muted p-2 rounded-lg text-sm outline-none" placeholder="Amount to add" />
                  <button onClick={() => handleAddFunds(g.id, g.current)} className="p-2 bg-primary text-primary-foreground rounded-xl"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setActiveAddFunds(null)} className="p-2 bg-muted rounded-xl text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-bold text-muted-foreground">{progress.toFixed(0)}% Completed</span>
                  <button onClick={() => setActiveAddFunds(g.id)} className="text-xs font-bold bg-muted/50 text-foreground px-4 py-2 rounded-xl hover:bg-border transition-colors cursor-pointer active:scale-95">
                    + Add Funds
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {enableFoodBudget && <FoodBudgetCard />}
      {enableSalaryPlanner && <SalaryPlanner />}
    </div>
  )
}
