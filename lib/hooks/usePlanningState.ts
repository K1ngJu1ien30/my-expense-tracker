"use client";

import { useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Goal, PlannerItem, DeletedItemCache } from "../types";

/** Cross-cutting deps the planning CRUD needs from the surrounding provider. */
export type PlanningStateDeps = {
  session: Session | null;
  cacheDeletedItem: (type: DeletedItemCache["type"], item: unknown) => void;
  /**
   * Fired exactly once when a goal's `current` crosses (or equals) its
   * `target` from below on an updateGoal call. The hook handles the
   * edge-detection so callers don't have to compare before/after state.
   */
  triggerDragonAlert: () => void;
};

/** Goal table column shape used by Supabase update payloads. */
type GoalPatchPayload = {
  title?: string;
  current_amount?: number;
  target_amount?: number;
  is_pinned?: boolean;
};

/**
 * usePlanningState — owns the long-term financial planning collections:
 *   • goals — savings targets with progress tracking
 *   • plannerItems — salary planner / monthly budget categories
 *
 * Both go through the standard Supabase CRUD pattern. Goals additionally
 * cache the pre-delete copy so shake-to-undo can restore them.
 *
 * The provider must include `setGoals` / `setPlannerItems` in the setters
 * passed to `useSyncState` so `refreshData` can populate them after a
 * successful Supabase fetch.
 */
export function usePlanningState(deps: PlanningStateDeps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);

  const { session, cacheDeletedItem, triggerDragonAlert } = deps;

  // ─── Goals ─────────────────────────────────────────────────────────────

  const addGoal = useCallback(
    async (goal: Partial<Goal>) => {
      delete goal.id;
      const { title, current, target, isPinned } = goal;
      const payload = {
        title,
        current_amount: current || 0,
        target_amount: target,
        is_pinned: isPinned || false,
        user_id: session?.user?.id,
      };
      const { data, error } = await supabase.from("goals").insert(payload).select().single();
      if (!error && data) {
        setGoals(prev => [{ ...goal, id: data.id } as Goal, ...prev]);
        NativeHaptics.successMedium();
      }
    },
    [session]
  );

  const updateGoal = useCallback(async (id: string, patch: Partial<Goal>) => {
    const { title, current, target, isPinned } = patch;
    const payload: GoalPatchPayload = {};
    if (title !== undefined) payload.title = title;
    if (current !== undefined) payload.current_amount = current;
    if (target !== undefined) payload.target_amount = target;
    if (isPinned !== undefined) payload.is_pinned = isPinned;

    // Capture the pre-update state so we can detect "just crossed the goal
    // line" and fire the 🐉 dragon alert exactly once (not every subsequent
    // add-funds after the goal is already met).
    let justReachedTarget = false;

    const { data, error } = await supabase
      .from("goals")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setGoals(prev => {
        const existing = prev.find(g => g.id === id);
        if (existing && current !== undefined) {
          const wasMet = existing.current >= existing.target;
          const newCurrent = current;
          const newTarget = target !== undefined ? target : existing.target;
          const nowMet = newCurrent >= newTarget;
          if (!wasMet && nowMet) justReachedTarget = true;
        }
        return prev.map(g => (g.id === id ? { ...g, ...patch } : g));
      });
      NativeHaptics.lightTick();
      if (justReachedTarget) triggerDragonAlert();
    }
  }, [triggerDragonAlert]);

  const deleteGoal = useCallback(
    async (id: string) => {
      // Read current goals via state setter callback to avoid stale closure
      // on the goals array.
      let item: Goal | undefined;
      setGoals(prev => {
        item = prev.find(g => g.id === id);
        return prev;
      });
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (!error) {
        setGoals(prev => prev.filter(g => g.id !== id));
        NativeHaptics.heavyDoubleThud();
        if (item) cacheDeletedItem("goal", item);
      }
    },
    [cacheDeletedItem]
  );

  // ─── Planner Items ─────────────────────────────────────────────────────

  const addPlannerItem = useCallback(
    async (item: Partial<PlannerItem>) => {
      // Strip id without mutating the caller's object.
      const { id: _id, ...rest } = item;
      const payload = { ...rest, user_id: session?.user?.id };
      const { data, error } = await supabase
        .from("salary_planner")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setPlannerItems(prev => [data as PlannerItem, ...prev]);
        NativeHaptics.successMedium();
      }
    },
    [session]
  );

  const deletePlannerItem = useCallback(async (id: string) => {
    const { error } = await supabase.from("salary_planner").delete().eq("id", id);
    if (!error) {
      setPlannerItems(prev => prev.filter(p => p.id !== id));
      NativeHaptics.heavyDoubleThud();
    }
  }, []);

  return {
    // State
    goals,
    setGoals,
    plannerItems,
    setPlannerItems,
    // Goal CRUD
    addGoal,
    updateGoal,
    deleteGoal,
    // Planner CRUD
    addPlannerItem,
    deletePlannerItem,
  };
}
