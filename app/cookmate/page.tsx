"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Clock, ChefHat } from "lucide-react";
import { useCookMate } from "@/lib/cookmate/context";
import { getApiKey, getModel, isRateLimited, incrementUsage, canCallNow } from "@/lib/ai/gemini";
import { ALWAYS_IN_STOCK } from "@/lib/cookmate/types";
import type { AIRecipe } from "@/lib/cookmate/types";

const CACHE_KEY = "cookmate_ai_recipes";
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

function getCachedRecipes(): AIRecipe[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { recipes, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_DURATION) return recipes;
    return null;
  } catch { return null; }
}

function cacheRecipes(recipes: AIRecipe[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ recipes, timestamp: Date.now() })); } catch {}
}

export default function CookMatePage() {
  const { pantry, preferences, history } = useCookMate();
  const [recipes, setRecipes] = useState<AIRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<"all" | "breakfast" | "lunch" | "dinner" | "snack">("all");

  const hasKey = !!getApiKey();
  const hour = new Date().getHours();
  const suggestedMeal = hour < 10 ? "breakfast" : hour < 14 ? "lunch" : hour < 18 ? "snack" : "dinner";

  // Load cached recipes on mount
  useEffect(() => {
    const cached = getCachedRecipes();
    if (cached && cached.length > 0) setRecipes(cached);
  }, []);

  const generateRecipes = async () => {
    if (!hasKey || loading) return;
    if (isRateLimited()) { setError("Daily AI limit reached."); return; }
    if (!canCallNow()) return;
    setLoading(true);
    setError(null);

    const model = getModel();
    const MODELS: Record<string, string> = {
      "gemini-2.5-flash": "v1beta",
      "gemini-2.0-flash": "v1beta",
      "gemini-2.0-flash-lite": "v1beta",
      "gemini-1.5-flash": "v1",
    };
    const version = MODELS[model] || "v1beta";
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${getApiKey()}`;

    const pantryList = pantry.map(p => `${p.name} (${p.quantity} ${p.unit}${p.expiry_date ? `, exp ${p.expiry_date}` : ""})`).join(", ");
    const recentCooks = history.slice(0, 5).map(h => h.recipe_name).join(", ");
    const expiringSoon = pantry.filter(p => {
      if (!p.expiry_date) return false;
      const days = (new Date(p.expiry_date).getTime() - Date.now()) / 86400000;
      return days <= 3 && days >= 0;
    }).map(p => p.name);

    const prompt = `Generate 6 recipe suggestions as a JSON array based on this context:

PANTRY: ${pantryList || "Basic staples only (rice, oil, salt, soy sauce)"}
${expiringSoon.length ? `EXPIRING SOON (prioritize these!): ${expiringSoon.join(", ")}` : ""}
RECENTLY COOKED (avoid repeating): ${recentCooks || "Nothing recently"}
ALWAYS AVAILABLE: ${ALWAYS_IN_STOCK.join(", ")}

USER PREFERENCES:
- Cuisines: ${preferences.cuisines.join(", ")}
- Dietary: ${preferences.dietary.join(", ") || "None"}
- Spice level: ${preferences.spiceLevel}
- Skill level: ${preferences.cookingSkill}
- Household size: ${preferences.householdSize}
${preferences.dislikedIngredients.length ? `- Disliked: ${preferences.dislikedIngredients.join(", ")}` : ""}

CURRENT TIME: ${hour}:00 — suggest appropriate meals (${suggestedMeal} time)

Generate EXACTLY 6 recipes — a mix of: 2 ${suggestedMeal} options, 2 other meals, 1 quick option (<15 min), 1 that uses expiring ingredients (if any).

Return ONLY a valid JSON array with this structure:
[{
  "id": "unique-id",
  "name": "Recipe Name",
  "description": "One-sentence description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["Step 1", "Step 2"],
  "prep_minutes": 10,
  "cook_minutes": 15,
  "difficulty": "easy",
  "cuisine": "Malaysian",
  "meal_type": "dinner",
  "servings": ${preferences.householdSize},
  "estimated_cost": "RM 8-12",
  "uses_pantry": ["item from pantry used"]
}]

Rules:
- Recipes MUST suit ${preferences.cuisines.join("/")} taste
- Respect dietary restrictions: ${preferences.dietary.join(", ") || "none"}
- Match skill level: ${preferences.cookingSkill}
- Prioritize using pantry ingredients over buying new ones
- Estimated cost in RM
- Steps should be clear and numbered
- ONLY output the JSON array, no markdown fences, no explanation`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      });

      if (!res.ok) {
        if (res.status === 503) setError("AI is busy — try again in a moment.");
        else setError("Failed to generate recipes.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Extract JSON from response (handle markdown fences)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed: AIRecipe[] = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure IDs
          const withIds = parsed.map((r, i) => ({ ...r, id: r.id || `ai-${Date.now()}-${i}` }));
          setRecipes(withIds);
          cacheRecipes(withIds);
          incrementUsage();
        }
      } else {
        setError("AI returned an unexpected format. Try again.");
      }
    } catch {
      setError("Network error. Check your connection.");
    }
    setLoading(false);
  };

  // Auto-generate on first visit if cache is empty
  useEffect(() => {
    if (recipes.length === 0 && hasKey && pantry.length > 0) {
      generateRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey]);

  const filtered = mealFilter === "all" ? recipes : recipes.filter(r => r.meal_type === mealFilter);

  return (
    <div className="p-6 space-y-4 pb-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {suggestedMeal === "breakfast" ? "🌅 Breakfast time" : suggestedMeal === "lunch" ? "☀️ Lunch ideas" : suggestedMeal === "snack" ? "🍵 Snack time" : "🌙 Dinner ideas"}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Based on your pantry & preferences</p>
        </div>
        <button
          onClick={generateRecipes}
          disabled={loading || !hasKey}
          className="p-2.5 rounded-xl bg-muted active:scale-95 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Meal type filter */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {(["all", "breakfast", "lunch", "dinner", "snack"] as const).map(t => (
          <button
            key={t}
            onClick={() => setMealFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all capitalize ${mealFilter === t ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}
          >
            {t === "all" ? "All" : t}
          </button>
        ))}
      </div>

      {/* No API key */}
      {!hasKey && (
        <div className="text-center py-12 space-y-2">
          <Sparkles className="w-10 h-10 mx-auto text-orange-500" />
          <p className="font-bold text-foreground">AI-Powered Recipes</p>
          <p className="text-xs text-muted-foreground">Set up your API key in Profile → AI Assistant to get personalized recipe suggestions.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs font-medium text-red-500">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && recipes.length === 0 && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card rounded-2xl border border-border/40 p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Recipes */}
      <div className="space-y-3">
        {filtered.map(recipe => (
          <div key={recipe.id} className="bg-card rounded-2xl border border-border/40 p-4 space-y-2 active:scale-[0.99] transition-transform">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{recipe.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{recipe.description}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                recipe.difficulty === "easy" ? "bg-emerald-500/10 text-emerald-500" :
                recipe.difficulty === "medium" ? "bg-amber-500/10 text-amber-500" :
                "bg-red-500/10 text-red-500"
              }`}>{recipe.difficulty}</span>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prep_minutes + (recipe.cook_minutes || 0)} min</span>
              <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" />{recipe.cuisine}</span>
              {recipe.estimated_cost && <span>{recipe.estimated_cost}</span>}
              <span className="capitalize px-1.5 py-0.5 rounded bg-muted">{recipe.meal_type}</span>
            </div>

            {recipe.uses_pantry && recipe.uses_pantry.length > 0 && (
              <p className="text-[10px] text-emerald-600 font-medium">
                ✓ Uses: {recipe.uses_pantry.join(", ")}
              </p>
            )}

            {/* Expandable steps */}
            <details className="mt-1">
              <summary className="text-xs font-bold text-orange-500 cursor-pointer">View recipe →</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Ingredients</p>
                  <div className="flex flex-wrap gap-1">
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">{ing}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Steps</p>
                  <ol className="space-y-1">
                    {recipe.steps.map((step, i) => (
                      <li key={i} className="text-xs text-foreground flex gap-2">
                        <span className="text-orange-500 font-bold shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>

      {recipes.length === 0 && hasKey && !loading && pantry.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <p className="text-4xl">🧊</p>
          <p className="font-bold text-foreground">Pantry is empty</p>
          <p className="text-xs text-muted-foreground">Add some ingredients to your pantry and I&apos;ll suggest recipes!</p>
        </div>
      )}
    </div>
  );
}
