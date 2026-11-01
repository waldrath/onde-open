'use client';
import {useEffect,useState} from 'react';
// Ambient motion (skin backdrops, a personal animated GIF) rests while it
// would only spend battery: when a video plays — the eye is on the video —
// and when the device saves power (battery at 20% or less and not charging,
// or the browser's data saver).
type BatteryManager=EventTarget&{level:number;charging:boolean};
type PowerNavigator=Navigator&{getBattery?:()=>Promise<BatteryManager>;connection?:{saveData?:boolean}};
const videoPlaying=()=>Array.from(document.querySelectorAll('video')).some(video=>!video.paused&&!video.ended&&video.readyState>2);
export function useAmbientRest(){
 const [playing,setPlaying]=useState(false),[saving,setSaving]=useState(false);
 useEffect(()=>{
  // Media events do not bubble: listen in the capture phase for every <video>.
  const update=()=>setPlaying(videoPlaying());
  const events=['playing','pause','ended','emptied','waiting'] as const;
  for(const name of events)document.addEventListener(name,update,true);
  const nav=navigator as PowerNavigator;
  let battery:BatteryManager|null=null;
  const power=()=>setSaving(!!nav.connection?.saveData||!!battery&&battery.level<=.2&&!battery.charging);
  power();
  void nav.getBattery?.().then(manager=>{battery=manager;power();manager.addEventListener('levelchange',power);manager.addEventListener('chargingchange',power);}).catch(()=>{});
  return()=>{for(const name of events)document.removeEventListener(name,update,true);battery?.removeEventListener('levelchange',power);battery?.removeEventListener('chargingchange',power);};
 },[]);
 return playing||saving;
}
