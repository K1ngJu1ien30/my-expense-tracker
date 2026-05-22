"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Sparkles, Trash2, ChevronLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { callGemini, getApiKey, getUsageToday, getDailyLimit, isRateLimited } from "@/lib/ai/gemini";
import type { ChatMessage } from "@/lib/ai/gemini";
import { NativeHaptics } from "@/lib/haptics";
import { format, subDays, startOfMonth } from "date-fns";

function buildFullSystemPrompt(ctx: ReturnType<typeof buildContext>) {
  return `You are a smart AI assistant inside a personal finance & life management app. You have FULL access to the user's data across all modules. Be concise, helpful, and personalized.

═══ FINANCIAL DATA ═══
Currency: ${ctx.currency}
Total transactions: ${ctx.transactionCount}
Spent this month: ${ctx.currency} ${ctx.spentThisMonth.toFixed(2)}
Spent this week: ${ctx.currency} ${ctx.spentThisWeek.toFixed(2)}
Income this month: ${ctx.currency} ${ctx.incomeThisMonth.toFixed(2)}
Net this month: ${ctx.currency} ${(ctx.incomeThisMonth - ctx.spentThisMonth).toFixed(2)}

Top categories this month: ${ctx.topCategories.map(c => `${c.name} (${ctx.currency} ${c.amount.toFixed(0)})`).join(", ") || "None yet"}

Accounts: ${ctx.accounts.map(a => `${a.name} [${a.currency}]`).join(", ") || "Default"}

Recent transactions (last 15):
${ctx.recentTransactions.map(t => `  ${t.date} | ${t.type} | ${t.category} | ${ctx.currency} ${t.amount} | ${t.note || "-"} | ${t.account}`).join("\n") || "  None"}

═══ SUBSCRIPTIONS & BILLS ═══
${ctx.subscriptions.length > 0 ? ctx.subscriptions.map(s => `  ${s.name}: ${ctx.currency} ${s.cost}/mo (Day ${s.billingDay})`).join("\n") : "  None"}

═══ UTILITIES ═══
${ctx.utilities.length > 0 ? ctx.utilities.map(u => `  ${u.name}: ${ctx.currency} ${u.cost}/mo`).join("\n") : "  None"}

═══ SAVINGS GOALS ═══
${ctx.goals.length > 0 ? ctx.goals.map(g => `  ${g.name}: ${ctx.currency} ${g.saved}/${g.target} (${Math.round((g.saved/g.target)*100)}%)`).join("\n") : "  None"}

═══ ASSETS & GEAR ═══
${ctx.assets.length > 0 ? ctx.assets.map(a => `  ${a.name} (${a.category}) — bought ${a.purchaseDate} for ${ctx.currency} ${a.purchasePrice}${a.maintenanceLogs ? `, ${a.maintenanceLogs} maintenance logs` : ""}`).join("\n") : "  None"}

═══ TRADING / FLIPPING ═══
${ctx.trades.length > 0 ? ctx.trades.map(t => `  ${t.name}: bought ${ctx.currency} ${t.buyPrice}${t.sellPrice ? ` → sold ${ctx.currency} ${t.sellPrice} (${t.sellPrice > t.buyPrice ? "profit" : "loss"} ${ctx.currency} ${Math.abs(t.sellPrice - t.buyPrice)})` : " (holding)"}`).join("\n") : "  None"}

═══ TRAVEL (WanderPlan) ═══
${ctx.trips.length > 0 ? ctx.trips.map(t => `  ${t.name} → ${t.destination} (${t.status}) | ${t.startDate} — ${t.endDate} | Budget: ${t.currency} ${t.budget} | Spent: ${t.currency} ${t.spent}`).join("\n") : "  No trips"}

═══ SALARY PLANNER ═══
${ctx.plannerItems.length > 0 ? ctx.plannerItems.map(p => `  ${p.name}: ${ctx.currency} ${p.amount}`).join("\n") : "  None"}

═══ CAPABILITIES ═══
- Analyze spending patterns, trends, and anomalies
- Advise on budgets, saving strategies, and financial goals
- Comment on asset depreciation and maintenance schedules
- Evaluate trading/flipping profitability
- Help plan trip budgets based on past travel spending
- Summarize subscriptions and total recurring costs
- Track goal progress and estimate completion dates
- Be concise — 2-4 sentences unless user asks for detail

═══ RULES ═══
- Only reference data provided above — never fabricate numbers
- Be encouraging about savings, honest about overspending
- If asked about unrelated topics, briefly help then gently redirect
- Format numbers with the user's currency (${ctx.currency})`;
}

function buildContext(appCtx: {
  currency: string;
  transactions: Array<{ type: string; amount: number; category: string; date: string; note?: string; account?: string }>;
  subscriptions: Array<{ name: string; cost: number; billingDay?: number }>;
  utilities: Array<{ name: string; cost: number }>;
  goals: Array<{ title: string; current: number; target: number }>;
  accounts: Array<{ name: string; currencyCode?: string }>;
  assets: Array<{ name: string; category?: string; purchase_date?: string; purchase_price?: number; logs?: number }>;
  tradeItems: Array<{ name: string; buy_price: number; sell_price?: number | null }>;
  wpTrips: Array<{ id: string; name: string; destination: string; status: string; start_date: string; end_date: string; currency_code: string }>;
  wpExpenses: Array<{ trip_id: string; amount_cents: number }>;
  wpAllocations: Array<{ trip_id: string; allocated_cents: number }>;
  plannerItems: Array<{ item_name: string; amount: number }>;
}) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const weekStart = subDays(now, 7);

  const monthTx = appCtx.transactions.filter(t => t.type === "Expense" && new Date(t.date) >= monthStart);
  const weekTx = appCtx.transactions.filter(t => t.type === "Expense" && new Date(t.date) >= weekStart);
  const monthIncome = appCtx.transactions.filter(t => t.type === "Income" && new Date(t.date) >= monthStart);

  const catMap: Record<string, number> = {};
  monthTx.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCategories = Object.entries(catMap).sort(([,a],[,b]) => b - a).slice(0, 7).map(([name, amount]) => ({ name, amount }));

  return {
    currency: appCtx.currency,
    transactionCount: appCtx.transactions.length,
    spentThisMonth: monthTx.reduce((s, t) => s + t.amount, 0),
    spentThisWeek: weekTx.reduce((s, t) => s + t.amount, 0),
    incomeThisMonth: monthIncome.reduce((s, t) => s + t.amount, 0),
    topCategories,
    accounts: appCtx.accounts.map(a => ({ name: a.name, currency: a.currencyCode || appCtx.currency })),
    recentTransactions: appCtx.transactions.slice(0, 15).map(t => ({
      date: format(new Date(t.date), "MMM d"),
      type: t.type,
      category: t.category || "-",
      amount: t.amount,
      note: t.note || "",
      account: t.account || "-",
    })),
    subscriptions: appCtx.subscriptions.map(s => ({ name: s.name, cost: s.cost, billingDay: s.billingDay || 1 })),
    utilities: appCtx.utilities.map(u => ({ name: u.name, cost: u.cost })),
    goals: appCtx.goals.map(g => ({ name: g.title, saved: g.current || 0, target: g.target || 1 })),
    assets: appCtx.assets.map(a => ({
      name: a.name,
      category: a.category || "Other",
      purchaseDate: a.purchase_date ? format(new Date(a.purchase_date), "MMM yyyy") : "?",
      purchasePrice: a.purchase_price || 0,
      maintenanceLogs: a.logs || 0,
    })),
    trades: appCtx.tradeItems.map(t => ({
      name: t.name,
      buyPrice: t.buy_price,
      sellPrice: t.sell_price || null,
    })),
    trips: appCtx.wpTrips.map(t => {
      const tripExpenses = appCtx.wpExpenses.filter(e => e.trip_id === t.id);
      const tripBudget = appCtx.wpAllocations.filter(a => a.trip_id === t.id);
      return {
        name: t.name,
        destination: t.destination,
        status: t.status,
        startDate: t.start_date,
        endDate: t.end_date,
        currency: t.currency_code,
        budget: (tripBudget.reduce((s, a) => s + a.allocated_cents, 0) / 100),
        spent: (tripExpenses.reduce((s, e) => s + e.amount_cents, 0) / 100),
      };
    }),
    plannerItems: appCtx.plannerItems.map(p => ({ name: p.item_name, amount: p.amount })),
  };
}

/** Simple markdown-to-JSX renderer for AI responses */
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    // Bold
    let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Bullet points
    if (processed.startsWith("- ") || processed.startsWith("• ")) {
      return <p key={i} className="pl-3 before:content-['•'] before:absolute before:left-0 relative before:text-muted-foreground" dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />;
    }
    // Numbered list
    const numMatch = processed.match(/^(\d+)\.\s/);
    if (numMatch) {
      return <p key={i} className="pl-4" dangerouslySetInnerHTML={{ __html: processed }} />;
    }
    // Empty line = spacing
    if (!processed.trim()) return <br key={i} />;
    return <p key={i} dangerouslySetInnerHTML={{ __html: processed }} />;
  });
}

const CHAT_STORAGE_KEY = "ai_chat_history";

function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveChatHistory(messages: ChatMessage[]): void {
  try {
    // Keep only last 50 messages to avoid localStorage bloat
    const trimmed = messages.slice(-50);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export default function AIAssistantPage() {
  const {
    currency, transactions, accountObjects, accentColor, triggerToast,
    subscriptions, utilities, goals, wpTrips, wpExpenses, wpAllocations,
    plannerItems,
  } = useAppContext();

  // Assets and trades — access via the context (typed in AppContextType)
  const ctx = useAppContext();
  const assets = (ctx as unknown as { assets: Array<{ id: string; name: string; category?: string; purchase_date?: string; purchase_price?: number; logs?: number }> }).assets || [];
  const tradeItems = (ctx as unknown as { tradeItems: Array<{ id: string; name: string; buy_price: number; sell_price?: number | null }> }).tradeItems || [];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasKey = !!getApiKey();

  // Load persisted chat on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = loadChatHistory();
    if (saved.length > 0) setMessages(saved);
  }, []);

  // Persist chat on every change
  useEffect(() => {
    if (messages.length > 0) saveChatHistory(messages);
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const getFullContext = useCallback(() => {
    return buildContext({
      currency,
      transactions: transactions as Array<{ type: string; amount: number; category: string; date: string; note?: string; account?: string }>,
      subscriptions: subscriptions as Array<{ name: string; cost: number; billingDay?: number }>,
      utilities: utilities as Array<{ name: string; cost: number }>,
      goals: goals as unknown as Array<{ title: string; current: number; target: number }>,
      accounts: accountObjects as Array<{ name: string; currencyCode?: string }>,
      assets,
      tradeItems,
      wpTrips: wpTrips as Array<{ id: string; name: string; destination: string; status: string; start_date: string; end_date: string; currency_code: string }>,
      wpExpenses: wpExpenses as Array<{ trip_id: string; amount_cents: number }>,
      wpAllocations: wpAllocations as Array<{ trip_id: string; allocated_cents: number }>,
      plannerItems: plannerItems as unknown as Array<{ item_name: string; amount: number }>,
    });
  }, [currency, transactions, subscriptions, utilities, goals, accountObjects, assets, tradeItems, wpTrips, wpExpenses, wpAllocations, plannerItems]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setError(null);
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    scrollToBottom();
    setLoading(true);
    NativeHaptics.lightTick();

    try {
      const ctx = getFullContext();
      const systemPrompt = buildFullSystemPrompt(ctx);
      const response = await callGemini(systemPrompt, messages, userMsg);
      setMessages(prev => [...prev, { role: "model", text: response }]);
      NativeHaptics.successMedium();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch {}
    triggerToast("Chat cleared");
    NativeHaptics.lightTick();
  };

  const quickPrompts = [
    "How's my spending this month?",
    "Summarize all my subscriptions",
    "How are my savings goals going?",
    "What's my total asset value?",
    "Any trading profits this month?",
    "Help me plan a budget",
  ];

  const usageToday = typeof window !== "undefined" ? getUsageToday() : 0;
  const dailyLimit = typeof window !== "undefined" ? getDailyLimit() : 50;
  const usagePct = Math.min((usageToday / dailyLimit) * 100, 100);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: accentColor }} /> AI Assistant
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium">{usageToday}/{dailyLimit} today · Knows everything in your app</p>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Usage bar */}
      {usagePct > 60 && (
        <div className="px-6 pb-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${usagePct}%`, backgroundColor: usagePct > 90 ? "#ef4444" : "#f97316" }} />
            </div>
            <span className={usagePct > 90 ? "text-red-500" : "text-orange-500"}>{Math.round(usagePct)}%</span>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-4 space-y-3">
        {!hasKey && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">No API Key</p>
                <p className="text-xs text-muted-foreground mt-1">Go to <Link href="/profile" className="underline font-bold" style={{ color: accentColor }}>Profile → AI Assistant</Link> to add your free Gemini API key.</p>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs font-bold mt-2 inline-block" style={{ color: accentColor }}>Get free key from Google AI Studio →</a>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && hasKey && (
          <div className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}1A` }}>
              <Sparkles className="w-8 h-8" style={{ color: accentColor }} />
            </div>
            <div>
              <p className="font-bold text-foreground">I know everything in your app</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">Transactions, goals, subscriptions, assets, trades, trips — ask me anything.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {quickPrompts.map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="text-left bg-muted/50 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors border border-border/30">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user"
                ? "text-white rounded-br-md"
                : "bg-muted/60 text-foreground rounded-bl-md"
            }`} style={msg.role === "user" ? { backgroundColor: accentColor } : {}}>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              ) : (
                <div className="space-y-1 leading-relaxed [&_strong]:font-bold [&_em]:italic">{renderMarkdown(msg.text)}</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/60 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs font-medium text-red-500">
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="px-4 pb-safe pt-2 border-t border-border/40 bg-card/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={hasKey ? "Ask about spending, goals, assets, trips..." : "Set up API key first"}
            disabled={!hasKey || isRateLimited()}
            className="flex-1 bg-muted/60 rounded-xl px-4 py-3 text-sm font-medium outline-none border border-border text-foreground placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || !hasKey}
            className="p-3 rounded-xl text-white active:scale-95 transition-all disabled:opacity-40"
            style={{ backgroundColor: accentColor }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
