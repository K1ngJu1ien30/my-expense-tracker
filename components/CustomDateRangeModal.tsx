"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { NativeHaptics } from "@/lib/haptics";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

type DateRangePresetKey = "today" | "thisWeek" | "thisMonth" | "lastMonth" | "last30" | "thisYear";

const PRESETS: Array<{ id: DateRangePresetKey; label: string }> = [
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This Week" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "last30", label: "30 Days" },
  { id: "thisYear", label: "This Year" },
];

interface CustomDateRangeModalProps {
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
  accentColor?: string;
}

export const CustomDateRangeModal = React.memo(function CustomDateRangeModal({
  isOpen,
  startDate,
  endDate,
  onClose,
  onApply,
  accentColor: _accentColor = "#10b981",
}: CustomDateRangeModalProps) {
  const [tempStartDate, setTempStartDate] = useState<string>(startDate);
  const [tempEndDate, setTempEndDate] = useState<string>(endDate);
  const [pickerMonth, setPickerMonth] = useState<number>(() => {
    const baseDate = startDate ? new Date(startDate + "T00:00:00") : new Date();
    return !isNaN(baseDate.getTime()) ? baseDate.getMonth() : new Date().getMonth();
  });
  const [pickerYear, setPickerYear] = useState<number>(() => {
    const baseDate = startDate ? new Date(startDate + "T00:00:00") : new Date();
    return !isNaN(baseDate.getTime()) ? baseDate.getFullYear() : new Date().getFullYear();
  });

  // Adjust state during render when modal opens or dates change
  const [prevOpenState, setPrevOpenState] = useState({ isOpen, startDate, endDate });
  if (
    prevOpenState.isOpen !== isOpen ||
    prevOpenState.startDate !== startDate ||
    prevOpenState.endDate !== endDate
  ) {
    setPrevOpenState({ isOpen, startDate, endDate });
    if (isOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      const baseDate = startDate ? new Date(startDate + "T00:00:00") : new Date();
      if (!isNaN(baseDate.getTime())) {
        setPickerMonth(baseDate.getMonth());
        setPickerYear(baseDate.getFullYear());
      }
    }
  }

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const firstDayIndex = new Date(pickerYear, pickerMonth, 1).getDay();
    // Convert Sunday (0) to 6, Monday (1) to 0, etc.
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days: Array<{ dateKey: string; dayNum: number } | null> = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(pickerMonth + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      days.push({
        dateKey: `${pickerYear}-${monthStr}-${dayStr}`,
        dayNum: d,
      });
    }
    return days;
  }, [pickerMonth, pickerYear]);

  const handleDateClick = (dateKey: string) => {
    NativeHaptics.lightTick();
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(dateKey);
      setTempEndDate("");
    } else if (tempStartDate && !tempEndDate) {
      if (dateKey < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(dateKey);
      } else {
        setTempEndDate(dateKey);
      }
    }
  };

  const handlePrevMonth = () => {
    NativeHaptics.lightTick();
    if (pickerMonth === 0) {
      setPickerMonth(11);
      setPickerYear((y) => y - 1);
    } else {
      setPickerMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    NativeHaptics.lightTick();
    if (pickerMonth === 11) {
      setPickerMonth(0);
      setPickerYear((y) => y + 1);
    } else {
      setPickerMonth((m) => m + 1);
    }
  };

  const handleApply = () => {
    NativeHaptics.successMedium();
    const finalStart = tempStartDate || new Date().toISOString().split("T")[0];
    const finalEnd = tempEndDate || finalStart;
    onApply(finalStart, finalEnd);
  };

  // Quick Preset Handlers
  const applyPreset = (preset: "today" | "thisWeek" | "thisMonth" | "lastMonth" | "last30" | "thisYear") => {
    NativeHaptics.lightTick();
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (preset === "today") {
      const t = fmt(now);
      setTempStartDate(t);
      setTempEndDate(t);
      setPickerMonth(now.getMonth());
      setPickerYear(now.getFullYear());
    } else if (preset === "thisWeek") {
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      setTempStartDate(fmt(start));
      setTempEndDate(fmt(now));
      setPickerMonth(now.getMonth());
      setPickerYear(now.getFullYear());
    } else if (preset === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setTempStartDate(fmt(start));
      setTempEndDate(fmt(end));
      setPickerMonth(now.getMonth());
      setPickerYear(now.getFullYear());
    } else if (preset === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setTempStartDate(fmt(start));
      setTempEndDate(fmt(end));
      setPickerMonth(start.getMonth());
      setPickerYear(start.getFullYear());
    } else if (preset === "last30") {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      setTempStartDate(fmt(start));
      setTempEndDate(fmt(now));
      setPickerMonth(now.getMonth());
      setPickerYear(now.getFullYear());
    } else if (preset === "thisYear") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setTempStartDate(fmt(start));
      setTempEndDate(fmt(end));
      setPickerMonth(now.getMonth());
      setPickerYear(now.getFullYear());
    }
  };

  const subtitleText = useMemo(() => {
    if (!tempStartDate) return "Click any date to start";
    if (tempEndDate) return `${tempStartDate} → ${tempEndDate}`;
    return `Selected ${tempStartDate} (now tap end date)`;
  }, [tempStartDate, tempEndDate]);

  // Keyboard accessibility: dismiss modal on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="date-range-modal-title"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative z-10 w-full max-w-sm bg-card border border-border/70 rounded-3xl shadow-heavy p-5 space-y-4 text-foreground overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 id="date-range-modal-title" className="font-black text-foreground text-base">Select Date Range</h3>
                <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                  {subtitleText}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-[11px] font-bold text-muted-foreground hover:text-foreground shrink-0 border border-border/30 active:scale-95 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-black text-foreground">
                {MONTH_NAMES[pickerMonth]} {pickerYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK_DAYS.map((d, i) => (
                <span key={i} className="text-[10px] font-bold text-muted-foreground/80 uppercase">
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <div key={`offset-${idx}`} className="h-9 rounded-xl pointer-events-none" />;
                }

                const { dateKey, dayNum } = item;
                const isStart = dateKey === tempStartDate;
                const isEnd = dateKey === tempEndDate;
                const isInRange = Boolean(
                  tempStartDate && tempEndDate && dateKey > tempStartDate && dateKey < tempEndDate
                );

                let cellClass = "hover:bg-muted/70 text-foreground rounded-xl font-medium";
                if (isStart || isEnd) {
                  cellClass =
                    "bg-primary text-primary-foreground font-black shadow-md rounded-xl scale-[1.05] ring-2 ring-primary/20";
                } else if (isInRange) {
                  cellClass = "bg-primary/15 text-primary rounded-lg font-bold";
                }

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDateClick(dateKey)}
                    className={`h-9 text-xs flex items-center justify-center transition-all select-none ${cellClass}`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-border/50 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!tempStartDate}
                className="flex-1 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 transition-all disabled:opacity-50"
              >
                Apply Range
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

export default CustomDateRangeModal;
