"use client";

import { useState, useMemo } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCookMate } from "@/lib/cookmate/context";
import { INGREDIENT_CATEGORIES, COMMON_UNITS } from "@/lib/cookmate/types";
import type { IngredientCategory } from "@/lib/cookmate/types";
import CustomDatePicker from "@/components/CustomDatePicker";

export default function PantryPage() {
  const { pantry, addPantryItem, removePantryItem, updatePantryQuantity } = useCookMate();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [cat, setCat] = useState<IngredientCategory>("protein");
  const [expiry, setExpiry] = useState("");

  const grouped = useMemo(() => {
    const g: Record<string, typeof pantry> = {};
    INGREDIENT_CATEGORIES.forEach(c => { g[c.value] = pantry.filter(i => i.category === c.value); });
    return g;
  }, [pantry]);

  const handleAdd = () => {
    if (!name.trim()) return;
    addPantryItem({ name: name.trim(), quantity: Number(qty) || 1, unit, category: cat, expiry_date: expiry || null });
    setShowAdd(false); setName(""); setQty("1"); setExpiry("");
  };

  const getExpiryColor = (date: string | null | undefined) => {
    if (!date) return "";
    const days = (new Date(date).getTime() - Date.now()) / 86400000;
    if (days < 0) return "text-red-500";
    if (days <= 3) return "text-amber-500";
    return "text-muted-foreground";
  };

  return (
    <div className="p-6 space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Pantry</h2>
        <span className="text-xs font-bold text-muted-foreground">{pantry.length} items</span>
      </div>

      <button onClick={() => setShowAdd(true)} className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all" style={{ backgroundColor: "#f97316" }}>
        <Plus className="w-4 h-4" /> Add Ingredient
      </button>

      {INGREDIENT_CATEGORIES.map(c => {
        const items = grouped[c.value];
        if (!items?.length) return null;
        return (
          <div key={c.value}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{c.emoji} {c.label}</p>
            <div className="space-y-1.5">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-card rounded-xl px-3 py-2 border border-border/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                    <p className={`text-[10px] font-medium ${getExpiryColor(item.expiry_date)}`}>
                      {item.quantity} {item.unit}
                      {item.expiry_date && ` · Exp: ${new Date(item.expiry_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button onClick={() => updatePantryQuantity(item.id, -1)} className="p-1.5 rounded-lg bg-muted active:scale-90"><Minus className="w-3 h-3 text-muted-foreground" /></button>
                  <button onClick={() => updatePantryQuantity(item.id, 1)} className="p-1.5 rounded-lg bg-muted active:scale-90"><Plus className="w-3 h-3 text-muted-foreground" /></button>
                  <button onClick={() => removePantryItem(item.id)} className="p-1.5 rounded-lg text-red-500 active:scale-90"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {pantry.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">🧊</p>
          <p className="font-bold text-foreground">Pantry is empty</p>
          <p className="text-xs text-muted-foreground">Add ingredients to get recipe matches</p>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-md bg-card rounded-t-[2rem] border-t border-border/50 shadow-heavy p-6 space-y-3 pb-safe">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Add Ingredient</h2>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ingredient name" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <div className="grid grid-cols-2 gap-3">
                <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="Qty" className="bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" />
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar items-center">
                  {COMMON_UNITS.slice(0, 6).map(u => (
                    <button key={u} onClick={() => setUnit(u)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold shrink-0 ${unit === u ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{u}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                {INGREDIENT_CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => setCat(c.value)} className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${cat === c.value ? "text-white" : "bg-muted text-muted-foreground"}`} style={cat === c.value ? { backgroundColor: "#f97316" } : {}}>{c.emoji} {c.label}</button>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground mb-1">Expiry Date (optional)</p>
                <CustomDatePicker value={expiry} onChange={setExpiry} accentColor="#f97316" />
              </div>
              <button onClick={handleAdd} disabled={!name.trim()} className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-40" style={{ backgroundColor: "#f97316" }}>Add to Pantry</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
