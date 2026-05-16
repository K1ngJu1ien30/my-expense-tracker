"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { useAppContext } from "@/lib/context";

const GAMES = [
  { href: "/arcade/games/reaction", icon: "🎨", name: "Color Reaction", desc: "Test your reflexes", time: "10s", gradient: "from-red-500 to-orange-500" },
  { href: "/arcade/games/2048", icon: "🔢", name: "2048", desc: "Swipe to merge tiles", time: "2-5 min", gradient: "from-amber-500 to-yellow-500" },
  { href: "/arcade/games/memory", icon: "🧠", name: "Memory Match", desc: "Find all pairs", time: "2 min", gradient: "from-purple-500 to-pink-500" },
  { href: "/arcade/games/snake", icon: "🐍", name: "Snake", desc: "Classic snake game", time: "3-5 min", gradient: "from-green-500 to-emerald-500" },
  { href: "/arcade/games/minesweeper", icon: "💣", name: "Minesweeper", desc: "Don't hit a mine", time: "5 min", gradient: "from-zinc-500 to-zinc-700" },
  { href: "/arcade/games/idle", icon: "🐟", name: "Idle Fisher", desc: "Tap to earn fish coins", time: "∞", gradient: "from-cyan-500 to-blue-500" },
  { href: "/arcade/games/flappy", icon: "🐠", name: "Flappy Fish", desc: "Tap to fly", time: "30s", gradient: "from-sky-500 to-indigo-500" },
  { href: "/arcade/games/tower", icon: "🏰", name: "Tower Defense", desc: "Place towers, survive waves", time: "10+ min", gradient: "from-rose-500 to-red-600" },
  { href: "/arcade/games/rhythm", icon: "🎵", name: "Rhythm Tap", desc: "Tap to the beat", time: "2 min", gradient: "from-fuchsia-500 to-violet-500" },
  { href: "/arcade/games/wordle", icon: "📝", name: "Wordle", desc: "Guess the 5-letter word", time: "5 min", gradient: "from-emerald-500 to-teal-500" },
  { href: "/arcade/games/tetris", icon: "🧱", name: "Block Drop", desc: "Classic falling blocks", time: "5-10 min", gradient: "from-blue-500 to-indigo-600" },
];

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function getBadge(s: number) {
  if (s >= 7200) return { label: "Trophy", icon: "🏆", color: "text-amber-400" };
  if (s >= 3600) return { label: "Gold", icon: "🥇", color: "text-yellow-500" };
  if (s >= 1800) return { label: "Silver", icon: "🥈", color: "text-zinc-400" };
  if (s >= 600) return { label: "Bronze", icon: "🥉", color: "text-amber-600" };
  return null;
}

export default function ArcadeHub() {
  const { accentColor } = useAppContext();
  const [elapsed, setElapsed] = useState(0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const storageKey = `fish_timer_${today}`;

  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey) || "0");
    setElapsed(saved);
    const interval = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        localStorage.setItem(storageKey, String(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [storageKey]);

  const badge = getBadge(elapsed);

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500 pb-32 select-none">
      <div className="flex items-center gap-3">
        <Link href="/hub" className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Slack Arcade</h1>
          <p className="text-[10px] text-muted-foreground font-medium">Mini-games & slack timer</p>
        </div>
        <Link href="/arcade/boss" className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center active:scale-90 transition-transform">
          <AlertCircle className="w-5 h-5 text-red-500" />
        </Link>
      </div>

      {/* Daily Slack Timer */}
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-5 text-white shadow-heavy">
        <p className="text-xs font-bold uppercase tracking-wider text-white/70">Daily Slack Timer</p>
        <p className="text-4xl font-black mt-1 tracking-tight tabular-nums">{formatTime(elapsed)}</p>
        <div className="flex items-center gap-2 mt-2">
          {badge && <span className={`text-lg ${badge.color}`}>{badge.icon}</span>}
          {badge && <span className="text-xs font-bold text-white/80">{badge.label}</span>}
          {!badge && <span className="text-xs text-white/60 font-medium">Keep going... 10m for Bronze 🥉</span>}
        </div>
      </div>

      {/* Game grid */}
      <div className="space-y-3">
        {GAMES.map(g => (
          <Link key={g.href} href={g.href} className="block">
            <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-4 flex items-center gap-4 hover:scale-[1.01] active:scale-[0.98] transition-all">
              <div className={`bg-gradient-to-br ${g.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                {g.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">{g.name}</p>
                <p className="text-[10px] text-muted-foreground font-medium">{g.desc}</p>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{g.time}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
