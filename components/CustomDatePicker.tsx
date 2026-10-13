"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { NativeHaptics } from "@/lib/haptics";

export interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  accentColor?: string;
  className?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function CustomDatePicker({
  value,
  onChange,
  accentColor = "#3b82f6",
  className = "",
  label,
  placeholder = "Select date",
  disabled = false,
  size = "md",
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const [pickerDate, setPickerDate] = useState(() => {
    if (value) {
      const parsed = new Date(value + "T00:00:00");
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });

  // When value changes from outside, sync pickerMonth
  useEffect(() => {
    if (value) {
      const parsed = new Date(value + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        setPickerDate(parsed);
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const year = pickerDate.getFullYear();
  const month = pickerDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  // Monday-first indexing (0 = Mon, 6 = Sun)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const formattedDate = React.useMemo(() => {
    if (!value) return placeholder;
    const d = new Date(value + "T00:00:00");
    if (isNaN(d.getTime())) return placeholder;

    if (value === todayStr) {
      return `Today, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (value === yesterdayStr) {
      return `Yesterday, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [value, todayStr, placeholder, now]);

  const handleToggle = () => {
    if (disabled) return;
    NativeHaptics.lightTick();
    if (!isOpen && value) {
      const parsed = new Date(value + "T00:00:00");
      if (!isNaN(parsed.getTime())) setPickerDate(parsed);
    }
    setIsOpen((prev) => !prev);
  };

  const handlePrevMonth = () => {
    NativeHaptics.lightTick();
    setPickerDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    NativeHaptics.lightTick();
    setPickerDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (dayNum: number) => {
    NativeHaptics.lightTick();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    NativeHaptics.lightTick();
    onChange(todayStr);
    setPickerDate(new Date());
    setIsOpen(false);
  };

  const handleSelectYesterday = () => {
    NativeHaptics.lightTick();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(
      y.getDate()
    ).padStart(2, "0")}`;
    onChange(yStr);
    setPickerDate(y);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: "py-2 px-3 text-xs rounded-xl min-h-[36px]",
    md: "py-2.5 px-3.5 text-xs sm:text-sm rounded-2xl min-h-[44px]",
    lg: "py-3 px-4 text-sm font-semibold rounded-2xl min-h-[50px]",
  }[size];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full bg-muted/40 hover:bg-muted/70 active:scale-[0.99] border transition-all text-left flex items-center justify-between gap-2.5 outline-none font-medium select-none ${sizeClasses} ${
          isOpen
            ? "border-primary/50 ring-2 ring-primary/10 bg-muted/70"
            : "border-border/50 hover:border-border"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span
            className={`truncate ${
              value ? "text-foreground font-bold" : "text-muted-foreground font-medium"
            }`}
          >
            {formattedDate}
          </span>
        </div>

        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
          Change
        </span>
      </button>

      {/* Floating Popover Calendar Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-2 z-[250] bg-card/95 backdrop-blur-2xl border border-border/70 rounded-3xl shadow-heavy p-4 space-y-3"
          >
            {/* Month & Year Navigation Header */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded-xl hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="text-sm font-black text-foreground">
                  {pickerDate.toLocaleDateString("en-US", { month: "long" })}{" "}
                  <span className="text-muted-foreground font-bold">{year}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1.5 rounded-xl hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span
                  key={i}
                  className="text-[10px] font-black uppercase text-muted-foreground/70 py-1"
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Empty leading blanks */}
              {Array.from({ length: startOffset }).map((_, idx) => (
                <div key={`blank-${idx}`} className="h-8 w-8 mx-auto" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
                  dayNum
                ).padStart(2, "0")}`;
                const isSelected = value === dateStr;
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    style={
                      isSelected
                        ? { backgroundColor: accentColor, color: "#ffffff" }
                        : {}
                    }
                    className={`h-8 w-8 mx-auto rounded-xl text-xs font-bold transition-all flex items-center justify-center relative select-none ${
                      isSelected
                        ? "shadow-md scale-105 font-black ring-2 ring-primary/30"
                        : isToday
                        ? "bg-muted text-foreground font-black border border-border"
                        : "text-foreground hover:bg-muted/60 active:scale-95"
                    }`}
                  >
                    {dayNum}
                    {isToday && !isSelected && (
                      <span
                        className="absolute bottom-1 w-1 h-1 rounded-full"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Action Shortcuts Footer */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-bold text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleSelectYesterday}
                  className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                >
                  Yesterday
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
