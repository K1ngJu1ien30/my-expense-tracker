import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORY_COLOR_MAP: Record<string, string> = {
  food: "#f59e0b",          // Amber
  groceries: "#10b981",     // Emerald
  transport: "#3b82f6",     // Blue
  housing: "#8b5cf6",       // Violet
  bills: "#a855f7",         // Purple
  healthcare: "#06b6d4",    // Cyan
  shopping: "#f43f5e",      // Rose
  entertainment: "#ec4899", // Pink
  salary: "#22c55e",        // Green
  income: "#10b981",        // Emerald
  education: "#6366f1",     // Indigo
  other: "#64748b",         // Slate
};

/**
 * Generates a unique, consistent, dark-mode aesthetic color for any category name.
 * Uses a curated palette for core categories and a deterministic HSL hash fallback for custom ones.
 */
export function getCategoryColor(categoryName: string): string {
  if (!categoryName) return "#64748b";
  const normalized = categoryName.trim().toLowerCase();

  // Check preset map first
  if (CATEGORY_COLOR_MAP[normalized]) {
    return CATEGORY_COLOR_MAP[normalized];
  }

  // Fallback: deterministic HSL hash generator for custom categories
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

/**
 * Accurately rounds a currency number to 2 decimal places to eliminate IEEE 754 binary floating-point drift.
 * (e.g. 0.1 + 0.2 = 0.30000000000000004 -> 0.3)
 */
export function roundCurrency(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

