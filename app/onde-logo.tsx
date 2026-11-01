import {useId,type CSSProperties} from 'react';
const LETTERS=['o','n','d','e'];
// Each wave is revealed by a brush stroke drawn along its crest (a mask), so the
// skin's own fill colour stays untouched; the letters are wrapped to ride the
// swell and the word is read once. The motion itself lives in app/skins.css.
const CRESTS=['M-6 20C6 4 16 5 24.5 12S42 21 52 2','M-6 31C6 15 16 16 24.5 23S42 32 52 13'];
const WAVES=['M2 12C11 2 17 2 25 8s14 8 21-1c-5 13-13 16-22 10S10 8 2 17z','M2 23c8-9 14-9 22-3s15 8 22-1c-5 12-13 15-22 9S10 19 2 28z'];
export default function Logo(){
 const id='onde'+useId().replace(/[^\w-]/g,'');
 return <span className="logo">
  <span className="logo-rings" aria-hidden="true"><i/><i/><i/></span>
  <svg className="logo-mark" viewBox="0 0 48 32" aria-hidden="true">
   <defs>{CRESTS.map((crest,index)=><mask key={index} id={`${id}-crest-${index}`} maskUnits="userSpaceOnUse" x="-12" y="-8" width="72" height="48"><path className="logo-brush" d={crest} pathLength={1} fill="none" stroke="#fff" strokeWidth={22} strokeLinecap="round" strokeDasharray="1 2"/></mask>)}</defs>
   {WAVES.map((wave,index)=><path key={index} d={wave} mask={`url(#${id}-crest-${index})`}/>)}
  </svg>
  <span className="logo-word" role="img" aria-label="onde">{LETTERS.map((letter,index)=><span key={index} className="logo-letter" aria-hidden="true" style={{'--letter':index} as CSSProperties}>{letter}</span>)}</span>
  <span className="logo-period" aria-hidden="true">.</span>
 </span>;
}
