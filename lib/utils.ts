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
 * Accurately rounds a currency number to 2 decimal places (half away from zero)
 * to eliminate IEEE 754 binary floating-point drift for both positive and
 * negative amounts across large magnitudes.
 * (e.g. 0.1 + 0.2 -> 0.3, -1.005 -> -1.01)
 */
export function roundCurrency(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  const rounded = (Math.sign(amount) * Math.round(Math.abs(amount) * 100 + 1e-9)) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Formats a Date into local calendar `YYYY-MM-DD` (never UTC-shifted).
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Extracts local calendar `YYYY-MM-DD` from an ISO timestamp or date string.
 * Plain `YYYY-MM-DD` inputs are returned verbatim without UTC conversion.
 */
export function getLocalDateKeyFromIso(dateInput: string): string {
  if (!dateInput) return formatLocalDate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return formatLocalDate();
  return formatLocalDate(d);
}

/**
 * Converts a local calendar `YYYY-MM-DD` input into a safe ISO timestamp:
 *  - If editing and the local calendar day matches `preserveTimeFromIso`, keeps
 *    the original timestamp intact.
 *  - If the chosen day is today (local) and no prior timestamp is preserved,
 *    uses the current timestamp so intraday ordering stays accurate.
 *  - Otherwise anchors at local noon (`12:00:00`) so the date never drifts by
 *    ±1 day across timezone boundaries.
 */
export function parseLocalDateToIso(dateInput: string, preserveTimeFromIso?: string): string {
  if (!dateInput) return new Date().toISOString();
  const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }
  if (preserveTimeFromIso && getLocalDateKeyFromIso(preserveTimeFromIso) === dateInput) {
    const orig = new Date(preserveTimeFromIso);
    if (!isNaN(orig.getTime())) return orig.toISOString();
  }
  if (dateInput === formatLocalDate(new Date()) && !preserveTimeFromIso) {
    return new Date().toISOString();
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(year, month, day, 12, 0, 0, 0).toISOString();
}

/**
 * Converts a `YYYY-MM-DD` string to UTC epoch milliseconds at 00:00:00Z for
 * pure calendar-day difference arithmetic (immune to local DST / TZ offsets).
 */
export function dateKeyToUtcMs(dateKey: string): number {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Validates whether a string is a canonical UUID (for Postgres UUID columns).
 */
export function isValidUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

