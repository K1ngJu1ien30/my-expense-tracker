"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LANES=4;const COLORS=["#ef4444","#3b82f6","#22c55e","#eab308"];
const BPM=120;const NOTE_COUNT=40;const FALL_TIME=3000;

function genSong(){
  const notes:{lane:number;time:number}[]=[];
  const interval=60000/BPM;
  for(let i=0;i<NOTE_COUNT;i++){
    const t=1000+i*interval;const lane=Math.floor(Math.random()*LANES);
    notes.push({lane,time:t});
    if(Math.random()>0.7){notes.push({lane:(lane+1+Math.floor(Math.random()*2))%LANES,time:t});}
  }
  return notes;
}

export default function RhythmGame(){
  const [phase,setPhase]=useState<"idle"|"playing"|"done">("idle");
  const [score,setScore]=useState(0);
  const [combo,setCombo]=useState(0);
  const [maxCombo,setMaxCombo]=useState(0);
  const [judgement,setJudgement]=useState<{text:string;color:string}|null>(null);
  const [counts,setCounts]=useState({perfect:0,good:0,miss:0});
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("rhythm_best")||"0");}catch{return 0;}});
  const songRef=useRef<{lane:number;time:number;hit:boolean}[]>([]);
  const startTime=useRef(0);
  const animRef=useRef<number>(0);
  const [notes,setNotes]=useState<{lane:number;y:number;hit:boolean}[]>([]);

  const start=useCallback(()=>{
    songRef.current=genSong().map(n=>({...n,hit:false}));
    startTime.current=Date.now();
    setPhase("playing");setScore(0);setCombo(0);setMaxCombo(0);setCounts({perfect:0,good:0,miss:0});
  },[]);

  useEffect(()=>{
    if(phase!=="playing")return;
    const loop=()=>{
      const now=Date.now()-startTime.current;
      const visible=songRef.current.filter(n=>!n.hit).map(n=>({lane:n.lane,y:(now-n.time+FALL_TIME)/FALL_TIME*100,hit:n.hit})).filter(n=>n.y>0&&n.y<120);
      setNotes(visible);
      // auto-miss notes that passed
      songRef.current.forEach(n=>{if(!n.hit&&now-n.time>200){n.hit=true;setCounts(p=>({...p,miss:p.miss+1}));setCombo(0);showJudge("Miss","#9ca3af");}});
      // check if song ended
      if(songRef.current.every(n=>n.hit)){setPhase("done");const s=score;if(s>best){setBest(s);localStorage.setItem("rhythm_best",String(s));}return;}
      animRef.current=requestAnimationFrame(loop);
    };
    animRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[phase]);

  const showJudge=(text:string,color:string)=>{setJudgement({text,color});setTimeout(()=>setJudgement(null),400);};

  const tapLane=(lane:number)=>{
    if(phase!=="playing")return;
    const now=Date.now()-startTime.current;
    const candidates=songRef.current.filter(n=>!n.hit&&n.lane===lane);
    // Find closest note by reducing — avoids TS narrowing issue with forEach+let
    const match=candidates.reduce<{note:typeof candidates[0];diff:number}|null>((best,n)=>{
      const d=Math.abs(now-n.time);
      if(!best||d<best.diff)return{note:n,diff:d};
      return best;
    },null);
    if(!match||match.diff>200)return;
    match.note.hit=true;
    if(match.diff<=100){setScore(s=>s+300+combo*10);setCounts(p=>({...p,perfect:p.perfect+1}));showJudge("Perfect!","#eab308");}
    else{setScore(s=>s+100+combo*10);setCounts(p=>({...p,good:p.good+1}));showJudge("Good","#22c55e");}
    setCombo(c=>{const nc=c+1;setMaxCombo(m=>Math.max(m,nc));return nc;});
  };

  return(
    <div className="p-6 space-y-4 select-none pb-32" style={{backgroundColor:"#18181b",minHeight:"100vh"}}>
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-zinc-800"><ChevronLeft className="w-5 h-5 text-zinc-400"/></Link>
        <h1 className="text-lg font-bold text-white">Rhythm Tap</h1>
        <div className="ml-auto flex gap-2 text-xs font-bold">
          <span className="bg-zinc-800 px-2 py-1 rounded-lg text-white">{score}</span>
          <span className="bg-zinc-800 px-2 py-1 rounded-lg text-zinc-400">×{combo}</span>
        </div>
      </div>
      {phase==="idle"&&(
        <div className="text-center py-16 space-y-4"><p className="text-5xl">🎵</p><p className="font-bold text-white">Tap the lanes to the beat!</p><button onClick={start} className="px-8 py-3 rounded-2xl bg-fuchsia-500 text-white font-bold text-sm active:scale-95">Start</button></div>
      )}
      {phase==="playing"&&(
        <>
          <div className="relative mx-auto" style={{width:LANES*72,height:300}}>
            {COLORS.map((c,i)=><div key={i} className="absolute top-0 bottom-0 opacity-10 rounded" style={{left:i*72,width:68,backgroundColor:c}}/>)}
            {notes.map((n,i)=><div key={i} className="absolute rounded-md" style={{left:n.lane*72+4,top:`${n.y}%`,width:60,height:24,backgroundColor:COLORS[n.lane],opacity:0.9}}/>)}
            {/* Hit zone */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30"/>
          </div>
          <AnimatePresence>{judgement&&<motion.p initial={{scale:0.5,opacity:0}} animate={{scale:1,opacity:1}} exit={{opacity:0}} className="text-center text-lg font-black" style={{color:judgement.color}}>{judgement.text}</motion.p>}</AnimatePresence>
          <div className="grid grid-cols-4 gap-2 max-w-[320px] mx-auto">
            {COLORS.map((c,i)=><button key={i} onPointerDown={()=>tapLane(i)} className="py-8 rounded-2xl active:brightness-150 transition-all" style={{backgroundColor:c}}/>)}
          </div>
        </>
      )}
      {phase==="done"&&(
        <div className="text-center py-8 space-y-3 text-white">
          <p className="text-3xl font-black">{score}</p>
          <p className="text-sm text-zinc-400">Max Combo: {maxCombo}</p>
          <div className="flex justify-center gap-4 text-xs font-bold">
            <span className="text-amber-400">Perfect {counts.perfect}</span>
            <span className="text-emerald-400">Good {counts.good}</span>
            <span className="text-zinc-500">Miss {counts.miss}</span>
          </div>
          <button onClick={start} className="px-8 py-3 rounded-2xl bg-fuchsia-500 text-white font-bold text-sm active:scale-95">Play Again</button>
        </div>
      )}
    </div>
  );
}
