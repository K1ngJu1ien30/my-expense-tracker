"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Goal, PlannerItem, DeletedItemCache } from "../types";

/** Cross-cutting deps the planning CRUD needs from the surrounding provider. */
export type PlanningStateDeps = {
  session: Session | null;
  cacheDeletedItem: (type: DeletedItemCache["type"], item: unknown) => void;
  triggerDragonAlert: () => void;
  triggerToast?: (msg: string) => void;
};

/** Goal table column shape used by Supabase update payloads. */
type GoalPatchPayload = {
  title?: string;
  current_amount?: number;
  target_amount?: number;
  is_pinned?: boolean;
};

export function usePlanningState(deps: PlanningStateDeps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);

  const goalsRef = useRef(goals);
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  const { session, cacheDeletedItem, triggerDragonAlert, triggerToast } = deps;
  const userId = session?.user?.id;

  // ─── Goals ─────────────────────────────────────────────────────────────

  const addGoal = useCallback(
    async (goal: Partial<Goal>) => {
      const { id: _id, ...rest } = goal;
      void _id;
      const { title, current, target, isPinned } = rest;
      const payload = {
        title,
        current_amount: current || 0,
        target_amount: target,
        is_pinned: isPinned || false,
        user_id: userId,
      };
      const { data, error } = await supabase.from("goals").insert(payload).select().single();
      if (!error && data) {
        setGoals(prev => [
          {
            subtitle: "Goal",
            color: "bg-emerald-500",
            bg: "bg-emerald-500/10",
            iconName: "Target",
            ...rest,
            id: data.id,
            user_id: userId,
          } as Goal,
          ...prev,
        ]);
        NativeHaptics.successMedium();
      } else if (error) {
        console.error("[addGoal] failed:", error);
        triggerToast?.(`❌ Failed to create goal: ${error.message}`);
      }
    },
    [userId, triggerToast]
  );

  const updateGoal = useCallback(
    async (id: string, patch: Partial<Goal>) => {
      const { title, current, target, isPinned } = patch;
      const payload: GoalPatchPayload = {};
      if (title !== undefined) payload.title = title;
      if (current !== undefined) payload.current_amount = current;
      if (target !== undefined) payload.target_amount = target;
      if (isPinned !== undefined) payload.is_pinned = isPinned;

      // Read pre-update state synchronously from ref (avoids React 18 async
      // batching skipping side-effect flags set inside setState updaters).
      const existing = goalsRef.current.find(g => g.id === id);
      const justReachedTarget = Boolean(
        existing &&
          current !== undefined &&
          existing.target > 0 &&
          existing.current < existing.target &&
          current >= (target !== undefined ? target : existing.target)
      );

      const { data, error } = await supabase
        .from("goals")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) {
        setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)));
        NativeHaptics.lightTick();
        if (justReachedTarget) triggerDragonAlert();
      } else if (error) {
        console.error("[updateGoal] failed:", error);
        triggerToast?.(`❌ Failed to update goal: ${error.message}`);
      }
    },
    [triggerDragonAlert, triggerToast]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      const item = goalsRef.current.find(g => g.id === id);
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (!error) {
        setGoals(prev => prev.filter(g => g.id !== id));
        NativeHaptics.heavyDoubleThud();
        if (item) cacheDeletedItem("goal", item);
      } else {
        console.error("[deleteGoal] failed:", error);
        triggerToast?.(`❌ Failed to delete goal: ${error.message}`);
      }
    },
    [cacheDeletedItem, triggerToast]
  );

  // ─── Planner Items ─────────────────────────────────────────────────────

  const addPlannerItem = useCallback(
    async (item: Partial<PlannerItem>) => {
      const { id: _id, ...rest } = item;
      void _id;
      const payload = { ...rest, user_id: userId };
      const { data, error } = await supabase
        .from("salary_planner")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setPlannerItems(prev => [data as PlannerItem, ...prev]);
        NativeHaptics.successMedium();
      } else if (error) {
        console.error("[addPlannerItem] failed:", error);
        triggerToast?.(`❌ Failed to add planner item: ${error.message}`);
      }
    },
    [userId, triggerToast]
  );

  const deletePlannerItem = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("salary_planner").delete().eq("id", id);
      if (!error) {
        setPlannerItems(prev => prev.filter(p => p.id !== id));
        NativeHaptics.heavyDoubleThud();
      } else {
        console.error("[deletePlannerItem] failed:", error);
        triggerToast?.(`❌ Failed to delete planner item: ${error.message}`);
      }
    },
    [triggerToast]
  );

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
