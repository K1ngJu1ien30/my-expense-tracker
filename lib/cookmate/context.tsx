"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { PantryItem, ShoppingItem, CookingHistoryEntry, FoodPreferences } from "./types";
import { DEFAULT_PREFERENCES } from "./types";

function ssrLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function ssrSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

interface CookMateContextType {
  // Pantry
  pantry: PantryItem[];
  addPantryItem: (item: Omit<PantryItem, "id" | "added_at">) => void;
  removePantryItem: (id: string) => void;
  updatePantryQuantity: (id: string, delta: number) => void;
  bulkAddPantry: (items: Omit<PantryItem, "id" | "added_at">[]) => void;
  // Shopping
  shopping: ShoppingItem[];
  addShoppingItem: (name: string, quantity?: string) => void;
  removeShoppingItem: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  clearBoughtItems: () => void;
  addMissingToShopping: (names: string[]) => void;
  // History
  history: CookingHistoryEntry[];
  addToHistory: (recipeId: string, recipeName: string, thumbnail: string) => void;
  toggleFavorite: (id: string) => void;
  // Preferences
  preferences: FoodPreferences;
  setPreferences: (prefs: FoodPreferences) => void;
}

const CookMateContext = createContext<CookMateContextType | null>(null);

export function CookMateProvider({ children }: { children: React.ReactNode }) {
  const [pantry, setPantry] = useState<PantryItem[]>(() => ssrLoad("cookmate_pantry", []));
  const [shopping, setShopping] = useState<ShoppingItem[]>(() => ssrLoad("cookmate_shopping", []));
  const [history, setHistory] = useState<CookingHistoryEntry[]>(() => ssrLoad("cookmate_history", []));
  const [preferences, setPreferencesRaw] = useState<FoodPreferences>(() => ssrLoad("cookmate_preferences", DEFAULT_PREFERENCES));

  useEffect(() => { ssrSave("cookmate_pantry", pantry); }, [pantry]);
  useEffect(() => { ssrSave("cookmate_shopping", shopping); }, [shopping]);
  useEffect(() => { ssrSave("cookmate_history", history); }, [history]);
  useEffect(() => { ssrSave("cookmate_preferences", preferences); }, [preferences]);

  const setPreferences = useCallback((prefs: FoodPreferences) => { setPreferencesRaw(prefs); }, []);

  // ─── Pantry CRUD ──────────────────────────────────────────────────────────
  const addPantryItem = useCallback((item: Omit<PantryItem, "id" | "added_at">) => {
    setPantry(prev => [...prev, { ...item, id: crypto.randomUUID(), added_at: new Date().toISOString() }]);
  }, []);

  const removePantryItem = useCallback((id: string) => {
    setPantry(prev => prev.filter(i => i.id !== id));
  }, []);

  const updatePantryQuantity = useCallback((id: string, delta: number) => {
    setPantry(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  }, []);

  const bulkAddPantry = useCallback((items: Omit<PantryItem, "id" | "added_at">[]) => {
    setPantry(prev => [...prev, ...items.map(i => ({ ...i, id: crypto.randomUUID(), added_at: new Date().toISOString() }))]);
  }, []);

  // ─── Shopping CRUD ────────────────────────────────────────────────────────
  const addShoppingItem = useCallback((name: string, quantity = "1") => {
    setShopping(prev => [...prev, { id: crypto.randomUUID(), name, quantity, checked: false }]);
  }, []);

  const removeShoppingItem = useCallback((id: string) => {
    setShopping(prev => prev.filter(i => i.id !== id));
  }, []);

  const toggleShoppingItem = useCallback((id: string) => {
    setShopping(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }, []);

  const clearBoughtItems = useCallback(() => {
    setShopping(prev => prev.filter(i => !i.checked));
  }, []);

  const addMissingToShopping = useCallback((names: string[]) => {
    setShopping(prev => {
      const existing = new Set(prev.map(i => i.name.toLowerCase()));
      const newItems = names.filter(n => !existing.has(n.toLowerCase())).map(n => ({
        id: crypto.randomUUID(), name: n, quantity: "1", checked: false,
      }));
      return [...prev, ...newItems];
    });
  }, []);

  // ─── History ──────────────────────────────────────────────────────────────
  const addToHistory = useCallback((recipeId: string, recipeName: string, thumbnail: string) => {
    setHistory(prev => [{
      id: crypto.randomUUID(),
      recipe_id: recipeId,
      recipe_name: recipeName,
      thumbnail,
      cooked_at: new Date().toISOString(),
      is_favorite: false,
    }, ...prev]);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, is_favorite: !h.is_favorite } : h));
  }, []);

  return (
    <CookMateContext.Provider value={{
      pantry, addPantryItem, removePantryItem, updatePantryQuantity, bulkAddPantry,
      shopping, addShoppingItem, removeShoppingItem, toggleShoppingItem, clearBoughtItems, addMissingToShopping,
      history, addToHistory, toggleFavorite,
      preferences, setPreferences,
    }}>
      {children}
    </CookMateContext.Provider>
  );
}

export function useCookMate() {
  const ctx = useContext(CookMateContext);
  if (!ctx) throw new Error("useCookMate must be used within CookMateProvider");
  return ctx;
}
