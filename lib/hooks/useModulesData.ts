"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Asset, DeletedItemCache } from "../types";

/** Cross-cutting deps the modules CRUD needs from the surrounding provider. */
export type ModulesDataDeps = {
  session: Session | null;
  cacheDeletedItem: (type: DeletedItemCache["type"], item: unknown) => void;
  triggerToast?: (msg: string) => void;
};

export function useModulesData(deps: ModulesDataDeps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const assetsRef = useRef(assets);
  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const { session, cacheDeletedItem, triggerToast } = deps;
  const userId = session?.user?.id;

  // ─── Assets ────────────────────────────────────────────────────────────

  const addAsset = useCallback(
    async (asset: Partial<Asset>) => {
      const { id: _id, ...rest } = asset;
      void _id;
      const payload = { ...rest, user_id: userId };
      const { data, error } = await supabase
        .from("asset_vault")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setAssets(prev => [data as Asset, ...prev]);
        NativeHaptics.successMedium();
      } else if (error) {
        console.error("[addAsset] failed:", error);
        triggerToast?.(`❌ Failed to add asset: ${error.message}`);
      }
    },
    [userId, triggerToast]
  );

  const updateAsset = useCallback(
    async (id: string, patch: Partial<Asset>) => {
      const { data, error } = await supabase
        .from("asset_vault")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) {
        setAssets(prev => prev.map(a => (a.id === id ? ({ ...a, ...data } as Asset) : a)));
        NativeHaptics.lightTick();
      } else if (error) {
        console.error("[updateAsset] failed:", error);
        triggerToast?.(`❌ Failed to update asset: ${error.message}`);
      }
    },
    [triggerToast]
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      const item = assetsRef.current.find(a => a.id === id);
      const { error } = await supabase.from("asset_vault").delete().eq("id", id);
      if (!error) {
        setAssets(prev => prev.filter(a => a.id !== id));
        NativeHaptics.heavyDoubleThud();
        if (item) cacheDeletedItem("asset", item);
      } else {
        console.error("[deleteAsset] failed:", error);
        triggerToast?.(`❌ Failed to delete asset: ${error.message}`);
      }
    },
    [cacheDeletedItem, triggerToast]
  );

  return {
    // State
    assets,
    setAssets,
    // Asset CRUD
    addAsset,
    updateAsset,
    deleteAsset,
  };
}
