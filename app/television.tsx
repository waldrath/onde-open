'use client';
import { makeId } from '../lib/identifiers';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Radio, Home, Heart, CalendarDays, ListVideo, Search, Plus, ArrowUpRight, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, CloudCheck, CloudOff, RefreshCw, X, Check, MonitorSmartphone, Info, Play, SlidersHorizontal, ExternalLink, MoreHorizontal, Trash2, Pencil, Globe2, Wifi, Menu, Clock3, Newspaper, Film, Music, Baby, UserRound, Sun, Moon, CircleHelp, Sparkles, Settings, BellRing } from 'lucide-react';
import { languageLabel, isPremiumChannel, expandChannel, type Channel } from '../lib/channel-utils';
import { getChannelLogo } from '../lib/channel-logos';
import type {ClientCatalogue} from '../lib/catalogue-maintenance';
import type { Guide, Programme } from '../lib/guide';
import type { ChannelList } from '../lib/preferences';
import { usePreferences } from './use-preferences';
import Player from './player';
import Logo from './onde-logo';
import {useLocale} from './locale-provider';
import SettingsPanel from './settings-panel';
import GuideExplorer from './guide-explorer';
import {CategoryIcon,discoveryCategories,categoryGroup} from './category-icon';
import {MultiSelect} from './multi-select';
import {discoverChannels} from '../lib/discover';
import {rememberChannel,type RecentChannel} from '../lib/recent';
import {isTheme,type Theme} from '../lib/themes';
import {defaultSettings,readSettings,writeSettings,type DeviceSettings} from '../lib/settings';
import ThemeBackdrop from './theme-backdrop';
import CustomWallpaper from './custom-wallpaper';
import {useWallpaper} from './use-wallpaper';
import {useAmbientRest} from './use-ambient-rest';
import {selection,curateSelection,weekStart} from '../lib/selection';
import { hasPlayback } from '../lib/playback';
import {prefersNativeHls} from '../lib/native-casting';
import {parseReliability,reliabilityOf,type ReliabilityCounts} from '../lib/reliability';
import {dueReminders,nextReminderDelay,reminderKey,type Reminder} from '../lib/reminders';
import {useReminders} from './use-reminders';
import {zapTarget} from '../lib/zap';
import ReminderToggle from './reminder-toggle';
import {detectViewerCountry,isLikelyGeoBlocked,viewerCountryLabel,type ViewerCountry} from '../lib/geo';
type View='home'|'channels'|'favorites'|'guide'|'selection'|'lists';
const pageOrder:View[]=['home','channels','favorites','guide','selection'];
// Page swap: only the incoming page moves, 28 px and a fade over 260 ms. The
// mini player (fixed, inside #contenu) and the bars outside it never move.
const SWAP_SHIFT=28,SWAP_MS=260,SWAP_EASING='cubic-bezier(.22,.8,.24,1)';
// Region filter, grouped by continent; a country appears once it has channels.
const REGION_GROUPS=[['Amérique du Nord',['Québec','Canada','USA','Haïti']],['Europe',['France','Belgique','Suisse','Luxembourg','Monaco','Suède']],['Afrique',['Cameroun','Sénégal',"Côte d'Ivoire",'RD Congo','Maroc','Algérie','Tunisie','Togo','Bénin','Congo','Burkina Faso','Guinée','Niger','Mali','Rwanda','Burundi','Tchad','Gabon','Madagascar']],['Outre-mer',['Outre-mer']]] as const;
const navigation=[{id:'home',label:'Accueil',icon:Home},{id:'channels',label:'Chaînes',icon:Radio},{id:'favorites',label:'Favoris',icon:Heart},{id:'guide',label:'Programme',icon:CalendarDays},{id:'selection',label:'Sélection',icon:Sparkles}] as const;
// The catalogue arrives from the server component (see app/page.tsx). These
// placeholders keep the shell renderable while it is still loading.
const NO_CHANNELS:Channel[]=[];
const FALLBACK_CHANNEL:Channel={id:'savoir',name:'Onde',brand:'Onde',region:'Québec',category:'Général',color:'#d0ec9c',description:'',official:'/',guide:'/'};

function Brand({channel,small=false}:{channel:Channel;small?:boolean}){const [failedLogo,setFailedLogo]=useState<string|null>(null);const logo=getChannelLogo(channel);return <span className={`brand ${logo&&logo!==failedLogo?'brand-has-logo':''} ${logo&&logo!==failedLogo&&/(?:white|light)/i.test(logo)?'brand-logo-dark':''} ${small?'brand-small':''} ${!small&&Math.max(...channel.brand.split('\n').map(x=>x.length))>12?'brand-dense':!small&&Math.max(...channel.brand.split('\n').map(x=>x.length))>8?'brand-compact':''} brand-${channel.id}`} style={{'--brand-color':channel.color} as React.CSSProperties}>{logo&&logo!==failedLogo?<img className="channel-logo" src={logo} alt="" loading="lazy" decoding="async" onError={()=>setFailedLogo(logo)}/>:channel.brand.split('\n').map((line,i)=><span key={i}>{line}</span>)}</span>;}
// Accent- and case-insensitive search key, computed once per channel (see searchIndex).
const fold=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const prefersReducedMotion=()=>document.documentElement.dataset.motion==='reduced'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function currentProgramme(programmes:Programme[],now:number){return programmes.find(p=>Date.parse(p.start)<=now&&p.end&&Date.parse(p.end)>now);}
function HomeCarousel({title,action,actionLabel,trackClass,children}:{title:string;action?:()=>void;actionLabel?:string;trackClass:string;children:ReactNode}){
 const {t}=useLocale();
 const ref=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({previous:false,next:false});
 useEffect(()=>{const el=ref.current;if(!el)return;const update=()=>setEdges({previous:el.scrollLeft>1,next:el.scrollLeft+el.clientWidth<el.scrollWidth-1});update();const observer=new ResizeObserver(update);observer.observe(el);for(const child of Array.from(el.children))observer.observe(child);el.addEventListener('scroll',update,{passive:true});return()=>{observer.disconnect();el.removeEventListener('scroll',update);};},[children]);
 const move=(direction:number)=>{const el=ref.current;if(el)el.scrollBy({left:direction*el.clientWidth*.8,behavior:prefersReducedMotion()?'auto':'smooth'});};
 return <><div className="home-section-heading"><h2>{t(title)}</h2><div className="home-carousel-controls">{action&&<button className="home-carousel-all" onClick={action}>{t(actionLabel||'Tout voir')} <ChevronRight size={18}/></button>}<button className="home-carousel-arrow" aria-label={t('Faire défiler {title} vers la gauche',{title:t(title)})} disabled={!edges.previous} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><button className="home-carousel-arrow" aria-label={t('Faire défiler {title} vers la droite',{title:t(title)})} disabled={!edges.next} onClick={()=>move(1)}><ChevronRight size={18}/></button></div></div><div className={trackClass} ref={ref} tabIndex={0} role="group" aria-label={t(title)} data-previous={edges.previous?'true':'false'} data-next={edges.next?'true':'false'}>{children}</div></>;
}
export default function Television({userId,account=null,initialTheme='dark',initialCatalogue=null}:{userId:string|null;account?:{name:string|null;email:string}|null;initialTheme?:Theme;initialCatalogue?:ClientCatalogue|null}){
 const signedIn=!!userId;
 const {locale,t}=useLocale();
 const localeTag=locale==='fr'?'fr-CA':'en-CA';
 const time=(value:string)=>new Date(value).toLocaleTimeString(localeTag,{hour:'2-digit',minute:'2-digit'});
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [theme,setTheme]=useState<Theme>(initialTheme);
 // A personal background for this skin replaces its animated backdrop (see app/custom-wallpaper.tsx).
 const wallpaper=useWallpaper(theme),resting=useAmbientRest();
 const [settings,setSettings]=useState<DeviceSettings>(defaultSettings);
 useEffect(()=>{try{setSettings(readSettings(localStorage));}catch{}},[]);
 const updateSettings=(patch:Partial<DeviceSettings>)=>{const next={...settings,...patch};setSettings(next);try{writeSettings(localStorage,next);}catch{}};
 useEffect(()=>{const root=document.documentElement;if(settings.motion==='reduced')root.dataset.motion='reduced';else delete root.dataset.motion;},[settings.motion]);
 const rememberTheme=(next:Theme)=>{try{localStorage.setItem('onde-theme',next);document.cookie=`onde-theme=${next};path=/;max-age=31536000;SameSite=Lax${location.protocol==='https:'?';Secure':''}`;}catch{}};
 useEffect(()=>{try{const saved=localStorage.getItem('onde-theme');if(isTheme(saved)){setTheme(saved);rememberTheme(saved);}}catch{}},[]);
 const chooseTheme=(next:Theme)=>{setTheme(next);rememberTheme(next);};
 useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
 const [catalogue,setCatalogue]=useState<ClientCatalogue|null>(initialCatalogue),[catalogueRefreshing,setCatalogueRefreshing]=useState(false),[catalogueError,setCatalogueError]=useState(false);
 const allChannels=useMemo(()=>catalogue?catalogue.channels.map(expandChannel):NO_CHANNELS,[catalogue]);
 // Success rates of real playback (see lib/reliability.ts), fetched once the page has settled.
 const [reliability,setReliability]=useState<Record<string,ReliabilityCounts>>({});
 useEffect(()=>{const controller=new AbortController();const id=setTimeout(()=>{void fetch('/api/reliability',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(payload=>setReliability(parseReliability(payload))).catch(()=>{});},1500);return()=>{clearTimeout(id);controller.abort();};},[]);
 const [viewerCountry,setViewerCountry]=useState<ViewerCountry>('XX');
 const [showGeoBlocked,setShowGeoBlocked]=useState(false);
 useEffect(()=>{setViewerCountry(detectViewerCountry());},[]);
 // Some streams only play through Safari's own HLS player (their host refuses
 // other sites' requests): those channels are listed in Safari only.
 const [nativeHls,setNativeHls]=useState(false);
 // A Safari the server did not recognise got the lean catalogue: fetch the full one right away.
 useEffect(()=>{const native=prefersNativeHls(document.createElement('video'));setNativeHls(native);if(native&&initialCatalogue?.nativeOnlyIds?.length)void loadCatalogue();},[]);
 const channels=useMemo(()=>allChannels.filter(c=>(showGeoBlocked||!isLikelyGeoBlocked(c,viewerCountry))&&(nativeHls||!c.nativeHlsOnly)),[allChannels,viewerCountry,showGeoBlocked,nativeHls]);
 // Lookups run for every card on every render: index the ~2 300 channels once
 // instead of scanning the array (and re-folding their text) each time.
 const channelIndex=useMemo(()=>new Map(channels.map(c=>[c.id,c])),[channels]);
 const catalogueRegions=useMemo(()=>new Set<string>(channels.map(c=>c.region)),[channels]);
 // Built on the first search rather than at mount: folding every channel costs
 // more than the first paint can afford, and most visits never search.
 const searchIndex=useMemo(()=>{let index:Map<string,{name:string;short:string;full:string}>|undefined;return {get:(id:string)=>(index??=new Map(channels.map(c=>[c.id,{name:fold(c.name),short:fold([c.name,c.category,c.region].join(' ')),full:fold([c.name,c.category,c.region,languageLabel(c),c.description].join(' '))}]))).get(id)};},[channels]);
 const recentIds=useMemo(()=>new Set(catalogue?.recentIds),[catalogue]);
 const channelById=(id:string)=>channelIndex.get(id);
 const isNew=(id:string)=>recentIds.has(id);
 const newCount=useMemo(()=>channels.filter(c=>recentIds.has(c.id)).length,[channels,recentIds]);
 const suspectCount=useMemo(()=>channels.filter(c=>catalogue?.health[c.id]?.state==='suspect').length,[channels,catalogue]);
 const categories=useMemo(()=>discoveryCategories(channels),[channels]);
 const {data,status,error,mutate,refresh}=usePreferences(userId,allChannels);
 const favoriteIds=useMemo(()=>new Set(data.favorites),[data.favorites]);
 async function loadCatalogue(){setCatalogueRefreshing(true);try{const r=await fetch('/api/catalogue?view=client'+(prefersNativeHls(document.createElement('video'))?'':'&native=0'),{cache:'no-cache'});if(!r.ok)throw new Error();const data=await r.json() as ClientCatalogue;if(!Array.isArray(data.channels)||!data.health||!Array.isArray(data.recentIds))throw new Error();setCatalogue(data);setCatalogueError(false);}catch{setCatalogueError(true);}finally{setCatalogueRefreshing(false);}}
 const catalogueLoaded=useRef(!!initialCatalogue);
 useEffect(()=>{const mountedAt=Date.now();if(!catalogueLoaded.current)void loadCatalogue();const update=()=>{if(!document.hidden&&Date.now()-mountedAt>60000)void loadCatalogue();};const timer=setInterval(update,300000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[]);
 const [view,setView]=useState<View>('home'),[showPlayer,setShowPlayer]=useState(false),[regions,setRegions]=useState<string[]>([]),[categoriesChosen,setCategoriesChosen]=useState<string[]>([]),[premiumOnly,setPremiumOnly]=useState(false),[previewListId,setPreviewListId]=useState<string|null>(null);
 const [playbackOnly,setPlaybackOnly]=useState(true),[languages,setLanguages]=useState<string[]>([]),[newOnly,setNewOnly]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
 const [visibleCount,setVisibleCount]=useState(48);
 // A page swap onto a channel grid renders its first 12 cards only (they fill
 // the screen); the rest follow once the slide is over, so the tap answers at once.
 const [gridWarm,setGridWarm]=useState(true);
 useEffect(()=>{if(gridWarm)return;const id=setTimeout(()=>setGridWarm(true),SWAP_MS+40);return()=>clearTimeout(id);},[gridWarm]);
 const [search,setSearch]=useState(''),[selected,setSelected]=useState('savoir'),[active,setActive]=useState(false);
 const [zapNotice,setZapNotice]=useState<{id:string;position:number;total:number}|null>(null);
 const zapRef=useRef<(direction:1|-1)=>void>(()=>{}),activeRef=useRef(false);
 useEffect(()=>{if(!zapNotice)return;const id=setTimeout(()=>setZapNotice(null),2600);return()=>clearTimeout(id);},[zapNotice]);
 // Channel keys of TV remotes always zap; the arrows only in full screen or
 // once the player has the focus, so they still scroll the page otherwise.
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(!activeRef.current||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
   const target=event.target as HTMLElement|null;
   if(target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable)||document.querySelector('dialog[open]'))return;
   const player=document.querySelector('.watch-main'),inPlayer=!!player&&(document.fullscreenElement===player||player.contains(document.activeElement));
   const direction=event.key==='ChannelUp'||event.key==='MediaTrackNext'||inPlayer&&event.key==='ArrowUp'?1:event.key==='ChannelDown'||event.key==='MediaTrackPrevious'||inPlayer&&event.key==='ArrowDown'?-1:0;
   if(!direction)return;
   event.preventDefault();zapRef.current(direction);
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[]);
 const [searchFocus,setSearchFocus]=useState(false);
 const [sort,setSort]=useState<'default'|'name'|'region'|'recent'|'reliable'>('default');
 const [hideSuspect,setHideSuspect]=useState(false);
 useEffect(()=>{setVisibleCount(48);},[regions,categoriesChosen,languages,playbackOnly,newOnly,premiumOnly,view,search]);
 useEffect(()=>{if(view!=='channels'&&view!=='favorites')setFiltersOpen(false);},[view]);
 useEffect(()=>{if(!filtersOpen)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setFiltersOpen(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[filtersOpen]);
 const [guideChannel,setGuideChannel]=useState('integrated');
 const [programmeDetail,setProgrammeDetail]=useState<{channel:Channel;programme:Programme;source:string;sourceLabel?:string;notice?:string}|null>(null);
 const programmeDialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(programmeDetail)programmeDialogRef.current?.showModal();else programmeDialogRef.current?.close();},[programmeDetail]);
 const [guides,setGuides]=useState<Guide[]>([]),[guideLoading,setGuideLoading]=useState(true);
 const [now,setNow]=useState(0),[help,setHelp]=useState(false),[mobileMenu,setMobileMenu]=useState(false),[toast,setToast]=useState('');
 const [discoverSeed,setDiscoverSeed]=useState(0);
 const seenDiscover=useRef<Set<string>>(new Set());
 // The discover row must never repeat the same channels: remember what was
 // proposed and draw from the unseen pool, resetting once it runs dry.
 useEffect(()=>{
  try{const raw=JSON.parse(localStorage.getItem('onde-discover-seen')||'[]');if(Array.isArray(raw))seenDiscover.current=new Set(raw.filter((id):id is string=>typeof id==='string'));}catch{}
  setDiscoverSeed(Date.now()%2147483647);
 },[]);
 const [modal,setModal]=useState<'create'|'edit'|'membership'|null>(null),[listName,setListName]=useState(''),[listId,setListId]=useState<string|null>(null),[membershipChannel,setMembershipChannel]=useState<Channel|null>(null),[confirmDelete,setConfirmDelete]=useState(false);
 const [listQuery,setListQuery]=useState('');
 const [listFilter,setListFilter]=useState<string|null>(null),[modalError,setModalError]=useState('');
 const playerRef=useRef<HTMLDivElement>(null),interacted=useRef(false),dialogRef=useRef<HTMLDialogElement>(null),previewListRef=useRef<HTMLDialogElement>(null);
 const channel=channelById(selected)||channels[0]||FALLBACK_CHANNEL;
 const guideIndex=useMemo(()=>new Map(guides.map(g=>[g.channel,g])),[guides]);
 const selectedGuide=guideIndex.get(selected);
 const current=selectedGuide?currentProgramme(selectedGuide.programmes,now):undefined;
 const upcoming=selectedGuide?.programmes.filter(p=>Date.parse(p.start)>now).slice(0,3)||[];
 const last=channelById(data.lastChannel||'');
 // The clock re-renders the app: it stops while Onde is hidden and catches up on return.
 useEffect(()=>{const tick=()=>{if(!document.hidden)setNow(Date.now());};tick();const i=setInterval(tick,30000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(i);document.removeEventListener('visibilitychange',tick);};},[]);
 useEffect(()=>{if(data.lastChannel&&!interacted.current){setSelected(data.lastChannel);}},[data.lastChannel]);
 function mergeGuides(incoming:Guide[]){setGuides(previous=>{const byId=new Map(previous.map(g=>[g.channel,g]));for(const guide of incoming)byId.set(guide.channel,guide);return [...byId.values()];});}
 async function fetchGuides(url:string,signal?:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data))throw new Error();return data as Guide[];}
 // Every channel's grid only feeds the catalogue cards: it is fetched the first
 // time a card view opens, not on the home screen, which needs one channel.
 async function loadGuide(){await Promise.allSettled(['/api/guide','/api/guide?scope=community'].map(async url=>{mergeGuides(await fetchGuides(url));}));}
 useEffect(()=>{
  const controller=new AbortController();
  const load=()=>fetchGuides('/api/guide?channel='+encodeURIComponent(selected),controller.signal).then(mergeGuides).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setGuideLoading(false);});
  setGuideLoading(true);void load();
  const i=setInterval(()=>{if(!document.hidden)void load();},300000);
  return()=>{controller.abort();clearInterval(i);};
 },[selected]);
 const [gridRequested,setGridRequested]=useState(false);
 useEffect(()=>{if(view==='channels'||view==='favorites'||view==='lists'||view==='selection')setGridRequested(true);},[view]);
 // Started just after the page swap, so 48 cards re-rendering with their programmes never lands mid-slide.
 useEffect(()=>{if(!gridRequested)return;const start=setTimeout(()=>void loadGuide(),400);const i=setInterval(()=>{if(!document.hidden)void loadGuide();},300000);return()=>{clearTimeout(start);clearInterval(i);};},[gridRequested]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(id);},[toast]);
 useEffect(()=>{if(modal){dialogRef.current?.showModal();}else dialogRef.current?.close();},[modal]);
 useEffect(()=>{if(previewListId)previewListRef.current?.showModal();else previewListRef.current?.close();},[previewListId]);
 const appRef=useRef<HTMLDivElement>(null),topbarRef=useRef<HTMLElement>(null);
 // The top bar wraps and sticks differently per width and view: its measured
 // height places the mini player just under it when it sits at the top.
 useEffect(()=>{const bar=topbarRef.current,app=appRef.current;if(!bar||!app)return;const update=()=>app.style.setProperty('--topbar-height',bar.offsetHeight+'px');update();const observer=new ResizeObserver(update);observer.observe(bar);return()=>observer.disconnect();},[]);
 const swipeStart=useRef<{x:number;y:number}|null>(null);
 const navToken=useRef(0);
 const pageIndex=(id:View)=>id==='lists'?2:Math.max(0,pageOrder.indexOf(id));
 useEffect(()=>{
  const el=appRef.current;if(!el)return;
  let frame=0;
  const move=(event:PointerEvent)=>{
   const card=(event.target as Element)?.closest?.('.channel-card') as HTMLElement|null;
   if(!card||frame)return;
   frame=requestAnimationFrame(()=>{
    frame=0;
    const rect=card.getBoundingClientRect();
    card.style.setProperty('--spot-x',`${event.clientX-rect.left}px`);
    card.style.setProperty('--spot-y',`${event.clientY-rect.top}px`);
   });
  };
  el.addEventListener('pointermove',move,{passive:true});
  return()=>{el.removeEventListener('pointermove',move);if(frame)cancelAnimationFrame(frame);};
 },[]);
 // Every change of page goes through here. The new page is rendered at once,
 // then its blocks slide in from the side of travel (forward from the right,
 // back from the left) while fading in. Nothing snapshots the old page, so no
 // layer ever covers the bottom bar or the mini player, and the GPU only
 // composites the new page's few top-level blocks (transform + opacity).
 const swap=(direction:'forward'|'back',update:()=>void)=>{
  const apply=()=>{update();window.scrollTo({top:0,behavior:'auto'});};
  if(prefersReducedMotion()){apply();return;}
  flushSync(apply);
  const main=document.getElementById('contenu');if(!main)return;
  const token=++navToken.current,shift=direction==='forward'?SWAP_SHIFT:-SWAP_SHIFT;
  // The skin backdrop holds still while the page moves: one class on its own subtree.
  const backdrop=document.querySelector('.theme-backdrop');backdrop?.classList.add('is-paused');
  const blocks=Array.from(main.children).filter(el=>!el.classList.contains('watch-dock')&&!el.classList.contains('sr-only'));
  const motion=blocks.map(el=>el.animate([{opacity:0,transform:`translate3d(${shift}px,0,0)`},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:SWAP_MS,easing:SWAP_EASING}));
  void Promise.allSettled(motion.map(animation=>animation.finished)).then(()=>{if(navToken.current===token)backdrop?.classList.remove('is-paused');});
 };
 // `then` applies extra state inside the same swap (opening a list, a
 // channel's guide, the player) instead of after it.
 const chooseRef=useRef<(c:Channel)=>void>(()=>{});
 useEffect(()=>{
  const open=(id:unknown)=>{if(typeof id!=='string')return;const c=allChannelsRef.current.find(item=>item.id===id);if(c&&hasPlayback(c))chooseRef.current(c);};
  const message=(event:MessageEvent)=>{const data=event.data as {type?:unknown;channelId?:unknown}|null;if(data?.type==='onde-reminder-open')open(data.channelId);};
  navigator.serviceWorker?.addEventListener('message',message);
  const requested=new URLSearchParams(location.search).get('regarder');
  if(requested){history.replaceState(null,'',location.pathname);open(requested);}
  return()=>navigator.serviceWorker?.removeEventListener('message',message);
 },[]);
 const navigate=(id:View,then?:()=>void)=>{
  if(id===view){then?.();setMobileMenu(false);window.scrollTo({top:0,behavior:prefersReducedMotion()?'auto':'smooth'});return;}
  swap(pageIndex(id)>=pageIndex(view)?'forward':'back',()=>{
   if(id==='favorites'||id==='lists'){setSearch('');setRegions([]);setCategoriesChosen([]);setLanguages([]);setNewOnly(false);}
   if(id==='guide'){setSearch('');setGuideChannel('integrated');}
   if(id==='selection'){setSearch('');}
   // Same render as the page itself: set from the effect, it re-rendered the whole app mid-slide.
   if(id==='channels'||id==='favorites'||id==='lists'){setGridRequested(true);setGridWarm(false);}
   if(id==='selection')setGridRequested(true);
   setView(id);setListFilter(null);setMobileMenu(false);then?.();
  });
 };
 const openList=(id:string|null)=>swap(id?'forward':'back',()=>setListFilter(id));
 const onTouchStart=(event:React.TouchEvent<HTMLDivElement>)=>{
  if(event.touches.length!==1){swipeStart.current=null;return;}
  const target=event.target as Element;
  if(target.closest?.('input,select,textarea,video,iframe,dialog,details,.player-shell,.home-favorite-row,.home-category-grid,.guide-days,.region-tabs,.search-results,.topbar,.sidebar,.mobile-nav')){swipeStart.current=null;return;}
  swipeStart.current={x:event.touches[0].clientX,y:event.touches[0].clientY};
 };
 const onTouchEnd=(event:React.TouchEvent<HTMLDivElement>)=>{
  const start=swipeStart.current;swipeStart.current=null;
  if(!start||document.querySelector('dialog[open]'))return;
  const touch=event.changedTouches[0];if(!touch)return;
  const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  if(Math.abs(dx)<64||Math.abs(dx)<Math.abs(dy)*1.25)return;
  const index=pageIndex(view);const next=pageOrder[index+(dx<0?1:-1)];
  if(next)navigate(next);
 };
 const [recent,setRecent]=useState<RecentChannel[]>([]);
 useEffect(()=>{try{const raw=JSON.parse(localStorage.getItem('onde-recent')||'[]');if(Array.isArray(raw))setRecent(raw.filter((entry):entry is RecentChannel=>!!entry&&typeof entry.id==='string'&&typeof entry.at==='string').slice(0,12));}catch{}},[userId]);
 const clearRecent=()=>{setRecent([]);try{localStorage.removeItem('onde-recent');}catch{}};
 // Forget which channels were already proposed, then draw a fresh row.
 const newIdeas=()=>{seenDiscover.current=new Set();try{localStorage.removeItem('onde-discover-seen');}catch{}setDiscoverSeed(seed=>seed+1);};
 const remember=(id:string)=>setRecent(current=>{const next=rememberChannel(current,id,new Date().toISOString());try{localStorage.setItem('onde-recent',JSON.stringify(next));}catch{}return next;});
 // Programme reminders (lib/reminders.ts): a banner here when the programme
 // starts, and a system notification as well while Onde is in the background.
 const {reminders,dismiss:dismissReminder}=useReminders();
 const [reminderAlerts,setReminderAlerts]=useState<Reminder[]>([]);
 const allChannelsRef=useRef(allChannels);allChannelsRef.current=allChannels;
 useEffect(()=>{
  const announce=()=>{
   const due=dueReminders(reminders,Date.now());if(!due.length)return;
   for(const reminder of due){
    dismissReminder(reminder);
    const name=allChannelsRef.current.find(c=>c.id===reminder.channelId)?.name||reminder.channelId;
    if(document.visibilityState!=='visible'&&'Notification' in window&&Notification.permission==='granted'&&'serviceWorker' in navigator)void navigator.serviceWorker.ready.then(registration=>registration.showNotification(t('{title} commence',{title:reminder.title}),{body:t('Sur {name} · touchez pour regarder',{name}),tag:reminderKey(reminder),icon:'/icon-192.png',data:{channelId:reminder.channelId}})).catch(()=>{});
   }
   setReminderAlerts(alerts=>[...alerts.filter(alert=>!due.some(item=>reminderKey(item)===reminderKey(alert))),...due]);
  };
  announce();
  const delay=nextReminderDelay(reminders,Date.now());
  const timer=delay===null?undefined:setTimeout(announce,Math.min(delay+500,2147483647));
  document.addEventListener('visibilitychange',announce);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',announce);};
 },[reminders]);
 const choose=(c:Channel,play=true)=>{
  interacted.current=true;remember(c.id);mutate({type:'last',channel:c.id});
  if(view!=='home'&&active&&play&&hasPlayback(c)){setSelected(c.id);setMobileMenu(false);return;}
  navigate('home',()=>{setSelected(c.id);setActive(play);setShowPlayer(true);});
 };
 const openChannelGuide=()=>navigate('guide',()=>{setSearch('');setGuideChannel(selected);});
 const showProgramme=(programme:Programme)=>setProgrammeDetail({channel,programme,source:selectedGuide?.source||channel.guide,sourceLabel:selectedGuide?.sourceLabel,notice:selectedGuide?.notice});
 const favorite=(c:Channel)=>{const value=!favoriteIds.has(c.id);if(!mutate({type:'favorite',channel:c.id,value}))return;setToast(t(value?'{name} ajouté aux favoris':'{name} retiré des favoris',{name:c.name}));};
 const favoriteLabel=(c:Channel)=>t(favoriteIds.has(c.id)?'Retirer {name} des favoris':'Ajouter {name} aux favoris',{name:c.name});
 const openCreate=(withChannel=false)=>{if(!withChannel)setMembershipChannel(null);setListName('');setModalError('');setModal('create');setListId(null);};
 const openEdit=(list:ChannelList)=>{setListQuery('');setListId(list.id);setListName(list.name);setConfirmDelete(false);setModalError('');setModal('edit');};
 const openMembership=(c:Channel)=>{setMembershipChannel(c);setModal('membership');};
 const saveList=()=>{
  if(!listName.trim()||listName.trim().length>48){setModalError(t('Choisissez un nom de 1 à 48 caractères.'));return;}
  if(modal==='create'){const id=makeId();if(!mutate({type:'createList',id,name:listName})){setModalError(t('Impossible de créer cette liste. Vérifiez sa limite de 20 listes.'));return;}if(membershipChannel)mutate({type:'listChannel',id,channel:membershipChannel.id,value:true});navigate('lists',()=>setListFilter(id));setToast(t('Votre liste a été créée'));}
  else if(listId){if(!mutate({type:'renameList',id:listId,name:listName})){setModalError(t('Le nom n’a pas pu être enregistré. Réessayez.'));return;}setToast(t('Nom de la liste modifié'));}
  setModal(null);
 };
 const listNeedle=fold(listQuery);
 const matchingListChannels=modal==='edit'?channels.filter(c=>!!searchIndex.get(c.id)?.name.includes(listNeedle)):[];
 const editList=data.lists.find(l=>l.id===listId);
 const filterList=data.lists.find(l=>l.id===listFilter);
 const needle=fold(search);
 const filterChannels=(items:Channel[])=>{
  const matches=items.filter(c=>(!regions.length||regions.includes(c.region))&&(!categoriesChosen.length||categoriesChosen.includes(categoryGroup(c.category)))&&(!languages.length||languages.includes(c.language||'fr'))&&(!premiumOnly||isPremiumChannel(c))&&(!hideSuspect||catalogue?.health[c.id]?.state!=='suspect')&&(!needle||!!searchIndex.get(c.id)?.full.includes(needle)));
  if(sort==='name')return [...matches].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  if(sort==='region')return [...matches].sort((a,b)=>a.region.localeCompare(b.region,'fr')||a.name.localeCompare(b.name,'fr'));
  if(sort==='reliable'){const score=(c:Channel)=>{const counts=reliability[c.id],label=reliabilityOf(counts);return (label==='reliable'?2:label==='unstable'?0:1)+(counts?counts.ok/Math.max(1,counts.ok+counts.failed)/2:.25);};return [...matches].sort((a,b)=>score(b)-score(a));}
  if(sort==='recent'){const rank=new Map(recent.map((entry,position)=>[entry.id,position]));return [...matches].sort((a,b)=>(rank.get(a.id)??999)-(rank.get(b.id)??999));}
  return matches;
 };
 // Active-filter summary and one-click reset, shown above the filter bar.
 const activeFilterList=[
  regions.length?t('Région'):'',
  categoriesChosen.length?t('Catégorie'):'',
  languages.length?t('Langue'):'',
  sort!=='default'?t('Tri'):'',
  premiumOnly?t('Chaînes premium'):'',
  newOnly?t('Nouvelles chaînes'):'',
  !playbackOnly?t('Toutes les chaînes'):'',
  showGeoBlocked?t('Chaînes géo-bloquées'):'',
  hideSuspect?t('Chaînes à vérifier'):'',
 ].filter(Boolean);
 const resetFilters=()=>{
  setSearch('');setRegions([]);setCategoriesChosen([]);setLanguages([]);setSort('default');
  setPremiumOnly(false);setPlaybackOnly(true);setNewOnly(false);
  setShowGeoBlocked(false);setHideSuspect(false);
 };
 const searchQuery=needle.trim();
 const searchMatches=searchQuery.length>=2?channels.filter(c=>!!searchIndex.get(c.id)?.short.includes(searchQuery)):[];
 const byIds=(ids:readonly string[])=>ids.map(id=>channelById(id)).filter((c):c is Channel=>!!c);
 // Favourites and list entries whose channel left the catalogue (its stream
 // stopped working): said once on Favoris/Listes, with a one-tap clean-up.
 const catalogueIds=useMemo(()=>new Set([...allChannels.map(c=>c.id),...(catalogue?.nativeOnlyIds||[])]),[allChannels,catalogue]);
 const retiredIds=catalogue?[...new Set([...data.favorites,...data.lists.flatMap(l=>l.channels)])].filter(id=>!catalogueIds.has(id)):[];
 const clearRetired=()=>{
  for(const id of retiredIds){
   if(data.favorites.includes(id))mutate({type:'favorite',channel:id,value:false});
   for(const list of data.lists)if(list.channels.includes(id))mutate({type:'listChannel',id:list.id,channel:id,value:false});
  }
  setToast(t('Favoris et listes mis à jour'));
 };
 const retiredNotice=retiredIds.length>0&&<div className="notice retired-notice" role="status"><Info size={17}/><span>{retiredIds.length===1?t('Une chaîne de vos favoris ou de vos listes n’est plus disponible : son flux a cessé de fonctionner.'):t('{count} chaînes de vos favoris ou de vos listes ne sont plus disponibles : leurs flux ont cessé de fonctionner.',{count:retiredIds.length})}</span><button onClick={clearRetired}>{t('Les retirer')}</button></div>;
 const favoriteChannels=byIds(data.favorites);
 // The catalogue grid is only filtered while it is on screen.
 const displayed=view==='favorites'?filterChannels(favoriteChannels):view==='channels'?filterChannels(channels.filter(c=>(!playbackOnly||hasPlayback(c))&&(!newOnly||isNew(c.id)))):[];
 const homeChannels=favoriteChannels.length?favoriteChannels:channels.filter(c=>hasPlayback(c)).slice(0,6);
 const date=now?new Date(now).toLocaleDateString(locale==='fr'?'fr-CA':'en-CA',{weekday:'long',day:'numeric',month:'long'}):'';
 const favorites=favoriteChannels;
 const recentChannels=byIds(recent.map(entry=>entry.id)).slice(0,6);
 // The week's selection for this viewer (see curateSelection): computed only on its page.
 const weekSelection=view==='selection'?curateSelection(selection,{now:new Date(now||Date.now()),available:id=>{const c=channelById(id);return !!c&&hasPlayback(c);},seen:new Set(recent.map(entry=>entry.id)),favorites:favoriteIds}):[];
 const previewList=previewListId?data.lists.find(l=>l.id===previewListId):undefined;
 const previewListChannels=previewList?byIds(previewList.channels):[];
 const homeChannelTile=(c:Channel)=>{const isFavorite=favoriteIds.has(c.id);return <div key={c.id} className="home-favorite-item"><button className={`home-favorite-open ${active&&selected===c.id?'home-favorite-active':''}`} onClick={()=>choose(c)} aria-label={t('Regarder {name}',{name:c.name})}><span className="home-favorite-art"><Brand channel={c}/></span><span className="home-favorite-name">{c.name}</span></button><button type="button" className={`home-favorite-fav ${isFavorite?'is-favorite':''}`} onClick={()=>favorite(c)} aria-pressed={isFavorite} aria-label={favoriteLabel(c)} title={t(isFavorite?'Retirer des favoris':'Ajouter aux favoris')}><Heart size={16} fill={isFavorite?'currentColor':'none'}/></button></div>;};
 const discover=useMemo(()=>{
  const playable=channels.filter(c=>hasPlayback(c));
  const unseen=(c:Channel)=>!seenDiscover.current.has(c.id);
  const curated=playable.filter(c=>c.source!=='iptv-org');
  const wider=playable.filter(c=>c.source==='iptv-org'&&c.logoUrl);
  const curatedFresh=curated.filter(unseen);
  const widerFresh=wider.filter(unseen);
  const seed=String(discoverSeed);
  return [
   ...discoverChannels(curatedFresh.length>=6?curatedFresh:curated,seed+'curated',6),
   ...discoverChannels(widerFresh.length>=6?widerFresh:wider,seed+'wide',6),
  ];
 },[channels,discoverSeed]);
 useEffect(()=>{
  if(!discover.length)return;
  for(const c of discover)seenDiscover.current.add(c.id);
  const ids=[...seenDiscover.current].slice(-200);
  seenDiscover.current=new Set(ids);
  try{localStorage.setItem('onde-discover-seen',JSON.stringify(ids));}catch{}
 },[discover]);
 const syncLabels={loading:'Connexion…',synced:'Tout est synchronisé',pending:'Enregistrement…',offline:'Synchronisation en attente',local:'Sur cet appareil'};
 function renderChannelCard(c:Channel,reorder=false){
  const guide=guideIndex.get(c.id),p=guide?currentProgramme(guide.programmes,now):undefined;
  const isFavorite=favoriteIds.has(c.id),health=catalogue?.health[c.id];
  return <article key={c.id} className={`channel-card ${selected===c.id?'channel-selected':''}`}>
   <div className={`card-visual visual-${c.id}`} style={{'--brand-color':c.color} as React.CSSProperties}>
    <button className="card-select" onClick={()=>choose(c)} aria-label={t('Regarder {name}',{name:c.name})}><Brand channel={c}/><span className="hover-play"><Play size={18} fill="currentColor"/></span></button>
    <button className={`card-favorite ${isFavorite?'is-favorite':''}`} onClick={()=>favorite(c)} title={t(isFavorite?'Retirer des favoris':'Ajouter aux favoris')} aria-label={favoriteLabel(c)} aria-pressed={isFavorite}><Heart size={17} fill={isFavorite?'currentColor':'none'}/></button>
    <span className={`playback-tag ${hasPlayback(c)?'integrated':''}`}>{hasPlayback(c)?<><span/>{t(c.limited?'Selon région':'Dans Onde')}</>:<>{t('Site officiel')}<ArrowUpRight size={10}/></>}</span>
   </div>
   <div className="card-body"><div className="card-title-line"><button onClick={()=>choose(c)} className="card-title">{c.name}</button><button className="icon-button" onClick={()=>openMembership(c)} aria-label={t('Ajouter {name} à une liste',{name:c.name})} title={t('Ajouter à une liste')}><Plus size={17}/></button></div><p className="card-meta">{c.region}<span>·</span>{t(languageLabel(c))}<span>·</span>{c.category}</p>{p?<p className="card-programme"><span className="tiny-dot"/>{p.title}</p>:<p className="card-programme muted">{t(hasPlayback(c)?'Direct gratuit':'Lecture intégrée non disponible')}</p>}
    {health?.state==='suspect'&&<p className="channel-health" title={health.note}>{t('À vérifier · plusieurs contrôles en échec')}</p>}
    {(()=>{const counts=reliability[c.id],label=reliabilityOf(counts);if(!counts||!label)return null;const rate=Math.round(counts.ok/(counts.ok+counts.failed)*100);return <p className={`channel-reliability is-${label}`} title={t('{ok} lectures réussies sur {total} ces 30 derniers jours',{ok:counts.ok,total:counts.ok+counts.failed})}>{label==='reliable'?<Check size={13}/>:<Info size={13}/>}{t(label==='reliable'?'Fiable · {rate} % des lectures réussies':'Instable · {rate} % des lectures réussies',{rate})}</p>;})()}
    {reorder&&<div className="reorder-controls"><span>{t('Classer ce favori')}</span><button className="icon-button" disabled={data.favorites.indexOf(c.id)===0} onClick={()=>mutate({type:'move',channel:c.id,direction:-1})} aria-label={t('Monter {name}',{name:c.name})}><ArrowUp size={15}/></button><button className="icon-button" disabled={data.favorites.indexOf(c.id)===data.favorites.length-1} onClick={()=>mutate({type:'move',channel:c.id,direction:1})} aria-label={t('Descendre {name}',{name:c.name})}><ArrowDown size={15}/></button></div>}
   </div>
  </article>;
 }
 chooseRef.current=c=>choose(c);activeRef.current=active;
 // Zapping, as on a TV: the next or previous channel of the list being
 // watched (the favourites when this channel is one of them, else the
 // filtered grid, else the whole catalogue), without leaving the page or the
 // full screen (which sits on .watch-main, kept across channels).
 const zapPool=(favoriteIds.has(selected)&&favoriteChannels.length>1?favoriteChannels:view==='channels'&&displayed.length>1?displayed:channels).filter(hasPlayback);
 const zap=(direction:1|-1)=>{
  const target=zapTarget(zapPool,selected,direction);if(!target)return;
  const next=target.item;
  interacted.current=true;remember(next.id);mutate({type:'last',channel:next.id});
  setSelected(next.id);setActive(true);setShowPlayer(true);
  setZapNotice({id:next.id,position:target.position,total:zapPool.length});
 };
 zapRef.current=zap;
 return <div className="app-shell" data-theme={theme} data-dock={settings.dock} ref={appRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>{wallpaper.url?<CustomWallpaper url={wallpaper.url} stillUrl={wallpaper.stillUrl} strength={wallpaper.strength} resting={resting}/>:<ThemeBackdrop theme={theme} resting={resting}/>}<a className="skip-link" href="#contenu">{t('Aller au contenu')}</a>
  <aside className={`sidebar ${mobileMenu?'mobile-open':''}`} aria-label={t('Navigation principale')}><a className="brand-link" href="#" onClick={e=>{e.preventDefault();navigate('home');}} aria-label={t('Onde, accueil')}><Logo theme={theme}/></a><p className="sidebar-caption">{t('VOTRE FENÊTRE SUR LE MONDE')}</p><nav>{navigation.map(item=><button key={item.id} aria-current={(view===item.id||(view==='lists'&&item.id==='favorites'))?'page':undefined} className={`nav-item ${(view===item.id||(view==='lists'&&item.id==='favorites'))?'nav-active':''}`} onClick={()=>navigate(item.id)}><item.icon size={19}/>{t(item.label)}{item.id==='favorites'&&data.favorites.length>0&&<span className="nav-count">{data.favorites.length}</span>}</button>)}</nav><div className="sidebar-lists"><div className="sidebar-section-label">{t('VOS LISTES')}<button className="icon-button" onClick={()=>openCreate()} aria-label={t('Créer une liste')}><Plus size={16}/></button></div>{data.lists.length?data.lists.map(list=><button key={list.id} className={`list-nav ${listFilter===list.id&&view==='lists'?'list-nav-active':''}`} onClick={()=>navigate('lists',()=>setListFilter(list.id))}><span className="list-color"/>{list.name}<span>{list.channels.length}</span></button>):<button className="create-list-sidebar" onClick={()=>openCreate()}><Plus size={15}/>{t('Créer ma première liste')}</button>}</div><div className="sidebar-bottom"><div className="device-note"><MonitorSmartphone size={22}/><strong>{t(signedIn?'Votre télé vous suit.':'Votre télé, à votre rythme.')}</strong><p>{t(signedIn?'Vos favoris sur tous vos écrans.':'Vos favoris restent sur cet appareil. Le compte est optionnel.')}</p></div><span className="sidebar-version">{t('FAIT POUR LES MOMENTS SIMPLES')}</span></div></aside>
  {mobileMenu&&<button className="menu-backdrop" onClick={()=>setMobileMenu(false)} aria-label={t('Fermer le menu')}/>}
  <div className="main-shell"><header ref={topbarRef} className={`topbar topbar-${view}`}><div className="mobile-brand"><button className="icon-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label={t('Ouvrir le menu')}><Menu size={22}/></button><Logo theme={theme}/></div><div className="breadcrumb">{t('Mon espace télé')} <ChevronRight size={13}/><span>{t(navigation.find(n=>n.id===view)?.label||'Mes listes')}</span></div><div className="search-wrap"><div className="search-box" role="search"><Search size={18} aria-hidden="true"/><input placeholder={t('Rechercher une chaîne…')} value={search} onFocus={()=>setSearchFocus(true)} onBlur={()=>setTimeout(()=>setSearchFocus(false),160)} onChange={e=>{setSearch(e.target.value);setSearchFocus(true);}} onKeyDown={e=>{if(e.key==='Escape'){setSearch('');setSearchFocus(false);(e.target as HTMLInputElement).blur();}else if(e.key==='Enter'&&search.trim()){setSearchFocus(false);(e.target as HTMLInputElement).blur();if(view!=='channels'&&view!=='guide')navigate('channels');}}} aria-label={t('Rechercher une chaîne')} aria-controls="search-results" aria-expanded={searchFocus&&searchMatches.length>0}/>{search&&<button type="button" className="search-clear" onClick={()=>setSearch('')} aria-label={t('Effacer la recherche')}><X size={14} aria-hidden="true"/></button>}</div>{searchFocus&&searchMatches.length>0&&<div className="search-results" id="search-results" role="listbox" aria-label={t('Résultats de recherche')}><div className="search-results-head">{t('{count} chaînes',{count:searchMatches.length})}</div>{searchMatches.slice(0,6).map(c=><button key={c.id} className="search-result" role="option" aria-selected="false" onMouseDown={e=>e.preventDefault()} onClick={()=>{choose(c);setSearch('');setSearchFocus(false);}}><Brand channel={c} small/><span className="search-result-copy"><strong>{c.name}</strong><small>{c.region} · {c.category}</small></span></button>)}{searchMatches.length>6&&<button className="search-all" onMouseDown={e=>e.preventDefault()} onClick={()=>{navigate('channels');setSearchFocus(false);}}>{t('Voir les {count} résultats',{count:searchMatches.length})}</button>}</div>}</div><button className={`sync-indicator ${status==='offline'?'sync-offline':''}`} onClick={()=>void refresh()} title={`${t(syncLabels[status])}. ${t('Cliquer pour actualiser.')}`}>{status==='offline'?<CloudOff size={17}/>:status==='loading'||status==='pending'?<RefreshCw size={17} className="spin"/>:<CloudCheck size={17}/>}<span>{t(syncLabels[status])}</span></button><button className="icon-button topbar-help" onClick={()=>setHelp(true)} aria-label={t('Aide et sources')} title={t('Aide et sources')}><CircleHelp size={20}/></button><button className="profile-avatar settings-button" onClick={()=>setSettingsOpen(true)} aria-haspopup="dialog" aria-label={t('Réglages')} title={t('Réglages')}><Settings size={20}/>{signedIn&&<span className="settings-signed-in" aria-hidden="true"/>}</button></header>
   <main id="contenu" className={`main-content view-main-${view}`}>
    <span className="sr-only page-announcer" aria-live="polite">{t(navigation.find(item=>item.id===(view==='lists'?'favorites':view))?.label||'Mes listes')}</span>
    {catalogueError&&<div className="notice" role="status"><span>{t('Actualisation du catalogue indisponible. Les chaînes déjà chargées restent accessibles.')}</span><button onClick={()=>void loadCatalogue()}>{t('Réessayer')}</button></div>}
    {error&&status!=='offline'&&<div className="notice" role="alert"><Info size={17}/><span>{error}</span></div>}{status==='offline'&&<div className="notice" role="status"><CloudOff size={17}/><span>{error||t('Connexion interrompue. Les modifications en attente seront envoyées à la reconnexion.')}</span><button onClick={()=>void refresh()}>{t('Réessayer')}</button></div>}
    <div className={`page-heading heading-${view}`}><div><div className="eyebrow">{t(view==='home'?'BIENVENUE CHEZ VOUS':view==='channels'?'TOUTES VOS ENVIES':view==='favorites'?'VOTRE SÉLECTION PERSONNELLE':view==='guide'?'À CHACUN SON PROGRAMME':view==='selection'?'LE CHOIX D’ONDE':'VOS LISTES')}</div><h1>{t(view==='home'?(showPlayer||active?'À l’écran':'On regarde quoi ?'):view==='channels'?'Les chaînes':view==='favorites'?'Mes favoris':view==='guide'?'Programme':view==='selection'?'La sélection':'Mes listes')}</h1><p>{t(view==='home'?'Votre télé, tout simplement.':view==='channels'?'Découvrez les chaînes qui vous ressemblent.':view==='favorites'?'Retrouvez vos chaînes et vos listes.':view==='guide'?'Découvrez les horaires disponibles.':view==='selection'?'Les meilleures chaînes par genre, choisies à la main.':'Regroupez vos chaînes selon vos envies.')}</p></div><span className="today-date"><span className="tiny-dot"/>{date}</span></div>
    <section className={view==='home'&&(showPlayer||active)?'watch-section':view!=='home'&&active?'watch-dock':'watch-hidden'} aria-label={t('Lecteur et programmes')}>{active&&view!=='home'&&<div className="dock-head"><span className="dock-title">{channel.name}</span><button type="button" className="dock-close" onClick={()=>setActive(false)} aria-label={t('Fermer le lecteur')}><X size={15}/>{t('Fermer')}</button></div>}<div className="watch-main" ref={playerRef} tabIndex={-1}><Player key={channel.id} channel={channel} programmeTitle={current?.title} programmes={selectedGuide?.programmes} now={now} active={active} scheduleOpen={settings.schedule} onScheduleOpen={open=>updateSettings({schedule:open})} audioOnly={settings.audioOnly} onAudioOnly={on=>updateSettings({audioOnly:on})} onPlay={()=>{setActive(true);interacted.current=true;mutate({type:'last',channel:channel.id});}} onZap={active&&zapPool.length>1?zap:undefined}/>{zapNotice&&(()=>{const c=channelById(zapNotice.id);if(!c)return null;const guide=guideIndex.get(c.id),live=guide&&now?currentProgramme(guide.programmes,now):undefined;return <div className="zap-notice" role="status"><span className="zap-position">{zapNotice.position} / {zapNotice.total}</span><strong>{c.name}</strong>{live&&<span>{live.title}</span>}</div>;})()}</div>{view==='home'&&<aside className="up-next"><div className="panel-heading"><span className="eyebrow">{t('SUR CETTE CHAÎNE')}</span><CalendarDays size={17}/></div><div className="now-heading"><span className="tiny-dot"/><span>{t('En ce moment')}</span></div><h3>{current?.title||(guideLoading?t('Chargement de l’horaire…'):channel.name)}</h3><p className="now-description">{current?t('{start} à {end}',{start:time(current.start),end:time(current.end)}):channel.description}</p>{current?.detail&&current.detail!==current.title&&<p className="now-programme-detail">{current.detail}</p>}{current&&<button className="programme-detail-link" onClick={()=>showProgramme(current)}>{t('Détails de l’émission')}<ArrowUpRight size={13}/></button>}{selectedGuide?.notice&&<p className="guide-notice">{t(selectedGuide.notice)}</p>}{current&&<div className="programme-progress"><span style={{width:`${Math.max(0,Math.min(100,(now-Date.parse(current.start))/(Date.parse(current.end)-Date.parse(current.start))*100))}%`}}/></div>}{!current&&!guideLoading&&<p className="schedule-unavailable">{t(selectedGuide?.error?'Horaire intégré indisponible.':'La programmation détaillée n’est pas intégrée pour cette chaîne.')}</p>}<div className="next-programmes"><span className="eyebrow">{t(upcoming.length?'ENSUITE':'POUR CONTINUER')}</span>{upcoming.length?upcoming.map(p=><button className="next-item next-programme-button" key={p.start} onClick={()=>showProgramme(p)}><span>{time(p.start)}</span><span><strong>{p.title}</strong>{p.detail&&p.detail!==p.title&&<small>{p.detail}</small>}</span></button>):<a className="schedule-link" href={channel.guide} target="_blank" rel="noopener noreferrer">{channel.guide===channel.official?t('Site du diffuseur'):t('Horaire de {name}',{name:channel.name})}<ArrowUpRight size={16}/></a>}</div><button className="guide-button" onClick={openChannelGuide}>{t('Guide de cette chaîne')}<ArrowUpRight size={17}/></button></aside>}{view!=='home'&&active&&<div className="dock-controls"><button onClick={()=>navigate('home')}>{t('Agrandir le lecteur')}<ArrowUpRight size={14}/></button></div>}</section>
{view==='home'&&<>
     {!showPlayer&&!active&&<section className="desktop-first" aria-labelledby="home-first-title"><Radio size={36}/><span className="hero-eyebrow">{last?t('Reprendre où vous en étiez'):(locale==='fr'?`${channels.length.toLocaleString('fr-CA')} chaînes · sans abonnement`:`${channels.length.toLocaleString('en-CA')} CHANNELS · NO SUBSCRIPTION`)}</span><h2 id="home-first-title">{last?last.name:t('Toute la télé, au même endroit')}</h2><p>{last?last.description:t('Le Québec, le Canada, la France et les États-Unis, réunis dans un lecteur simple et gratuit.')}</p><div className="hero-actions"><button className="primary" onClick={()=>last?choose(last):navigate('channels')}><Play size={17} fill="currentColor"/>{t(last?'Reprendre cette chaîne':'Explorer les chaînes')}</button><button className="hero-secondary" onClick={()=>navigate('guide')}><CalendarDays size={16}/>{t('Voir le programme')}</button></div></section>}
     <aside className="desktop-home-panel" aria-label={t('Chaînes et programme')}><section className="desktop-channel-panel"><div className="desktop-panel-heading"><h2>{t('Mes chaînes')}</h2><button onClick={()=>navigate('channels')}>{t('Voir toutes')} <ChevronRight size={15}/></button></div><div className="desktop-channel-list">{homeChannels.map(c=><div className={`desktop-channel-row ${active&&selected===c.id?'desktop-channel-playing':''}`} key={c.id}><button className="desktop-channel-open" onClick={()=>choose(c)} aria-label={t('Regarder {name}',{name:c.name})}><Brand channel={c} small/><strong>{c.name}</strong></button><button className={`desktop-channel-heart ${favoriteIds.has(c.id)?'is-favorite':''}`} onClick={()=>favorite(c)} aria-label={favoriteLabel(c)} aria-pressed={favoriteIds.has(c.id)}><Heart size={19} fill={favoriteIds.has(c.id)?'currentColor':'none'}/></button></div>)}</div></section><section className="desktop-programme-panel"><div className="desktop-panel-heading"><h2>{t('Programme')}</h2><button onClick={()=>navigate('guide')}>{t('Voir plus')} <ChevronRight size={15}/></button></div>{(active||showPlayer)?<>{current&&<button className="desktop-programme-row" onClick={()=>showProgramme(current)}><span>{t('En ce moment')}</span><strong>{current.title}</strong><small>{t('{start} à {end}',{start:time(current.start),end:time(current.end)})}</small></button>}{upcoming.map(p=><button className="desktop-programme-row" key={p.start} onClick={()=>showProgramme(p)}><span>{time(p.start)}</span><strong>{p.title}</strong></button>)}{!current&&!upcoming.length&&<p>{t(guideLoading?'Chargement du programme…':'Horaire indisponible pour cette chaîne.')}</p>}</>:<p>{t('Choisissez une chaîne pour voir son programme.')}</p>}</section></aside>
    </>}
    {view==='home'&&<div className="home-discover">
      {!showPlayer&&!active&&<section className="home-hero-group" aria-labelledby="home-hero-title"><div className="home-hero"><div className="hero-copy"><span className="hero-eyebrow">{t(last?'Reprendre où vous en étiez':'Sans abonnement')}</span><h2 id="home-hero-title">{last?last.name:t('Toute la télé, au même endroit')}</h2><p>{last?last.description:t('Le Québec, le Canada, la France et les États-Unis, réunis dans un lecteur simple et gratuit.')}</p></div><div className="hero-brand"><Brand channel={last||channel}/></div></div><div className="hero-actions"><button className="home-primary" onClick={()=>last?choose(last):navigate('channels')}><Play size={18} fill="currentColor"/>{t(last?'Reprendre cette chaîne':'Explorer les chaînes')}</button></div></section>}
      {recentChannels.length>0&&<section className="home-favorites home-recent"><HomeCarousel title="Reprendre" actionLabel="Toutes les chaînes" action={()=>navigate('channels')} trackClass="home-favorite-row">{recentChannels.map(homeChannelTile)}</HomeCarousel></section>}
      {favorites.length>0&&<section className="home-favorites"><HomeCarousel title="Mes favoris" actionLabel="Voir mes favoris" action={()=>navigate('favorites')} trackClass="home-favorite-row">{favorites.map(homeChannelTile)}</HomeCarousel></section>}
      <section className="home-favorites"><HomeCarousel title="Chaînes à découvrir" actionLabel="D’autres idées" action={()=>setDiscoverSeed(seed=>seed+1)} trackClass="home-favorite-row">{discover.filter(c=>!favoriteIds.has(c.id)).map(homeChannelTile)}</HomeCarousel></section>
      {data.lists.length>0&&<section className="home-lists"><HomeCarousel title="Mes listes" actionLabel="Toutes mes listes" action={()=>navigate('lists')} trackClass="home-list-row">{data.lists.map(list=><button key={list.id} type="button" className="home-list-tile" onClick={()=>setPreviewListId(list.id)} aria-label={t('Voir les chaînes de la liste {name}',{name:list.name})}><span className="home-list-art"><ListVideo size={24}/><span className="home-list-count">{list.channels.length}</span></span><span className="home-list-name">{list.name}</span></button>)}</HomeCarousel></section>}
      <section className="home-categories"><HomeCarousel title="Explorer par genre" trackClass="home-category-grid">{categories.map(value=><button key={value} onClick={()=>{setSearch('');setRegions([]);setLanguages([]);setNewOnly(false);setPlaybackOnly(false);setCategoriesChosen([value]);navigate('channels');}}><CategoryIcon category={value}/><span>{value}</span><ArrowUpRight size={18}/></button>)}</HomeCarousel></section>
    </div>}
        {(view==='channels'||view==='favorites')&&<>
     
     {view==='favorites'&&retiredNotice}
     {view==='favorites'&&<div className="favorites-lists"><div><h2>{t('Vos listes')}</h2><p>{t('Retrouvez et organisez vos sélections.')}</p></div><button className="secondary" onClick={()=>navigate('lists')}>{t('Voir mes listes')} <ChevronRight size={16}/></button></div>}<section className={`channels-section view-${view}`}>{!(view==='favorites'&&!data.favorites.length)&&<><div className="section-heading"><div><h2><span className="section-title">{t(view==='favorites'?'Votre sélection':(newOnly?'Les nouvelles chaînes':playbackOnly?'À regarder dans Onde':'Toutes les chaînes'))}</span><span className="section-count">{locale==='fr'?`${displayed.length} chaîne${displayed.length!==1?'s':''}`:`${displayed.length} channel${displayed.length!==1?'s':''}`}</span></h2><p>{t(view==='favorites'?'Utilisez les flèches pour changer leur classement.':'Choisissez une chaîne pour ouvrir son lecteur vidéo ici, dans Onde.')}</p></div></div>{viewerCountry!=='XX'&&<p className="geo-filter-note"><Globe2 size={14}/>{showGeoBlocked?t('Toutes les chaînes sont affichées, y compris celles qui peuvent être géo-bloquées.'):t('Chaînes disponibles dans votre région : {region}',{region:t(viewerCountryLabel(viewerCountry))})}</p>}<div className={`filter-bar${filtersOpen?' filter-open':''}`}><div className="filter-bar-head"><span className="filter-title">{t('Filtres')}</span><button type="button" className="filter-toggle" onClick={()=>setFiltersOpen(o=>!o)} aria-expanded={filtersOpen} aria-controls="filter-panel"><SlidersHorizontal size={16} aria-hidden="true"/><span>{t('Filtres')}</span>{activeFilterList.length>0&&<span className="filter-badge" aria-hidden="true">{activeFilterList.length}</span>}</button><span className="filter-summary" aria-live="polite">{activeFilterList.length>0?t('{count} filtres actifs',{count:activeFilterList.length}):t('Aucun filtre actif')}</span><button type="button" className="filter-clear" onClick={resetFilters} disabled={activeFilterList.length===0}>{t('Tout effacer')}<X size={14} aria-hidden="true"/></button></div><button type="button" className="filter-backdrop" onClick={()=>setFiltersOpen(false)} aria-label={t('Fermer')} tabIndex={-1}/><div className="filter-panel" id="filter-panel" role="group" aria-label={t('Affiner les chaînes')}><div className="filter-panel-head"><span>{t('Affiner les chaînes')}</span><button type="button" className="filter-panel-reset" onClick={resetFilters}>{t('Tout effacer')}</button><button type="button" className="filter-panel-close" onClick={()=>setFiltersOpen(false)} aria-label={t('Fermer')}><X size={18} aria-hidden="true"/></button></div><div className="filter-group filter-group-selects"><MultiSelect className="filter-field-language" label={t('Langue')} ariaLabel={t('Filtrer par langue')} allLabel={t('Toutes les langues')} countLabel={count=>t('{count} langues',{count})} groups={[{options:[['fr',t('Français')],['en',t('Anglais')],['sv',t('Suédois')],['zxx',t('Sans paroles')]]}]} selected={languages} onChange={setLanguages}/><MultiSelect className="filter-field-category" label={t('Catégorie')} ariaLabel={t('Filtrer par catégorie')} allLabel={t('Toutes les catégories')} countLabel={count=>t('{count} catégories',{count})} groups={[{options:categories.map(x=>[x,x] as const)}]} selected={categoriesChosen} onChange={setCategoriesChosen}/><label className="filter-field"><span className="filter-field-label">{t('Tri')}</span><select aria-label={t('Trier les chaînes')} value={sort} onChange={e=>setSort(e.target.value as 'default'|'name'|'region'|'recent'|'reliable')}><option value="default">{t('Tri : par défaut')}</option><option value="name">{t('Nom (A-Z)')}</option><option value="region">{t('Région')}</option><option value="recent">{t('Récemment vues')}</option><option value="reliable">{t('Les plus fiables')}</option></select></label></div><div className="filter-group filter-group-region"><MultiSelect className="filter-field-region" label={t('Région')} ariaLabel={t('Filtrer par région')} allLabel={t('Toutes les régions')} countLabel={count=>t('{count} régions',{count})} groups={[...REGION_GROUPS.map(([group,members])=>({label:t(group),options:members.filter(r=>catalogueRegions.has(r)||regions.includes(r)).map(r=>[r,t(r)] as const)})).filter(group=>group.options.length),...(catalogueRegions.has('International')||regions.includes('International')?[{label:t('International'),options:[['International',t('International')] as const]}]:[])]} selected={regions} onChange={setRegions}/></div><div className="filter-group filter-group-toggles">{view==='channels'?<div className="catalog-toggles">{newCount>0&&<label className="playback-filter"><input type="checkbox" checked={newOnly} onChange={e=>setNewOnly(e.target.checked)}/>{t('Nouvelles chaînes ({count})',{count:newCount})}</label>}<label className="playback-filter"><input type="checkbox" checked={playbackOnly} onChange={e=>setPlaybackOnly(e.target.checked)}/>{t('Lecture dans Onde')}</label><label className="playback-filter"><input type="checkbox" checked={premiumOnly} onChange={e=>{setPremiumOnly(e.target.checked);if(e.target.checked)setPlaybackOnly(false);}}/>{t('Chaînes premium')}</label><label className="playback-filter"><input type="checkbox" checked={showGeoBlocked} onChange={e=>setShowGeoBlocked(e.target.checked)}/>{t('Afficher les chaînes géo-bloquées')}</label>{suspectCount>0&&<label className="playback-filter"><input type="checkbox" checked={hideSuspect} onChange={e=>setHideSuspect(e.target.checked)}/>{t('Masquer les chaînes à vérifier ({count})',{count:suspectCount})}</label>}</div>:<span className="free-note"><Check size={14}/>{t('Sans abonnement IPTV')}</span>}</div><div className="filter-panel-apply"><button type="button" className="primary" onClick={()=>setFiltersOpen(false)}>{displayed.length===0?t('Aucune chaîne à afficher'):displayed.length===1?t('Afficher 1 chaîne'):t('Afficher {count} chaînes',{count:displayed.length.toLocaleString(localeTag)})}</button></div></div></div></>}{displayed.length?<div className="channel-grid">{(view==='channels'?displayed.slice(0,visibleCount):displayed).slice(0,gridWarm?undefined:12).map(c=>renderChannelCard(c,view==='favorites'))}</div>:<div className="empty-state"><Heart size={30}/><h3>{t(view==='favorites'&&!data.favorites.length?'Un cœur, et c’est dans vos favoris.':'Aucune chaîne trouvée')}</h3><p>{t(view==='favorites'&&!data.favorites.length?'Appuyez sur le cœur d’une chaîne pour la retrouver ici.':'Essayez une autre recherche ou une autre région.')}</p><button className="secondary" onClick={()=>{setSearch('');setCategoriesChosen([]);setRegions([]);setLanguages([]);setNewOnly(false);setPlaybackOnly(false);if(view==='favorites'&&!data.favorites.length)navigate('channels');}}>{t(view==='favorites'&&!data.favorites.length?'Découvrir les chaînes':'Effacer les filtres')}</button></div>}{view==='channels'&&displayed.length>visibleCount&&<div className="catalog-more"><p>{t('{shown} chaînes affichées sur {total}',{shown:Math.min(visibleCount,displayed.length),total:displayed.length})}</p><button className="secondary" onClick={()=>setVisibleCount(n=>n+48)}>{t('Afficher 48 chaînes de plus')}<Plus size={16}/></button><span>{t('Vous pouvez aussi choisir un genre ou rechercher une chaîne.')}</span></div>}</section>
    </>}
    {view==='guide'&&<GuideExplorer now={now} onChoose={choose} search={search} onClearSearch={()=>setSearch('')} key={guideChannel} initialChannel={guideChannel} channels={channels} favorites={data.favorites}/>}
    {view==='selection'&&<section className="selection-section">
      <div className="selection-lead"><Sparkles size={22}/><p><strong>{t('Un choix éditorial, pas un classement automatique.')}</strong> {t('Des diffuseurs publics ou des flux gratuits et légaux, retenus parce qu’on les recommanderait à un ami — avec une raison pour chacun, et tous lisibles depuis le Québec.')}</p></div>
      <p className="selection-week"><CalendarDays size={15}/>{t('Sélection de la semaine du {date} · renouvelée chaque lundi',{date:weekStart(new Date(now||Date.now())).toLocaleDateString(localeTag,{day:'numeric',month:'long'})})}</p>
      {weekSelection.map((theme,index)=><article className="selection-theme" key={theme.id}>
        <header className="selection-theme-head"><span className="eyebrow">{String(index+1).padStart(2,'0')}</span><h2>{t(theme.title)}</h2><p>{t(theme.intro)}</p></header>
        <ol className="selection-list">
          {theme.picks.map((pick,rank)=>{const c=channelById(pick.channelId);return c?<li className="selection-row" key={pick.channelId}>
            <span className="selection-rank">{String(rank+1).padStart(2,'0')}</span>
            <span className="selection-brand"><Brand channel={c} small/></span>
            <div className="selection-copy"><button className="selection-name" onClick={()=>choose(c)}>{c.name}</button>{(()=>{const guide=guideIndex.get(c.id),live=guide&&now?currentProgramme(guide.programmes,now):undefined;return (live||pick.fresh)&&<span className="selection-badges">{live&&<span className="selection-badge selection-badge-live">{t('En direct : {title}',{title:live.title})}</span>}{pick.fresh&&<span className="selection-badge">{t('Nouveau cette semaine')}</span>}</span>;})()}<p>{t(pick.reason)}</p><span className="selection-meta">{c.region} · {languageLabel(c)}</span></div>
            <button className="secondary selection-play" onClick={()=>choose(c)} aria-label={t('Regarder {name}',{name:c.name})}><Play size={14} fill="currentColor"/>{t('Regarder')}</button>
          </li>:null;})}
        </ol>
      </article>)}
    </section>}
    {view==='lists'&&retiredNotice}{view==='lists'&&<section className="lists-section"><div className="section-heading"><div><h2 className={filterList?'list-detail-title':'list-index-title'}>{filterList?filterList.name:t('Mes listes')}<span className="section-count">{filterList?filterList.channels.length:data.lists.length}</span></h2><p>{t(signedIn?'Vos sélections sont synchronisées avec votre compte.':'Retrouvez vos sélections sur cet appareil.')}</p></div><button className="primary" onClick={()=>filterList?openEdit(filterList):openCreate()}>{filterList?<><Pencil size={16}/>{t('Modifier la liste')}</>:<><Plus size={17}/>{t('Nouvelle liste')}</>}</button></div>{filterList?<><button className="text-button" onClick={()=>openList(null)}>{t('← Toutes mes listes')}</button>{filterList.channels.length?<div className="channel-grid">{filterChannels(filterList.channels.map(id=>channelById(id)).filter((c):c is Channel=>!!c)).map(c=>renderChannelCard(c))}</div>:<div className="empty-state"><ListVideo size={32}/><h3>{t('Cette liste attend vos découvertes.')}</h3><p>{t('Choisissez les chaînes à y ajouter.')}</p><button className="secondary" onClick={()=>openEdit(filterList)}>{t('Ajouter des chaînes')}</button></div>}</>:data.lists.length?<div className="lists-grid">{data.lists.map((list,i)=><article className="list-card" key={list.id}><button className="list-open" onClick={()=>openList(list.id)}><div className={`list-art list-art-${i%3}`}><ListVideo size={42}/><span>{String(i+1).padStart(2,'0')}</span></div><h3>{list.name}</h3><p>{t(list.channels.length===1?'{count} chaîne':'{count} chaînes',{count:list.channels.length})}</p></button><button className="icon-button edit-list" onClick={()=>openEdit(list)} aria-label={t('Modifier la liste {name}',{name:list.name})}><MoreHorizontal size={20}/></button></article>)}</div>:<div className="empty-state"><ListVideo size={36}/><h3>{t('Une liste pour chaque envie.')}</h3><p>{t('« Culture », « Le matin », « À découvrir »…')}<br/>{t('Réunissez vos chaînes au même endroit.')}</p><button className="primary" onClick={()=>openCreate()}><Plus size={17}/>{t('Créer ma première liste')}</button></div>}</section>}
   </main>
  </div>
  <nav className="mobile-nav" aria-label={t('Navigation mobile')}>{navigation.map(n=><button key={n.id} aria-current={(view===n.id||(view==='lists'&&n.id==='favorites'))?'page':undefined} className={(view===n.id||(view==='lists'&&n.id==='favorites'))?'active':''} onClick={()=>navigate(n.id)}><n.icon size={20}/><span>{t(n.label)}</span></button>)}</nav>
  {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
  {reminderAlerts.length>0&&<div className="reminder-alerts" role="status">{reminderAlerts.slice(-3).map(reminder=>{const c=allChannels.find(item=>item.id===reminder.channelId),late=Math.floor((Date.now()-Date.parse(reminder.start))/60000),name=c?.name||reminder.channelId,close=()=>setReminderAlerts(alerts=>alerts.filter(item=>reminderKey(item)!==reminderKey(reminder)));return <div className="reminder-alert" key={reminderKey(reminder)}><BellRing size={18}/><div><strong>{reminder.title}</strong><span>{late>=2?t('A commencé il y a {count} min sur {name}',{count:late,name}):t('Commence maintenant sur {name}',{name})}</span></div>{c&&hasPlayback(c)&&<button className="primary" onClick={()=>{close();choose(c);}}><Play size={14} fill="currentColor"/>{t('Regarder')}</button>}<button className="icon-button" onClick={close} aria-label={t('Fermer le rappel')}><X size={16}/></button></div>;})}</div>}
  <dialog ref={programmeDialogRef} className="modal programme-dialog" aria-labelledby="programme-detail-title" onCancel={()=>setProgrammeDetail(null)} onClick={e=>{if(e.target===e.currentTarget)setProgrammeDetail(null);}}><div className="modal-body">{programmeDetail&&<><button className="modal-close icon-button" onClick={()=>setProgrammeDetail(null)} aria-label={t('Fermer les détails de l’émission')}><X size={22}/></button><span className="eyebrow">{programmeDetail.channel.name}</span><h2 id="programme-detail-title">{programmeDetail.programme.title}</h2><p>{new Date(programmeDetail.programme.start).toLocaleDateString(localeTag,{weekday:'long',day:'numeric',month:'long'})} · {programmeDetail.programme.end?t('{start} à {end}',{start:time(programmeDetail.programme.start),end:time(programmeDetail.programme.end)}):time(programmeDetail.programme.start)}</p><p>{programmeDetail.programme.detail||t('Le diffuseur n’a pas fourni de description pour cette émission.')}</p>{programmeDetail.notice&&<p className="guide-notice">{t(programmeDetail.notice)}</p>}<a className="schedule-link" href={programmeDetail.source} target="_blank" rel="noopener noreferrer">{t('Source : {label}',{label:t(programmeDetail.sourceLabel||'grille du diffuseur')})}<ArrowUpRight size={14}/></a><button className="primary full-width" onClick={()=>{setProgrammeDetail(null);openChannelGuide();}}>{t('Voir le guide de cette chaîne')}<CalendarDays size={16}/></button><ReminderToggle channelId={programmeDetail.channel.id} programme={programmeDetail.programme}/></>}</div></dialog>
  <dialog ref={dialogRef} className="modal" aria-label={t(modal==='membership'?'Ajouter à une liste':modal==='create'?'Créer une liste':'Modifier la liste')} onCancel={()=>setModal(null)} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}><div className="modal-body"><button className="modal-close icon-button" onClick={()=>setModal(null)} aria-label={t('Fermer')}><X size={22}/></button>{modal==='membership'?<><span className="eyebrow">{t('VOTRE SÉLECTION')}</span><h2>{t('Ajouter à une liste')}</h2><p>{membershipChannel?.name}</p>{error&&<p className="form-error" role="alert">{error}</p>}{data.lists.length?<div className="membership-list">{data.lists.map(l=><label key={l.id} className="checkbox-row"><ListVideo size={19}/><span>{l.name}</span><input type="checkbox" checked={!!membershipChannel&&l.channels.includes(membershipChannel.id)} onChange={e=>membershipChannel&&mutate({type:'listChannel',id:l.id,channel:membershipChannel.id,value:e.target.checked})}/></label>)}</div>:<p>{t('Créez une liste pour regrouper vos chaînes.')}</p>}<button className="secondary full-width" onClick={()=>openCreate(true)}><Plus size={16}/>{t('Créer une liste')}</button><button className="primary full-width" onClick={()=>setModal(null)}>{t('Terminé')}<Check size={16}/></button></>:<><span className="eyebrow">{t('MES LISTES')}</span><h2>{t(modal==='create'?'Une nouvelle envie ?':'Personnaliser la liste')}</h2><label className="field-label">{t('Nom de la liste')}<input autoFocus maxLength={48} value={listName} placeholder={t('Ex. Culture et découvertes')} onChange={e=>setListName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveList();}}}/></label>{(modalError||error)&&<p className="form-error" role="alert">{modalError||error}</p>}{modal==='edit'&&editList&&<><p className="field-label">{t('Chaînes de cette liste')}</p><label className="list-editor-search"><Search size={17}/><input aria-label={t('Rechercher une chaîne à ajouter')} placeholder={t('Rechercher une chaîne…')} value={listQuery} onChange={e=>setListQuery(e.target.value)}/></label><div className="edit-channels">{!matchingListChannels.length&&<p className="list-search-empty">{t('Aucune chaîne trouvée. Essayez un autre nom.')}</p>}{matchingListChannels.map(c=><label className="checkbox-row" key={c.id}><Brand channel={c} small/><span>{c.name}</span><input type="checkbox" checked={editList.channels.includes(c.id)} onChange={e=>mutate({type:'listChannel',id:editList.id,channel:c.id,value:e.target.checked})}/></label>)}</div></>}<button className="primary full-width" onClick={saveList}>{t(modal==='create'?'Créer la liste':'Enregistrer le nom')}<Check size={16}/></button>{modal==='edit'&&<button className="danger-button full-width" onClick={()=>{if(!confirmDelete){setConfirmDelete(true);return;}if(!listId||!mutate({type:'deleteList',id:listId})){setModalError(t('La liste n’a pas pu être supprimée. Réessayez.'));return;}setListFilter(null);setModal(null);setToast(t('Liste supprimée'));}}><Trash2 size={16}/>{t(confirmDelete?'Confirmer la suppression':'Supprimer cette liste')}</button>}</>}</div></dialog>
  <dialog ref={previewListRef} className="modal list-preview" aria-label={previewList?t('Chaînes de la liste {name}',{name:previewList.name}):t('Chaînes de la liste')} onCancel={()=>setPreviewListId(null)} onClick={e=>{if(e.target===e.currentTarget)setPreviewListId(null);}}><div className="modal-body"><button className="modal-close icon-button" onClick={()=>setPreviewListId(null)} aria-label={t('Fermer')}><X size={22}/></button><span className="eyebrow">{t('MES LISTES')}</span><h2>{previewList?.name||t('Liste')}</h2><p>{t(previewListChannels.length===1?'{count} chaîne dans cette liste':'{count} chaînes dans cette liste',{count:previewListChannels.length})}</p>{previewListChannels.length?<div className="list-preview-channels">{previewListChannels.map(c=><button key={c.id} type="button" className="list-preview-channel" onClick={()=>{choose(c);setPreviewListId(null);}} aria-label={t('Regarder {name}',{name:c.name})}><Brand channel={c} small/><span><strong>{c.name}</strong><small>{c.region} · {languageLabel(c)}</small></span><Play size={16}/></button>)}</div>:<p className="list-preview-empty">{t('Aucune chaîne dans cette liste pour le moment.')}</p>}<button className="secondary full-width" onClick={()=>{const id=previewList?.id||null;setPreviewListId(null);navigate('lists',()=>setListFilter(id));}}>{t('Ouvrir dans Mes listes')}</button></div></dialog>
  {settingsOpen&&<SettingsPanel onClose={()=>setSettingsOpen(false)} userId={userId} account={account} favoriteCount={data.favorites.length} listCount={data.lists.length} recentCount={recent.length} onClearRecent={clearRecent} onNewIdeas={newIdeas} theme={theme} onTheme={chooseTheme} settings={settings} onSettings={updateSettings}/>}{help&&<div className="help-backdrop" onClick={e=>{if(e.target===e.currentTarget)setHelp(false);}}><Help theme={theme} onClose={()=>setHelp(false)}/></div>}
 </div>;
}
function Help({onClose,theme}:{onClose:()=>void;theme:Theme}){
 const {t}=useLocale();
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="modal help-modal" aria-labelledby="help-title" ref={ref} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)ref.current?.close();}}><div className="modal-body"><button className="modal-close icon-button" onClick={()=>ref.current?.close()} aria-label={t('Fermer l’aide')}><X size={22}/></button><Logo theme={theme}/><h2 id="help-title">{t('Besoin d’un coup de main ?')}</h2><p>{t('Choisissez un sujet.')}</p><div className="help-topics">
<details><summary>{t('Regarder une chaîne')}</summary><p>{t('Choisissez une chaîne, puis appuyez sur Lecture. En cas de coupure, utilisez « Réessayer ». Certaines chaînes dépendent de votre région.')}</p></details>
<details><summary>{t('Regarder sur ma télé')}</summary><p>{t('Lancez une chaîne et appuyez sur « Sur ma télé ». Les deux appareils doivent être sur le même Wi-Fi. Les autres méthodes sont dans « Autres façons de diffuser ».')}</p></details>
<details><summary>{t('Mes favoris et mes listes')}</summary><p>{t('Le cœur garde une chaîne dans vos favoris. Le bouton + l’ajoute à une liste. Dans vos favoris, les flèches permettent de changer l’ordre.')}</p></details>
<details><summary>{t('Retrouver mes sélections ailleurs')}</summary><p>{t('Sans compte, vos sélections restent dans ce navigateur. Un compte Onde est optionnel et permet de les synchroniser entre vos appareils.')}</p></details>
<details><summary>{t('Consulter le programme')}</summary><p>{t('Choisissez une date ou « En cours ». Touchez une émission pour ses détails. Si la grille n’est pas disponible, ouvrez l’horaire du diffuseur.')}</p></details>
<details><summary>{t('Installer Onde')}</summary><p>{t('Sur Android : menu de Chrome, puis « Ajouter à l’écran d’accueil ». Sur iPhone : Partager, puis « Sur l’écran d’accueil ». Internet reste nécessaire pour regarder.')}</p></details>
<details><summary>{t('D’où viennent les chaînes ?')}</summary><p>{t('Onde utilise les lecteurs des diffuseurs et des flux publics, dont ceux répertoriés par IPTV-org. Les sources sont indiquées avec le lecteur et les programmes. La disponibilité peut varier selon la région. Les horaires manquants ne sont pas inventés.')}</p></details>
</div><button className="primary full-width" onClick={()=>ref.current?.close()}>{t('C’est parti')}<ChevronRight size={17}/></button></div></dialog>;
}
