import type { PantryItem, CookingHistoryEntry } from "./types";

const MODELS: Record<string, { version: string }> = {
  "gemini-2.5-flash": { version: "v1beta" },
  "gemini-2.0-flash": { version: "v1beta" },
  "gemini-2.0-flash-lite": { version: "v1beta" },
  "gemini-1.5-flash": { version: "v1" },
};

export const GEMINI_MODEL_OPTIONS = Object.keys(MODELS);

function buildSystemPrompt(pantry: PantryItem[], history: CookingHistoryEntry[]): string {
  const pantryList = pantry.map(p => `${p.name} (${p.quantity} ${p.unit}${p.expiry_date ? `, expires ${p.expiry_date}` : ""})`).join(", ");
  const recentCooks = history.slice(0, 5).map(h => h.recipe_name).join(", ");
  const expiring = pantry.filter(p => {
    if (!p.expiry_date) return false;
    const days = (new Date(p.expiry_date).getTime() - Date.now()) / 86400000;
    return days <= 3 && days >= 0;
  }).map(p => p.name);

  return `You are CookMate, a friendly smart kitchen assistant. You help with cooking, recipes, meal planning, and kitchen tips.

USER'S PANTRY: ${pantryList || "Empty"}
${expiring.length ? `EXPIRING SOON (use these first!): ${expiring.join(", ")}` : ""}
RECENTLY COOKED: ${recentCooks || "Nothing yet"}

Rules:
- Suggest recipes using ingredients the user HAS in their pantry
- Prioritize expiring ingredients
- Don't repeat recently cooked dishes
- Be concise, practical, and friendly
- When suggesting recipes, include prep time and difficulty
- If user asks for a recipe, give step-by-step instructions`;
}

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Try raw JSON array/object
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1];
  return text;
}

export async function askCookMate(
  apiKey: string,
  message: string,
  pantry: PantryItem[],
  history: CookingHistoryEntry[],
  chatHistory: { role: string; text: string }[],
  model: string
): Promise<string> {
  const modelInfo = MODELS[model] || MODELS["gemini-2.0-flash"];
  const url = `https://generativelanguage.googleapis.com/${modelInfo.version}/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    { role: "user", parts: [{ text: buildSystemPrompt(pantry, history) }] },
    { role: "model", parts: [{ text: "I'm CookMate, your kitchen assistant! I can see your pantry and recent cooking. How can I help?" }] },
    ...chatHistory.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
}

export interface AIRecipeSuggestion {
  name: string;
  ingredients: string[];
  steps: string[];
  prep_minutes: number;
  difficulty: string;
  reason: string;
}

export async function getAIRecipeSuggestions(
  apiKey: string,
  pantry: PantryItem[],
  history: CookingHistoryEntry[],
  mood: string,
  model: string
): Promise<AIRecipeSuggestion[]> {
  const modelInfo = MODELS[model] || MODELS["gemini-2.0-flash"];
  const url = `https://generativelanguage.googleapis.com/${modelInfo.version}/models/${model}:generateContent?key=${apiKey}`;

  const pantryList = pantry.map(p => p.name).join(", ");
  const prompt = `Based on these ingredients: ${pantryList || "basic kitchen staples"}
Mood/preference: ${mood || "anything quick and easy"}
Recently cooked (avoid repeating): ${history.slice(0, 3).map(h => h.recipe_name).join(", ") || "nothing"}

Suggest 3 recipes I can make. Return a JSON array:
[{"name":"...","ingredients":["..."],"steps":["1. ...","2. ..."],"prep_minutes":10,"difficulty":"easy","reason":"..."}]
Only return the JSON array, nothing else.`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    return JSON.parse(extractJSON(text));
  } catch {
    return [];
  }
}
