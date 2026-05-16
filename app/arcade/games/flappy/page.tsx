"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function FlappyFish(){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [score,setScore]=useState(0);
  const [best,setBest]=useState(()=>{try{return Number(localStorage?.getItem("flappy_best")||"0");}catch{return 0;}});
  const [phase,setPhase]=useState<"idle"|"playing"|"over">("idle");
  const stateRef=useRef({y:200,vy:0,pipes:[] as{x:number;gapY:number;passed:boolean}[],score:0,frame:0,phase:"idle" as string});

  const W=340,H=500,BIRD_X=50,GAP=150,PW=50,GRAVITY=0.5,JUMP=-8,SPEED=3;

  const startGame=useCallback(()=>{
    stateRef.current={y:200,vy:0,pipes:[],score:0,frame:0,phase:"playing"};
    setScore(0);setPhase("playing");
  },[]);

  const jump=useCallback(()=>{
    if(stateRef.current.phase==="idle"){startGame();return;}
    if(stateRef.current.phase==="over"){startGame();return;}
    stateRef.current.vy=JUMP;
  },[startGame]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    let raf:number;
    const loop=()=>{
      const s=stateRef.current;
      ctx.fillStyle="#0ea5e9";ctx.fillRect(0,0,W,H);
      if(s.phase==="playing"){
        s.vy+=GRAVITY;s.y+=s.vy;s.frame++;
        if(s.frame%90===0)s.pipes.push({x:W,gapY:80+Math.random()*(H-GAP-160),passed:false});
        s.pipes=s.pipes.filter(p=>p.x>-PW);
        let hit=false;
        s.pipes.forEach(p=>{
          p.x-=SPEED;
          ctx.fillStyle="#22c55e";
          ctx.fillRect(p.x,0,PW,p.gapY);
          ctx.fillRect(p.x,p.gapY+GAP,PW,H-p.gapY-GAP);
          if(BIRD_X+20>p.x&&BIRD_X<p.x+PW){if(s.y<p.gapY+5||s.y+20>p.gapY+GAP-5)hit=true;}
          if(!p.passed&&p.x+PW<BIRD_X){p.passed=true;s.score++;setScore(s.score);}
        });
        if(s.y<0||s.y>H-20)hit=true;
        if(hit){s.phase="over";setPhase("over");if(s.score>best){setBest(s.score);localStorage.setItem("flappy_best",String(s.score));}}
      }
      ctx.font="24px serif";ctx.fillText("🐟",BIRD_X,s.phase==="idle"?200:s.y+16);
      if(s.phase==="idle"){ctx.fillStyle="#fff";ctx.font="bold 20px sans-serif";ctx.textAlign="center";ctx.fillText("Tap to Start",W/2,H/2);ctx.textAlign="start";}
      if(s.phase==="over"){ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillText(`Score: ${s.score}`,W/2,H/2-20);ctx.font="16px sans-serif";ctx.fillText("Tap to retry",W/2,H/2+20);ctx.textAlign="start";}
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[best]);

  return(
    <div className="p-6 space-y-4 select-none pb-32">
      <div className="flex items-center gap-3">
        <Link href="/arcade" className="p-1.5 rounded-xl hover:bg-muted"><ChevronLeft className="w-5 h-5 text-muted-foreground"/></Link>
        <h1 className="text-lg font-bold text-foreground">Flappy Fish</h1>
        <div className="ml-auto flex gap-2 text-xs font-bold">
          <span className="bg-muted px-2 py-1 rounded-lg text-foreground">{score}</span>
          <span className="bg-muted px-2 py-1 rounded-lg text-muted-foreground">Best {best}</span>
        </div>
      </div>
      <div className="flex justify-center">
        <canvas ref={canvasRef} width={W} height={H} onClick={jump} onTouchStart={e=>{e.preventDefault();jump();}} className="rounded-2xl border border-border/40 shadow-soft" style={{touchAction:"manipulation",maxWidth:"100%"}}/>
      </div>
    </div>
  );
}
