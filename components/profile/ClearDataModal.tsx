"use client";

import { motion } from "framer-motion";
import { Trash2, X, Lock } from "lucide-react";

/**
 * Destructive confirmation modal for "Clear All Data". Requires the user's
 * password to authorise the wipe — handled by the parent's `onConfirm`
 * callback. UI here is dumb / presentational.
 */
export function ClearDataModal({
  password,
  setPassword,
  loading,
  onConfirm,
  onClose,
}: {
  password: string;
  setPassword: (val: string) => void;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-data-title"
        aria-describedby="clear-data-message"
        className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5"
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="bg-red-500/10 p-3 rounded-2xl w-fit mb-3">
              <Trash2 className="w-6 h-6 text-red-500" aria-hidden="true" />
            </div>
            <h3 id="clear-data-title" className="font-bold text-lg text-foreground">
              Clear All Data
            </h3>
            <p id="clear-data-message" className="text-sm text-muted-foreground font-medium mt-1">
              This action is irreversible. Enter your password to confirm.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password to confirm data wipe"
            autoComplete="current-password"
            className="w-full bg-muted/60 text-sm font-semibold pl-10 pr-4 py-3.5 rounded-xl border border-border focus:border-red-500/50 outline-none transition-colors"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-muted rounded-xl font-bold text-sm text-muted-foreground hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !password}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Wipe Data"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
