'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {Airplay,Cast,Check,ExternalLink,MonitorSmartphone,Pause,Play,RotateCw,Square,Volume2,Wifi,X} from 'lucide-react';
import type {Channel} from '../lib/channels';
import type {PlaybackSource} from '../lib/playback';
import {castManager,selectCastSource} from '../lib/casting';
import {canUseNativeRemote,showNativeRemote,type WirelessVideo} from '../lib/native-casting';
import {useCasting} from './use-casting';
type Props={channel:Channel;source?:PlaybackSource;sources:PlaybackSource[];active:boolean;video:RefObject<HTMLVideoElement|null>;open:boolean;onClose:()=>void;onOpen:()=>void;onPlay:()=>void};
export default function TVCasting({channel,source,sources,active,video,open,onClose,onOpen,onPlay}:Props){
 const casting=useCasting(),dialog=useRef<HTMLDialogElement>(null);
 const [nativeSupported,setNativeSupported]=useState(false),[airplay,setAirplay]=useState(false),[wireless,setWireless]=useState(false),[nativeAvailable,setNativeAvailable]=useState<boolean|null>(null),[notice,setNotice]=useState('');
 const [mirrorDevice,setMirrorDevice]=useState('android');
 const direct=active&&source?.kind==='hls';
 const castSource=active?selectCastSource(sources,source):undefined;
 const sameChannel=casting.connected&&casting.mediaLoaded&&casting.channelId===channel.id;
 useEffect(()=>{void castManager.initialize();},[]);
 useEffect(()=>{if(open){dialog.current?.showModal();setNotice('');}else dialog.current?.close();},[open]);
 useEffect(()=>{
  const el=video.current as WirelessVideo|null;
  setNativeSupported(!!el&&canUseNativeRemote(el));setAirplay(!!el?.webkitShowPlaybackTargetPicker);setNativeAvailable(null);setWireless(false);
  if(!el||!direct)return;
  const changed=()=>{setNativeSupported(canUseNativeRemote(el));setWireless(!!el.webkitCurrentPlaybackTargetIsWireless||el.remote?.state==='connected');};
  const available=(event:Event)=>setNativeAvailable((event as Event&{availability?:string}).availability==='available');
  el.addEventListener('loadedmetadata',changed);el.addEventListener('webkitcurrentplaybacktargetiswirelesschanged',changed);el.addEventListener('webkitplaybacktargetavailabilitychanged',available);
  el.remote?.addEventListener('connect',changed);el.remote?.addEventListener('disconnect',changed);changed();
  return()=>{el.removeEventListener('loadedmetadata',changed);el.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged',changed);el.removeEventListener('webkitplaybacktargetavailabilitychanged',available);el.remote?.removeEventListener('connect',changed);el.remote?.removeEventListener('disconnect',changed);};
 },[active,source?.url,source?.kind,video,direct]);
 async function project(){
  if(!castSource)return;
  setNotice('');try{const loaded=await castManager.cast(castSource,channel);if(loaded)video.current?.pause();}catch{/* The manager displays a useful receiver error; local playback continues. */}
 }
 function nativeProject(){
  const el=video.current as WirelessVideo|null;if(!el)return;setNotice('');
  void showNativeRemote(el).catch(error=>{if((error as {name?:string}).name==='NotAllowedError')return;setNotice('Aucun écran compatible n’a pu être sélectionné. Vérifiez le Wi-Fi et les réglages de la télé.');});
 }
 function resumeHere(){castManager.stop();void video.current?.play().catch(()=>setNotice('Appuyez sur Lecture dans le lecteur pour reprendre ici.'));}
 return <>
  {(casting.connected||wireless)&&<div className="cast-session-strip" role="status"><Cast size={17}/><span>{casting.connected?<><strong>{casting.mediaName||'Google Cast'}</strong><small>{casting.mediaLoaded?`Sur ${casting.deviceName}`:`Connecté à ${casting.deviceName}`}</small></>:<><strong>{channel.name}</strong><small>Diffusion {airplay?'AirPlay':'sur un écran'} en cours</small></>}</span><button onClick={onOpen}>Gérer la diffusion</button></div>}
  <dialog ref={dialog} className="modal tv-modal" aria-labelledby="tv-casting-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-body">
   <button className="modal-close icon-button" onClick={onClose} aria-label="Fermer les options de diffusion"><X size={22}/></button>
   <h2 id="tv-casting-title"><Cast size={25}/>Sur ma télé</h2>
   <p className="tv-intro"><Wifi size={17}/>Même Wi-Fi pour les deux appareils.</p>
   {!active?<div className="tv-start"><p>Lancez {channel.name} pour choisir une télé.</p><button className="primary" onClick={onPlay}><Play size={16}/>Lancer la chaîne</button></div>:!direct?<div className="tv-embedded-note"><p>{castSource?'Choisissez une télé ci-dessous.':'Utilisez le bouton Cast ou AirPlay dans la vidéo, ou recopiez votre écran.'}</p></div>:null}
   {casting.connected&&<section className="tv-connected"><div className="tv-connected-title"><Check size={18}/><div><strong>{casting.deviceName}</strong><span>{casting.mediaName||'Aucune chaîne chargée'}</span></div></div>
    {casting.mediaLoaded&&<><div className="button-row"><button className="secondary" onClick={castManager.togglePause}>{casting.paused?<Play size={15}/>:<Pause size={15}/>} {casting.paused?'Reprendre sur la télé':'Mettre la télé en pause'}</button>{sameChannel&&<button className="secondary" onClick={resumeHere}><MonitorSmartphone size={15}/>Reprendre ici</button>}</div><label className="tv-volume"><Volume2 size={17}/><span>Volume de la télé</span><input aria-label="Volume de la télé" type="range" min="0" max="1" step="0.05" value={casting.volume} onChange={e=>castManager.setVolume(Number(e.target.value))}/></label></>}
    <button className="text-button" onClick={castManager.stop}><Square size={13}/>Arrêter la diffusion Google Cast</button>
   </section>}
   {(castSource||direct)&&<div className="tv-methods">{castSource&&<section className="tv-method"><Cast size={25}/><div><h3>Chromecast et Google TV</h3>
    <button className="primary" disabled={casting.phase!=='ready'||casting.busy} onClick={()=>void project()}><Cast size={16}/>{casting.busy?'Connexion à la télé…':sameChannel?'Relancer sur la télé':casting.connected?'Diffuser cette chaîne':'Choisir une télé'}</button>
    <p className="tv-method-status" role="status">{casting.phase==='loading'?'Préparation de Google Cast…':casting.phase==='unavailable'?casting.error:casting.phase==='ready'&&!casting.available?'Allumez votre télé et vérifiez le Wi-Fi.':'Avec Chrome sur Android ou ordinateur.'}</p>
    {casting.phase==='unavailable'&&<button className="text-button" onClick={()=>void castManager.initialize()}><RotateCw size={13}/>Réessayer la détection</button>}
   </div></section>}
   {direct&&<section className="tv-method"><Airplay size={25}/><div><h3>AirPlay et écrans compatibles</h3>{nativeSupported?<><button className="secondary" onClick={nativeProject}><Airplay size={16}/>{wireless?'Gérer l’écran connecté':airplay?'Choisir un écran AirPlay':'Choisir un écran'}</button>{nativeAvailable===false&&<p className="tv-method-status">Aucun écran AirPlay détecté pour le moment.</p>}</>:<p className="tv-method-status">Disponible dans Safari sur iPhone, iPad et Mac.</p>}</div></section>}</div>}
   {(notice||casting.error&&casting.phase==='ready')&&<p className="tv-error" role="alert">{notice||casting.error}</p>}
   <details className="tv-mirror"><summary><MonitorSmartphone size={18}/>Autres façons de diffuser</summary><div className="tv-mirror-content"><label className="field-label">Votre appareil<select value={mirrorDevice} onChange={e=>setMirrorDevice(e.target.value)}><option value="android">Android</option><option value="samsung">Samsung Galaxy</option><option value="apple">iPhone ou iPad</option><option value="computer">Ordinateur avec Chrome</option></select></label>
    {mirrorDevice==='android'&&<p>Dans <strong>Google Home</strong>, choisissez votre télé, puis la recopie d’écran.</p>}
    {mirrorDevice==='samsung'&&<p>Ouvrez les réglages rapides, puis <strong>Smart View</strong>. Choisissez votre télé.</p>}
    {mirrorDevice==='apple'&&<p>Ouvrez le Centre de contrôle, puis <strong>Recopie de l’écran</strong>. Choisissez votre télé AirPlay.</p>}
    {mirrorDevice==='computer'&&<p>Dans le menu ⋮ de Chrome, choisissez <strong>Caster, enregistrer et partager</strong>, puis <strong>Caster</strong>.</p>}
    <p className="tv-compatibility">La compatibilité dépend de la télé et du diffuseur.</p>
    <div className="tv-help-links"><a href="https://support.google.com/chromecast/answer/3228332?hl=fr" target="_blank" rel="noopener noreferrer">Aide Google Cast<ExternalLink size={12}/></a><a href="https://support.apple.com/fr-ca/102661" target="_blank" rel="noopener noreferrer">Aide AirPlay<ExternalLink size={12}/></a></div>
   </div></details>
  </div></dialog>
 </>;
}
