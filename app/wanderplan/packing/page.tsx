"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { PACKING_CATEGORIES, PACKING_CATEGORY_LABELS, PACKING_TEMPLATES } from "@/lib/wanderplanConstants";
import type { WPPackingCategory } from "@/lib/types";

export default function PackingPage() {
  const {
    accentColor, wpTrips, wpActiveTripId, wpPackingItems,
    addWPPackingItem, addWPPackingItems, toggleWPPacked, deleteWPPackingItem, triggerToast,
  } = useAppContext();

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];
  const items = useMemo(() => trip ? wpPackingItems.filter(i => i.trip_id === trip.id) : [], [trip, wpPackingItems]);
  const packedCount = items.filter(i => i.is_packed).length;
  const pctPacked = items.length > 0 ? Math.round((packedCount / items.length) * 100) : 0;

  const [showAdd, setShowAdd] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemCat, setItemCat] = useState<WPPackingCategory>("clothing");
  const [quantity, setQuantity] = useState("1");
  const [showTemplates, setShowTemplates] = useState(false);

  const handleAdd = async () => {
    if (!trip || !itemName.trim()) return;
    await addWPPackingItem(trip.id, { item_name: itemName.trim(), category: itemCat, quantity: Number(quantity) || 1 } as never);
    setShowAdd(false);
    setItemName(""); setQuantity("1");
    triggerToast("Item added!");
  };

  const handleTemplate = async (templateIdx: number) => {
    if (!trip) return;
    const template = PACKING_TEMPLATES[templateIdx];
    await addWPPackingItems(trip.id, template.items);
    setShowTemplates(false);
    triggerToast(`${template.name} — ${template.items.length} items added!`);
  };

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip first.</div>;

  // Group by category
  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    PACKING_CATEGORIES.forEach(c => { g[c] = items.filter(i => i.category === c); });
    return g;
  }, [items]);

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <h2 className="text-lg font-bold text-foreground">{trip.name} — Packing</h2>

      {/* Progress */}
      {items.length > 0 && (
        <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-foreground">{pctPacked}% packed</span>
            <span className="text-xs text-muted-foreground font-medium">{packedCount}/{items.length} items</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pctPacked}%`, backgroundColor: accentColor }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setShowAdd(true)} style={{ backgroundColor: accentColor }} className="py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all">
          <Plus className="w-4 h-4" /> Add Item
        </button>
        <button onClick={() => setShowTemplates(true)} className="py-3 rounded-2xl bg-muted text-foreground font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all">
          📋 Templates
        </button>
      </div>

      {/* Grouped items */}
      {PACKING_CATEGORIES.map(cat => {
        const catItems = grouped[cat];
        if (!catItems || catItems.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{PACKING_CATEGORY_LABELS[cat]} ({catItems.filter(i => i.is_packed).length}/{catItems.length})</p>
            <div className="space-y-1">
              {catItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-card rounded-xl px-3 py-2 shadow-soft border border-border/40">
                  <button onClick={() => toggleWPPacked(item.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${item.is_packed ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                    {item.is_packed && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className={`flex-1 text-sm font-medium ${item.is_packed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.item_name}
                    {item.quantity > 1 && <span className="text-muted-foreground text-xs ml-1">×{item.quantity}</span>}
                  </span>
                  <button onClick={() => deleteWPPackingItem(item.id)} className="p-1 text-muted-foreground hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl">🎒</p>
          <p className="font-bold text-foreground">Nothing to pack yet</p>
          <p className="text-xs text-muted-foreground font-medium">Add items or use a template to get started.</p>
        </div>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-md bg-card rounded-t-[2rem] border-t border-border/50 shadow-heavy p-6 space-y-3 pb-safe">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Add Packing Item</h2>
              <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Item name" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {PACKING_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setItemCat(c)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${itemCat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{PACKING_CATEGORY_LABELS[c]}</button>
                ))}
              </div>
              <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" inputMode="numeric" min="1" placeholder="Quantity" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <button onClick={handleAdd} disabled={!itemName.trim()} style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-40">Add Item</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {showTemplates && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTemplates(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-sm bg-card rounded-3xl p-6 shadow-heavy space-y-3 border border-border/50">
              <h3 className="font-bold text-foreground text-lg">Packing Templates</h3>
              {PACKING_TEMPLATES.map((tpl, i) => (
                <button key={i} onClick={() => handleTemplate(i)} className="w-full text-left bg-muted/40 hover:bg-muted/70 rounded-2xl p-4 active:scale-[0.98] transition-all border border-border/30">
                  <span className="text-2xl mr-2">{tpl.icon}</span>
                  <span className="font-bold text-foreground">{tpl.name}</span>
                  <span className="text-xs text-muted-foreground font-medium ml-2">{tpl.items.length} items</span>
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
