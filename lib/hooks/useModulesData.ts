"use client";

import { useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Asset, DeletedItemCache } from "../types";

/** Cross-cutting deps the modules CRUD needs from the surrounding provider. */
export type ModulesDataDeps = {
  session: Session | null;
  cacheDeletedItem: (type: DeletedItemCache["type"], item: unknown) => void;
};

/**
 * useModulesData — owns the optional-feature collections that live behind
 * feature flags in the Hub:
 *   • assets — Asset Vault items (gear, electronics, vehicles, etc.)
 *
 * Simple Supabase CRUD with shake-to-undo support on delete.
 */
export function useModulesData(deps: ModulesDataDeps) {
  const [assets, setAssets] = useState<Asset[]>([]);

  const { session, cacheDeletedItem } = deps;

  // ─── Assets ────────────────────────────────────────────────────────────

  const addAsset = useCallback(
    async (asset: Partial<Asset>) => {
      const { id: _id, ...rest } = asset;
      const payload = { ...rest, user_id: session?.user?.id };
      const { data, error } = await supabase
        .from("asset_vault")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setAssets(prev => [data as Asset, ...prev]);
        NativeHaptics.successMedium();
      }
    },
    [session]
  );

  const updateAsset = useCallback(async (id: string, patch: Partial<Asset>) => {
    const { data, error } = await supabase
      .from("asset_vault")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setAssets(prev => prev.map(a => (a.id === id ? ({ ...a, ...data } as Asset) : a)));
      NativeHaptics.lightTick();
    }
  }, []);

  const deleteAsset = useCallback(
    async (id: string) => {
      let item: Asset | undefined;
      setAssets(prev => {
        item = prev.find(a => a.id === id);
        return prev;
      });
      const { error } = await supabase.from("asset_vault").delete().eq("id", id);
      if (!error) {
        setAssets(prev => prev.filter(a => a.id !== id));
        NativeHaptics.heavyDoubleThud();
        if (item) cacheDeletedItem("asset", item);
      }
    },
    [cacheDeletedItem]
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
