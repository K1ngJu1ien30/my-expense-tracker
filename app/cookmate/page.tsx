"use client";

import { useState, useMemo } from "react";
import { useCookMate } from "@/lib/cookmate/context";
import { LOCAL_RECIPES } from "@/lib/cookmate/localRecipes";
import type { MealOccasion, Difficulty } from "@/lib/cookmate/types";
import Link from "next/link";

const OCCASIONS: { value: MealOccasion; label: string; icon: string }[] = [
  { value: "quick-breakfast", label: "Breakfast", icon: "🌅" },
  { value: "work-lunch", label: "Lunch", icon: "🍱" },
  { value: "weekday-dinner", label: "Dinner", icon: "🍽️" },
  { value: "weekend-cooking", label: "Weekend", icon: "👨‍🍳" },
  { value: "meal-prep", label: "Meal Prep", icon: "📦" },
  { value: "snack", label: "Snack", icon: "🍿" },
];

const CUISINES = ["All", "Chinese", "Japanese", "Korean", "SE Asian", "Western", "Asian"];
const ACCENT = "#f97316";

export default function CookPage() {
  const { matchRecipes } = useCookMate();
  const [occasion, setOccasion] = useState<MealOccasion | null>(null);
  const [cuisine, setCuisine] = useState("All");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  const matched = useMemo(() => {
    let recipes = LOCAL_RECIPES;
    if (occasion) recipes = recipes.filter(r => r.occasion?.includes(occasion));
    if (cuisine !== "All") recipes = recipes.filter(r => r.cuisine === cuisine);
    if (difficulty) recipes = recipes.filter(r => r.difficulty === difficulty);
    return matchRecipes(recipes);
  }, [occasion, cuisine, difficulty, matchRecipes]);

  return (
    <div className="p-6 space-y-4 pb-4">
      {/* Occasion pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        <button onClick={() => setOccasion(null)} className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${!occasion ? "text-white" : "bg-muted text-muted-foreground"}`} style={!occasion ? { backgroundColor: ACCENT } : {}}>All</button>
        {OCCASIONS.map(o => (
          <button key={o.value} onClick={() => setOccasion(occasion === o.value ? null : o.value)} className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${occasion === o.value ? "text-white" : "bg-muted text-muted-foreground"}`} style={occasion === o.value ? { backgroundColor: ACCENT } : {}}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>

      {/* Cuisine + difficulty */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {CUISINES.map(c => (
          <button key={c} onClick={() => setCuisine(c)} className={`px-3 py-1 rounded-full text-[10px] font-bold shrink-0 ${cuisine === c ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{c}</button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
          <button key={d} onClick={() => setDifficulty(difficulty === d ? null : d)} className={`px-3 py-1 rounded-full text-[10px] font-bold capitalize ${difficulty === d ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{d}</button>
        ))}
      </div>

      {/* Recipe cards */}
      <div className="space-y-3">
        {matched.map(r => (
          <Link key={r.id} href={`/cookmate/recipe/${r.id}`} className="block">
            <div className="bg-card rounded-2xl shadow-soft border border-border/40 overflow-hidden active:scale-[0.98] transition-transform">
              <div className="flex gap-3 p-3">
                <img src={r.thumbnail} alt={r.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{r.cuisine} · {r.prep_minutes || "?"}min · {r.difficulty || "easy"}</p>
                  {/* Match bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.matchScore}%`, backgroundColor: r.matchScore >= 70 ? "#22c55e" : r.matchScore >= 40 ? "#eab308" : "#ef4444" }} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: r.matchScore >= 70 ? "#22c55e" : r.matchScore >= 40 ? "#eab308" : "#ef4444" }}>{r.matchScore}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {r.matchedIngredients.length > 0 && <span className="text-emerald-500">Have: {r.matchedIngredients.slice(0, 3).join(", ")}</span>}
                    {r.missingIngredients.length > 0 && <span className="text-red-400 ml-1">Need: {r.missingIngredients.slice(0, 2).join(", ")}</span>}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {matched.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-4xl">🍳</p>
            <p className="font-bold text-foreground">No recipes match your filters</p>
            <p className="text-xs text-muted-foreground">Try changing your filters or add items to your pantry</p>
          </div>
        )}
      </div>
    </div>
  );
}
