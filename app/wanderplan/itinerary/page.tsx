"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Clock, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/lib/context";
import { format, parseISO } from "date-fns";
import { ACTIVITY_CATEGORIES, ACTIVITY_CATEGORY_LABELS, ACTIVITY_CATEGORY_COLORS } from "@/lib/wanderplanConstants";
import type { WPActivityCategory } from "@/lib/types";

export default function ItineraryPage() {
  const {
    accentColor, wpTrips, wpActiveTripId, wpActivities,
    getWPTripDays, createWPActivity, deleteWPActivity, toggleWPActivityCompleted,
    triggerToast,
  } = useAppContext();

  const trip = wpTrips.find(t => t.id === wpActiveTripId) || wpTrips[0];
  const days = useMemo(() => trip ? getWPTripDays(trip.id) : [], [trip, getWPTripDays]);

  const [showAdd, setShowAdd] = useState(false);
  const [addDayId, setAddDayId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WPActivityCategory>("activity");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingRef, setBookingRef] = useState("");

  const openAdd = (dayId: string) => { setAddDayId(dayId); setShowAdd(true); setTitle(""); setCategory("activity"); setStartTime(""); setEndTime(""); setCost(""); setNotes(""); setBookingRef(""); };

  const handleAdd = async () => {
    if (!title.trim()) return;
    await createWPActivity(addDayId, {
      title: title.trim(),
      category,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: null,
      cost_amount: cost ? Number(cost) : null,
      cost_currency: trip?.currency_code || "RM",
      notes: notes || null,
      booking_ref: bookingRef || null,
      links: [],
      is_completed: false,
      place_id: null,
      location: null,
    } as never);
    setShowAdd(false);
    triggerToast("Activity added!");
  };

  if (!trip) return <div className="p-6 text-center text-muted-foreground font-medium">Create a trip first to build your itinerary.</div>;

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <h2 className="text-lg font-bold text-foreground">{trip.name} — Itinerary</h2>

      {days.map(day => {
        const acts = wpActivities.filter(a => a.trip_day_id === day.id).sort((a, b) => a.order_index - b.order_index);
        return (
          <div key={day.id} className="bg-card rounded-3xl shadow-soft border border-border/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Day {day.day_number}</p>
                <p className="text-sm font-bold text-foreground">{format(parseISO(day.date), "EEE, MMM d")}</p>
              </div>
              <button onClick={() => openAdd(day.id)} className="p-2 rounded-xl active:scale-95 transition-transform" style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {acts.length === 0 && <p className="px-5 py-6 text-center text-xs text-muted-foreground font-medium">No activities yet</p>}

            <div className="divide-y divide-border/20">
              {acts.map(act => (
                <div key={act.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-1 h-full min-h-[40px] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: ACTIVITY_CATEGORY_COLORS[act.category] }} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${act.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{act.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-medium">
                      {act.start_time && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{act.start_time}{act.end_time ? ` — ${act.end_time}` : ""}</span>}
                      {act.cost_amount != null && <span>{act.cost_currency || ""} {(act.cost_amount / 100).toFixed(2)}</span>}
                      <span className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${ACTIVITY_CATEGORY_COLORS[act.category]}1A`, color: ACTIVITY_CATEGORY_COLORS[act.category] }}>
                        {ACTIVITY_CATEGORY_LABELS[act.category]}
                      </span>
                    </div>
                    {act.notes && <p className="text-[10px] text-muted-foreground mt-1 truncate">{act.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleWPActivityCompleted(act.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${act.is_completed ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-emerald-500"} transition-colors`}>
                      {act.is_completed && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <button onClick={() => deleteWPActivity(act.id)} className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Add Activity Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="relative w-full max-w-md bg-card rounded-t-[2rem] border-t border-border/50 shadow-heavy p-6 space-y-3 pb-safe">
              <div className="w-10 h-1 bg-muted rounded-full mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Add Activity</h2>

              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Activity title" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />

              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {ACTIVITY_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)} className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0" style={category === c ? { backgroundColor: ACTIVITY_CATEGORY_COLORS[c], color: "#fff" } : { backgroundColor: `${ACTIVITY_CATEGORY_COLORS[c]}1A`, color: ACTIVITY_CATEGORY_COLORS[c] }}>
                    {ACTIVITY_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input value={startTime} onChange={e => setStartTime(e.target.value)} type="time" className="bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" />
                <input value={endTime} onChange={e => setEndTime(e.target.value)} type="time" className="bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground" />
              </div>

              <input value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost (cents)" type="number" inputMode="numeric" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <input value={bookingRef} onChange={e => setBookingRef(e.target.value)} placeholder="Booking reference" className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground" />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground placeholder:text-muted-foreground resize-none" />

              <button onClick={handleAdd} disabled={!title.trim()} style={{ backgroundColor: accentColor }} className="w-full py-4 rounded-2xl text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-40">
                Add Activity
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
