/**
 * Shared Gemini AI service.
 * Used by CookMate and the app-wide AI assistant.
 * Includes usage tracking + rate limiting to protect free-tier API keys.
 */

const MODELS: Record<string, { version: string; label: string }> = {
  "gemini-2.5-flash": { version: "v1beta", label: "2.5 Flash (latest)" },
  "gemini-2.0-flash": { version: "v1beta", label: "2.0 Flash" },
  "gemini-2.0-flash-lite": { version: "v1beta", label: "2.0 Flash Lite (cheapest)" },
  "gemini-1.5-flash": { version: "v1", label: "1.5 Flash" },
};

export const AI_MODEL_OPTIONS = Object.keys(MODELS);
export const AI_MODEL_LABELS = MODELS;
export const DEFAULT_MODEL = "gemini-2.0-flash-lite";
export const DEFAULT_DAILY_LIMIT = 50; // messages per day

// ─── Usage Tracking (localStorage) ──────────────────────────────────────────

const USAGE_KEY = "ai_usage";

interface UsageData {
  date: string; // YYYY-MM-DD
  count: number;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function getUsageToday(): number {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return 0;
    const data: UsageData = JSON.parse(raw);
    if (data.date !== getToday()) return 0;
    return data.count;
  } catch { return 0; }
}

export function incrementUsage(): void {
  try {
    const today = getToday();
    const raw = localStorage.getItem(USAGE_KEY);
    let data: UsageData = { date: today, count: 0 };
    if (raw) {
      data = JSON.parse(raw);
      if (data.date !== today) data = { date: today, count: 0 };
    }
    data.count++;
    localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getDailyLimit(): number {
  try {
    const raw = localStorage.getItem("ai_daily_limit");
    return raw ? Number(raw) : DEFAULT_DAILY_LIMIT;
  } catch { return DEFAULT_DAILY_LIMIT; }
}

export function setDailyLimit(limit: number): void {
  try { localStorage.setItem("ai_daily_limit", String(limit)); } catch {}
}

export function isRateLimited(): boolean {
  return getUsageToday() >= getDailyLimit();
}

// ─── Rate limiter (minimum gap between calls) ───────────────────────────────

let lastCallTime = 0;
const MIN_GAP_MS = 2000;

export function canCallNow(): boolean {
  return Date.now() - lastCallTime >= MIN_GAP_MS;
}

// ─── API Key Management ─────────────────────────────────────────────────────

export function getApiKey(): string {
  try { return localStorage.getItem("ai_api_key") || ""; } catch { return ""; }
}

export function setApiKey(key: string): void {
  try { localStorage.setItem("ai_api_key", key); } catch {}
}

export function getModel(): string {
  try { return localStorage.getItem("ai_model") || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}

export function setModel(model: string): void {
  try { localStorage.setItem("ai_model", model); } catch {}
}

// ─── Core API Call ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function callGemini(
  systemPrompt: string,
  messages: ChatMessage[],
  userMessage: string,
  options?: { apiKey?: string; model?: string }
): Promise<string> {
  const apiKey = options?.apiKey || getApiKey();
  const model = options?.model || getModel();

  if (!apiKey) throw new Error("No API key configured. Go to Profile → AI Assistant to set one up.");
  if (isRateLimited()) throw new Error(`Daily limit reached (${getDailyLimit()} messages). Resets at midnight.`);
  if (!canCallNow()) throw new Error("Please wait a moment between messages.");

  const modelInfo = MODELS[model] || MODELS[DEFAULT_MODEL];
  const url = `https://generativelanguage.googleapis.com/${modelInfo.version}/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I'm ready to help." }] },
    ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  lastCallTime = Date.now();
  incrementUsage();

  // Retry logic for transient 503 errors (server overload)
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
    }

    // Retry on 503 (overloaded) with exponential backoff
    if (res.status === 503 && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
      continue;
    }

    const err = await res.text();
    if (res.status === 429) throw new Error("API rate limited by Google. Wait a minute and try again.");
    if (res.status === 403) throw new Error("Invalid API key. Check Profile → AI Assistant.");
    throw new Error(`Gemini error: ${res.status} — ${err.slice(0, 150)}`);
  }

  throw new Error("Server busy — please try again in a moment.");
}
