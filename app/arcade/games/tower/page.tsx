"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const COLS=10,ROWS=14,CS=34;
type Pt={x:number;y:number};
type Tower={x:number;y:number;type:number;cooldown:number;lastFire:number};
type Enemy={id:number;pathIdx:number;progress:number;hp:number;maxHp:number;speed:number};
type Proj={x:number;y:number;tx:number;ty:number;dmg:number};

const PATH:Pt[]=[{x:0,y:2},{x:3,y:2},{x:3,y:5},{x:7,y:5},{x:7,y:8},{x:2,y:8},{x:2,y:11},{x:9,y:11},{x:9,y:13}];
const TOWERS=[
  {name:"Archer",icon:"🏹",cost:50,dmg:10,range:3,cd:800,color:"#22c55e"},
  {name:"Sniper",icon:"🎯",cost:100,dmg:40,range:5,cd:2000,color:"#3b82f6"},
  {name:"Splash",icon:"💥",cost:120,dmg:15,range:2.5,cd:1200,color:"#ef4444"},
  {name:"Slow",icon:"❄️",cost:75,dmg:5,range:3,cd:1000,color:"#06b6d4"},
];
const pathSet=new Set(PATH.map(p=>`${p.x},${p.y}`));
// Interpolate path segments
for(let i=0;i<PATH.length-1;i++){const a=PATH[i],b=PATH[i+1];const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);let cx=a.x+dx,cy=a.y+dy;while(cx!==b.x||cy!==b.y){pathSet.add(`${cx},${cy}`);cx+=dx;cy+=dy;}}

export default function TowerDefense(){
  const [gold,setGold]=useState(200);
  const [lives,setLives]=useState(20);
  const [wave,setWave]=useState(0);
  const [phase,setPhase]=useState<"idle"|"wave"|"over"|"win">("idle");
  const [towers,setTowers]=useState<Tower[]>([]);
  const [enemies,setEnemies]=useState<Enemy[]>([]);
  const [projs,setProjs]=useState<Proj[]>([]);
  const [selTower,setSelTower]=useState(0);
  const enemiesRef=useRef<Enemy[]>([]);
  useEffect(()=>{enemiesRef.current=enemies;},[enemies]);
  const enemyId=useRef(0);
  const spawnRef=useRef<ReturnType<typeof setInterval>|null>(null);

  const placeTower=(x:number,y:number)=>{
    if(pathSet.has(`${x},${y}`))return;
    if(towers.some(t=>t.x===x&&t.y===y))return;
    const t=TOWERS[selTower];
    if(gold<t.cost)return;
    setGold(g=>g-t.cost);
    setTowers(prev=>[...prev,{x,y,type:selTower,cooldown:t.cd,lastFire:0}]);
  };

  const startWave=useCallback(()=>{
    const w=wave+1;setWave(w);setPhase("wave");
    const count=5+w*3;let spawned=0;
    spawnRef.current=setInterval(()=>{
      if(spawned>=count){if(spawnRef.current){clearInterval(spawnRef.current);spawnRef.current=null;}return;}
      enemyId.current++;
      setEnemies(prev=>[...prev,{id:enemyId.current,pathIdx:0,progress:0,hp:30+w*20,maxHp:30+w*20,speed:0.02+w*0.002}]);
      spawned++;
    },600);
  },[wave]);

  // Cleanup intervals on unmount
  useEffect(()=>()=>{if(spawnRef.current)clearInterval(spawnRef.current);},[]);

  useEffect(()=>{
    if(phase!=="wave")return;
    const tick=setInterval(()=>{
      setEnemies(prev=>{
        const next=prev.map(e=>{
          let p={...e};p.progress+=p.speed;
          if(p.progress>=1){p.pathIdx++;p.progress=0;}
          if(p.pathIdx>=PATH.length-1){setLives(l=>{const nl=l-1;if(nl<=0)setPhase("over");return nl;});return null;}
          return p;
        }).filter(Boolean) as Enemy[];
        if(next.length===0&&spawnRef.current===null) {/* check wave end handled below */}
        return next;
      });
      // Tower firing
      setTowers(prev=>prev.map(t=>{
        const now=Date.now();
        if(now-t.lastFire<t.cooldown)return t;
        const td=TOWERS[t.type];
        // find closest enemy in range using ref (avoids TS narrowing issue with setState read)
        const currentEnemies=enemiesRef.current;
        const closest=currentEnemies.reduce<{enemy:Enemy;dist:number}|null>((best,e)=>{
          if(e.pathIdx>=PATH.length-1)return best;
          const a=PATH[e.pathIdx],b=PATH[Math.min(e.pathIdx+1,PATH.length-1)];
          const ex=a.x+(b.x-a.x)*e.progress;const ey=a.y+(b.y-a.y)*e.progress;
          const d=Math.sqrt((t.x-ex)**2+(t.y-ey)**2);
          if(d<=td.range&&(!best||d<best.dist))return{enemy:e,dist:d};
          return best;
        },null);
        if(closest){
          const c=closest.enemy;
          const a=PATH[c.pathIdx],b=PATH[Math.min(c.pathIdx+1,PATH.length-1)];
          setProjs(p=>[...p,{x:t.x,y:t.y,tx:a.x+(b.x-a.x)*c.progress,ty:a.y+(b.y-a.y)*c.progress,dmg:td.dmg}]);
          setEnemies(es=>es.map(e=>e.id===c.id?{...e,hp:e.hp-td.dmg}:e).filter(e=>{if(e.hp<=0){setGold(g=>g+10);return false;}return true;}));
          return{...t,lastFire:now};
        }
        return t;
      }));
      setProjs([]);// instant hit for simplicity
    },100);
    return()=>clearInterval(tick);
  },[phase]);

  // Check wave complete
  useEffect(()=>{
    if(phase==="wave"&&enemies.length===0&&wave>0){
      const timer=setTimeout(()=>{if(wave>=10)setPhase("win");else setPhase("idle");},500);
      return()=>clearTimeout(timer);
    }
  },[enemies.length,phase,wave]);

  return(
    <div className="p-6 space-y-3 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Tower Defense</h1>
      </div>
      <div className="flex items-center gap-3 text-xs font-bold">
        <span className="text-amber-500">💰 {gold}</span>
        <span className="text-red-500">❤️ {lives}</span>
        <span className="text-muted-foreground">Wave {wave}/10</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        {TOWERS.map((t,i)=>(
          <button key={i} onClick={()=>setSelTower(i)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${selTower===i?"text-white":"text-muted-foreground bg-muted"}`} style={selTower===i?{backgroundColor:t.color}:{}}>
            {t.icon} {t.name} ({t.cost})
          </button>
        ))}
      </div>
      <div className="mx-auto rounded-xl overflow-hidden" style={{width:COLS*CS,height:ROWS*CS,position:"relative",backgroundColor:"#18181b"}}>
        {/* Path */}
        {Array.from(pathSet).map(k=>{const[x,y]=k.split(",").map(Number);return <div key={k} className="absolute" style={{left:x*CS,top:y*CS,width:CS,height:CS,backgroundColor:"#27272a"}}/>;
        })}
        {/* Grid tap targets */}
        {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>(
          <div key={`${r}-${c}`} onClick={()=>placeTower(c,r)} className="absolute cursor-pointer" style={{left:c*CS,top:r*CS,width:CS,height:CS}}/>
        )))}
        {/* Towers */}
        {towers.map((t,i)=><div key={i} className="absolute flex items-center justify-center text-lg" style={{left:t.x*CS,top:t.y*CS,width:CS,height:CS}}>{TOWERS[t.type].icon}</div>)}
        {/* Enemies */}
        {enemies.map(e=>{
          if(e.pathIdx>=PATH.length-1) return null;
          const a=PATH[e.pathIdx],b=PATH[Math.min(e.pathIdx+1,PATH.length-1)];
          const ex=a.x+(b.x-a.x)*e.progress;const ey=a.y+(b.y-a.y)*e.progress;
          return <div key={e.id} className="absolute" style={{left:ex*CS,top:ey*CS,width:CS,height:CS}}>
            <div className="w-full h-1 bg-red-900 rounded-full mb-0.5"><div className="h-full bg-red-500 rounded-full" style={{width:`${(e.hp/e.maxHp)*100}%`}}/></div>
            <span className="text-xs flex items-center justify-center">👾</span>
          </div>;
        })}
      </div>
      {phase==="idle"&&<button onClick={startWave} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Start Wave {wave+1}</button>}
      {phase==="over"&&<div className="text-center py-4"><p className="text-xl font-black text-foreground">Game Over — Wave {wave}</p><button onClick={()=>{setGold(200);setLives(20);setWave(0);setTowers([]);setEnemies([]);setPhase("idle");}} className="mt-3 px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Restart</button></div>}
      {phase==="win"&&<div className="text-center py-4"><p className="text-xl font-black text-foreground">Victory! 🏆 All 10 waves cleared!</p></div>}
    </div>
  );
}
