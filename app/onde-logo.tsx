import {useId,type CSSProperties} from 'react';
import type {Theme} from '../lib/themes';
const LETTERS=['o','n','d','e'];
// The Sombre mark: each wave is revealed by a brush stroke drawn along its
// crest (a mask), so the skin's own fill colour stays untouched.
const CRESTS=['M-6 20C6 4 16 5 24.5 12S42 21 52 2','M-6 31C6 15 16 16 24.5 23S42 32 52 13'];
const WAVES=['M2 12C11 2 17 2 25 8s14 8 21-1c-5 13-13 16-22 10S10 8 2 17z','M2 23c8-9 14-9 22-3s15 8 22-1c-5 12-13 15-22 9S10 19 2 28z'];
// Every other skin draws its own mark as lines (48×32), stroke by stroke in
// order, then gives it the skin's own flourish (app/skins.css, logo marks).
const MARKS:Partial<Record<Theme,readonly string[]>>={
 light:['M11 15a8 8 0 0 1 16 0','M19 3v2','M8 6l1.5 1.5','M30 6l-1.5 1.5','M3 22c6-5 11-5 16 0s11 5 16 0 9-4 11-3'],
 retro:['M8 21a16 16 0 0 1 32 0','M4 25h40','M9 29h30','M14 13h20'],
 matrix:['M4 7l9 9-9 9','M17 25h11','M31 18h4v-6h4v12h4v-6h3'],
 anime:['M22 3c2 8 5 11 13 13-8 2-11 5-13 13-2-8-5-11-13-13 8-2 11-5 13-13z','M40 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z'],
 blueprint:['M36 16a12 12 0 1 1-24 0a12 12 0 1 1 24 0','M24 1v30','M7 16h34','M30 10l-6 6'],
 noir:['M6 26a18 18 0 0 1 36 0','M24 26L11 12','M24 26L18 8','M24 26V7','M24 26L30 8','M24 26L37 12'],
 ocean:['M24 2c6 8 10 13 10 18a10 10 0 0 1-20 0c0-5 4-10 10-18z','M18 21c2 3 5 4 8 2'],
 cosmos:['M32 16a8 8 0 1 1-16 0a8 8 0 1 1 16 0','M5 23c-2-5 14-14 30-15 9-1 11 3 4 8','M14 23.5c9 1 22-4 27-9'],
 arcade:['M2 24h6v-6h6v-6h6v6h6v6h6v-6h6v-6h6'],
 sumi:['M31 4a13 13 0 1 0 10 11'],
 ember:['M24 30c-7 0-11-5-10-11 1-5 5-7 5-12 4 3 6 7 5 11 2-1 3-3 3-5 4 3 6 7 5 10-1 4-5 7-8 7z','M24 26c-2 0-4-2-3-5 1-2 2-3 2-5 2 2 4 4 3 7'],
 millennium:['M37 16a13 13 0 1 1-26 0a13 13 0 1 1 26 0','M27 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0','M15 11a10 10 0 0 1 6-5','M42 4l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z'],
 bureau:['M7 3h34v21H7z','M24 24v4','M17 29h14','M12 15c4-4 8-4 12 0s8 4 12 0'],
 comics:['M24 2l3.5 7.5 8-3.5-2 8.5 9 2.5-8 4.5 4.5 7.5-9-1.5-1.5 8.5-5-6.5-6 5.5-.5-8.5-9 .5 5.5-7-7.5-5.5 9-1.5-1-9 8 4.5z'],
 aura:['M28 2L12 18h10l-4 12 18-18H26l2-10z','M6 8l4 2','M42 22l-4-2','M8 26l4-3'],
};
// Letters are wrapped so each can ride the swell; the word is read once.
export default function Logo({theme}:{theme?:Theme}){
 const id='onde'+useId().replace(/[^\w-]/g,'');
 const lines=theme&&MARKS[theme];
 return <span className="logo">
  <span className="logo-rings" aria-hidden="true"><i/><i/><i/></span>
  {lines?<svg className={`logo-mark logo-mark-${theme}`} viewBox="0 0 48 32" aria-hidden="true">
   {lines.map((line,index)=><path key={index} className="logo-line" d={line} pathLength={1} style={{'--stroke':index} as CSSProperties}/>)}
  </svg>:<svg className="logo-mark" viewBox="0 0 48 32" aria-hidden="true">
   <defs>{CRESTS.map((crest,index)=><mask key={index} id={`${id}-crest-${index}`} maskUnits="userSpaceOnUse" x="-12" y="-8" width="72" height="48"><path className="logo-brush" d={crest} pathLength={1} fill="none" stroke="#fff" strokeWidth={22} strokeLinecap="round" strokeDasharray="1 2"/></mask>)}</defs>
   {WAVES.map((wave,index)=><path key={index} d={wave} mask={`url(#${id}-crest-${index})`}/>)}
  </svg>}
  <span className="logo-word" role="img" aria-label="onde">{LETTERS.map((letter,index)=><span key={index} className="logo-letter" aria-hidden="true" style={{'--letter':index} as CSSProperties}>{letter}</span>)}</span>
  <span className="logo-period" aria-hidden="true">.</span>
 </span>;
}
