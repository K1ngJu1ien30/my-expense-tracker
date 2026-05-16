"use client";

import { useState, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type {
  WPTrip, WPTripDay, WPActivity, WPBudgetAllocation,
  WPTripExpense, WPSavedPlace, WPDocument, WPPackingItem,
  WPTripStatus, WPBudgetCategory,
} from "../types";

export type WanderPlanDeps = {
  session: Session | null;
};

/**
 * useWanderPlanState — owns ALL WanderPlan collections and CRUD.
 *
 * Performance notes:
 *   - Toggle/find operations use setter-callback pattern to read the latest
 *     state without capturing the full array in the useCallback dep array.
 *     This keeps callback identities stable so downstream memoisation works.
 *   - Reorder writes use Promise.all instead of sequential awaits.
 *   - Supabase loads are gated by the caller (only if module is enabled).
 */
export function useWanderPlanState(deps: WanderPlanDeps) {
  const { session } = deps;

  const [wpTrips, setWPTrips] = useState<WPTrip[]>([]);
  const [wpTripDays, setWPTripDays] = useState<WPTripDay[]>([]);
  const [wpActivities, setWPActivities] = useState<WPActivity[]>([]);
  const [wpAllocations, setWPAllocations] = useState<WPBudgetAllocation[]>([]);
  const [wpExpenses, setWPExpenses] = useState<WPTripExpense[]>([]);
  const [wpPlaces, setWPPlaces] = useState<WPSavedPlace[]>([]);
  const [wpDocuments, setWPDocuments] = useState<WPDocument[]>([]);
  const [wpPackingItems, setWPPackingItems] = useState<WPPackingItem[]>([]);
  const [wpActiveTripId, setWPActiveTripIdRaw] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("wanderplan_active_trip");
    return null;
  });

  // Refs for stable callbacks that need to read current state without deps.
  const wpActiveTripIdRef = useRef(wpActiveTripId);
  wpActiveTripIdRef.current = wpActiveTripId;

  const setWPActiveTripId = useCallback((id: string | null) => {
    setWPActiveTripIdRaw(id);
    wpActiveTripIdRef.current = id;
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("wanderplan_active_trip", id);
      else localStorage.removeItem("wanderplan_active_trip");
    }
  }, []);

  // ─── Load all WanderPlan data ───────────────────────────────────────────
  // Only called when isWanderPlanEnabled is true (gated by context.tsx).
  // All child-table queries include user_id filter for defense-in-depth
  // beyond RLS.
  const loadWanderPlanData = useCallback(async (userId: string) => {
    const [trips, days, activities, allocs, expenses, places, docs, packing] = await Promise.all([
      supabase.from("wp_trips").select("*").eq("user_id", userId).is("deleted_at", null).order("start_date", { ascending: false }),
      supabase.from("wp_trip_days").select("*, wp_trips!inner(user_id)").eq("wp_trips.user_id", userId).is("deleted_at", null).order("day_number", { ascending: true }),
      supabase.from("wp_activities").select("*, wp_trip_days!inner(trip_id, wp_trips!inner(user_id))").eq("wp_trip_days.wp_trips.user_id", userId).is("deleted_at", null).order("order_index", { ascending: true }),
      supabase.from("wp_budget_allocations").select("*, wp_trips!inner(user_id)").eq("wp_trips.user_id", userId).is("deleted_at", null),
      supabase.from("wp_trip_expenses").select("*, wp_trips!inner(user_id)").eq("wp_trips.user_id", userId).is("deleted_at", null).order("date", { ascending: false }),
      supabase.from("wp_saved_places").select("*, wp_trips!inner(user_id)").eq("wp_trips.user_id", userId).is("deleted_at", null),
      supabase.from("wp_documents").select("*, wp_trips!inner(user_id)").eq("wp_trips.user_id", userId).is("deleted_at", null),
      supabase.from("wp_packing_lists").select("*, wp_trips!inner(user_id)").eq("wp_trips.user_id", userId).is("deleted_at", null),
    ]);

    if (trips.data) setWPTrips(trips.data as WPTrip[]);
    if (days.data) setWPTripDays(days.data as WPTripDay[]);
    if (activities.data) setWPActivities(activities.data as WPActivity[]);
    if (allocs.data) setWPAllocations(allocs.data as WPBudgetAllocation[]);
    if (expenses.data) setWPExpenses(expenses.data as WPTripExpense[]);
    if (places.data) setWPPlaces(places.data as WPSavedPlace[]);
    if (docs.data) setWPDocuments(docs.data as WPDocument[]);
    if (packing.data) setWPPackingItems(packing.data as WPPackingItem[]);
  }, []);

  // ─── Trips CRUD ─────────────────────────────────────────────────────────

  const createWPTrip = useCallback(async (data: Partial<WPTrip>): Promise<string | null> => {
    const { id: _id, ...rest } = data;
    const payload = { ...rest, user_id: session?.user?.id };
    const { data: row, error } = await supabase.from("wp_trips").insert(payload).select().single();
    if (error || !row) return null;
    const trip = row as WPTrip;
    setWPTrips(prev => [trip, ...prev]);
    // Fetch auto-generated days from trigger
    const { data: days } = await supabase
      .from("wp_trip_days").select("*")
      .eq("trip_id", trip.id).is("deleted_at", null)
      .order("day_number");
    if (days) setWPTripDays(prev => [...prev, ...(days as WPTripDay[])]);
    NativeHaptics.successMedium();
    return trip.id;
  }, [session]);

  const updateWPTrip = useCallback(async (id: string, data: Partial<WPTrip>) => {
    const { data: row, error } = await supabase.from("wp_trips").update(data).eq("id", id).select().single();
    if (!error && row) {
      setWPTrips(prev => prev.map(t => t.id === id ? { ...t, ...row } as WPTrip : t));
      NativeHaptics.lightTick();
    }
  }, []);

  const deleteWPTrip = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("wp_trips").update({ deleted_at: now }).eq("id", id);
    if (!error) {
      setWPTrips(prev => prev.filter(t => t.id !== id));
      // Also clean local state for child entities of this trip
      setWPTripDays(prev => prev.filter(d => d.trip_id !== id));
      setWPAllocations(prev => prev.filter(a => a.trip_id !== id));
      setWPExpenses(prev => prev.filter(e => e.trip_id !== id));
      setWPPlaces(prev => prev.filter(p => p.trip_id !== id));
      setWPDocuments(prev => prev.filter(d => d.trip_id !== id));
      setWPPackingItems(prev => prev.filter(i => i.trip_id !== id));
      if (wpActiveTripIdRef.current === id) setWPActiveTripId(null);
      NativeHaptics.heavyDoubleThud();
    }
  }, [setWPActiveTripId]);

  const setWPTripStatus = useCallback(async (id: string, status: WPTripStatus) => {
    await updateWPTrip(id, { status } as Partial<WPTrip>);
    if (status === "active") setWPActiveTripId(id);
  }, [updateWPTrip, setWPActiveTripId]);

  const getWPTripDays = useCallback((tripId: string) => {
    return wpTripDays.filter(d => d.trip_id === tripId).sort((a, b) => a.day_number - b.day_number);
  }, [wpTripDays]);

  // ─── Activities CRUD ────────────────────────────────────────────────────
  // Uses setter-callback pattern to avoid capturing wpActivities array.

  const createWPActivity = useCallback(async (dayId: string, data: Partial<WPActivity>) => {
    const { id: _id, ...rest } = data;
    // Read current max order via setter callback (no stale closure)
    let maxOrder = -1;
    setWPActivities(prev => {
      maxOrder = prev.filter(a => a.trip_day_id === dayId).reduce((m, a) => Math.max(m, a.order_index), -1);
      return prev; // no mutation — just reading
    });
    const payload = { ...rest, trip_day_id: dayId, order_index: maxOrder + 1 };
    const { data: row, error } = await supabase.from("wp_activities").insert(payload).select().single();
    if (!error && row) {
      setWPActivities(prev => [...prev, row as WPActivity]);
      NativeHaptics.successMedium();
    }
  }, []);

  const updateWPActivity = useCallback(async (id: string, data: Partial<WPActivity>) => {
    const { data: row, error } = await supabase.from("wp_activities").update(data).eq("id", id).select().single();
    if (!error && row) {
      setWPActivities(prev => prev.map(a => a.id === id ? { ...a, ...row } as WPActivity : a));
      NativeHaptics.lightTick();
    }
  }, []);

  const deleteWPActivity = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("wp_activities").update({ deleted_at: now }).eq("id", id);
    if (!error) {
      setWPActivities(prev => prev.filter(a => a.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  const toggleWPActivityCompleted = useCallback(async (id: string) => {
    // Optimistic toggle via setter — avoids stale closure on wpActivities
    let newVal = false;
    setWPActivities(prev => prev.map(a => {
      if (a.id !== id) return a;
      newVal = !a.is_completed;
      return { ...a, is_completed: newVal };
    }));
    const { error } = await supabase.from("wp_activities").update({ is_completed: newVal }).eq("id", id);
    if (error) {
      // Revert on failure
      setWPActivities(prev => prev.map(a => a.id === id ? { ...a, is_completed: !newVal } : a));
    } else {
      NativeHaptics.lightTick();
    }
  }, []);

  const reorderWPActivities = useCallback(async (dayId: string, orderedIds: string[]) => {
    // Optimistic local reorder
    setWPActivities(prev => prev.map(a => {
      if (a.trip_day_id !== dayId) return a;
      const idx = orderedIds.indexOf(a.id);
      return idx >= 0 ? { ...a, order_index: idx } : a;
    }));
    // Batch write in parallel
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from("wp_activities").update({ order_index: i }).eq("id", id)
      )
    );
  }, []);

  // ─── Budget Allocations ─────────────────────────────────────────────────

  const setWPAllocation = useCallback(async (tripId: string, category: WPBudgetCategory, cents: number) => {
    // Find existing via setter callback to avoid stale closure
    let existingId: string | null = null;
    setWPAllocations(prev => {
      const found = prev.find(a => a.trip_id === tripId && a.category === category);
      existingId = found?.id || null;
      return prev;
    });

    if (existingId) {
      const { data: row, error } = await supabase.from("wp_budget_allocations").update({ allocated_cents: cents }).eq("id", existingId).select().single();
      if (!error && row) setWPAllocations(prev => prev.map(a => a.id === existingId ? { ...a, ...row } as WPBudgetAllocation : a));
    } else {
      const { data: row, error } = await supabase.from("wp_budget_allocations").insert({ trip_id: tripId, category, allocated_cents: cents, spent_cents: 0 }).select().single();
      if (!error && row) setWPAllocations(prev => [...prev, row as WPBudgetAllocation]);
    }
    NativeHaptics.lightTick();
  }, []);

  // ─── Trip Expenses ──────────────────────────────────────────────────────

  const addWPExpense = useCallback(async (tripId: string, data: Partial<WPTripExpense>) => {
    const { id: _id, ...rest } = data;
    const payload = { ...rest, trip_id: tripId };
    const { data: row, error } = await supabase.from("wp_trip_expenses").insert(payload).select().single();
    if (!error && row) {
      const expense = row as WPTripExpense;
      setWPExpenses(prev => [expense, ...prev]);
      setWPAllocations(prev => prev.map(a =>
        a.trip_id === tripId && a.category === expense.budget_category
          ? { ...a, spent_cents: a.spent_cents + expense.amount_cents }
          : a
      ));
      NativeHaptics.successMedium();
    }
  }, []);

  const deleteWPExpense = useCallback(async (id: string) => {
    // Capture expense data via setter callback (no stale closure)
    let expData: { trip_id: string; budget_category: WPBudgetCategory; amount_cents: number } | null = null;
    setWPExpenses(prev => {
      const found = prev.find(e => e.id === id);
      if (found) expData = { trip_id: found.trip_id, budget_category: found.budget_category, amount_cents: found.amount_cents };
      return prev;
    });
    const now = new Date().toISOString();
    const { error } = await supabase.from("wp_trip_expenses").update({ deleted_at: now }).eq("id", id);
    if (!error) {
      setWPExpenses(prev => prev.filter(e => e.id !== id));
      if (expData) {
        setWPAllocations(prev => prev.map(a =>
          a.trip_id === expData!.trip_id && a.category === expData!.budget_category
            ? { ...a, spent_cents: Math.max(0, a.spent_cents - expData!.amount_cents) }
            : a
        ));
      }
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  // ─── Saved Places ───────────────────────────────────────────────────────

  const createWPPlace = useCallback(async (tripId: string, data: Partial<WPSavedPlace>) => {
    const { id: _id, ...rest } = data;
    const payload = { ...rest, trip_id: tripId };
    const { data: row, error } = await supabase.from("wp_saved_places").insert(payload).select().single();
    if (!error && row) {
      setWPPlaces(prev => [...prev, row as WPSavedPlace]);
      NativeHaptics.successMedium();
    }
  }, []);

  const deleteWPPlace = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("wp_saved_places").update({ deleted_at: now }).eq("id", id);
    if (!error) {
      setWPPlaces(prev => prev.filter(p => p.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  const toggleWPPlaceVisited = useCallback(async (id: string) => {
    let newVal = false;
    setWPPlaces(prev => prev.map(p => {
      if (p.id !== id) return p;
      newVal = !p.is_visited;
      return { ...p, is_visited: newVal };
    }));
    const { error } = await supabase.from("wp_saved_places").update({ is_visited: newVal }).eq("id", id);
    if (error) setWPPlaces(prev => prev.map(p => p.id === id ? { ...p, is_visited: !newVal } : p));
    else NativeHaptics.lightTick();
  }, []);

  // ─── Documents ──────────────────────────────────────────────────────────

  const createWPDocument = useCallback(async (tripId: string, data: Partial<WPDocument>) => {
    const { id: _id, ...rest } = data;
    const payload = { ...rest, trip_id: tripId };
    const { data: row, error } = await supabase.from("wp_documents").insert(payload).select().single();
    if (!error && row) {
      setWPDocuments(prev => [...prev, row as WPDocument]);
      NativeHaptics.successMedium();
    }
  }, []);

  const deleteWPDocument = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("wp_documents").update({ deleted_at: now }).eq("id", id);
    if (!error) {
      setWPDocuments(prev => prev.filter(d => d.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  // ─── Packing Items ─────────────────────────────────────────────────────

  const addWPPackingItem = useCallback(async (tripId: string, data: Partial<WPPackingItem>) => {
    const { id: _id, ...rest } = data;
    const payload = { ...rest, trip_id: tripId, is_packed: false };
    const { data: row, error } = await supabase.from("wp_packing_lists").insert(payload).select().single();
    if (!error && row) {
      setWPPackingItems(prev => [...prev, row as WPPackingItem]);
      NativeHaptics.successMedium();
    }
  }, []);

  const addWPPackingItems = useCallback(async (tripId: string, items: { category: string; item_name: string; quantity: number }[]) => {
    const payload = items.map(i => ({ ...i, trip_id: tripId, is_packed: false }));
    const { data: rows, error } = await supabase.from("wp_packing_lists").insert(payload).select();
    if (!error && rows) {
      setWPPackingItems(prev => [...prev, ...(rows as WPPackingItem[])]);
      NativeHaptics.successMedium();
    }
  }, []);

  const toggleWPPacked = useCallback(async (id: string) => {
    let newVal = false;
    setWPPackingItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      newVal = !i.is_packed;
      return { ...i, is_packed: newVal };
    }));
    const { error } = await supabase.from("wp_packing_lists").update({ is_packed: newVal }).eq("id", id);
    if (error) setWPPackingItems(prev => prev.map(i => i.id === id ? { ...i, is_packed: !newVal } : i));
    else NativeHaptics.lightTick();
  }, []);

  const deleteWPPackingItem = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("wp_packing_lists").update({ deleted_at: now }).eq("id", id);
    if (!error) {
      setWPPackingItems(prev => prev.filter(i => i.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  return {
    wpTrips, setWPTrips,
    wpTripDays, setWPTripDays,
    wpActivities, setWPActivities,
    wpAllocations, setWPAllocations,
    wpExpenses, setWPExpenses,
    wpPlaces, setWPPlaces,
    wpDocuments, setWPDocuments,
    wpPackingItems, setWPPackingItems,
    wpActiveTripId, setWPActiveTripId,
    loadWanderPlanData,
    createWPTrip, updateWPTrip, deleteWPTrip, setWPTripStatus, getWPTripDays,
    createWPActivity, updateWPActivity, deleteWPActivity, toggleWPActivityCompleted, reorderWPActivities,
    setWPAllocation,
    addWPExpense, deleteWPExpense,
    createWPPlace, deleteWPPlace, toggleWPPlaceVisited,
    createWPDocument, deleteWPDocument,
    addWPPackingItem, addWPPackingItems, toggleWPPacked, deleteWPPackingItem,
  };
}
