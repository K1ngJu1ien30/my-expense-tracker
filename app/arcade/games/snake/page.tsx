"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const W=15,H=15,TICK=150;
type Pt={x:number;y:number};
type Dir="up"|"down"|"left"|"right";

export default function SnakeGame(){
  const [snake,setSnake]=useState<Pt[]>([{x:7,y:7}]);
  const [food,setFood]=useState<Pt>({x:3,y:3});
  const [dir,setDir]=useState<Dir>("right");
  const [score,setScore]=useState(0);
  const [gameOver,setGameOver]=useState(false);
  const [started,setStarted]=useState(false);
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("snake_best")||"0");}catch{return 0;}});
  const dirRef=useRef<Dir>("right");
  const touchRef=useRef<{x:number;y:number}|null>(null);

  const spawnFood=(s:Pt[]):Pt=>{
    const set=new Set(s.map(p=>`${p.x},${p.y}`));
    const empty:Pt[]=[];
    for(let x=0;x<W;x++)for(let y=0;y<H;y++)if(!set.has(`${x},${y}`))empty.push({x,y});
    return empty[Math.floor(Math.random()*empty.length)]||{x:0,y:0};
  };

  const start=useCallback(()=>{
    const s=[{x:7,y:7}];setSnake(s);setDir("right");dirRef.current="right";setScore(0);setGameOver(false);setStarted(true);setFood(spawnFood(s));
  },[]);

  useEffect(()=>{
    if(!started||gameOver) return;
    const interval=setInterval(()=>{
      setSnake(prev=>{
        const d=dirRef.current;
        const head={...prev[0]};
        if(d==="up")head.y--;else if(d==="down")head.y++;else if(d==="left")head.x--;else head.x++;
        if(head.x<0||head.x>=W||head.y<0||head.y>=H||prev.some(p=>p.x===head.x&&p.y===head.y)){
          setGameOver(true);return prev;
        }
        const ns=[head,...prev];
        if(head.x===food.x&&head.y===food.y){
          setScore(s=>{const n=s+1;if(n>best){setBest(n);localStorage.setItem("snake_best",String(n));}return n;});
          setFood(spawnFood(ns));
        } else ns.pop();
        return ns;
      });
    },TICK);
    return()=>clearInterval(interval);
  },[started,gameOver,food,best]);

  useEffect(()=>{
    const opp:Record<Dir,Dir>={up:"down",down:"up",left:"right",right:"left"};
    const h=(e:KeyboardEvent)=>{const m:{[k:string]:Dir}={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};const d=m[e.key];if(d&&d!==opp[dirRef.current]){dirRef.current=d;setDir(d);}};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[]);

  const handleSwipe=(dx:number,dy:number)=>{
    const opp:Record<Dir,Dir>={up:"down",down:"up",left:"right",right:"left"};
    if(Math.abs(dx)<20&&Math.abs(dy)<20) return;
    let d:Dir;
    if(Math.abs(dx)>Math.abs(dy)) d=dx>0?"right":"left"; else d=dy>0?"down":"up";
    if(d!==opp[dirRef.current]){dirRef.current=d;setDir(d);}
  };

  const cellSize=Math.floor(Math.min(340,typeof window!=="undefined"?window.innerWidth-48:340)/W);

  return(
    <div className="p-6 space-y-4 select-none pb-32"
      onTouchStart={e=>{touchRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
      onTouchEnd={e=>{if(!touchRef.current)return;const t=e.changedTouches[0];handleSwipe(t.clientX-touchRef.current.x,t.clientY-touchRef.current.y);touchRef.current=null;}}>
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Snake</h1>
        <div className="ml-auto flex gap-2 text-xs font-bold">
          <span className="bg-muted px-2 py-1 rounded-lg text-foreground">{score}</span>
          <span className="bg-muted px-2 py-1 rounded-lg text-muted-foreground">Best {best}</span>
        </div>
      </div>
      {!started?(
        <div className="text-center py-16 space-y-4"><p className="text-5xl">🐍</p><p className="font-bold text-foreground">Swipe or arrow keys to move</p><button onClick={start} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Start</button></div>
      ):(
        <div className="mx-auto rounded-xl overflow-hidden border border-border/40" style={{width:cellSize*W,height:cellSize*H,position:"relative",backgroundColor:"#18181b"}}>
          {snake.map((p,i)=><div key={i} className="absolute rounded-sm" style={{left:p.x*cellSize,top:p.y*cellSize,width:cellSize-1,height:cellSize-1,backgroundColor:i===0?"#22c55e":"#4ade80"}}/>)}
          <div className="absolute flex items-center justify-center text-xs" style={{left:food.x*cellSize,top:food.y*cellSize,width:cellSize,height:cellSize}}>🍎</div>
        </div>
      )}
      {gameOver&&(
        <div className="text-center py-6 space-y-3"><p className="text-xl font-black text-foreground">Game Over — Score: {score}</p><button onClick={start} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Try Again</button></div>
      )}
    </div>
  );
}
