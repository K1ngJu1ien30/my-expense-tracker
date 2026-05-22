// CookMate Types — fully AI-driven kitchen companion

export interface PantryItem {
  id: string;
  name: string;
  category: "protein" | "vegetables" | "dairy" | "grains" | "condiments" | "frozen" | "fruits" | "snacks" | "other";
  quantity: number;
  unit: string;
  expiry_date?: string | null;
  added_at: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  category?: string;
}

export interface CookingHistoryEntry {
  id: string;
  recipe_name: string;
  thumbnail: string;
  cooked_at: string;
  is_favorite: boolean;
  recipe_id: string;
}

export interface FoodPreferences {
  cuisines: string[]; // e.g. ["Malaysian", "Chinese", "Japanese", "Korean"]
  dietary: string[]; // e.g. ["halal", "no-pork", "low-carb"]
  spiceLevel: "mild" | "medium" | "spicy" | "extra-spicy";
  cookingSkill: "beginner" | "intermediate" | "advanced";
  dislikedIngredients: string[];
  householdSize: number;
  mealPrepPreference: boolean; // likes batch cooking
}

export interface AIRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  prep_minutes: number;
  cook_minutes: number;
  difficulty: "easy" | "medium" | "hard";
  cuisine: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  estimated_cost?: string;
  uses_pantry: string[]; // which pantry items it uses
}

export interface MealPlan {
  id: string;
  created_at: string;
  days: MealPlanDay[];
  budget?: number;
  notes?: string;
}

export interface MealPlanDay {
  date: string;
  meals: { type: "breakfast" | "lunch" | "dinner" | "snack"; recipe_name: string; description?: string }[];
}

export const PANTRY_CATEGORIES = [
  { key: "protein", label: "Protein", emoji: "🥩" },
  { key: "vegetables", label: "Vegetables", emoji: "🥬" },
  { key: "fruits", label: "Fruits", emoji: "🍎" },
  { key: "dairy", label: "Dairy", emoji: "🥛" },
  { key: "grains", label: "Grains", emoji: "🌾" },
  { key: "condiments", label: "Condiments", emoji: "🧂" },
  { key: "frozen", label: "Frozen", emoji: "🧊" },
  { key: "snacks", label: "Snacks", emoji: "🍿" },
  { key: "other", label: "Other", emoji: "📦" },
] as const;

export const CUISINE_OPTIONS = [
  "Malaysian", "Chinese", "Japanese", "Korean", "Thai",
  "Vietnamese", "Indian", "Indonesian", "Western", "Mediterranean",
  "Middle Eastern", "Fusion",
];

export const DIETARY_OPTIONS = [
  "Halal", "No Pork", "No Beef", "Vegetarian", "Vegan",
  "Low Carb", "Keto", "Gluten Free", "Dairy Free", "No Shellfish",
];

export const DEFAULT_PREFERENCES: FoodPreferences = {
  cuisines: ["Malaysian", "Chinese", "Japanese"],
  dietary: [],
  spiceLevel: "medium",
  cookingSkill: "intermediate",
  dislikedIngredients: [],
  householdSize: 1,
  mealPrepPreference: false,
};

// Items that are always assumed to be available
export const ALWAYS_IN_STOCK = [
  "salt", "pepper", "oil", "cooking oil", "garlic", "water", "sugar",
  "soy sauce", "sesame oil", "rice", "butter",
];

// ─── Legacy exports for pantry page compatibility ───────────────────────────

export type IngredientCategory = PantryItem["category"];

export const INGREDIENT_CATEGORIES = PANTRY_CATEGORIES.map(c => ({ value: c.key, label: c.label, emoji: c.emoji }));

export const COMMON_UNITS = [
  "pcs", "g", "kg", "ml", "L", "cups", "tbsp", "tsp", "slices", "bunch", "pack", "can", "bottle",
];
