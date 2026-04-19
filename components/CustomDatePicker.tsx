"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  accentColor?: string;
  className?: string;
};

export default function CustomDatePicker({ value, onChange, accentColor = "#3b82f6", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => new Date(value || new Date()));

  const formattedDate = value
    ? new Date(value + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : "Select date";

  const year = pickerMonth.getFullYear();
  const month = pickerMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: (firstDay || 7) - 1 }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (value) setPickerMonth(new Date(value)); setOpen(!open); }}
        className="w-full bg-muted/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none border border-border text-foreground flex items-center gap-3 active:scale-[0.98] transition-all text-left"
      >
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        {formattedDate}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-2"
          >
            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-heavy">
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setPickerMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <p className="text-sm font-bold text-foreground">{pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                <button type="button" onClick={() => setPickerMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <span key={i} className="text-[10px] font-bold text-muted-foreground py-1">{d}</span>
                ))}
                {blanks.map(i => <div key={`b-${i}`} />)}
                {days.map(d => {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const isSelected = value === dateStr;
                  const isToday = dateStr === todayStr;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { onChange(dateStr); setOpen(false); }}
                      style={isSelected ? { backgroundColor: accentColor, color: '#fff' } : {}}
                      className={`h-9 rounded-xl text-xs font-bold transition-all ${isSelected ? 'shadow-sm scale-105' : isToday ? 'bg-muted font-black text-foreground' : 'text-foreground hover:bg-muted/50'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
