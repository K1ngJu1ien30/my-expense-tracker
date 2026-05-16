"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BossKeyPage() {
  const router = useRouter();
  const [pct, setPct] = useState(12);

  useEffect(() => {
    const interval = setInterval(() => {
      setPct(prev => {
        const next = prev + Math.random() * 0.3;
        return next >= 99 ? 12 : next;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div onClick={() => router.back()} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-default select-none" style={{ backgroundColor: "#0078d4" }}>
      {/* Spinner */}
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-8" />

      <p className="text-white text-2xl font-semibold mb-2">Working on updates</p>
      <p className="text-white/60 text-sm mb-8">{Math.floor(pct)}% complete</p>

      {/* Progress bar */}
      <div className="w-64 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-white/50 text-xs mt-6">Don&apos;t turn off your device</p>
      <p className="text-white/10 text-[8px] mt-auto mb-4">tap anywhere to go back</p>
    </div>
  );
}
