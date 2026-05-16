"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const ROWS=10,COLS=8,MINES=10;
type Cell={mine:boolean;adj:number;revealed:boolean;flagged:boolean};

function genBoard(safeR:number,safeC:number):Cell[][]{
  const b:Cell[][]=Array.from({length:ROWS},()=>Array.from({length:COLS},()=>({mine:false,adj:0,revealed:false,flagged:false})));
  let placed=0;
  while(placed<MINES){const r=Math.floor(Math.random()*ROWS);const c=Math.floor(Math.random()*COLS);if(b[r][c].mine||(r===safeR&&c===safeC))continue;b[r][c].mine=true;placed++;}
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){if(b[r][c].mine)continue;let n=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&b[nr][nc].mine)n++;}b[r][c].adj=n;}
  return b;
}

const ADJ_COLORS:Record<number,string>={1:"#3b82f6",2:"#22c55e",3:"#ef4444",4:"#7c3aed",5:"#f59e0b",6:"#06b6d4",7:"#000",8:"#6b7280"};

export default function MinesweeperGame(){
  const [board,setBoard]=useState<Cell[][]|null>(null);
  const [flagMode,setFlagMode]=useState(false);
  const [gameOver,setGameOver]=useState(false);
  const [won,setWon]=useState(false);
  const [time,setTime]=useState(0);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("mine_best")||"9999");}catch{return 9999;}});

  // Cleanup timer on unmount
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);
  const flags=useMemo(()=>board?board.flat().filter(c=>c.flagged).length:0,[board]);

  const start=(r:number,c:number)=>{const b=genBoard(r,c);b[r][c].revealed=true;if(b[r][c].adj===0)flood(b,r,c);setBoard(b);setTime(0);setGameOver(false);setWon(false);timerRef.current=setInterval(()=>setTime(p=>p+1),1000);};

  const flood=(b:Cell[][],r:number,c:number)=>{
    const q:number[][]=[[r,c]];while(q.length){const[cr,cc]=q.pop()!;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=cr+dr,nc=cc+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!b[nr][nc].revealed&&!b[nr][nc].mine){b[nr][nc].revealed=true;if(b[nr][nc].adj===0)q.push([nr,nc]);}}}
  };

  const checkWin=(b:Cell[][])=>b.flat().every(c=>c.mine||c.revealed);

  const tap=useCallback((r:number,c:number)=>{
    if(!board){start(r,c);return;}
    if(gameOver||won) return;
    const b=board.map(row=>row.map(cell=>({...cell})));
    if(flagMode){b[r][c].flagged=!b[r][c].flagged;setBoard(b);return;}
    if(b[r][c].flagged||b[r][c].revealed) return;
    if(b[r][c].mine){b.forEach(row=>row.forEach(cell=>{if(cell.mine)cell.revealed=true;}));setBoard(b);setGameOver(true);if(timerRef.current)clearInterval(timerRef.current);return;}
    b[r][c].revealed=true;
    if(b[r][c].adj===0)flood(b,r,c);
    setBoard(b);
    if(checkWin(b)){setWon(true);if(timerRef.current)clearInterval(timerRef.current);if(time<best){setBest(time);try{localStorage.setItem("mine_best",String(time));}catch{}}}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[board,flagMode,gameOver,won,timerRef,time,best]);

  const restart=()=>{if(timerRef.current)clearInterval(timerRef.current);timerRef.current=null;setBoard(null);setGameOver(false);setWon(false);setTime(0);};

  return(
    <div className="p-6 space-y-4 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Minesweeper</h1>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">Best: {best<9999?`${best}s`:"—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-muted-foreground">⏱ {time}s</span>
        <span className="text-xs font-bold text-muted-foreground">🚩 {flags}/{MINES}</span>
        <button onClick={()=>setFlagMode(!flagMode)} className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${flagMode?"bg-red-500 text-white":"bg-muted text-muted-foreground"}`}>{flagMode?"🚩 Flag":"👆 Reveal"}</button>
      </div>
      {!board?(
        <div className="text-center py-12 space-y-3"><p className="text-5xl">💣</p><p className="font-bold text-foreground">Tap any cell to start</p></div>
      ):null}
      <div className="mx-auto" style={{maxWidth:COLS*36}}>
        <div className="grid gap-0.5" style={{gridTemplateColumns:`repeat(${COLS},1fr)`}}>
          {(board||Array.from({length:ROWS},()=>Array.from({length:COLS},()=>({mine:false,adj:0,revealed:false,flagged:false})))).flat().map((cell,i)=>{
            const r=Math.floor(i/COLS),c=i%COLS;
            return(
              <button key={i} onClick={()=>tap(r,c)} className={`aspect-square rounded-md text-xs font-bold flex items-center justify-center ${cell.revealed?cell.mine?"bg-red-500":"bg-card border border-border/30":"bg-muted/80 border border-border/40 active:scale-90"} transition-transform`} style={{fontSize:12}}>
                {cell.flagged&&!cell.revealed?"🚩":cell.revealed?(cell.mine?"💣":cell.adj>0?<span style={{color:ADJ_COLORS[cell.adj]}}>{cell.adj}</span>:""):""}
              </button>
            );
          })}
        </div>
      </div>
      {(gameOver||won)&&(
        <div className="text-center py-4 space-y-2">
          <p className="text-xl font-black text-foreground">{won?"You Win! 🎉":"Game Over 💥"}</p>
          {won&&<p className="text-sm text-muted-foreground">Time: {time}s</p>}
          <button onClick={restart} className="px-8 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95">Play Again</button>
        </div>
      )}
    </div>
  );
}
