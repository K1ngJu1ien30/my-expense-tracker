/**
 * AI-powered personalized greetings (merged with smart insights).
 * 
 * Instead of a generic "Good morning" + separate insight card,
 * this generates ONE cohesive greeting that IS the insight.
 * E.g. "📉 Down 70% this week, Jerry — nice discipline!"
 * 
 * USAGE PROTECTION:
 * - Cached per-session only — refreshes on every cold app open
 *   (sessionStorage is cleared by the OS when the app process dies)
 * - Also refreshes when Capacitor fires `resume` after >5min in background
 * - Falls back to static greetings if no API key or rate limited
 * - Non-blocking — returns cached/static immediately, updates async
 */

import { getApiKey, getModel, isRateLimited, canCallNow, incrementUsage } from "./gemini";

const CACHE_KEY = "ai_greeting_cache";

interface GreetingCache {
  greeting: string;
  timestamp: number;
  bucket: string;
  // Data signature — if the underlying numbers shift meaningfully we
  // invalidate the cache so we never show "RM 0 spent" while the user
  // is staring at RM 125 on the same screen.
  sig: string;
}

/**
 * Build a coarse signature of the spending context. We round amounts so
 * tiny RM 0.50 changes don't bust the cache, but a jump from 0 → 30+ does.
 */
function buildSig(ctx: {
  spentToday: number;
  spentThisWeek: number;
  spentThisMonth: number;
  transactionCount: number;
}): string {
  // Round to nearest 10 so micro-changes don't churn the cache,
  // but the 0 → ~30 jump (the bug we just hit) does.
  const r = (n: number) => Math.round(n / 10) * 10;
  return `${r(ctx.spentToday)}|${r(ctx.spentThisWeek)}|${r(ctx.spentThisMonth)}|${ctx.transactionCount}`;
}

function getCachedGreeting(bucket: string, sig: string): string | null {
  try {
    // sessionStorage is wiped when the app process is killed (cold-open
    // case) but persists across in-app route changes — exactly the
    // "refresh on every app open" semantics we want, without hammering
    // the API on every tab switch.
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: GreetingCache = JSON.parse(raw);
    if (cache.bucket === bucket && cache.sig === sig) {
      return cache.greeting;
    }
    return null;
  } catch { return null; }
}

function setCachedGreeting(greeting: string, bucket: string, sig: string): void {
  try {
    const cache: GreetingCache = { greeting, timestamp: Date.now(), bucket, sig };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * Public helper — call this when the app returns from background after
 * a long pause (e.g. >5 min) so the next render fetches a fresh greeting
 * instead of reusing the stale session value.
 */
export function clearGreetingCache(): void {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

export async function generateAIGreeting(
  bucket: string,
  context: {
    userName: string;
    hour: number;
    currency: string;
    spentToday: number;
    spentThisWeek: number;
    spentLastWeek: number;
    spentThisMonth: number;
    spentLastMonth: number;
    topCategory: string;
    topCategoryAmount: number;
    transactionCount: number;
    streakDays: number;
    savingsGoalName: string;
    savingsGoalPct: number;
    dayOfMonth: number;
  }
): Promise<string | null> {
  const sig = buildSig(context);
  const cached = getCachedGreeting(bucket, sig);
  if (cached) return cached;

  // Guard against the empty-state race: if we have literally zero
  // transactions in context, the parent component probably hasn't
  // finished loading from Supabase yet. Bail rather than generating
  // (and caching!) a misleading "RM 0 spent" greeting.
  if (context.transactionCount === 0) return null;

  const apiKey = getApiKey();
  if (!apiKey || isRateLimited() || !canCallNow()) return null;

  const model = getModel();
  const MODELS: Record<string, string> = {
    "gemini-2.5-flash": "v1beta",
    "gemini-2.0-flash": "v1beta",
    "gemini-2.0-flash-lite": "v1beta",
    "gemini-1.5-flash": "v1",
  };
  const version = MODELS[model] || "v1beta";
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

  const weekChange = context.spentLastWeek > 0
    ? Math.round(((context.spentThisWeek - context.spentLastWeek) / context.spentLastWeek) * 100)
    : 0;

  const prompt = `Generate a short personalized greeting + financial insight for a finance app dashboard. This replaces both "Good morning" AND a separate insight card — it should be ONE line that feels like a smart friend greeting you with something useful.

USER: ${context.userName}
TIME: ${context.hour}:00 (${bucket})
CURRENCY: ${context.currency}

SPENDING DATA:
- Today: ${context.currency} ${context.spentToday.toFixed(0)}
- This week: ${context.currency} ${context.spentThisWeek.toFixed(0)} (${weekChange > 0 ? "+" : ""}${weekChange}% vs last week)
- This month so far: ${context.currency} ${context.spentThisMonth.toFixed(0)} (day ${context.dayOfMonth})
- Last month total: ${context.currency} ${context.spentLastMonth.toFixed(0)}
- Top category: ${context.topCategory} (${context.currency} ${context.topCategoryAmount.toFixed(0)})
${context.streakDays > 1 ? `- No spending for ${context.streakDays} days straight!` : ""}
${context.savingsGoalName ? `- Savings goal "${context.savingsGoalName}" at ${context.savingsGoalPct}%` : ""}

RULES:
- Output EXACTLY one line, max 8 words + an emoji at the start
- The greeting should BE the insight — combine time-awareness with financial data
- Be specific — reference actual numbers, percentages, or categories
- Tone: like a smart friend who noticed something about your money
- DO NOT be generic like "Good morning!" or "Have a great day!" — those are BANNED
- Late night (11pm-5am): acknowledge they're up + money fact
- Morning: energizing + today's spending context
- Examples of GOOD output:
  "📉 Down 70% this week — killing it!"
  "🌙 Still up? RM 0 spent today though"  
  "💪 3 days no-spend streak, nice!"
  "🍜 Food's 60% of your month, btw"
  "🎯 Laptop goal at 80% — almost there!"
  "☀️ Fresh start — only RM 19 yesterday"
- ONLY output the greeting. No quotes, no explanation.`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text && text.length < 80 && !text.includes('"')) {
      incrementUsage();
      setCachedGreeting(text, bucket, sig);
      return text;
    }
    return null;
  } catch {
    return null;
  }
}
