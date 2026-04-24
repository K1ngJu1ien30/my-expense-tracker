"use client";

import { useState, useRef, useCallback } from "react";
import { NativeHaptics } from "../haptics";
import type { DeletedItemCache } from "../types";

/**
 * Time gate for the 🐧 penguin alert (late-night snack detector).
 * Default: 1 AM – 5 AM local. Kept as a constant so the condition is
 * visible at one glance when debugging.
 */
const PENGUIN_HOUR_START = 1;
const PENGUIN_HOUR_END = 5;
/** Below this amount, any expense during penguin hours triggers the alert. */
const PENGUIN_MAX_AMOUNT = 10;

/**
 * useEasterEggsUI — owns the presentation state for all Easter-egg overlays
 * and the deleted-item cache used by shake-to-undo.
 *
 * This hook intentionally does NOT perform the actual restore (which needs
 * access to CRUD setters from other domains). The owning component/provider
 * wires up its own `onUndo` callback that consumes `deletedItemCacheRef`.
 *
 * Alert variants:
 *   🐋 Whale   — expense >= RM 5000
 *   🐧 Penguin — expense < RM 10 between 1 AM and 5 AM
 *   🐉 Dragon  — savings goal reached 100%
 *   🔥 Phoenix — a soft-deleted transaction is restored via shake-to-undo
 *   🎈 Derry   — amount 6.66 or note includes "pennywise" (legacy)
 */
export function useEasterEggsUI() {
  const [whaleAlert, setWhaleAlert] = useState(false);
  const [sharkUndo, setSharkUndo] = useState(false);
  const [derryActive, setDerryActive] = useState(false);

  // 5C additions — each variant owns its own boolean so multiple can't
  // collide in the same render if something weird happens. In practice they
  // are mutually exclusive by timing.
  const [penguinAlert, setPenguinAlert] = useState(false);
  const [dragonAlert, setDragonAlert] = useState(false);
  const [phoenixAlert, setPhoenixAlert] = useState(false);

  // God mode persists across reloads — read synchronously so the Hub can
  // render the "GOD MODE" variant on the very first paint.
  const [isGodMode] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("god_mode") === "true"
  );

  const deletedItemCacheRef = useRef<DeletedItemCache | null>(null);

  const triggerWhaleAlert = useCallback(() => {
    setWhaleAlert(true);
    NativeHaptics.heavyDoubleThud();
    setTimeout(() => setWhaleAlert(false), 2000);
  }, []);

  /**
   * Fires penguin alert only if the expense amount + local time fall inside
   * the late-night snack window. Callers just hand in the amount — the hook
   * decides whether to actually show anything. This keeps "when to trigger"
   * co-located with the alert definition itself.
   */
  const maybeTriggerPenguinAlert = useCallback((amount: number) => {
    if (amount <= 0 || amount >= PENGUIN_MAX_AMOUNT) return;
    const hour = new Date().getHours();
    if (hour < PENGUIN_HOUR_START || hour >= PENGUIN_HOUR_END) return;
    setPenguinAlert(true);
    NativeHaptics.lightTick();
    setTimeout(() => setPenguinAlert(false), 2200);
  }, []);

  const triggerDragonAlert = useCallback(() => {
    setDragonAlert(true);
    NativeHaptics.heavyDoubleThud();
    setTimeout(() => setDragonAlert(false), 2800);
  }, []);

  const triggerPhoenixAlert = useCallback(() => {
    setPhoenixAlert(true);
    NativeHaptics.successMedium();
    setTimeout(() => setPhoenixAlert(false), 2000);
  }, []);

  const triggerDerry = useCallback(() => {
    setDerryActive(true);
    if (typeof document !== "undefined") {
      document.body.classList.add("derry-active");
    }
    NativeHaptics.creepyHeartbeat();
    setTimeout(() => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("derry-active");
      }
      setDerryActive(false);
    }, 8000);
  }, []);

  const showSharkUndo = useCallback(() => {
    NativeHaptics.successMedium();
    setSharkUndo(true);
    setTimeout(() => setSharkUndo(false), 1500);
  }, []);

  const cacheDeletedItem = useCallback(
    (type: DeletedItemCache["type"], item: unknown) => {
      if (deletedItemCacheRef.current) {
        clearTimeout(deletedItemCacheRef.current.timeout);
      }
      const timeout = setTimeout(() => {
        deletedItemCacheRef.current = null;
      }, 5000);
      deletedItemCacheRef.current = { type, item, timeout };
    },
    []
  );

  const clearCacheTimeout = useCallback(() => {
    if (deletedItemCacheRef.current) {
      clearTimeout(deletedItemCacheRef.current.timeout);
      deletedItemCacheRef.current = null;
    }
  }, []);

  return {
    // UI state
    isGodMode,
    whaleAlert,
    sharkUndo,
    derryActive,
    penguinAlert,
    dragonAlert,
    phoenixAlert,
    // Actions
    triggerWhaleAlert,
    maybeTriggerPenguinAlert,
    triggerDragonAlert,
    triggerPhoenixAlert,
    triggerDerry,
    showSharkUndo,
    // Undo cache (provider wires the actual restore logic on top of this)
    deletedItemCacheRef,
    cacheDeletedItem,
    clearCacheTimeout,
  };
}
