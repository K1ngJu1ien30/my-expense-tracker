"use client";

import { useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { NativeHaptics } from "../haptics";
import type { Asset, TradeItem, DeletedItemCache } from "../types";

/** Threshold above which a buy_price triggers the 🐋 whale alert. */
const WHALE_THRESHOLD = 5000;

/** Cross-cutting deps the modules CRUD needs from the surrounding provider. */
export type ModulesDataDeps = {
  session: Session | null;
  triggerWhaleAlert: () => void;
  cacheDeletedItem: (type: DeletedItemCache["type"], item: unknown) => void;
};

/**
 * useModulesData — owns the optional-feature collections that live behind
 * feature flags in the Hub:
 *   • assets — Asset Vault items (gear, electronics, vehicles, etc.)
 *   • tradeItems — Trading / Flipping inventory
 *
 * Both are simple Supabase CRUD with shake-to-undo support on delete. Trade
 * items also trigger the whale alert when buy_price ≥ 5000.
 *
 * The provider must include `setAssets` / `setTradeItems` in the setters
 * passed to `useSyncState` so `refreshData` can populate them after a
 * successful Supabase fetch.
 */
export function useModulesData(deps: ModulesDataDeps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tradeItems, setTradeItems] = useState<TradeItem[]>([]);

  const { session, triggerWhaleAlert, cacheDeletedItem } = deps;

  // ─── Assets ────────────────────────────────────────────────────────────

  const addAsset = useCallback(
    async (asset: Partial<Asset>) => {
      delete asset.id;
      const payload = { ...asset, user_id: session?.user?.id };
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
      // Capture pre-delete copy via setter callback to avoid stale closure.
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

  // ─── Trade Items ───────────────────────────────────────────────────────

  const addTradeItem = useCallback(
    async (item: Partial<TradeItem>) => {
      // TradeItem.id is a string but Partial<> still types it as optional;
      // we strip it before insert so Postgres assigns a fresh UUID.
      const { id: _id, ...rest } = item;
      const payload = { ...rest, user_id: session?.user?.id };
      const { data, error } = await supabase
        .from("trade_items")
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setTradeItems(prev => [data as TradeItem, ...prev]);
        NativeHaptics.successMedium();
        if (Number(item.buy_price) >= WHALE_THRESHOLD) triggerWhaleAlert();
      }
    },
    [session, triggerWhaleAlert]
  );

  const updateTradeItem = useCallback(async (id: string, patch: Partial<TradeItem>) => {
    const { data, error } = await supabase
      .from("trade_items")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setTradeItems(prev => prev.map(t => (t.id === id ? ({ ...t, ...data } as TradeItem) : t)));
      NativeHaptics.successMedium();
    }
  }, []);

  const deleteTradeItem = useCallback(
    async (id: string) => {
      let item: TradeItem | undefined;
      setTradeItems(prev => {
        item = prev.find(t => t.id === id);
        return prev;
      });
      const { error } = await supabase.from("trade_items").delete().eq("id", id);
      if (!error) {
        setTradeItems(prev => prev.filter(t => t.id !== id));
        NativeHaptics.heavyDoubleThud();
        if (item) cacheDeletedItem("trade", item);
      }
    },
    [cacheDeletedItem]
  );

  return {
    // State
    assets,
    setAssets,
    tradeItems,
    setTradeItems,
    // Asset CRUD
    addAsset,
    updateAsset,
    deleteAsset,
    // Trade item CRUD
    addTradeItem,
    updateTradeItem,
    deleteTradeItem,
  };
}
