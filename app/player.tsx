'use client';
import {useEffect,useRef,useState} from 'react';
import {Play,RotateCw,ExternalLink,Radio,Maximize2,PictureInPicture2,Volume2,Cast,ShieldAlert,Clock3,ChevronDown,Flag,Undo2} from 'lucide-react';
import type Hls from 'hls.js';
import TVCasting from './tv-casting';
import {useCasting} from './use-casting';
import {prefersNativeHls} from '../lib/native-casting';
import {languageLabel,type Channel} from '../lib/channels';
import type {Programme} from '../lib/guide';
import {matchesAudioLanguage} from '../lib/audio';
import {getChannelLogo} from '../lib/channel-logos';
import {defaultSources,hasPlayback,type PlaybackResult,type PlaybackSource} from '../lib/playback';
type Status='idle'|'resolving'|'loading'|'playing'|'embedded'|'paused'|'reconnecting'|'error';
type AudioOption={id:number;name:string;lang:string};
type NativeTrack={language:string;label:string;enabled:boolean};
type NativeVideo=HTMLVideoElement&{audioTracks?:{length:number;[key:number]:NativeTrack}};
function embedUrl(raw:string){const url=new URL(raw);if(url.hostname.includes('youtube.com')){url.searchParams.set('autoplay','1');url.searchParams.set('playsinline','1');url.searchParams.set('rel','0');}return url.toString();}
export default function Player({channel,active,onPlay,programmeTitle,programmes,now}:{channel:Channel;active:boolean;onPlay:()=>void;programmeTitle?:string;programmes?:Programme[];now?:number}){
 const siteHost=typeof window==='undefined'?'ce site':window.location.host;
 const [logoFailed,setLogoFailed]=useState(false);const channelLogo=getChannelLogo(channel);
 const video=useRef<NativeVideo>(null),hls=useRef<Hls|null>(null),container=useRef<HTMLDivElement>(null);
 const retries=useRef(0),preferredAudio=useRef(channel.language==='en'?'en':'fr');
 const [status,setStatus]=useState<Status>('idle'),[reload,setReload]=useState(0),[recovery,setRecovery]=useState(0);
 const [sources,setSources]=useState<PlaybackSource[]>(defaultSources(channel)),[sourceIndex,setSourceIndex]=useState(0);
 const [resolving,setResolving]=useState(false),[expiresAt,setExpiresAt]=useState<number>();
 const [pip,setPip]=useState(false),[playBlocked,setPlayBlocked]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState('');
 const [audioOptions,setAudioOptions]=useState<AudioOption[]>([]),[audioTrack,setAudioTrack]=useState(-1);
 const source=sources[sourceIndex];
 const casting=useCasting();
 const [tvOpen,setTvOpen]=useState(false);
 const onTelevision=casting.connected&&casting.mediaLoaded&&casting.channelId===channel.id;
 const remotePlayback=useRef(onTelevision);remotePlayback.current=onTelevision;
 useEffect(()=>{if(onTelevision)video.current?.pause();},[onTelevision,active,source?.url]);
 useEffect(()=>{setPip(!!document.pictureInPictureEnabled);},[]);
 useEffect(()=>{
  if(!active||!hasPlayback(channel))return;
  const controller=new AbortController();setFailure('');setPlayBlocked(false);setSourceIndex(0);setExpiresAt(undefined);retries.current=0;
  const fallback=defaultSources(channel);
  if(!channel.resolve){setSources(fallback);setStatus('loading');return;}
  if(fallback.length){setSources(fallback);setResolving(false);setStatus('loading');}else{setResolving(true);setStatus('resolving');setSources([]);}
  void fetch(`/api/playback?channel=${encodeURIComponent(channel.id)}`,{signal:controller.signal,cache:'no-store'})
   .then(async r=>{const result=await r.json() as PlaybackResult;if(!r.ok||!Array.isArray(result.sources)||!result.sources.length)throw new Error(result.message||'Le direct est indisponible.');return result;})
   .then(result=>{if(controller.signal.aborted)return;setSourceIndex(0);setSources(result.sources);setExpiresAt(result.expiresAt);})
   .catch(e=>{if(controller.signal.aborted)return;if(fallback.length){setSources(fallback);}else{setFailure(e instanceof Error?e.message:'Le diffuseur ne répond pas.');setStatus('error');}})
   .finally(()=>{if(!controller.signal.aborted)setResolving(false);});
  return()=>controller.abort();
 },[channel.id,channel.resolve,channel.stream,channel.embed,channel.youtube,active,reload]);
 useEffect(()=>{
  if(!active||!expiresAt)return;
  const delay=Math.max(30000,expiresAt-Date.now()-60000);
  const timeout=setTimeout(()=>setReload(x=>x+1),Math.min(delay,2147483647));return()=>clearTimeout(timeout);
 },[active,expiresAt]);
 useEffect(()=>{
  if(!active)return;
  const online=()=>{retries.current=0;setReload(x=>x+1);};
  window.addEventListener('online',online);return()=>window.removeEventListener('online',online);
 },[active]);
 useEffect(()=>{
  const el=video.current;
  if(!active||resolving||source?.kind!=='hls'||!el)return;
  let cancelled=false,scheduled=false,mediaRecovery=false;
  let retryTimer:ReturnType<typeof setTimeout>|undefined;
  let lastTime=-1,lastAdvance=Date.now(),healthySince=0;
  setStatus('loading');setPlayBlocked(false);setAudioOptions([]);setAudioTrack(-1);
  const reconnect=()=>{
   if(cancelled||scheduled)return;scheduled=true;
   hls.current?.stopLoad();
   if(retries.current<3){const delay=1000*2**retries.current++;setStatus('reconnecting');retryTimer=setTimeout(()=>{if(!cancelled)setRecovery(x=>x+1);},delay);}
   else if(sourceIndex+1<sources.length){retries.current=0;setSourceIndex(x=>x+1);}
   else{el.pause();setFailure('Le flux ne répond pas ou ne peut pas être lu dans ta région.');setStatus('error');}
  };
  const attempt=()=>{if(remotePlayback.current){setStatus('paused');return;}void el.play().catch(()=>{if(!cancelled&&!scheduled){setPlayBlocked(true);setStatus('paused');}});};
  const playing=()=>{if(cancelled||scheduled)return;setStatus('playing');setPlayBlocked(false);lastAdvance=Date.now();if(!healthySince)healthySince=Date.now();};
  const waiting=()=>{if(!cancelled&&!scheduled&&!el.paused)setStatus('loading');};
  const paused=()=>{if(!cancelled&&!scheduled){setStatus('paused');healthySince=0;}};
  const progress=()=>{if(cancelled||scheduled)return;if(el.currentTime>lastTime+.05){lastTime=el.currentTime;lastAdvance=Date.now();if(healthySince&&Date.now()-healthySince>60000)retries.current=0;}};
  const nativeAudio=()=>{const tracks=el.audioTracks;if(!tracks)return;const opts=Array.from({length:tracks.length},(_,i)=>({id:i,name:tracks[i].label||tracks[i].language||`Piste ${i+1}`,lang:tracks[i].language||''}));setAudioOptions(opts);const selected=opts.find(t=>matchesAudioLanguage(t,preferredAudio.current))?.id;if(selected!==undefined){for(let i=0;i<tracks.length;i++)tracks[i].enabled=i===selected;setAudioTrack(selected);}};
  el.addEventListener('playing',playing);el.addEventListener('waiting',waiting);el.addEventListener('pause',paused);el.addEventListener('timeupdate',progress);el.addEventListener('error',reconnect);el.addEventListener('loadedmetadata',nativeAudio);
  const watchdog=setInterval(()=>{
   if(cancelled||scheduled||document.hidden||playBlocked)return;
   if(el.paused&&el.readyState>=2)return;
   if(Date.now()-lastAdvance>25000){healthySince=0;reconnect();}
  },4000);
  if(prefersNativeHls(el)){el.src=source.url;attempt();}
  else void import('hls.js').then(({default:Hls})=>{
    if(cancelled)return;if(!Hls.isSupported()){if(el.canPlayType('application/vnd.apple.mpegurl')){el.src=source.url;attempt();return;}setFailure('Ce navigateur ne prend pas en charge ce flux vidéo. Essaie Chrome, Safari ou Edge.');setStatus('error');return;}
    const player=new Hls({enableWorker:true,backBufferLength:60,maxBufferLength:30,capLevelToPlayerSize:true,liveSyncDurationCount:3,liveMaxLatencyDurationCount:8,maxLiveSyncPlaybackRate:1.1});hls.current=player;
    player.on(Hls.Events.MANIFEST_PARSED,attempt);
    player.on(Hls.Events.AUDIO_TRACKS_UPDATED,()=>{
     if(cancelled)return;const opts=player.audioTracks.map((t,i)=>({id:i,name:t.name||t.lang||`Piste ${i+1}`,lang:t.lang||''}));setAudioOptions(opts);
     const preferred=opts.find(t=>matchesAudioLanguage(t,preferredAudio.current));if(preferred&&player.audioTrack!==preferred.id)player.audioTrack=preferred.id;
    });
    player.on(Hls.Events.AUDIO_TRACK_SWITCHED,(_e,data)=>{if(!cancelled)setAudioTrack(data.id);});
    player.on(Hls.Events.ERROR,(_event,data)=>{if(cancelled||!data.fatal)return;
     if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&!mediaRecovery){mediaRecovery=true;player.recoverMediaError();}else reconnect();
    });
    player.loadSource(source.url);player.attachMedia(el);
   }).catch(reconnect);
  return()=>{cancelled=true;clearInterval(watchdog);if(retryTimer)clearTimeout(retryTimer);el.removeEventListener('playing',playing);el.removeEventListener('waiting',waiting);el.removeEventListener('pause',paused);el.removeEventListener('timeupdate',progress);el.removeEventListener('error',reconnect);el.removeEventListener('loadedmetadata',nativeAudio);hls.current?.destroy();hls.current=null;el.pause();el.removeAttribute('src');el.load();};
 },[active,source?.url,source?.kind,sourceIndex,sources.length,resolving,recovery]);
 useEffect(()=>{if(active&&source?.kind==='embed'){setStatus('loading');setAudioOptions([]);}},[source?.url,source?.kind,active]);
 const retry=()=>{retries.current=0;setReload(x=>x+1);setRecovery(x=>x+1);};
 const alternate=()=>{retries.current=0;setSourceIndex(i=>(i+1)%sources.length);setFailure('');setPlayBlocked(false);};
 const fullscreen=async()=>{try{if(container.current?.requestFullscreen)await container.current.requestFullscreen();else setMessage('Utilise le plein écran du lecteur vidéo.');}catch{setMessage('Utilise le plein écran du lecteur vidéo.');}};
 useEffect(()=>{
  if(!active)return;
  const onKey=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement|null;
   if(target&&/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))return;
   if(event.key===' '){const el=video.current;if(!el)return;event.preventDefault();if(el.paused)void el.play().catch(()=>setPlayBlocked(true));else el.pause();}
   else if(event.key==='f'||event.key==='F'){event.preventDefault();void fullscreen();}
   else if(event.key==='m'||event.key==='M'){const el=video.current;if(el)el.muted=!el.muted;}
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[active,source?.kind]);
 const picture=async()=>{try{if(video.current&&video.current.readyState>=2)await video.current.requestPictureInPicture();else setMessage('Démarre la vidéo avant d’activer la mini-fenêtre.');}catch{setMessage('La mini-fenêtre n’est pas disponible pour cette vidéo.');}};
 const live=()=>{const el=video.current;if(!el)return;const position=hls.current?.liveSyncPosition;if(position!=null)el.currentTime=position;else if(el.seekable.length)el.currentTime=Math.max(el.seekable.start(0),el.seekable.end(el.seekable.length-1)-2);void el.play().catch(()=>setPlayBlocked(true));};
 const selectAudio=(id:number)=>{const selected=audioOptions.find(o=>o.id===id);if(selected)preferredAudio.current=selected.lang||selected.name;if(hls.current)hls.current.audioTrack=id;else if(video.current?.audioTracks){const tracks=video.current.audioTracks;for(let i=0;i<tracks.length;i++)tracks[i].enabled=i===id;}setAudioTrack(id);};
 const [reporting,setReporting]=useState(false);
 const reportKey=`onde-report:${channel.id}`;
 const [reported,setReported]=useState(()=>{if(typeof window==='undefined')return false;try{return localStorage.getItem(`onde-report:${channel.id}`)==='1';}catch{return false;}});
 const markReported=(value:boolean)=>{setReported(value);try{if(value)localStorage.setItem(reportKey,'1');else localStorage.removeItem(reportKey);}catch{}};
 const report=async()=>{setReporting(true);try{const res=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId:channel.id,reason:'flux indisponible'})});if(res.ok){markReported(true);setMessage('Merci, ton signalement est enregistré. Tu peux l’annuler avec le bouton Désignaler.');}else setMessage('Le signalement n’a pas pu être envoyé.');}catch{setMessage('Le signalement n’a pas pu être envoyé.');}finally{setReporting(false);}};
 const unreport=async()=>{setReporting(true);try{const res=await fetch('/api/report',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelId:channel.id})});if(res.ok){markReported(false);setMessage('Signalement annulé. Merci de nous avoir prévenus.');}else setMessage('Le signalement n’a pas pu être annulé.');}catch{setMessage('Le signalement n’a pas pu être annulé.');}finally{setReporting(false);}};
 const nextAudio=()=>{if(audioOptions.length<2)return;const index=audioOptions.findIndex(o=>o.id===audioTrack);selectAudio(audioOptions[(index+1)%audioOptions.length].id);};
 const [scheduleOpen,setScheduleOpen]=useState(true);
 useEffect(()=>{try{if(localStorage.getItem('onde-schedule-open')==='0')setScheduleOpen(false);}catch{}},[]);
 const toggleSchedule=()=>setScheduleOpen(open=>{const next=!open;try{localStorage.setItem('onde-schedule-open',next?'1':'0');}catch{}return next;});
 const playable=hasPlayback(channel);
 // Channels flagged `insecureStream` play over plain http: browsers block
 // that on this HTTPS app until the viewer allows insecure content for
 // the site, so the player explains it up front (see the panel below)
 // instead of failing silently. Once the setting is allowed, playback
 // takes the normal path and the panel disappears on 'playing'.
 const insecureStream=channel.insecureStream===true;
 const scheduleNow=now||Date.now();
 const schedule=(programmes||[]).filter(programme=>!programme.end||Date.parse(programme.end)>scheduleNow).slice(0,4);
 return <div className="player-shell" ref={container}>
  <div className="player-screen">
   {active&&playable?<>
    {source?.kind==='hls'&&<video ref={video} controls playsInline disableRemotePlayback={false} x-webkit-airplay="allow" aria-label={`Direct de ${channel.name}`} />}
    {source?.kind==='embed'&&!onTelevision&&<iframe key={source.url+reload} src={embedUrl(source.url)} title={`Lecteur officiel de ${channel.name}`} allow="autoplay; fullscreen; picture-in-picture; encrypted-media; presentation; remote-playback" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={()=>setStatus('embedded')} onError={()=>{setFailure('Le lecteur du diffuseur ne répond pas.');setStatus('error');}}/>}
    {(resolving||(!source&&status!=='error'))&&<div className="player-resolving"><span className="spinner"/><p>Ouverture du direct dans Onde…</p></div>}
    {source?.kind==='hls'&&!onTelevision&&(status==='loading'||status==='reconnecting')&&<div className="video-loading" role="status"><span className="spinner"/>{status==='reconnecting'?'Reconnexion au direct…':'Connexion au direct…'}</div>}
    {onTelevision&&<div className="tv-playing-overlay"><Cast size={38}/><h3>Lecture sur {casting.deviceName}</h3><p>{channel.name}</p><button className="secondary" onClick={()=>setTvOpen(true)}>Gérer la diffusion</button></div>}
    {playBlocked&&!onTelevision&&status!=='error'&&<button className="video-start" onClick={()=>{setPlayBlocked(false);void video.current?.play().catch(()=>setPlayBlocked(true));}}><Play size={22} fill="currentColor"/>Démarrer la vidéo</button>}
    {status==='error'&&!onTelevision&&!insecureStream&&<div className="video-error"><Radio size={32}/><h3>Direct momentanément indisponible</h3><p>{failure||'Le diffuseur ne répond pas pour le moment.'}</p><div className="button-row"><button className="primary" onClick={retry}><RotateCw size={16}/>Réessayer ici</button>{sources.length>1&&<button className="secondary" onClick={alternate}>Autre lecteur intégré</button>}</div><small>La lecture reste dans Onde.</small></div>}
    {insecureStream&&!onTelevision&&status!=='playing'&&status!=='embedded'&&<div className="video-error insecure-stream-panel"><ShieldAlert size={30}/><h3>Chaîne en HTTP seulement</h3><p>Ton navigateur bloque ce type de flux par défaut sur un site sécurisé. Pour la regarder : Chrome → menu ⋮ → Paramètres → Confidentialité et sécurité → Paramètres de site → {siteHost} → « Contenu non sécurisé » → Autoriser, puis reviens ici et réessaie. Sur iPhone/Safari, ce réglage n'existe pas.</p><div className="button-row"><button className="primary" onClick={retry}><RotateCw size={16}/>Réessayer la lecture</button></div><small>Si tu as déjà autorisé le contenu non sécurisé pour Onde, la lecture démarre normalement.</small></div>}
   </>:<div className={`player-cover cover-${channel.id}`}>
    <div className="cover-art" aria-hidden="true"><div className="ring ring-one"/><div className="ring ring-two"/><div className="ring ring-three"/><span className="art-star star-one">✳</span><span className="art-star star-two">✧</span><div className={`cover-wordmark ${Math.max(...channel.brand.split('\n').map(x=>x.length))>8?'cover-compact':''}`} style={{color:channel.color}}>{channel.brand.split('\n').map((x,i)=><span key={i}>{x}</span>)}</div></div>
    <div className="cover-top"><span className="broadcast-label"><span/>{playable?'À REGARDER ICI, DANS ONDE':'LECTURE INTÉGRÉE NON DISPONIBLE'}</span><span className="cover-region">{channel.region} · {languageLabel(channel)}</span></div>
    <div className="cover-content"><span className="eyebrow">{channel.category}</span><h2>{channel.id==='savoir'?<>La curiosité<br/>fait du bien.</>:channel.name}</h2><p>{channel.description}</p>{playable?<button className="primary" onClick={onPlay}><Play size={17} fill="currentColor"/>Regarder ici</button>:<span className="unavailable-playback">Ce diffuseur exige son propre service.</span>}</div>
    <div className="cover-caption">{playable?'Votre chaîne. Votre lecteur. Sans quitter Onde.':'Aucun lecteur compatible n’a pu être confirmé pour cette chaîne.'}</div>
   </div>}
  </div>
  <div className="player-toolbar"><div className="player-label">{channelLogo&&!logoFailed&&<span className="player-channel-logo"><img src={channelLogo} alt="" onError={()=>setLogoFailed(true)}/></span>}<span className="player-channel-copy"><strong>{channel.name}</strong>{programmeTitle&&<span>{programmeTitle}</span>}</span></div><div className="player-quick-options">{active&&source?.kind==='hls'&&<><button className="quick-option" onClick={live} title="Revenir au direct" aria-label="Revenir au direct"><span className="tiny-dot"/></button>{audioOptions.length>1&&<button className="quick-option" onClick={nextAudio} title="Changer la piste audio" aria-label="Changer la piste audio"><Volume2 size={17}/></button>}{pip&&<button className="quick-option" onClick={()=>void picture()} title="Mini-fenêtre" aria-label="Ouvrir la mini-fenêtre"><PictureInPicture2 size={17}/></button>}<button className="quick-option" onClick={()=>void fullscreen()} title="Plein écran" aria-label="Passer en plein écran"><Maximize2 size={17}/></button></>}{active&&sources.length>1&&<button className="quick-option" onClick={alternate} title="Changer de lecteur" aria-label="Changer de lecteur"><RotateCw size={16}/></button>}<a className="quick-option quick-optional" href={channel.official} target="_blank" rel="noopener noreferrer" title="Site officiel" aria-label={'Ouvrir le site officiel de '+channel.name}><ExternalLink size={16}/></a>{active&&<button className={`quick-option report-option ${reported?'is-reported':''}`} onClick={()=>void (reported?unreport():report())} disabled={reporting} title={reported?'Annuler le signalement':'Signaler un problème'} aria-label={reported?'Annuler le signalement':'Signaler un problème'} aria-pressed={reported}>{reported?<Undo2 size={16}/>:<Flag size={16}/>}</button>}</div><div className="toolbar-actions"><button className={`tv-cast-button ${casting.connected?'tv-cast-connected':''}`} onClick={()=>setTvOpen(true)} aria-label="Diffuser sur une télé" title="Diffuser sur une télé"><Cast size={18}/><span>Sur ma télé</span></button></div></div>
  {active&&source?.kind==='embed'&&<div className="embed-controls"><span>Lecteur officiel intégré{channel.limited?' · Restrictions de région possibles':''}</span><button onClick={retry}><RotateCw size={12}/>Recharger ici</button></div>}
  <TVCasting channel={channel} source={source} sources={sources} active={active} video={video} open={tvOpen} onClose={()=>setTvOpen(false)} onOpen={()=>setTvOpen(true)} onPlay={onPlay}/>
  {schedule.length>0&&<section className="player-schedule" aria-label={'Horaire de '+channel.name}><div className="player-schedule-head"><Clock3 size={13}/><span>Horaire</span><button className="player-schedule-toggle" onClick={toggleSchedule} aria-expanded={scheduleOpen} aria-label={scheduleOpen?'Masquer l’horaire':'Afficher l’horaire'} title={scheduleOpen?'Masquer l’horaire':'Afficher l’horaire'}><ChevronDown size={14} className={scheduleOpen?'':'is-closed'}/></button></div>{scheduleOpen&&<ol>{schedule.map(programme=>{const live=Date.parse(programme.start)<=scheduleNow&&(!programme.end||Date.parse(programme.end)>scheduleNow);return <li key={programme.start} className={live?'is-live':''}><span className="player-schedule-time">{new Date(programme.start).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})}</span><span className="player-schedule-title">{programme.title}</span>{live&&<span className="player-schedule-live">En ce moment</span>}</li>;})}</ol>}</section>}{message&&<p role="status" className="player-note">{message}</p>}
 </div>;
}
