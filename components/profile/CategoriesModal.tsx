"use client";

import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { X, GripVertical, Trash2, Plus } from "lucide-react";
import { getCategoryColor, cn } from "@/lib/utils";
import { NativeHaptics } from "@/lib/haptics";

/**
 * Drag-to-reorder category manager. State for "new category input" is local
 * because it's purely modal-scoped — no need to lift it up.
 */
export function CategoriesModal({
  categories,
  setCategories,
  addCategory,
  deleteCategory,
  accentColor,
  triggerToast,
  onClose,
}: {
  categories: string[];
  setCategories: (cats: string[]) => void;
  addCategory: (cat: string) => void;
  deleteCategory: (cat: string) => void;
  accentColor: string;
  triggerToast?: (msg: string) => void;
  onClose: () => void;
}) {
  const [newCat, setNewCat] = useState("");
  const [catError, setCatError] = useState<string | null>(null);

  const submit = () => {
    setCatError(null);
    const trimmed = newCat.trim();
    if (!trimmed) {
      setCatError("Category name cannot be empty.");
      NativeHaptics.errorShake();
      if (triggerToast) triggerToast("⚠️ Category name cannot be empty.");
      return;
    }
    const isDuplicate = categories.some(
      (c) => c.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setCatError(`Category "${trimmed}" already exists.`);
      NativeHaptics.errorShake();
      if (triggerToast) triggerToast(`⚠️ Category "${trimmed}" already exists.`);
      return;
    }
    addCategory(trimmed);
    NativeHaptics.successMedium();
    if (triggerToast) triggerToast(`Category "${trimmed}" added!`);
    setNewCat("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="categories-title"
        className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-border/40 flex justify-between items-center bg-muted/20">
          <h3 id="categories-title" className="font-bold text-foreground">Manage Categories</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        <p className="px-5 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">
          Drag to reorder
        </p>

        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          <Reorder.Group axis="y" values={categories} onReorder={setCategories} className="space-y-2">
            {categories.map((cat) => (
              <Reorder.Item
                key={cat}
                value={cat}
                className="flex justify-between items-center bg-card shadow-sm p-3 rounded-xl border border-border/80 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground/50" aria-hidden="true" />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(cat) }} />
                  <span className="font-medium text-sm text-foreground">{cat}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Delete category ${cat}`}
                  onClick={() => {
                    NativeHaptics.lightTick();
                    deleteCategory(cat);
                  }}
                  className="text-muted-foreground hover:text-red-500 transition-colors p-1.5"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          {categories.length === 0 && (
            <p className="text-center text-sm font-medium text-muted-foreground py-4">
              No categories left!
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border/40 bg-muted/20 space-y-2">
          <div className="flex gap-2">
            <input
              value={newCat}
              onChange={(e) => {
                setNewCat(e.target.value);
                if (catError) setCatError(null);
              }}
              type="text"
              placeholder="New category..."
              aria-label="New category name"
              aria-invalid={!!catError}
              className={cn(
                "flex-1 bg-card rounded-xl px-4 py-2 text-sm font-medium outline-none border transition-colors text-foreground",
                catError
                  ? "border-rose-500/80 ring-2 ring-rose-500/20 text-rose-500"
                  : "border-border"
              )}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <button
              type="button"
              aria-label="Add category"
              style={{ backgroundColor: accentColor }}
              onClick={submit}
              className="text-white p-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          {catError && (
            <p role="alert" className="text-xs font-bold text-rose-500 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {catError}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
