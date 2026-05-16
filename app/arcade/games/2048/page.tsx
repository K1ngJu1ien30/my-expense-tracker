"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Board = (number|null)[][];
const SIZE = 4;
const empty = ():Board => Array.from({length:SIZE},()=>Array(SIZE).fill(null));
const clone = (b:Board):Board => b.map(r=>[...r]);

function addRandom(b:Board){
  const cells:{r:number;c:number}[]=[];
  b.forEach((row,r)=>row.forEach((v,c)=>{if(v===null)cells.push({r,c});}));
  if(!cells.length) return;
  const {r,c}=cells[Math.floor(Math.random()*cells.length)];
  b[r][c]=Math.random()<0.9?2:4;
}

function slideRow(row:(number|null)[]):(number|null)[]{
  const f=row.filter(v=>v!==null) as number[];
  const merged:number[]=[];
  let i=0;
  while(i<f.length){if(i+1<f.length&&f[i]===f[i+1]){merged.push(f[i]*2);i+=2;}else{merged.push(f[i]);i++;}}
  while(merged.length<SIZE) merged.push(null as unknown as number);
  return merged;
}

function move(board:Board, dir:"left"|"right"|"up"|"down"):{board:Board;score:number;moved:boolean}{
  let b=clone(board); let score=0; let moved=false;
  const slide=(rows:(number|null)[][])=>{return rows.map(row=>{const nr=slideRow(row);const old=row; nr.forEach((v,i)=>{if(v!==old[i])moved=true;}); return nr;});};
  const transpose=(m:(number|null)[][])=>m[0].map((_,i)=>m.map(r=>r[i]));
  const reverse=(m:(number|null)[][])=>m.map(r=>[...r].reverse());
  if(dir==="left") b=slide(b) as Board;
  else if(dir==="right") b=reverse(slide(reverse(b))) as Board;
  else if(dir==="up") b=transpose(slide(transpose(b))) as Board;
  else b=transpose(reverse(slide(reverse(transpose(b))))) as Board;
  // calc score from merges
  b.forEach((row,r)=>row.forEach((v,c)=>{if(v&&v!==board[r]?.[c]&&board[r]?.[c]!==null) score+=v||0;}));
  return {board:b,score,moved};
}

function canMove(b:Board){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    if(b[r][c]===null) return true;
    if(c+1<SIZE&&b[r][c]===b[r][c+1]) return true;
    if(r+1<SIZE&&b[r][c]===b[r+1][c]) return true;
  }
  return false;
}

const TILE_COLORS:Record<number,string>={2:"#e4e4e7",4:"#d4d4d8",8:"#fdba74",16:"#fb923c",32:"#f97316",64:"#ef4444",128:"#fde047",256:"#facc15",512:"#eab308",1024:"#ca8a04",2048:"#f59e0b"};

export default function Game2048(){
  const [board,setBoard]=useState<Board>(()=>{const b=empty();addRandom(b);addRandom(b);return b;});
  const [score,setScore]=useState(0);
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("2048_best")||"0");}catch{return 0;}});
  const [gameOver,setGameOver]=useState(false);
  const touchRef=useRef<{x:number;y:number}|null>(null);

  const doMove=useCallback((dir:"left"|"right"|"up"|"down")=>{
    if(gameOver) return;
    const {board:nb,score:s,moved}=move(board,dir);
    if(!moved) return;
    addRandom(nb);
    const ns=score+s;
    setBoard(nb);setScore(ns);
    if(ns>best){setBest(ns);localStorage.setItem("2048_best",String(ns));}
    if(!canMove(nb)) setGameOver(true);
  },[board,score,best,gameOver]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{const m:{[k:string]:"left"|"right"|"up"|"down"}={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"};if(m[e.key])doMove(m[e.key]);};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[doMove]);

  const restart=()=>{const b=empty();addRandom(b);addRandom(b);setBoard(b);setScore(0);setGameOver(false);};

  return(
    <div className="p-6 space-y-4 select-none pb-32"
      onTouchStart={e=>{const t=e.touches[0];touchRef.current={x:t.clientX,y:t.clientY};}}
      onTouchEnd={e=>{if(!touchRef.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchRef.current.x;const dy=t.clientY-touchRef.current.y;touchRef.current=null;if(Math.abs(dx)<20&&Math.abs(dy)<20)return;if(Math.abs(dx)>Math.abs(dy))doMove(dx>0?"right":"left");else doMove(dy>0?"down":"up");}}
    >
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">2048</h1>
        <div className="ml-auto flex gap-2 text-xs font-bold">
          <span className="bg-muted px-2 py-1 rounded-lg text-foreground">{score}</span>
          <span className="bg-muted px-2 py-1 rounded-lg text-muted-foreground">Best {best}</span>
        </div>
      </div>
      <div className="bg-muted rounded-2xl p-2 max-w-[340px] mx-auto">
        <div className="grid grid-cols-4 gap-1.5">
          {board.flat().map((v,i)=>(
            <div key={i} className="aspect-square rounded-xl flex items-center justify-center font-black text-lg" style={{backgroundColor:v?TILE_COLORS[v]||"#854d0e":"#a1a1aa20",color:v&&v>=8?"#fff":"#27272a",fontSize:v&&v>=1024?"14px":v&&v>=128?"16px":"20px"}}>
              <AnimatePresence mode="popLayout"><motion.span key={v||`e${i}`} initial={{scale:v?0.5:1}} animate={{scale:1}} transition={{type:"spring",damping:20}}>{v||""}</motion.span></AnimatePresence>
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground font-medium">Swipe or arrow keys to move tiles</p>
      {gameOver&&(
        <div className="text-center py-8 space-y-3">
          <p className="text-3xl font-black text-foreground">Game Over</p>
          <p className="text-sm text-muted-foreground">Score: {score}</p>
          <button onClick={restart} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Try Again</button>
        </div>
      )}
    </div>
  );
}
