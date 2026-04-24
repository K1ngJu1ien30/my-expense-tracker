"use client";

import { useState, useCallback } from "react";
import type { ToastType, ConfirmState } from "../types";

/**
 * useUIState — owns all cross-cutting UI state that lives at the app level.
 *
 * - `toast`: ephemeral banner notifications. Auto-dismisses after 3 seconds.
 * - `confirmState`: the global confirmation modal (e.g. Delete Goal).
 *   Callers invoke `confirmAction(title, message, onConfirm)` to open it,
 *   and the provider renders it once, globally.
 * - `editTransactionId`: when non-null, the TransactionModal opens in edit mode.
 * - `activeAssetId`: when non-null, the AssetDetailOverlay renders for that asset.
 * - `showTransactionModal`: controls the global bottom-sheet expense form.
 *
 * This hook is fully self-contained — no cross-domain dependencies — which
 * makes it the safest early extraction.
 */
export function useUIState() {
  // ─── Toast ────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastType>(null);

  const triggerToast = useCallback((message: string) => {
    const id = Date.now();
    setToast({ message, id });
    // Only dismiss if no newer toast has superseded this one
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 3000);
  }, []);

  // ─── Confirmation Modal ───────────────────────────────────────────────
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirmAction = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setConfirmState({ isOpen: true, title, message, onConfirm });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // ─── Modal / overlay flags ────────────────────────────────────────────
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  return {
    // Toast
    toast,
    triggerToast,
    // Confirm modal
    confirmState,
    confirmAction,
    closeConfirm,
    // Modal/overlay flags
    editTransactionId,
    setEditTransactionId,
    activeAssetId,
    setActiveAssetId,
    showTransactionModal,
    setShowTransactionModal,
  };
}
