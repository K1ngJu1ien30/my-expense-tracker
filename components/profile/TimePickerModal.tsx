"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

/**
 * iOS-style scroll-wheel time picker for the daily-reminder setting.
 * Two snap-scroll columns (hour, minute) + an AM/PM segmented control.
 * Auto-scrolls each column to the current selection on open.
 */
export function TimePickerModal({
  accentColor,
  tempHour,
  setTempHour,
  tempMin,
  setTempMin,
  tempAmPm,
  setTempAmPm,
  onSave,
  onClose,
}: {
  accentColor: string;
  tempHour: string;
  setTempHour: (val: string) => void;
  tempMin: string;
  setTempMin: (val: string) => void;
  tempAmPm: string;
  setTempAmPm: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollTo = (container: HTMLDivElement | null, value: string, items: string[]) => {
      if (!container) return;
      const idx = items.indexOf(value);
      if (idx === -1) return;
      // Each item is 40px (h-10), spacer is 70px
      const target = 70 + idx * 40 - container.clientHeight / 2 + 20;
      container.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
    };
    const t = setTimeout(() => {
      scrollTo(hourRef.current, tempHour, HOURS);
      scrollTo(minRef.current, tempMin, MINUTES);
    }, 50);
    return () => clearTimeout(t);
  }, [tempHour, tempMin]);

  const tap = (cb: () => void) => () => {
    cb();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
  };

  const handleHourClick = (h: string) => {
    setTempHour(h);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    const idx = HOURS.indexOf(h);
    if (hourRef.current && idx !== -1) {
      const target = 70 + idx * 40 - hourRef.current.clientHeight / 2 + 20;
      hourRef.current.scrollTo({ top: target, behavior: "smooth" });
    }
  };

  const handleMinClick = (m: string) => {
    setTempMin(m);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    const idx = MINUTES.indexOf(m);
    if (minRef.current && idx !== -1) {
      const target = 70 + idx * 40 - minRef.current.clientHeight / 2 + 20;
      minRef.current.scrollTo({ top: target, behavior: "smooth" });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-picker-title"
        className="bg-card w-full max-w-[320px] rounded-[2rem] shadow-heavy z-10 overflow-hidden flex flex-col pt-4 pb-6 px-4"
      >
        <h3 id="time-picker-title" className="font-bold text-center mb-6 text-foreground">
          Remind me at
        </h3>

        <div className="flex justify-between items-stretch gap-2 mb-6 h-[180px]">
          {/* Hours column */}
          <div
            ref={hourRef}
            className="flex-1 overflow-y-auto hide-scrollbar snap-y snap-mandatory border border-border/50 rounded-2xl p-1 bg-muted/10 relative shadow-inner"
          >
            <div
              style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }}
              className="absolute top-1/2 left-1 right-1 h-10 -mt-5 pointer-events-none rounded-xl border z-10"
              aria-hidden="true"
            />
            <div className="h-[70px]" aria-hidden="true" />
            {HOURS.map((h) => (
              <div
                key={`h-${h}`}
                onClick={() => handleHourClick(h)}
                style={tempHour === h ? { color: accentColor, fontWeight: 900 } : {}}
                className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all rounded-lg text-lg ${
                  tempHour === h ? "scale-110" : "text-muted-foreground font-bold"
                }`}
              >
                {h}
              </div>
            ))}
            <div className="h-[70px]" aria-hidden="true" />
          </div>

          {/* Minutes column */}
          <div
            ref={minRef}
            className="flex-1 overflow-y-auto hide-scrollbar snap-y snap-mandatory border border-border/50 rounded-2xl p-1 bg-muted/10 relative shadow-inner"
          >
            <div
              style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33` }}
              className="absolute top-1/2 left-1 right-1 h-10 -mt-5 pointer-events-none rounded-xl border z-10"
              aria-hidden="true"
            />
            <div className="h-[70px]" aria-hidden="true" />
            {MINUTES.map((m) => (
              <div
                key={`m-${m}`}
                onClick={() => handleMinClick(m)}
                style={tempMin === m ? { color: accentColor, fontWeight: 900 } : {}}
                className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all rounded-lg text-lg ${
                  tempMin === m ? "scale-110" : "text-muted-foreground font-bold"
                }`}
              >
                {m}
              </div>
            ))}
            <div className="h-[70px]" aria-hidden="true" />
          </div>

          {/* AM/PM */}
          <div className="w-[70px] flex flex-col justify-center gap-2">
            <button
              type="button"
              onClick={tap(() => setTempAmPm("AM"))}
              style={tempAmPm === "AM" ? { backgroundColor: accentColor, color: "#fff" } : {}}
              className={`flex-1 rounded-2xl font-bold transition-all ${
                tempAmPm === "AM" ? "shadow-sm scale-105" : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={tap(() => setTempAmPm("PM"))}
              style={tempAmPm === "PM" ? { backgroundColor: accentColor, color: "#fff" } : {}}
              className={`flex-1 rounded-2xl font-bold transition-all ${
                tempAmPm === "PM" ? "shadow-sm scale-105" : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              PM
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          style={{ backgroundColor: accentColor }}
          className="w-full text-white py-3.5 rounded-xl font-bold shadow-soft active:scale-[0.98] transition-all"
        >
          Save Time
        </button>
      </motion.div>
    </div>
  );
}
