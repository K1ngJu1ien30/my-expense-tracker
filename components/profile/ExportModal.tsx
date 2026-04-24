"use client";

import { motion } from "framer-motion";
import { FileSpreadsheet, X, Calendar, Download, Loader2 } from "lucide-react";

/**
 * Accountant Export wizard — picks "current month" vs. "all time" and hands
 * the choice back to the parent's `onExport` callback. Loading state is
 * driven externally so the parent can wire up actual CSV generation +
 * Capacitor Share without this component knowing about either.
 */
export function ExportModal({
  accentColor,
  txCount,
  loading,
  onExport,
  onClose,
}: {
  accentColor: string;
  txCount: number;
  loading: boolean;
  onExport: (filter: "month" | "all") => void;
  onClose: () => void;
}) {
  const closeIfIdle = () => { if (!loading) onClose(); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeIfIdle}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="bg-card w-full max-w-sm rounded-[2rem] shadow-heavy z-10 overflow-hidden p-6 space-y-5"
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl w-fit mb-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-500" aria-hidden="true" />
            </div>
            <h3 id="export-title" className="font-bold text-lg text-foreground">Accountant Export</h3>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Generate a CSV report for your records.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={closeIfIdle}
            className="p-1.5 hover:bg-muted rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">Generating report...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onExport("month")}
              style={{ borderColor: `${accentColor}33` }}
              className="w-full flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border hover:bg-muted/60 active:scale-[0.98] transition-all text-left"
            >
              <div style={{ backgroundColor: `${accentColor}1A` }} className="p-3 rounded-xl">
                <Calendar style={{ color: accentColor }} className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">Current Month</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onExport("all")}
              style={{ borderColor: `${accentColor}33` }}
              className="w-full flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border hover:bg-muted/60 active:scale-[0.98] transition-all text-left"
            >
              <div style={{ backgroundColor: `${accentColor}1A` }} className="p-3 rounded-xl">
                <Download style={{ color: accentColor }} className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">All Time</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  {txCount} transaction{txCount !== 1 ? "s" : ""}
                </p>
              </div>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
