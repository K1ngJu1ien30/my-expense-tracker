"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const COLS=10,ROWS=20,CS=28;
const PIECES=[
  {shape:[[1,1,1,1]],color:"#06b6d4"},
  {shape:[[1,1],[1,1]],color:"#eab308"},
  {shape:[[0,1,0],[1,1,1]],color:"#a855f7"},
  {shape:[[0,0,1],[1,1,1]],color:"#f97316"},
  {shape:[[1,0,0],[1,1,1]],color:"#3b82f6"},
  {shape:[[0,1,1],[1,1,0]],color:"#22c55e"},
  {shape:[[1,1,0],[0,1,1]],color:"#ef4444"},
];
type Cell={color:string}|null;
type Piece={shape:number[][];color:string;x:number;y:number};
const emptyBoard=():Cell[][]=>Array.from({length:ROWS},()=>Array(COLS).fill(null));
const rotate=(s:number[][])=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
function collides(b:Cell[][],p:Piece){for(let r=0;r<p.shape.length;r++)for(let c=0;c<p.shape[r].length;c++){if(!p.shape[r][c])continue;const nr=p.y+r,nc=p.x+c;if(nc<0||nc>=COLS||nr>=ROWS)return true;if(nr>=0&&b[nr][nc])return true;}return false;}
function merge(b:Cell[][],p:Piece){const nb=b.map(r=>[...r]);p.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v&&p.y+r>=0)nb[p.y+r][p.x+c]={color:p.color};}));return nb;}
function clearLines(b:Cell[][]){const kept=b.filter(r=>r.some(c=>!c));const cl=ROWS-kept.length;while(kept.length<ROWS)kept.unshift(Array(COLS).fill(null));return{board:kept,cleared:cl};}
function ghostY(b:Cell[][],p:Piece){let y=p.y;while(!collides(b,{...p,y:y+1}))y++;return y;}
function randomPiece():Piece{const p=PIECES[Math.floor(Math.random()*PIECES.length)];return{shape:p.shape,color:p.color,x:Math.floor((COLS-p.shape[0].length)/2),y:-p.shape.length};}

export default function TetrisGame(){
  const [board,setBoard]=useState(emptyBoard);
  const [piece,setPiece]=useState<Piece>(randomPiece);
  const [next,setNext]=useState<Piece>(randomPiece);
  const [score,setScore]=useState(0);
  const [lines,setLines]=useState(0);
  const [level,setLevel]=useState(1);
  const [over,setOver]=useState(false);
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("tetris_best")||"0");}catch{return 0;}});
  const touchRef=useRef<{x:number;y:number}|null>(null);

  const lock=useCallback(()=>{
    const mb=merge(board,piece);const{board:nb,cleared}=clearLines(mb);
    const pts=[0,100,300,500,800][cleared]||0;const ns=score+pts*level;const nl=lines+cleared;
    setBoard(nb);setScore(ns);setLines(nl);setLevel(Math.floor(nl/10)+1);
    if(ns>best){setBest(ns);localStorage.setItem("tetris_best",String(ns));}
    const np=next;if(collides(nb,np)){setOver(true);return;}
    setPiece(np);setNext(randomPiece());
  },[board,piece,next,score,lines,level,best]);

  const moveP=useCallback((dx:number,dy:number)=>{
    if(over)return;const np={...piece,x:piece.x+dx,y:piece.y+dy};
    if(!collides(board,np))setPiece(np);else if(dy>0)lock();
  },[board,piece,over,lock]);

  const rotatePiece=useCallback(()=>{
    if(over)return;const ns=rotate(piece.shape);
    for(const dx of[0,-1,1,-2,2]){const np={...piece,shape:ns,x:piece.x+dx};if(!collides(board,np)){setPiece(np);return;}}
  },[board,piece,over]);

  const hardDrop=useCallback(()=>{
    if(over)return;setPiece(p=>({...p,y:ghostY(board,p)}));setTimeout(lock,0);
  },[board,over,lock]);

  useEffect(()=>{if(over)return;const t=setInterval(()=>moveP(0,1),Math.max(100,800-(level-1)*80));return()=>clearInterval(t);},[level,over,moveP]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="ArrowLeft")moveP(-1,0);else if(e.key==="ArrowRight")moveP(1,0);else if(e.key==="ArrowDown")moveP(0,1);else if(e.key==="ArrowUp")rotatePiece();else if(e.key===" ")hardDrop();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[moveP,rotatePiece,hardDrop]);

  const restart=()=>{setBoard(emptyBoard());setPiece(randomPiece());setNext(randomPiece());setScore(0);setLines(0);setLevel(1);setOver(false);};
  const gy=ghostY(board,piece);

  return(
    <div className="p-4 space-y-3 select-none pb-32" style={{backgroundColor:"#18181b",minHeight:"100vh"}}
      onTouchStart={e=>{touchRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
      onTouchEnd={e=>{if(!touchRef.current)return;const t=e.changedTouches[0];const dx=t.clientX-touchRef.current.x;const dy=t.clientY-touchRef.current.y;touchRef.current=null;if(Math.abs(dx)<15&&Math.abs(dy)<15){rotatePiece();return;}if(dy>30&&Math.abs(dy)>Math.abs(dx)){hardDrop();return;}if(Math.abs(dx)>20)moveP(dx>0?1:-1,0);}}>
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-zinc-800"><ChevronLeft className="w-5 h-5 text-zinc-400"/></Link>
        <h1 className="text-lg font-bold text-white">Block Drop</h1>
        <span className="ml-auto text-[10px] font-bold text-zinc-400">Best {best}</span>
      </div>
      <div className="flex gap-3 justify-center">
        <div className="rounded-lg overflow-hidden border border-zinc-700" style={{width:COLS*CS,height:ROWS*CS,position:"relative",backgroundColor:"#09090b"}}>
          {board.map((row,r)=>row.map((cell,c)=>cell?<div key={`${r}-${c}`} className="absolute rounded-[3px]" style={{left:c*CS+1,top:r*CS+1,width:CS-2,height:CS-2,backgroundColor:cell.color}}/>:null))}
          {piece.shape.map((row,r)=>row.map((v,c)=>v?<div key={`g${r}-${c}`} className="absolute rounded-[3px] border border-zinc-600" style={{left:(piece.x+c)*CS+1,top:(gy+r)*CS+1,width:CS-2,height:CS-2,opacity:0.15,backgroundColor:piece.color}}/>:null))}
          {piece.shape.map((row,r)=>row.map((v,c)=>v&&piece.y+r>=0?<div key={`p${r}-${c}`} className="absolute rounded-[3px]" style={{left:(piece.x+c)*CS+1,top:(piece.y+r)*CS+1,width:CS-2,height:CS-2,backgroundColor:piece.color}}/>:null))}
        </div>
        <div className="space-y-2 w-16">
          <div><p className="text-[9px] font-bold text-zinc-500 uppercase">Score</p><p className="text-xs font-black text-white tabular-nums">{score}</p></div>
          <div><p className="text-[9px] font-bold text-zinc-500 uppercase">Lvl</p><p className="text-xs font-black text-white">{level}</p></div>
          <div><p className="text-[9px] font-bold text-zinc-500 uppercase">Lines</p><p className="text-xs font-black text-white">{lines}</p></div>
          <div className="space-y-1 pt-2">
            <button onClick={()=>moveP(-1,0)} className="w-full py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-bold active:scale-90">←</button>
            <button onClick={rotatePiece} className="w-full py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-bold active:scale-90">↻</button>
            <button onClick={()=>moveP(1,0)} className="w-full py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-bold active:scale-90">→</button>
            <button onClick={hardDrop} className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold active:scale-90">⬇</button>
          </div>
        </div>
      </div>
      {over&&<div className="text-center py-4 space-y-2"><p className="text-xl font-black text-white">Game Over</p><p className="text-sm text-zinc-400">Score: {score} · Lines: {lines}</p><button onClick={restart} className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm active:scale-95">Restart</button></div>}
    </div>
  );
}
