"use client";

import { useState } from "react";
import { Eye, EyeOff, ChevronDown, ChevronUp, Heart, Clock } from "lucide-react";
import { useCookMate } from "@/lib/cookmate/context";
import { GEMINI_MODEL_OPTIONS } from "@/lib/cookmate/gemini";
import Link from "next/link";

export default function SettingsPage() {
  const { geminiKey, setGeminiKey, geminiModel, setGeminiModel, history, toggleFavorite, pantry, shopping } = useCookMate();
  const [showKey, setShowKey] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const favorites = history.filter(h => h.is_favorite);
  const recent = history.slice(0, 10);

  return (
    <div className="p-6 space-y-4 pb-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-3 border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{pantry.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Pantry</p>
        </div>
        <div className="bg-card rounded-2xl p-3 border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{history.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Cooked</p>
        </div>
        <div className="bg-card rounded-2xl p-3 border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{shopping.length}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Shopping</p>
        </div>
      </div>

      {/* AI Config */}
      <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
        <button onClick={() => setAiOpen(!aiOpen)} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-bold text-sm text-foreground">AI Settings</span>
          </div>
          {aiOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {aiOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Gemini API Key</p>
              <div className="flex gap-2">
                <input value={geminiKey} onChange={e => setGeminiKey(e.target.value)} type={showKey ? "text" : "password"} placeholder="Paste your API key" className="flex-1 bg-muted/60 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground font-mono" />
                <button onClick={() => setShowKey(!showKey)} className="p-2.5 rounded-xl bg-muted">
                  {showKey ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">Google AI Studio</a></p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Model</p>
              <div className="flex gap-1.5 flex-wrap">
                {GEMINI_MODEL_OPTIONS.map(m => (
                  <button key={m} onClick={() => setGeminiModel(m)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${geminiModel === m ? "text-white" : "bg-muted text-muted-foreground"}`} style={geminiModel === m ? { backgroundColor: "#f97316" } : {}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cooking History */}
      <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
        <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <span className="font-bold text-sm text-foreground">Cooking History</span>
          </div>
          {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {historyOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
            {favorites.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Favorites</p>
                {favorites.map(h => (
                  <div key={h.id} className="flex items-center gap-3 py-1.5">
                    <img src={h.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{h.recipe_name}</span>
                    <button onClick={() => toggleFavorite(h.id)}><Heart className="w-4 h-4 fill-red-500 text-red-500" /></button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent</p>
              {recent.length === 0 && <p className="text-xs text-muted-foreground">No cooking history yet</p>}
              {recent.map(h => (
                <Link key={h.id} href={`/cookmate/recipe/${h.recipe_id}`} className="flex items-center gap-3 py-1.5">
                  <img src={h.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h.recipe_name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(h.cooked_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => { e.preventDefault(); toggleFavorite(h.id); }}>
                    <Heart className={`w-4 h-4 ${h.is_favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
