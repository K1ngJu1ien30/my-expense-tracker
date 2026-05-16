import type { Recipe } from "./types";

const BASE = "https://www.themealdb.com/api/json/v1/1";

type MealDBMeal = Record<string, string | null>;

function parseMeal(m: MealDBMeal): Recipe {
  const ingredients: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = m[`strIngredient${i}`]?.trim();
    const measure = m[`strMeasure${i}`]?.trim();
    if (name) ingredients.push({ name, measure: measure || "" });
  }
  return {
    id: `mdb-${m.idMeal}`,
    name: m.strMeal || "",
    thumbnail: m.strMealThumb || "",
    cuisine: m.strArea || "",
    category: m.strCategory || "",
    instructions: m.strInstructions || "",
    ingredients,
    source: m.strSource || null,
    youtube: m.strYoutube || null,
  };
}

export async function searchRecipesByIngredient(ingredient: string): Promise<Recipe[]> {
  try {
    const res = await fetch(`${BASE}/filter.php?i=${encodeURIComponent(ingredient)}`);
    const data = await res.json();
    if (!data.meals) return [];
    const ids = (data.meals as { idMeal: string }[]).slice(0, 8);
    const recipes = await Promise.all(ids.map(m => getRecipeById(m.idMeal)));
    return recipes.filter(Boolean) as Recipe[];
  } catch { return []; }
}

export async function getRandomRecipes(count: number): Promise<Recipe[]> {
  try {
    const recipes: Recipe[] = [];
    for (let i = 0; i < count; i++) {
      const res = await fetch(`${BASE}/random.php`);
      const data = await res.json();
      if (data.meals?.[0]) recipes.push(parseMeal(data.meals[0]));
    }
    return recipes;
  } catch { return []; }
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  try {
    const cleanId = id.replace("mdb-", "");
    const res = await fetch(`${BASE}/lookup.php?i=${cleanId}`);
    const data = await res.json();
    if (!data.meals?.[0]) return null;
    return parseMeal(data.meals[0]);
  } catch { return null; }
}

export async function getRecipesByCuisine(area: string): Promise<Recipe[]> {
  try {
    const res = await fetch(`${BASE}/filter.php?a=${encodeURIComponent(area)}`);
    const data = await res.json();
    if (!data.meals) return [];
    const ids = (data.meals as { idMeal: string }[]).slice(0, 10);
    const recipes = await Promise.all(ids.map(m => getRecipeById(m.idMeal)));
    return recipes.filter(Boolean) as Recipe[];
  } catch { return []; }
}
