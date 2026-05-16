"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShoppingCart, Check, ExternalLink } from "lucide-react";
import { useCookMate } from "@/lib/cookmate/context";
import { LOCAL_RECIPES } from "@/lib/cookmate/localRecipes";

export default function RecipeDetail() {
  const params = useParams();
  const id = params.id as string;
  const { addMissingToShopping, addToHistory, matchRecipes } = useCookMate();
  const [cooked, setCooked] = useState(false);

  const recipe = useMemo(() => LOCAL_RECIPES.find(r => r.id === id), [id]);
  const matched = useMemo(() => recipe ? matchRecipes([recipe])[0] : null, [recipe, matchRecipes]);

  if (!recipe || !matched) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-4xl">🔍</p>
        <p className="font-bold text-foreground mt-2">Recipe not found</p>
        <Link href="/cookmate" className="text-sm text-orange-500 font-bold mt-2 block">← Back to recipes</Link>
      </div>
    );
  }

  const handleCook = () => {
    addToHistory(recipe.id, recipe.name, recipe.thumbnail);
    setCooked(true);
  };

  const steps = recipe.instructions.split("\n").filter(s => s.trim());

  return (
    <div className="pb-4">
      <div className="relative">
        <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-48 object-cover" />
        <Link href="/cookmate" className="absolute top-4 left-4 p-2 bg-black/40 backdrop-blur-sm rounded-full">
          <ChevronLeft className="w-5 h-5 text-white" />
        </Link>
      </div>

      <div className="p-6 space-y-4 -mt-6 relative">
        <div className="bg-card rounded-2xl border border-border/40 p-4 shadow-soft">
          <h1 className="text-xl font-black text-foreground">{recipe.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-medium">
            <span>{recipe.cuisine}</span><span>·</span><span>{recipe.prep_minutes || "?"}min</span><span>·</span><span className="capitalize">{recipe.difficulty || "easy"}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${matched.matchScore}%`, backgroundColor: matched.matchScore >= 70 ? "#22c55e" : matched.matchScore >= 40 ? "#eab308" : "#ef4444" }} />
            </div>
            <span className="text-xs font-bold" style={{ color: matched.matchScore >= 70 ? "#22c55e" : "#eab308" }}>{matched.matchScore}% match</span>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-foreground mb-2">Ingredients</h2>
          <div className="space-y-1.5">
            {recipe.ingredients.map((ing, i) => {
              const have = matched.matchedIngredients.includes(ing.name);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${have ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}`}>{have ? "✓" : "✕"}</span>
                  <span className="text-sm text-foreground">{ing.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{ing.measure}</span>
                  {!have && <button onClick={() => addMissingToShopping([ing.name])} className="p-1 text-orange-500 active:scale-90"><ShoppingCart className="w-3.5 h-3.5" /></button>}
                </div>
              );
            })}
          </div>
          {matched.missingIngredients.length > 0 && (
            <button onClick={() => addMissingToShopping(matched.missingIngredients)} className="mt-2 text-xs font-bold text-orange-500 active:scale-95">+ Add all missing to shopping list</button>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold text-foreground mb-2">Instructions</h2>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{i + 1}</span>
                <p className="text-sm text-foreground leading-relaxed">{step.replace(/^\d+\.\s*/, "")}</p>
              </div>
            ))}
          </div>
        </div>

        {recipe.youtube && <a href={recipe.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-red-500"><ExternalLink className="w-4 h-4" /> Watch on YouTube</a>}

        <button onClick={handleCook} disabled={cooked} className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all ${cooked ? "bg-emerald-500 text-white" : "text-white"}`} style={!cooked ? { backgroundColor: "#f97316" } : {}}>
          {cooked ? <><Check className="w-5 h-5" /> Cooked!</> : "🍳 I Cooked This!"}
        </button>
      </div>
    </div>
  );
}
