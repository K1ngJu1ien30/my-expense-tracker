"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

/**
 * Bottom-sheet that lets the user pick the billing-reset day-of-month.
 * Pure presentation — selection is committed via the `onSelect` callback.
 */
export function BillingCycleSheet({
  current,
  accentColor,
  onSelect,
  onClose,
}: {
  current: string;
  accentColor: string;
  onSelect: (day: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-title"
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card rounded-t-[2.5rem] shadow-heavy z-[101] flex flex-col h-[55vh]"
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-4 mb-2 shrink-0" aria-hidden="true" />
        <div className="px-6 py-4 border-b border-border/40 shrink-0 flex justify-between items-center">
          <h2 id="billing-title" className="font-bold text-lg text-foreground">Select Reset Day</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 px-2 bg-muted hover:bg-border rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-5 gap-3 hide-scrollbar pb-24">
          {DAYS.map((day) => {
            const active = current === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelect(day)}
                style={
                  active
                    ? { backgroundColor: accentColor, color: "#fff", boxShadow: `0 0 15px ${accentColor}4D` }
                    : {}
                }
                className={`aspect-square flex items-center justify-center rounded-2xl font-bold transition-all ${
                  active ? "scale-105" : "bg-muted/50 hover:bg-border text-foreground"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
