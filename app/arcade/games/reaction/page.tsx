"use client";
import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ssrSafe(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

const COLORS = ["#ef4444","#3b82f6","#22c55e","#eab308"];
const NAMES = ["Red","Blue","Green","Yellow"];
const TOTAL = 10;

export default function ReactionGame() {
  const [phase, setPhase] = useState<"idle"|"playing"|"done">("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [currentColor, setCurrentColor] = useState("");
  const [showTime, setShowTime] = useState<number|null>(null);
  const [best, setBest] = useState(() => Number(ssrSafe("reaction_best", "9999")));
  const startRef = useRef(0);

  const nextRound = useCallback(() => {
    const c = COLORS[Math.floor(Math.random()*4)];
    setCurrentColor(c);
    setShowTime(null);
    startRef.current = Date.now();
  },[]);

  const start = () => { setPhase("playing"); setRound(0); setTimes([]); nextRound(); };

  const tap = (idx: number) => {
    if(phase!=="playing") return;
    const elapsed = Date.now() - startRef.current;
    const correct = COLORS[idx]===currentColor;
    const t = correct ? elapsed : elapsed+500;
    const newTimes = [...times, t];
    setTimes(newTimes);
    setShowTime(t);
    const r = round+1;
    setRound(r);
    if(r>=TOTAL) {
      setPhase("done");
      const avg = Math.round(newTimes.reduce((a,b)=>a+b,0)/newTimes.length);
      if(avg<best){setBest(avg);try{localStorage.setItem("reaction_best",String(avg));}catch{}}
    } else { setTimeout(nextRound, 400); }
  };

  const avg = times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : 0;
  const rating = avg<200?"Insane!":avg<350?"Great!":avg<500?"Good":"Keep trying";

  return (
    <div className="p-6 space-y-4 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Color Reaction</h1>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">Best: {best<9999?`${best}ms`:"—"}</span>
      </div>
      {phase==="idle"&&(
        <div className="text-center py-16 space-y-4">
          <p className="text-5xl">🎨</p>
          <p className="font-bold text-foreground">Tap the matching color as fast as you can!</p>
          <button onClick={start} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform">Start</button>
        </div>
      )}
      {phase==="playing"&&(
        <div className="space-y-4">
          <p className="text-xs font-bold text-muted-foreground text-center">Round {round+1}/{TOTAL}</p>
          <div className="w-full aspect-square max-w-[200px] mx-auto rounded-3xl" style={{backgroundColor:currentColor}}/>
          <AnimatePresence>{showTime!=null&&<motion.p initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-center text-sm font-bold text-foreground">{showTime}ms</motion.p>}</AnimatePresence>
          <div className="grid grid-cols-2 gap-3 max-w-[280px] mx-auto">
            {COLORS.map((c,i)=>(
              <button key={c} onClick={()=>tap(i)} className="py-4 rounded-2xl font-bold text-sm text-white active:scale-90 transition-transform" style={{backgroundColor:c}}>{NAMES[i]}</button>
            ))}
          </div>
        </div>
      )}
      {phase==="done"&&(
        <div className="text-center py-12 space-y-3">
          <p className="text-5xl">{avg<350?"🔥":"⏱️"}</p>
          <p className="text-3xl font-black text-foreground">{avg}ms</p>
          <p className="text-sm font-bold" style={{color:avg<350?"#22c55e":avg<500?"#eab308":"#9ca3af"}}>{rating}</p>
          <button onClick={start} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform">Play Again</button>
        </div>
      )}
    </div>
  );
}
