'use client';
import {useEffect,useRef,type CSSProperties} from 'react';
import type {Theme} from '../lib/themes';

const GLYPHS='アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-*/=%#&_(),.;:?!';
const PETALS=[0,1,2,3,4,5,6,7,8,9,10,11];
const BUBBLES=[0,1,2,3,4,5,6,7,8,9,10,11,12,13];
const EMBERS=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
const PIXELS=[0,1,2,3,4,5,6,7,8,9];
const SPECKS=Array.from({length:22},(_,index)=>index);
const RINGS=[0,1,2];

export default function ThemeBackdrop({theme}:{theme:Theme}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(theme!=='matrix')return;
  const el=canvas.current;if(!el)return;
  const ctx=el.getContext('2d');if(!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size=16;let width=0,height=0,columns=0,drops:number[]=[];
  const setup=()=>{const dpr=Math.min(2,window.devicePixelRatio||1);width=window.innerWidth;height=window.innerHeight;el.width=Math.floor(width*dpr);el.height=Math.floor(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);columns=Math.ceil(width/size);drops=Array.from({length:columns},()=>Math.random()*height/size);};
  const draw=()=>{
   ctx.fillStyle='rgba(2,10,5,0.14)';ctx.fillRect(0,0,width,height);
   ctx.font='15px ui-monospace, SFMono-Regular, monospace';
   for(let column=0;column<columns;column+=1){
    const glyph=GLYPHS[Math.floor(Math.random()*GLYPHS.length)];
    const y=drops[column]*size;
    ctx.fillStyle=Math.random()>0.975?'#e6fff0':'#3dff8a';
    ctx.fillText(glyph,column*size,y);
    if(y>height&&Math.random()>0.975)drops[column]=0;
    drops[column]+=0.55+Math.random()*0.4;
   }
  };
  setup();
  if(reduced){draw();return;}
  const timer=setInterval(draw,60);
  window.addEventListener('resize',setup);
  return()=>{clearInterval(timer);window.removeEventListener('resize',setup);};
 },[theme]);
 return <div className={'theme-backdrop backdrop-'+theme} aria-hidden="true">
  {theme==='matrix'&&<canvas ref={canvas}/>}
  <div className="backdrop-aura"><i/><i/><i/></div>
  <div className="backdrop-mesh"/>
  <div className="backdrop-rings">{RINGS.map(index=><i key={index}/>)}</div>
  <div className="backdrop-specks">{SPECKS.map(index=><i key={index} style={{
   left:`${(index*37+7)%100}%`,
   top:`${(index*61+13)%100}%`,
   animationDelay:`-${(index*.73).toFixed(2)}s`,
   animationDuration:`${(9+(index%5)*2.6).toFixed(1)}s`,
   '--speck-size':`${1+(index%4)*.7}px`,
   '--speck-opacity':`${.22+(index%5)*.09}`,
  } as CSSProperties}/>)}</div>
  <div className="backdrop-grain"/>
  {theme==='anime'&&<div className="theme-petals">{PETALS.map(index=><i key={index}/>)}</div>}
  {theme==='ocean'&&<div className="theme-bubbles">{BUBBLES.map(index=><i key={index}/>)}</div>}
  {theme==='ember'&&<div className="theme-embers">{EMBERS.map(index=><i key={index}/>)}</div>}
  {theme==='arcade'&&<div className="theme-pixels">{PIXELS.map(index=><i key={index}/>)}</div>}
  {theme==='cosmos'&&<div className="theme-stars"/>}
  {theme==='sumi'&&<div className="theme-ink"/>}
  {theme==='ocean'&&<div className="theme-tide"/>}
  {theme==='ember'&&<div className="theme-heat"/>}
  {theme==='noir'&&<div className="theme-spotlight"/>}
  {theme==='light'&&<div className="theme-sunrays"/>}
  {theme==='retro'&&<div className="theme-neon-grid"/>}
 </div>;
}
