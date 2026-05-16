export type IngredientCategory = 'protein' | 'vegetables' | 'dairy' | 'grains' | 'condiments' | 'frozen' | 'other';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type MealOccasion = 'quick-breakfast' | 'work-lunch' | 'weekday-dinner' | 'weekend-cooking' | 'snack' | 'meal-prep';

export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  expiry_date: string | null;
  added_at: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  thumbnail: string;
  cuisine: string;
  category: string;
  instructions: string;
  ingredients: { name: string; measure: string }[];
  source: string | null;
  youtube: string | null;
  prep_minutes?: number;
  difficulty?: Difficulty;
  occasion?: MealOccasion[];
}

export interface RecipeMatch extends Recipe {
  matchScore: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

export interface CookingHistoryEntry {
  id: string;
  recipe_id: string;
  recipe_name: string;
  thumbnail: string;
  cooked_at: string;
  is_favorite: boolean;
}

export const ALWAYS_IN_STOCK = [
  'salt', 'pepper', 'oil', 'cooking oil', 'vegetable oil', 'olive oil',
  'garlic', 'onion', 'onions', 'soy sauce', 'sugar', 'water',
];

export const INGREDIENT_CATEGORIES: { value: IngredientCategory; label: string; emoji: string }[] = [
  { value: 'protein', label: 'Protein', emoji: '🥩' },
  { value: 'vegetables', label: 'Vegetables', emoji: '🥬' },
  { value: 'dairy', label: 'Dairy', emoji: '🧀' },
  { value: 'grains', label: 'Grains & Carbs', emoji: '🍚' },
  { value: 'condiments', label: 'Condiments', emoji: '🧂' },
  { value: 'frozen', label: 'Frozen', emoji: '🧊' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp', 'cup', 'pack', 'can', 'bottle', 'bunch'];
