"use client";
import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

const WORDS=["WORLD","PLANE","BEACH","HOTEL","TRAIN","MONEY","GUIDE","TOWER","ROUTE","METRO","FERRY","COAST","SIGHT","JAPAN","PARIS","ITALY","QUEEN","ROYAL","OCEAN","RIVER","MOUNT","TRAIL","CABIN","VILLA","LODGE","TRIPS","VISIT","CORAL","TROUT","FROST","POLAR","CARGO","WHALE","DRIFT","FLYER","PORTS","YACHT","SCUBA","NORTH","SOUTH","ATLAS","ROAMS","FIELD","RIDGE","STORM","CHART","OASIS","DUNES"];

function getDaily(){const d=new Date();const doy=Math.floor((d.getTime()-new Date(d.getFullYear(),0,0).getTime())/86400000);return WORDS[doy%WORDS.length];}

type CellState="correct"|"present"|"absent"|"empty";

export default function WordleGame(){
  const word=useMemo(()=>getDaily(),[]);
  const today=new Date().toISOString().slice(0,10);
  const storageKey=`wordle_${today}`;

  const [guesses,setGuesses]=useState<string[]>(()=>{try{if(typeof window==="undefined")return[];const s=JSON.parse(localStorage.getItem(storageKey)||"null");return s?.guesses||[];}catch{return[];}});
  const [current,setCurrent]=useState("");
  const [shake,setShake]=useState(false);
  const [won,setWon]=useState(()=>{try{if(typeof window==="undefined")return false;return JSON.parse(localStorage.getItem(storageKey)||"null")?.won||false;}catch{return false;}});
  const [streak]=useState(()=>{try{return Number(localStorage?.getItem("wordle_streak")||"0");}catch{return 0;}});

  const maxGuesses=6;const done=won||guesses.length>=maxGuesses;

  const evaluate=(guess:string):{letter:string;state:CellState}[]=>{
    const result=guess.split("").map(l=>({letter:l,state:"absent" as CellState}));
    const wArr=word.split("");const used=Array(5).fill(false);
    result.forEach((r,i)=>{if(r.letter===wArr[i]){r.state="correct";used[i]=true;}});
    result.forEach((r)=>{if(r.state==="correct")return;const idx=wArr.findIndex((w,i)=>!used[i]&&w===r.letter);if(idx>=0){r.state="present";used[idx]=true;}});
    return result;
  };

  const allResults=guesses.map(g=>evaluate(g));
  const keyColors=useMemo(()=>{
    const m:Record<string,CellState>={};
    allResults.forEach(r=>r.forEach(({letter,state})=>{const cur=m[letter];if(state==="correct")m[letter]="correct";else if(state==="present"&&cur!=="correct")m[letter]="present";else if(!cur)m[letter]=state;}));
    return m;
  },[allResults]);

  const submit=useCallback(()=>{
    if(current.length!==5){setShake(true);setTimeout(()=>setShake(false),500);return;}
    const g=[...guesses,current];setGuesses(g);
    const isWin=current===word;
    if(isWin){setWon(true);const ns=streak+1;localStorage.setItem("wordle_streak",String(ns));}
    localStorage.setItem(storageKey,JSON.stringify({guesses:g,won:isWin}));
    setCurrent("");
  },[current,guesses,word,storageKey,streak]);

  const tapKey=(k:string)=>{
    if(done)return;
    if(k==="ENT"){submit();return;}
    if(k==="⌫"){setCurrent(p=>p.slice(0,-1));return;}
    if(current.length<5)setCurrent(p=>p+k);
  };

  const stateColor=(s:CellState)=>s==="correct"?"#22c55e":s==="present"?"#eab308":s==="absent"?"#52525b":"transparent";
  const KEYS=[["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L"],["ENT","Z","X","C","V","B","N","M","⌫"]];

  return(
    <div className="p-6 space-y-3 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Wordle</h1>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">🔥 {streak} streak</span>
      </div>
      {/* Grid */}
      <motion.div animate={shake?{x:[0,-8,8,-8,8,0]}:{}} transition={{duration:0.4}} className="space-y-1.5 max-w-[300px] mx-auto">
        {Array.from({length:maxGuesses}).map((_,row)=>{
          const guess=guesses[row];const isCurrent=row===guesses.length&&!done;
          const cells=guess?evaluate(guess):isCurrent?current.padEnd(5," ").split("").map(l=>({letter:l.trim(),state:"empty" as CellState})):Array(5).fill({letter:"",state:"empty" as CellState});
          return(
            <div key={row} className="flex gap-1.5 justify-center">
              {cells.map((c:{letter:string;state:CellState},i:number)=>(
                <motion.div key={i} initial={guess?{rotateX:90}:{}} animate={guess?{rotateX:0}:{}} transition={{delay:i*0.15,duration:0.3}}
                  className="w-[52px] h-[52px] rounded-xl border-2 flex items-center justify-center text-xl font-black text-white"
                  style={{backgroundColor:stateColor(c.state),borderColor:c.state==="empty"?(c.letter?"#52525b":"#3f3f46"):stateColor(c.state)}}>
                  {c.letter}
                </motion.div>
              ))}
            </div>
          );
        })}
      </motion.div>
      {done&&<p className="text-center text-sm font-bold text-foreground">{won?`Got it in ${guesses.length}! 🎉`:`The word was ${word}`}</p>}
      {/* Keyboard */}
      <div className="space-y-1 max-w-[360px] mx-auto pt-2">
        {KEYS.map((row,ri)=>(
          <div key={ri} className="flex gap-1 justify-center">
            {row.map(k=>{
              const bg=keyColors[k]==="correct"?"#22c55e":keyColors[k]==="present"?"#eab308":keyColors[k]==="absent"?"#3f3f46":"#52525b";
              return <button key={k} onClick={()=>tapKey(k)} className="rounded-lg font-bold text-white text-xs active:scale-90 transition-transform" style={{backgroundColor:bg,padding:k.length>1?"10px 8px":"10px 12px",minWidth:k.length>1?44:32}}>{k}</button>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
