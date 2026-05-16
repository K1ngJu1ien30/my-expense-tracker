"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

const EMOJIS = ["🐟","🐠","🐡","🦈","🐙","🦑","🦀","🐚"];

export default function MemoryGame(){
  const [cards,setCards]=useState<{emoji:string;flipped:boolean;matched:boolean}[]>([]);
  const [flipped,setFlipped]=useState<number[]>([]);
  const [locked,setLocked]=useState(false);
  const [moves,setMoves]=useState(0);
  const [done,setDone]=useState(false);
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("memory_best")||"999");}catch{return 999;}});
  const [started,setStarted]=useState(false);

  const init=useCallback(()=>{
    const deck=[...EMOJIS,...EMOJIS].sort(()=>Math.random()-0.5).map(emoji=>({emoji,flipped:false,matched:false}));
    setCards(deck);setFlipped([]);setMoves(0);setDone(false);setLocked(false);setStarted(true);
  },[]);

  const tap=(i:number)=>{
    if(locked||cards[i].flipped||cards[i].matched||flipped.length>=2) return;
    const nc=[...cards];nc[i]={...nc[i],flipped:true};setCards(nc);
    const nf=[...flipped,i];setFlipped(nf);
    if(nf.length===2){
      const nm=moves+1;setMoves(nm);setLocked(true);
      if(nc[nf[0]].emoji===nc[nf[1]].emoji){
        nc[nf[0]]={...nc[nf[0]],matched:true};nc[nf[1]]={...nc[nf[1]],matched:true};
        setCards(nc);setFlipped([]);setLocked(false);
        if(nc.every(c=>c.matched)){setDone(true);if(nm<best){setBest(nm);localStorage.setItem("memory_best",String(nm));}}
      } else {
        setTimeout(()=>{nc[nf[0]]={...nc[nf[0]],flipped:false};nc[nf[1]]={...nc[nf[1]],flipped:false};setCards([...nc]);setFlipped([]);setLocked(false);},800);
      }
    }
  };

  return(
    <div className="p-6 space-y-4 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Memory Match</h1>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">Best: {best<999?`${best} moves`:"—"}</span>
      </div>
      {!started?(
        <div className="text-center py-16 space-y-4">
          <p className="text-5xl">🧠</p><p className="font-bold text-foreground">Find all matching pairs!</p>
          <button onClick={init} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Start</button>
        </div>
      ):(
        <>
          <p className="text-center text-xs font-bold text-muted-foreground">Moves: {moves}</p>
          <div className="grid grid-cols-4 gap-2 max-w-[320px] mx-auto">
            {cards.map((c,i)=>(
              <motion.button key={i} onClick={()=>tap(i)} animate={{rotateY:c.flipped||c.matched?0:180}} transition={{duration:0.3}}
                className={`aspect-square rounded-xl flex items-center justify-center text-2xl font-bold ${c.matched?"bg-emerald-500/20 border-emerald-500/40":c.flipped?"bg-card border-border":"bg-muted border-border"} border-2 active:scale-90 transition-transform`}>
                {(c.flipped||c.matched)?c.emoji:"?"}
              </motion.button>
            ))}
          </div>
          {done&&(
            <div className="text-center py-6 space-y-3">
              <p className="text-3xl">🎉</p><p className="text-xl font-black text-foreground">Complete in {moves} moves!</p>
              <button onClick={init} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Play Again</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
