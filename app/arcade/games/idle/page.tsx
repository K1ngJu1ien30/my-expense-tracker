"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Upgrades={rod:number;net:number;boat:number;crew:number;trawler:number;factory:number;empire:number};
const UPG=[
  {key:"rod" as const,icon:"🎣",name:"Better Rod",baseCost:10,rate:1},
  {key:"net" as const,icon:"🪤",name:"Fishing Net",baseCost:50,rate:5},
  {key:"boat" as const,icon:"🚤",name:"Small Boat",baseCost:250,rate:25},
  {key:"crew" as const,icon:"👥",name:"Fishing Crew",baseCost:1000,rate:100},
  {key:"trawler" as const,icon:"🚢",name:"Trawler",baseCost:5000,rate:500},
  {key:"factory" as const,icon:"🏭",name:"Fish Factory",baseCost:25000,rate:2500},
  {key:"empire" as const,icon:"🌊",name:"Ocean Empire",baseCost:100000,rate:10000},
];

function fmt(n:number){if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e3)return(n/1e3).toFixed(1)+"K";return Math.floor(n).toString();}

type SaveData={fish:number;upgrades:Upgrades;tapPower:number;lastSave:number};
const DEFAULT:SaveData={fish:0,upgrades:{rod:0,net:0,boat:0,crew:0,trawler:0,factory:0,empire:0},tapPower:1,lastSave:Date.now()};

function load():SaveData{try{if(typeof window==="undefined")return DEFAULT;const d=JSON.parse(localStorage.getItem("idle_fisher")||"");return{...DEFAULT,...d};}catch{return DEFAULT;}}
function save(d:SaveData){try{localStorage.setItem("idle_fisher",JSON.stringify({...d,lastSave:Date.now()}));}catch{}}

export default function IdleFisher(){
  const [state,setState]=useState<SaveData>(()=>{const d=load();const elapsed=Math.min((Date.now()-d.lastSave)/1000, 86400);const ps=UPG.reduce((s,u)=>s+u.rate*(d.upgrades[u.key]||0),0);d.fish+=ps*elapsed;return d;});
  const [splashes,setSplashes]=useState<{id:number;amount:number}[]>([]);
  const splashId=useRef(0);

  const perSecond=UPG.reduce((s,u)=>s+u.rate*(state.upgrades[u.key]||0),0);

  useEffect(()=>{
    const t=setInterval(()=>setState(p=>({...p,fish:p.fish+perSecond})),1000);
    const s=setInterval(()=>save(state),2000);
    return()=>{clearInterval(t);clearInterval(s);};
  },[perSecond,state]);

  const tap=useCallback(()=>{
    setState(p=>({...p,fish:p.fish+p.tapPower}));
    splashId.current++;
    setSplashes(p=>[...p,{id:splashId.current,amount:state.tapPower}]);
    setTimeout(()=>setSplashes(p=>p.slice(1)),600);
  },[state.tapPower]);

  const buy=(key:keyof Upgrades)=>{
    const u=UPG.find(u=>u.key===key)!;
    const cost=Math.floor(u.baseCost*Math.pow(1.5,state.upgrades[key]));
    if(state.fish<cost)return;
    setState(p=>({...p,fish:p.fish-cost,upgrades:{...p.upgrades,[key]:p.upgrades[key]+1}}));
  };

  return(
    <div className="p-6 space-y-4 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Idle Fisher</h1>
        <span className="ml-auto text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full">{fmt(perSecond)}/s</span>
      </div>
      <div className="text-center py-4">
        <p className="text-4xl font-black text-foreground tabular-nums">🐟 {fmt(state.fish)}</p>
        <p className="text-xs text-muted-foreground font-medium mt-1">tap power: +{state.tapPower}</p>
      </div>
      <div className="relative flex justify-center">
        <button onClick={tap} className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 text-5xl flex items-center justify-center active:scale-90 transition-transform shadow-heavy">🐟</button>
        <AnimatePresence>
          {splashes.map(s=><motion.p key={s.id} initial={{opacity:1,y:0}} animate={{opacity:0,y:-40}} exit={{opacity:0}} transition={{duration:0.5}} className="absolute top-0 text-lg font-black text-cyan-500 pointer-events-none">+{s.amount}</motion.p>)}
        </AnimatePresence>
      </div>
      <div className="space-y-2">
        {UPG.map(u=>{
          const cost=Math.floor(u.baseCost*Math.pow(1.5,state.upgrades[u.key]));
          const canBuy=state.fish>=cost;
          return(
            <button key={u.key} onClick={()=>buy(u.key)} disabled={!canBuy} className={`w-full flex items-center gap-3 bg-card rounded-xl p-3 border border-border/40 ${canBuy?"active:scale-[0.98]":"opacity-50"} transition-all`}>
              <span className="text-2xl">{u.icon}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-foreground">{u.name} <span className="text-muted-foreground font-medium">×{state.upgrades[u.key]}</span></p>
                <p className="text-[10px] text-muted-foreground">+{u.rate}/s · Cost: {fmt(cost)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
