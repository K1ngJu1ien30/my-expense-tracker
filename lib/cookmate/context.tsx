"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { PantryItem, ShoppingItem, CookingHistoryEntry, Recipe, RecipeMatch } from "./types";
import { ALWAYS_IN_STOCK } from "./types";

function ssrLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function ssrSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

interface CookMateContextType {
  pantry: PantryItem[];
  addPantryItem: (item: Omit<PantryItem, "id" | "added_at">) => void;
  removePantryItem: (id: string) => void;
  updatePantryQuantity: (id: string, delta: number) => void;
  bulkAddPantry: (items: Omit<PantryItem, "id" | "added_at">[]) => void;
  shopping: ShoppingItem[];
  addShoppingItem: (name: string, quantity?: string) => void;
  removeShoppingItem: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  clearBoughtItems: () => void;
  addMissingToShopping: (names: string[]) => void;
  history: CookingHistoryEntry[];
  addToHistory: (recipeId: string, recipeName: string, thumbnail: string) => void;
  toggleFavorite: (id: string) => void;
  matchRecipes: (recipes: Recipe[]) => RecipeMatch[];
  geminiKey: string;
  setGeminiKey: (k: string) => void;
  geminiModel: string;
  setGeminiModel: (m: string) => void;
}

const CookMateContext = createContext<CookMateContextType | null>(null);

export function CookMateProvider({ children }: { children: React.ReactNode }) {
  const [pantry, setPantry] = useState<PantryItem[]>(() => ssrLoad("cookmate_pantry", []));
  const [shopping, setShopping] = useState<ShoppingItem[]>(() => ssrLoad("cookmate_shopping", []));
  const [history, setHistory] = useState<CookingHistoryEntry[]>(() => ssrLoad("cookmate_history", []));
  const [geminiKey, setGeminiKeyRaw] = useState(() => ssrLoad<string>("cookmate_gemini_key", ""));
  const [geminiModel, setGeminiModelRaw] = useState(() => ssrLoad<string>("cookmate_gemini_model", "gemini-2.5-flash"));

  useEffect(() => { ssrSave("cookmate_pantry", pantry); }, [pantry]);
  useEffect(() => { ssrSave("cookmate_shopping", shopping); }, [shopping]);
  useEffect(() => { ssrSave("cookmate_history", history); }, [history]);

  const setGeminiKey = useCallback((k: string) => { setGeminiKeyRaw(k); ssrSave("cookmate_gemini_key", k); }, []);
  const setGeminiModel = useCallback((m: string) => { setGeminiModelRaw(m); ssrSave("cookmate_gemini_model", m); }, []);

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
      const newItems = names.filter(n => !existing.has(n.toLowerCase())).map(n => ({ id: crypto.randomUUID(), name: n, quantity: "1", checked: false }));
      return [...prev, ...newItems];
    });
  }, []);

  const addToHistory = useCallback((recipeId: string, recipeName: string, thumbnail: string) => {
    setHistory(prev => [{ id: crypto.randomUUID(), recipe_id: recipeId, recipe_name: recipeName, thumbnail, cooked_at: new Date().toISOString(), is_favorite: false }, ...prev].slice(0, 50));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, is_favorite: !h.is_favorite } : h));
  }, []);

  const matchRecipes = useCallback((recipes: Recipe[]): RecipeMatch[] => {
    const pantryNames = new Set([...pantry.map(p => p.name.toLowerCase()), ...ALWAYS_IN_STOCK]);
    return recipes.map(r => {
      const matched: string[] = [];
      const missing: string[] = [];
      r.ingredients.forEach(ing => {
        const name = ing.name.toLowerCase();
        if (pantryNames.has(name) || ALWAYS_IN_STOCK.some(s => name.includes(s))) matched.push(ing.name);
        else missing.push(ing.name);
      });
      const total = r.ingredients.length || 1;
      return { ...r, matchScore: Math.round((matched.length / total) * 100), matchedIngredients: matched, missingIngredients: missing };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }, [pantry]);

  return (
    <CookMateContext.Provider value={{ pantry, addPantryItem, removePantryItem, updatePantryQuantity, bulkAddPantry, shopping, addShoppingItem, removeShoppingItem, toggleShoppingItem, clearBoughtItems, addMissingToShopping, history, addToHistory, toggleFavorite, matchRecipes, geminiKey, setGeminiKey, geminiModel, setGeminiModel }}>
      {children}
    </CookMateContext.Provider>
  );
}

export function useCookMate() {
  const ctx = useContext(CookMateContext);
  if (!ctx) throw new Error("useCookMate must be within CookMateProvider");
  return ctx;
}
