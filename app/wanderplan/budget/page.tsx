"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Trash2, Link2, ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS, BUDGET_CATEGORY_COLORS, mapWPCategoryToMainCategory } from "@/lib/wanderplanConstants";
import { format, parseISO } from "date-fns";
import type { WPBudgetCategory } from "@/lib/types";

export default function BudgetPage() {
  const {
    accentColor, wpTrips, wpActiveTripId, wpAllocations, wpExpenses,
    setWPAllocation, addWPExpense, deleteWPExpense, triggerToast,
    addTransaction, accounts, getWPTripDays,
  } = useAppContext();

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];

  const allocations = useMemo(() => trip ? wpAllocations.filter(a => a.trip_id === trip.id) : [], [trip, wpAllocations]);
  const expenses = useMemo(() => trip ? wpExpenses.filter(e => e.trip_id === trip.id) : [], [trip, wpExpenses]);

  const totalBudget = allocations.reduce((s, a) => s + a.allocated_cents, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount_cents, 0);

  const [editCat, setEditCat] = useState<WPBudgetCategory | null>(null);
  const [allocAmount, setAllocAmount] = useState("");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCat, setExpCat] = useState<WPBudgetCategory>("food");
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");
  const [bridgeToTracker, setBridgeToTracker] = useState(true);
  const [bridgeAccount, setBridgeAccount] = useState(accounts[0] || "Cash");

  // Currency converter state
  const [converterOpen, setConverterOpen] = useState(false);
  const [convertFrom, setConvertFrom] = useState("");
  const [convertRate, setConvertRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const homeCurrency = "MYR"; // User's home currency

  // Day-by-day breakdown toggle
  const [showDayBreakdown, setShowDayBreakdown] = useState(false);

  const days = useMemo(() => trip ? getWPTripDays(trip.id) : [], [trip, getWPTripDays]);

  const dayBreakdown = useMemo(() => {
    if (!trip || days.length === 0) return [];
    return days.map(day => {
      const dayExpenses = expenses.filter(e => {
        try { return format(parseISO(e.date), "yyyy-MM-dd") === day.date; } catch { return false; }
      });
      const total = dayExpenses.reduce((s, e) => s + e.amount_cents, 0);
      return { day, total, count: dayExpenses.length };
    });
  }, [trip, days, expenses]);

  const fetchRate = useCallback(async () => {
    if (!trip || !convertFrom || isNaN(Number(convertFrom))) return;
    setRateLoading(true);
    try {
      // Map currency codes to ISO for the API
      const codeMap: Record<string, string> = { RM: "MYR", USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY", CNY: "CNY", KRW: "KRW", THB: "THB", SGD: "SGD", AUD: "AUD", IDR: "IDR", VND: "VND", PHP: "PHP", TWD: "TWD", INR: "INR", HKD: "HKD", NZD: "NZD", CAD: "CAD", CHF: "CHF", AED: "AED" };
      const from = codeMap[trip.currency_code] || trip.currency_code;
      const to = codeMap[homeCurrency] || homeCurrency;
      if (from === to) { setConvertRate(Number(convertFrom)); setRateLoading(false); return; }
      const res = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${convertFrom}`);
      const data = await res.json();
      setConvertRate(data.result ?? null);
    } catch {
      setConvertRate(null);
    }
    setRateLoading(false);
  }, [convertFrom, trip, homeCurrency]);

  useEffect(() => {
    if (!convertFrom) { setConvertRate(null); return; }
    const t = setTimeout(fetchRate, 600);
    return () => clearTimeout(t);
  }, [convertFrom, fetchRate]);

  const handleSetAllocation = async () => {
    if (!trip || !editCat) return;
    await setWPAllocation(trip.id, editCat, Math.round(Number(allocAmount) * 100));
    setEditCat(null);
    triggerToast("Budget updated!");
  };

  const handleAddExpense = async () => {
    if (!trip || !expAmount) return;
    const cents = Math.round(Number(expAmount) * 100);
    await addWPExpense(trip.id, {
      budget_category: expCat,
      amount_cents: cents,
      currency_code: trip.currency_code,
      note: expNote || null,
      date: new Date().toISOString(),
      activity_id: null,
      transaction_id: null,
    } as never);
    if (bridgeToTracker) {
      await addTransaction({
        type: "Expense",
        amount: cents / 100,
        category: mapWPCategoryToMainCategory(expCat),
        account: bridgeAccount,
        date: new Date().toISOString(),
        note: `[Trip: ${trip.name}] ${expNote || BUDGET_CATEGORY_LABELS[expCat]}`,
        status: "cleared",
        is_claimable: false,
        claim_status: "none",
      });
    }
    setShowAddExpense(false);
    setExpAmount(""); setExpNote("");
    triggerToast(bridgeToTracker ? "Expense added + synced to tracker!" : "Expense added!");
  };

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip first.</div>;

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <h2 className="text-lg font-bold text-foreground">{trip.name} — Budget</h2>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-3 shadow-soft border border-border/40 text-center">
          <p className="text-xl font-black text-foreground">{trip.currency_code} {(totalBudget / 100).toFixed(0)}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Budget</p>
        </div>
        <div className="bg-card rounded-2xl p-3 shadow-soft border border-border/40 text-center">
          <p className="text-xl font-black text-rose-500">{trip.currency_code} {(totalSpent / 100).toFixed(0)}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Spent</p>
        </div>
        <div className="bg-card rounded-2xl p-3 shadow-soft border border-border/40 text-center">
          <p className={`text-xl font-black ${totalBudget - totalSpent >= 0 ? "text-emerald-500" : "text-red-500"}`}>{trip.currency_code} {((totalBudget - totalSpent) / 100).toFixed(0)}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Left</p>
        </div>
      </div>

      {/* Quick Currency Converter */}
      <button onClick={() => setConverterOpen(!converterOpen)} className="w-full flex items-center justify-between bg-card rounded-2xl shadow-soft border border-border/40 p-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-sky-500" />
          <span className="text-xs font-bold text-foreground">Quick Currency Convert</span>
        </div>
        {converterOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {converterOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">{trip.currency_code}</p>
                  <input value={convertFrom} onChange={e => setConvertFrom(e.target.value)} type="number" inputMode="decimal" placeholder="0.00" className="w-full bg-muted/60 rounded-xl px-3 py-2 text-sm font-black outline-none border border-border text-foreground text-center" />
                </div>
                <ArrowLeftRight className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">MYR</p>
                  <div className="w-full bg-muted/60 rounded-xl px-3 py-2 text-sm font-black text-center text-foreground border border-border">
                    {rateLoading ? "..." : convertRate !== null ? convertRate.toFixed(2) : "—"}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center font-medium">Live rate via exchangerate.host (may be delayed)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category bars */}
      <div className="bg-card rounded-3xl shadow-soft border border-border/40 p-4 space-y-3">
        {BUDGET_CATEGORIES.map(cat => {
          const alloc = allocations.find(a => a.category === cat);
          const allocated = alloc?.allocated_cents || 0;
          const spent = expenses.filter(e => e.budget_category === cat).reduce((s, e) => s + e.amount_cents, 0);
          const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
          return (
            <button key={cat} onClick={() => { setEditCat(cat); setAllocAmount(((alloc?.allocated_cents || 0) / 100).toString()); }} className="w-full text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: BUDGET_CATEGORY_COLORS[cat] }}>{BUDGET_CATEGORY_LABELS[cat]}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{(spent / 100).toFixed(0)} / {(allocated / 100).toFixed(0)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: BUDGET_CATEGORY_COLORS[cat] }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Day-by-Day Breakdown */}
      {dayBreakdown.length > 0 && (
        <>
          <button onClick={() => setShowDayBreakdown(!showDayBreakdown)} className="w-full flex items-center justify-between bg-card rounded-2xl shadow-soft border border-border/40 p-3">
            <span className="text-xs font-bold text-foreground">📅 Day-by-Day Spending</span>
            {showDayBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showDayBreakdown && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-3 space-y-1.5">
                  {dayBreakdown.map(({ day, total, count }) => {
                    const maxSpent = Math.max(...dayBreakdown.map(d => d.total), 1);
                    const barPct = (total / maxSpent) * 100;
                    return (
                      <div key={day.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground w-10 shrink-0">D{day.day_number}</span>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                          <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: accentColor }} />
                        </div>
                        <span className="text-[10px] font-bold text-foreground w-16 text-right shrink-0">
                          {total > 0 ? `${trip.currency_code} ${(total / 100).toFixed(0)}` : "—"}
                        </span>
                        {count > 0 && <span className="text-[10px] text-muted-foreground font-medium w-6 text-right shrink-0">{count}×</span>}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Add Expense */}
      <button onClick={() => setShowAddExpense(true)} style={{ backgroundColor: accentColor, boxShadow: `0 4px 20px ${accentColor}40` }} className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
        <Plus className="w-4 h-4" /> Add Expense
      </button>

      {/* Recent expenses */}
      <div className="space-y-2">
        {expenses.slice(0, 20).map(exp => (
          <div key={exp.id} className="flex items-center gap-3 bg-card rounded-2xl p-3 shadow-soft border border-border/40">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: BUDGET_CATEGORY_COLORS[exp.budget_category] }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{BUDGET_CATEGORY_LABELS[exp.budget_category]}</p>
              {exp.note && <p className="text-[10px] text-muted-foreground font-medium truncate">{exp.note}</p>}
            </div>
            <span className="text-sm font-black text-foreground shrink-0">{exp.currency_code} {(exp.amount_cents / 100).toFixed(2)}</span>
            <button onClick={() => deleteWPExpense(exp.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Edit Allocation Modal */}
      <AnimatePresence>
        {editCat && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditCat(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-sm bg-card rounded-3xl p-6 shadow-heavy space-y-4 border border-border/50">
              <h3 className="font-bold text-foreground">Set Budget — {BUDGET_CATEGORY_LABELS[editCat]}</h3>
              <input value={allocAmount} onChange={e => setAllocAmount(e.target.value)} type="number" inputMode="decimal" placeholder="0.00" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-lg font-black outline-none border border-border text-foreground text-center" />
              <button onClick={handleSetAllocation} style={{ backgroundColor: accentColor }} className="w-full py-3 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all">Save</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAddExpense && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddExpense(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-md bg-card rounded-t-[2rem] border-t border-border/50 shadow-heavy p-6 space-y-3 pb-safe">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Add Expense</h2>
              <input value={expAmount} onChange={e => setExpAmount(e.target.value)} type="number" inputMode="decimal" placeholder="Amount" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {BUDGET_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setExpCat(c)} className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0" style={expCat === c ? { backgroundColor: BUDGET_CATEGORY_COLORS[c], color: "#fff" } : { backgroundColor: `${BUDGET_CATEGORY_COLORS[c]}1A`, color: BUDGET_CATEGORY_COLORS[c] }}>
                    {BUDGET_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              <input value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />

              {/* Bridge to main tracker toggle */}
              <div className="flex items-center justify-between bg-muted/40 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-sky-500" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Sync to Expense Tracker</p>
                    <p className="text-[10px] text-muted-foreground">Also log in your main expenses</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBridgeToTracker(!bridgeToTracker)}
                  className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${bridgeToTracker ? "border-transparent" : "bg-muted border border-border"}`}
                  style={bridgeToTracker ? { backgroundColor: accentColor } : {}}
                >
                  <div className={`w-4 h-4 bg-card rounded-full shadow-sm absolute transition-transform ${bridgeToTracker ? "translate-x-[22px]" : "translate-x-[3px]"}`} />
                </button>
              </div>

              {bridgeToTracker && (
                <select value={bridgeAccount} onChange={e => setBridgeAccount(e.target.value)} className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground">
                  {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              <button onClick={handleAddExpense} disabled={!expAmount} style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-40">Add Expense</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
