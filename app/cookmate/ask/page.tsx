"use client";

import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCookMate } from "@/lib/cookmate/context";
import { callGemini, getApiKey, isRateLimited, canCallNow } from "@/lib/ai/gemini";
import type { ChatMessage } from "@/lib/ai/gemini";
import type { PantryItem, FoodPreferences, CookingHistoryEntry } from "@/lib/cookmate/types";
import { ALWAYS_IN_STOCK } from "@/lib/cookmate/types";
import Link from "next/link";

const QUICK_PROMPTS = [
  "What can I cook with what I have?",
  "Suggest a quick dinner under 20 min",
  "What's expiring soon? Help me use it",
  "Plan my meals for the next 3 days",
  "I have RM 50 for this week's groceries",
  "Healthy lunch I can bring to office",
];

function buildCookMatePrompt(pantry: PantryItem[], preferences: FoodPreferences, history: CookingHistoryEntry[]) {
  const pantryList = pantry.map(p => `${p.name} (${p.quantity} ${p.unit}${p.expiry_date ? `, exp ${p.expiry_date}` : ""})`).join(", ");
  const expiring = pantry.filter(p => {
    if (!p.expiry_date) return false;
    const days = (new Date(p.expiry_date).getTime() - Date.now()) / 86400000;
    return days <= 3 && days >= 0;
  }).map(p => p.name);

  return `You are CookMate, a smart AI kitchen assistant for a Malaysian user. You help with cooking, recipes, meal planning, grocery lists, and kitchen tips.

USER'S PANTRY: ${pantryList || "Basic staples only"}
ALWAYS AVAILABLE: ${ALWAYS_IN_STOCK.join(", ")}
${expiring.length ? `⚠️ EXPIRING SOON (use first!): ${expiring.join(", ")}` : ""}
RECENTLY COOKED: ${history.slice(0, 5).map(h => h.recipe_name).join(", ") || "Nothing yet"}

PREFERENCES:
- Cuisines: ${preferences.cuisines.join(", ")}
- Dietary: ${preferences.dietary.join(", ") || "None"}
- Spice: ${preferences.spiceLevel}
- Skill: ${preferences.cookingSkill}

RULES:
- Suggest recipes using pantry ingredients first — minimize buying new stuff
- Prioritize expiring ingredients
- Don't repeat recently cooked dishes
- Match cuisine and dietary preferences
- Be concise, practical, friendly
- Include prep time, difficulty, and estimated cost in RM
- When giving recipes, use numbered steps
- If asked for meal plans or grocery lists, be specific and budget-conscious
- Grocery suggestions should be realistic Malaysian supermarket items & prices`;
}

export default function AskAIPage() {
  const { pantry, history, preferences } = useCookMate();
  const apiKey = getApiKey();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !apiKey) return;
    if (isRateLimited()) { setMessages(prev => [...prev, { role: "model", text: "Daily AI limit reached. Resets at midnight." }]); return; }
    if (!canCallNow()) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    scrollToBottom();

    try {
      const systemPrompt = buildCookMatePrompt(pantry, preferences, history);
      const response = await callGemini(systemPrompt, messages, msg);
      setMessages(prev => [...prev, { role: "model", text: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "model", text: `Error: ${err instanceof Error ? err.message : "Failed"}` }]);
    }
    setLoading(false);
    scrollToBottom();
  };

  if (!apiKey) {
    return (
      <div className="p-6 text-center py-16 space-y-3">
        <p className="text-5xl">🤖</p>
        <p className="font-bold text-foreground">AI Chef needs an API key</p>
        <p className="text-xs text-muted-foreground">Go to <Link href="/profile" className="font-bold text-orange-500 underline">Profile → AI Assistant</Link> to add your Gemini API key.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium text-center">Ask me anything about cooking, meal planning, or groceries!</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)} className="text-left bg-muted/40 rounded-xl p-3 text-xs font-medium text-foreground active:scale-[0.98] transition-transform border border-border/30">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-orange-500 text-white rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1.5">
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 p-3 flex gap-2 shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder="What should I cook?" className="flex-1 bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
        <button onClick={() => send()} disabled={!input.trim() || loading} className="p-3 rounded-xl text-white active:scale-90 transition-transform disabled:opacity-40" style={{ backgroundColor: "#f97316" }}>
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
