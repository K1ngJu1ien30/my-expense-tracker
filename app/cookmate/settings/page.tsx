"use client";

import { useState } from "react";
import { Heart, Clock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useCookMate } from "@/lib/cookmate/context";
import { getApiKey } from "@/lib/ai/gemini";
import { CUISINE_OPTIONS, DIETARY_OPTIONS } from "@/lib/cookmate/types";
import type { FoodPreferences } from "@/lib/cookmate/types";
import Link from "next/link";

export default function SettingsPage() {
  const { history, toggleFavorite, pantry, shopping, preferences, setPreferences } = useCookMate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(true);
  const hasKey = !!getApiKey();

  const favorites = history.filter(h => h.is_favorite);
  const recent = history.slice(0, 10);

  const toggleCuisine = (c: string) => {
    const next = preferences.cuisines.includes(c)
      ? preferences.cuisines.filter(x => x !== c)
      : [...preferences.cuisines, c];
    setPreferences({ ...preferences, cuisines: next });
  };

  const toggleDietary = (d: string) => {
    const next = preferences.dietary.includes(d)
      ? preferences.dietary.filter(x => x !== d)
      : [...preferences.dietary, d];
    setPreferences({ ...preferences, dietary: next });
  };

  const updatePref = (key: keyof FoodPreferences, value: unknown) => {
    setPreferences({ ...preferences, [key]: value });
  };

  return (
    <div className="p-6 space-y-4 pb-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-3 border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{pantry.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Pantry</p>
        </div>
        <div className="bg-card rounded-2xl p-3 border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{history.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Cooked</p>
        </div>
        <div className="bg-card rounded-2xl p-3 border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{shopping.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Shopping</p>
        </div>
      </div>

      {/* AI Settings pointer */}
      <Link href="/profile" className="flex items-center gap-3 bg-card rounded-2xl border border-border/40 p-4 active:bg-muted/50 transition-colors">
        <div className="bg-violet-500/10 p-2 rounded-xl"><Sparkles className="w-5 h-5 text-violet-500" /></div>
        <div className="flex-1">
          <p className="font-bold text-sm text-foreground">AI Settings</p>
          <p className="text-[10px] text-muted-foreground">{hasKey ? "API key configured ✓" : "Set up in Profile → AI Assistant"}</p>
        </div>
      </Link>

      {/* Food Preferences */}
      <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
        <button onClick={() => setPrefsOpen(!prefsOpen)} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <span className="font-bold text-sm text-foreground">Food Preferences</span>
          </div>
          {prefsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {prefsOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">
            {/* Cuisines */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Preferred Cuisines</p>
              <div className="flex flex-wrap gap-1.5">
                {CUISINE_OPTIONS.map(c => (
                  <button key={c} onClick={() => toggleCuisine(c)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${preferences.cuisines.includes(c) ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Dietary */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Dietary Restrictions</p>
              <div className="flex flex-wrap gap-1.5">
                {DIETARY_OPTIONS.map(d => (
                  <button key={d} onClick={() => toggleDietary(d)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${preferences.dietary.includes(d) ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Spice Level */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Spice Level</p>
              <div className="flex gap-2">
                {(["mild", "medium", "spicy", "extra-spicy"] as const).map(s => (
                  <button key={s} onClick={() => updatePref("spiceLevel", s)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold capitalize transition-all ${preferences.spiceLevel === s ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {s === "extra-spicy" ? "🔥 Extra" : s === "spicy" ? "🌶️ Spicy" : s === "medium" ? "👌 Medium" : "😌 Mild"}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill Level */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Cooking Skill</p>
              <div className="flex gap-2">
                {(["beginner", "intermediate", "advanced"] as const).map(s => (
                  <button key={s} onClick={() => updatePref("cookingSkill", s)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold capitalize transition-all ${preferences.cookingSkill === s ? "bg-sky-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Household Size */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground">Household Size</p>
              <div className="flex items-center gap-2">
                <button onClick={() => updatePref("householdSize", Math.max(1, preferences.householdSize - 1))} className="w-7 h-7 rounded-full bg-muted text-foreground font-bold text-sm flex items-center justify-center">-</button>
                <span className="text-sm font-black text-foreground w-6 text-center">{preferences.householdSize}</span>
                <button onClick={() => updatePref("householdSize", Math.min(10, preferences.householdSize + 1))} className="w-7 h-7 rounded-full bg-muted text-foreground font-bold text-sm flex items-center justify-center">+</button>
              </div>
            </div>

            {/* Meal Prep */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground">Meal Prep Mode</p>
                <p className="text-[10px] text-muted-foreground">Suggest batch-cookable recipes</p>
              </div>
              <button onClick={() => updatePref("mealPrepPreference", !preferences.mealPrepPreference)} className={`w-10 h-6 rounded-full transition-colors relative ${preferences.mealPrepPreference ? "bg-orange-500" : "bg-muted border border-border"}`}>
                <div className={`w-4 h-4 bg-card rounded-full shadow-sm absolute top-1 transition-transform ${preferences.mealPrepPreference ? "translate-x-[22px]" : "translate-x-[3px]"}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cooking History */}
      <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
        <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <span className="font-bold text-sm text-foreground">Cooking History</span>
          </div>
          <span className="text-xs text-muted-foreground font-bold">{history.length}</span>
        </button>
        {historyOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
            {favorites.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Favorites</p>
                {favorites.map(h => (
                  <div key={h.id} className="flex items-center gap-3 py-1.5">
                    <span className="text-lg">🍳</span>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{h.recipe_name}</span>
                    <button onClick={() => toggleFavorite(h.id)}><Heart className="w-4 h-4 fill-red-500 text-red-500" /></button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent</p>
              {recent.length === 0 && <p className="text-xs text-muted-foreground">No cooking history yet</p>}
              {recent.map(h => (
                <div key={h.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-lg">🍳</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h.recipe_name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(h.cooked_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => toggleFavorite(h.id)}>
                    <Heart className={`w-4 h-4 ${h.is_favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
