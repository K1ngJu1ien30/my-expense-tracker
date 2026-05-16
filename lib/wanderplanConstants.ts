import type {
  WPActivityCategory,
  WPBudgetCategory,
  WPPlaceCategory,
  WPDocumentType,
  WPPackingCategory,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// Activity Categories
// ═══════════════════════════════════════════════════════════════

export const ACTIVITY_CATEGORY_COLORS: Record<WPActivityCategory, string> = {
  transport: "#ef4444",
  food: "#f97316",
  accommodation: "#3b82f6",
  activity: "#22c55e",
  sightseeing: "#22c55e",
  shopping: "#a855f7",
  rest: "#9ca3af",
};

export const ACTIVITY_CATEGORY_LABELS: Record<WPActivityCategory, string> = {
  transport: "Transport",
  food: "Food & Drink",
  accommodation: "Accommodation",
  activity: "Activity",
  sightseeing: "Sightseeing",
  shopping: "Shopping",
  rest: "Rest / Free Time",
};

export const ACTIVITY_CATEGORIES: WPActivityCategory[] = [
  "transport", "food", "accommodation", "activity", "sightseeing", "shopping", "rest",
];

// ═══════════════════════════════════════════════════════════════
// Budget Categories
// ═══════════════════════════════════════════════════════════════

export const BUDGET_CATEGORY_COLORS: Record<WPBudgetCategory, string> = {
  flights: "#ef4444",
  accommodation: "#3b82f6",
  food: "#f97316",
  transport: "#eab308",
  activities: "#22c55e",
  shopping: "#a855f7",
  insurance: "#64748b",
  visas: "#0ea5e9",
  misc: "#9ca3af",
};

export const BUDGET_CATEGORY_LABELS: Record<WPBudgetCategory, string> = {
  flights: "Flights",
  accommodation: "Accommodation",
  food: "Food & Drink",
  transport: "Local Transport",
  activities: "Activities",
  shopping: "Shopping",
  insurance: "Insurance",
  visas: "Visas & Fees",
  misc: "Miscellaneous",
};

export const BUDGET_CATEGORIES: WPBudgetCategory[] = [
  "flights", "accommodation", "food", "transport", "activities", "shopping", "insurance", "visas", "misc",
];

// ═══════════════════════════════════════════════════════════════
// Place Categories
// ═══════════════════════════════════════════════════════════════

export const PLACE_CATEGORY_COLORS: Record<WPPlaceCategory, string> = {
  eat: "#f97316",
  stay: "#3b82f6",
  do: "#22c55e",
  shop: "#a855f7",
  transport: "#ef4444",
};

export const PLACE_CATEGORY_LABELS: Record<WPPlaceCategory, string> = {
  eat: "Eat",
  stay: "Stay",
  do: "Do",
  shop: "Shop",
  transport: "Transport",
};

export const PLACE_CATEGORIES: WPPlaceCategory[] = ["eat", "stay", "do", "shop", "transport"];

// ═══════════════════════════════════════════════════════════════
// Document Types
// ═══════════════════════════════════════════════════════════════

export const DOCUMENT_TYPE_LABELS: Record<WPDocumentType, string> = {
  flight: "Flight",
  hotel: "Hotel",
  train: "Train",
  insurance: "Insurance",
  visa: "Visa",
  other: "Other",
};

export const DOCUMENT_TYPE_ICONS: Record<WPDocumentType, string> = {
  flight: "✈️",
  hotel: "🏨",
  train: "🚆",
  insurance: "🛡️",
  visa: "🛂",
  other: "📄",
};

export const DOCUMENT_TYPES: WPDocumentType[] = ["flight", "hotel", "train", "insurance", "visa", "other"];

// ═══════════════════════════════════════════════════════════════
// Packing Categories
// ═══════════════════════════════════════════════════════════════

export const PACKING_CATEGORY_LABELS: Record<WPPackingCategory, string> = {
  clothing: "Clothing",
  toiletries: "Toiletries",
  electronics: "Electronics",
  documents: "Documents",
  medicine: "Medicine",
  misc: "Miscellaneous",
};

export const PACKING_CATEGORIES: WPPackingCategory[] = [
  "clothing", "toiletries", "electronics", "documents", "medicine", "misc",
];

// ═══════════════════════════════════════════════════════════════
// Packing Templates
// ═══════════════════════════════════════════════════════════════

export type PackingTemplate = {
  name: string;
  icon: string;
  items: { category: WPPackingCategory; item_name: string; quantity: number }[];
};

export const PACKING_TEMPLATES: PackingTemplate[] = [
  {
    name: "City Break",
    icon: "🏙️",
    items: [
      { category: "clothing", item_name: "T-shirts", quantity: 3 },
      { category: "clothing", item_name: "Pants / Jeans", quantity: 2 },
      { category: "clothing", item_name: "Underwear", quantity: 4 },
      { category: "clothing", item_name: "Socks", quantity: 4 },
      { category: "clothing", item_name: "Jacket / Hoodie", quantity: 1 },
      { category: "clothing", item_name: "Walking shoes", quantity: 1 },
      { category: "clothing", item_name: "Sleepwear", quantity: 1 },
      { category: "toiletries", item_name: "Toothbrush & paste", quantity: 1 },
      { category: "toiletries", item_name: "Deodorant", quantity: 1 },
      { category: "toiletries", item_name: "Shampoo (travel size)", quantity: 1 },
      { category: "toiletries", item_name: "Sunscreen", quantity: 1 },
      { category: "electronics", item_name: "Phone charger", quantity: 1 },
      { category: "electronics", item_name: "Power bank", quantity: 1 },
      { category: "electronics", item_name: "Earbuds / Headphones", quantity: 1 },
      { category: "electronics", item_name: "Universal adapter", quantity: 1 },
      { category: "documents", item_name: "Passport", quantity: 1 },
      { category: "documents", item_name: "Travel insurance", quantity: 1 },
      { category: "documents", item_name: "Boarding passes", quantity: 1 },
      { category: "documents", item_name: "Hotel booking", quantity: 1 },
      { category: "medicine", item_name: "Basic medicine kit", quantity: 1 },
      { category: "misc", item_name: "Day bag / backpack", quantity: 1 },
    ],
  },
  {
    name: "Beach Vacation",
    icon: "🏖️",
    items: [
      { category: "clothing", item_name: "Swimwear", quantity: 2 },
      { category: "clothing", item_name: "Shorts", quantity: 3 },
      { category: "clothing", item_name: "Tank tops / T-shirts", quantity: 4 },
      { category: "clothing", item_name: "Flip flops / Sandals", quantity: 1 },
      { category: "clothing", item_name: "Sun hat / Cap", quantity: 1 },
      { category: "clothing", item_name: "Light cover-up", quantity: 1 },
      { category: "clothing", item_name: "Underwear", quantity: 4 },
      { category: "toiletries", item_name: "Sunscreen SPF 50+", quantity: 1 },
      { category: "toiletries", item_name: "After-sun lotion", quantity: 1 },
      { category: "toiletries", item_name: "Insect repellent", quantity: 1 },
      { category: "toiletries", item_name: "Toothbrush & paste", quantity: 1 },
      { category: "electronics", item_name: "Waterproof phone pouch", quantity: 1 },
      { category: "electronics", item_name: "Phone charger", quantity: 1 },
      { category: "misc", item_name: "Beach towel", quantity: 1 },
    ],
  },
  {
    name: "Winter Trip",
    icon: "🏔️",
    items: [
      { category: "clothing", item_name: "Thermal base layers", quantity: 2 },
      { category: "clothing", item_name: "Warm sweaters / Fleece", quantity: 2 },
      { category: "clothing", item_name: "Winter jacket", quantity: 1 },
      { category: "clothing", item_name: "Warm pants", quantity: 2 },
      { category: "clothing", item_name: "Thermal socks", quantity: 4 },
      { category: "clothing", item_name: "Gloves", quantity: 1 },
      { category: "clothing", item_name: "Beanie / Winter hat", quantity: 1 },
      { category: "clothing", item_name: "Scarf", quantity: 1 },
      { category: "clothing", item_name: "Waterproof boots", quantity: 1 },
      { category: "toiletries", item_name: "Lip balm (SPF)", quantity: 1 },
      { category: "toiletries", item_name: "Hand cream", quantity: 1 },
      { category: "toiletries", item_name: "Toothbrush & paste", quantity: 1 },
      { category: "electronics", item_name: "Phone charger", quantity: 1 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Currency List
// ═══════════════════════════════════════════════════════════════

export const WP_CURRENCIES = [
  { code: "RM", label: "Malaysian Ringgit" },
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CNY", label: "Chinese Yuan" },
  { code: "KRW", label: "Korean Won" },
  { code: "THB", label: "Thai Baht" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "IDR", label: "Indonesian Rupiah" },
  { code: "VND", label: "Vietnamese Dong" },
  { code: "PHP", label: "Philippine Peso" },
  { code: "TWD", label: "Taiwan Dollar" },
  { code: "INR", label: "Indian Rupee" },
  { code: "HKD", label: "Hong Kong Dollar" },
  { code: "NZD", label: "New Zealand Dollar" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "AED", label: "UAE Dirham" },
];

// ═══════════════════════════════════════════════════════════════
// Weather Codes → Description
// ═══════════════════════════════════════════════════════════════

export function weatherCodeToDescription(code: number): { description: string; icon: string } {
  if (code === 0) return { description: "Clear sky", icon: "☀️" };
  if (code <= 3) return { description: "Partly cloudy", icon: "⛅" };
  if (code <= 48) return { description: "Foggy", icon: "🌫️" };
  if (code <= 55) return { description: "Drizzle", icon: "🌦️" };
  if (code <= 65) return { description: "Rain", icon: "🌧️" };
  if (code <= 77) return { description: "Snow", icon: "🌨️" };
  if (code <= 82) return { description: "Showers", icon: "🌧️" };
  if (code <= 99) return { description: "Thunderstorm", icon: "⛈️" };
  return { description: "Unknown", icon: "🌡️" };

}

// ═══════════════════════════════════════════════════════════════
// Budget category → Main tracker category mapping
// ═══════════════════════════════════════════════════════════════

export function mapWPCategoryToMainCategory(cat: WPBudgetCategory): string {
  const map: Record<WPBudgetCategory, string> = {
    flights: "Transport",
    accommodation: "Bills",
    food: "Food",
    transport: "Transport",
    activities: "Entertainment",
    shopping: "Shopping",
    insurance: "Bills",
    visas: "Bills",
    misc: "Misc.",
  };
  return map[cat] || "Misc.";
}
