"use client";

import { useState } from "react";
import { Plus, Trash2, Check, ShoppingCart } from "lucide-react";
import { useCookMate } from "@/lib/cookmate/context";

export default function ShoppingPage() {
  const { shopping, addShoppingItem, removeShoppingItem, toggleShoppingItem, clearBoughtItems } = useCookMate();
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (!newItem.trim()) return;
    addShoppingItem(newItem.trim());
    setNewItem("");
  };

  const unchecked = shopping.filter(i => !i.checked);
  const checked = shopping.filter(i => i.checked);

  return (
    <div className="p-6 space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Shopping List</h2>
        {checked.length > 0 && (
          <button onClick={clearBoughtItems} className="text-xs font-bold text-red-500 active:scale-95">Clear bought</button>
        )}
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Add item..." className="flex-1 bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
        <button onClick={handleAdd} className="p-3 rounded-xl text-white active:scale-90 transition-transform" style={{ backgroundColor: "#f97316" }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Unchecked */}
      <div className="space-y-1.5">
        {unchecked.map(item => (
          <div key={item.id} className="flex items-center gap-3 bg-card rounded-xl px-3 py-2.5 border border-border/40">
            <button onClick={() => toggleShoppingItem(item.id)} className="w-5 h-5 rounded-md border-2 border-border shrink-0 active:scale-90" />
            <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{item.quantity}</span>
            <button onClick={() => removeShoppingItem(item.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Checked */}
      {checked.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bought ({checked.length})</p>
          <div className="space-y-1.5 opacity-60">
            {checked.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-card rounded-xl px-3 py-2.5 border border-border/40">
                <button onClick={() => toggleShoppingItem(item.id)} className="w-5 h-5 rounded-md bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </button>
                <span className="flex-1 text-sm font-medium text-foreground line-through">{item.name}</span>
                <button onClick={() => removeShoppingItem(item.id)} className="p-1 text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {shopping.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-4xl"><ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground" /></p>
          <p className="font-bold text-foreground">Shopping list is empty</p>
          <p className="text-xs text-muted-foreground">Add items or they&apos;ll appear from recipes you want to cook</p>
        </div>
      )}
    </div>
  );
}
