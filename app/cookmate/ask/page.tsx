"use client";

import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCookMate } from "@/lib/cookmate/context";
import { askCookMate } from "@/lib/cookmate/gemini";

const QUICK_PROMPTS = [
  "What can I cook with what I have?",
  "Suggest something quick for dinner",
  "What's expiring soon? Help me use it",
  "Give me a meal prep idea for the week",
];

export default function AskAIPage() {
  const { geminiKey, geminiModel, pantry, history } = useCookMate();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !geminiKey) return;
    setInput("");
    const userMsg = { role: "user" as const, text: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const chatHistory = messages.map(m => ({ role: m.role, text: m.text }));
      const reply = await askCookMate(geminiKey, msg, pantry, history, chatHistory, geminiModel);
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${err instanceof Error ? err.message : "Failed to get response"}` }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  if (!geminiKey) {
    return (
      <div className="p-6 text-center py-16 space-y-3">
        <p className="text-5xl">🤖</p>
        <p className="font-bold text-foreground">AI Chef needs an API key</p>
        <p className="text-xs text-muted-foreground">Go to <strong>More → AI Settings</strong> to add your Gemini API key. It&apos;s free to get one from Google AI Studio.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium text-center">Ask me anything about cooking!</p>
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
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-orange-500 text-white" : "bg-muted text-foreground"}`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
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

      {/* Input */}
      <div className="border-t border-border/40 p-3 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask CookMate..." className="flex-1 bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
        <button onClick={() => send()} disabled={!input.trim() || loading} className="p-3 rounded-xl text-white active:scale-90 transition-transform disabled:opacity-40" style={{ backgroundColor: "#f97316" }}>
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
