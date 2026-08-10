"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { NativeHaptics } from "@/lib/haptics";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface CustomDateRangeModalProps {
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
}

export const CustomDateRangeModal = React.memo(function CustomDateRangeModal({
  isOpen,
  startDate,
  endDate,
  onClose,
  onApply,
}: CustomDateRangeModalProps) {
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [tempEndDate, setTempEndDate] = useState<string>("");
  const [pickerMonth, setPickerMonth] = useState<number>(() => new Date().getMonth());
  const [pickerYear, setPickerYear] = useState<number>(() => new Date().getFullYear());

  useEffect(() => {
    if (isOpen) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      const baseDate = startDate ? new Date(startDate) : new Date();
      if (!isNaN(baseDate.getTime())) {
        setPickerMonth(baseDate.getMonth());
        setPickerYear(baseDate.getFullYear());
      }
    }
  }, [isOpen, startDate, endDate]);

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
      const monthStr = String(pickerMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
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
    onApply(tempStartDate, tempEndDate);
  };

  const subtitleText = useMemo(() => {
    if (!tempStartDate) return "Click dates to select range";
    if (tempEndDate) return `${tempStartDate} to ${tempEndDate}`;
    return `From ${tempStartDate} (pick end date)`;
  }, [tempStartDate, tempEndDate]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
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
            className="relative z-10 w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-5 space-y-4 text-white overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-white text-base">Select Date Range</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  {subtitleText}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-black text-white">
                {MONTH_NAMES[pickerMonth]} {pickerYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK_DAYS.map((d, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-500 uppercase">
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

                let cellClass = "hover:bg-slate-800 text-slate-300 rounded-xl font-medium";
                if (isStart || isEnd) {
                  cellClass = "bg-emerald-500 text-white font-black shadow-md shadow-emerald-500/30 rounded-xl scale-[1.05]";
                } else if (isInRange) {
                  cellClass = "bg-emerald-500/20 text-emerald-300 rounded-lg font-bold";
                }

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDateClick(dateKey)}
                    className={`h-9 text-xs flex items-center justify-center transition-all ${cellClass}`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-slate-800 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
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
