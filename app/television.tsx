'use client';
import { makeId } from '../lib/identifiers';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Radio, Home, Heart, CalendarDays, ListVideo, Search, Plus, ArrowUpRight, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, CloudCheck, CloudOff, RefreshCw, X, Check, MonitorSmartphone, Info, Play, SlidersHorizontal, ExternalLink, MoreHorizontal, Trash2, Pencil, Globe2, Wifi, Menu, Clock3, Newspaper, Film, Music, Baby, UserRound, Sun, Moon, CircleHelp, Sparkles, Palette } from 'lucide-react';
import { channels as baseChannels, languageLabel, type Channel } from '../lib/channels';
import { getChannelLogo } from '../lib/channel-logos';
import type {CataloguePayload} from '../lib/catalogue-maintenance';
import type { Guide, Programme } from '../lib/guide';
import type { ChannelList } from '../lib/preferences';
import { usePreferences } from './use-preferences';
import {clearPreferenceCache} from '../lib/preference-cache';
import Player from './player';
import Logo from './onde-logo';
import {useLocale} from './locale-provider';
import AccountPanel from './account-panel';
import GuideExplorer from './guide-explorer';
import {CategoryIcon,discoveryCategories,categoryGroup} from './category-icon';
import {discoverChannels} from '../lib/discover';
import {rememberChannel,type RecentChannel} from '../lib/recent';
import {isTheme,themes,type Theme} from '../lib/themes';
import ThemeBackdrop from './theme-backdrop';
import {selection} from '../lib/selection';
import { hasPlayback } from '../lib/playback';
import {detectViewerCountry,isLikelyGeoBlocked,viewerCountryLabel,type ViewerCountry} from '../lib/geo';
type View='home'|'channels'|'favorites'|'guide'|'selection'|'lists';
const pageOrder:View[]=['home','channels','favorites','guide','selection'];
type ViewTransitionDocument=Document&{startViewTransition?:(callback:()=>void)=>{finished:Promise<void>}};
const navigation=[{id:'home',label:'Accueil',icon:Home},{id:'channels',label:'Chaînes',icon:Radio},{id:'favorites',label:'Favoris',icon:Heart},{id:'guide',label:'Programme',icon:CalendarDays},{id:'selection',label:'Sélection',icon:Sparkles}] as const;

function Brand({channel,small=false}:{channel:Channel;small?:boolean}){const [failedLogo,setFailedLogo]=useState<string|null>(null);const logo=getChannelLogo(channel);return <span className={`brand ${logo&&logo!==failedLogo?'brand-has-logo':''} ${logo&&logo!==failedLogo&&/(?:white|light)/i.test(logo)?'brand-logo-dark':''} ${small?'brand-small':''} ${!small&&Math.max(...channel.brand.split('\n').map(x=>x.length))>12?'brand-dense':!small&&Math.max(...channel.brand.split('\n').map(x=>x.length))>8?'brand-compact':''} brand-${channel.id}`} style={{'--brand-color':channel.color} as React.CSSProperties}>{logo&&logo!==failedLogo?<img className="channel-logo" src={logo} alt="" loading="lazy" decoding="async" onError={()=>setFailedLogo(logo)}/>:channel.brand.split('\n').map((line,i)=><span key={i}>{line}</span>)}</span>;}
function time(value:string){return new Date(value).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'});}
function currentProgramme(programmes:Programme[],now:number){return programmes.find(p=>Date.parse(p.start)<=now&&p.end&&Date.parse(p.end)>now);}
function HomeCarousel({title,action,actionLabel,trackClass,children}:{title:string;action?:()=>void;actionLabel?:string;trackClass:string;children:ReactNode}){
 const {t}=useLocale();
 const ref=useRef<HTMLDivElement>(null),[edges,setEdges]=useState({previous:false,next:false});
 useEffect(()=>{const el=ref.current;if(!el)return;const update=()=>setEdges({previous:el.scrollLeft>1,next:el.scrollLeft+el.clientWidth<el.scrollWidth-1});update();const observer=new ResizeObserver(update);observer.observe(el);for(const child of Array.from(el.children))observer.observe(child);el.addEventListener('scroll',update,{passive:true});return()=>{observer.disconnect();el.removeEventListener('scroll',update);};},[children]);
 const move=(direction:number)=>{const el=ref.current;if(el)el.scrollBy({left:direction*el.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
 return <><div className="home-section-heading"><h2>{t(title)}</h2><div className="home-carousel-controls">{action&&<button className="home-carousel-all" onClick={action}>{t(actionLabel||'Tout voir')} <ChevronRight size={18}/></button>}<button className="home-carousel-arrow" aria-label={`Faire défiler ${title} vers la gauche`} disabled={!edges.previous} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><button className="home-carousel-arrow" aria-label={`Faire défiler ${title} vers la droite`} disabled={!edges.next} onClick={()=>move(1)}><ChevronRight size={18}/></button></div></div><div className={trackClass} ref={ref} tabIndex={0} role="group" aria-label={title} data-previous={edges.previous?'true':'false'} data-next={edges.next?'true':'false'}>{children}</div></>;
}
export default function Television({userId,initialTheme='dark'}:{userId:string|null;initialTheme?:Theme}){
 const signedIn=!!userId;
 const {locale,setLocale,t}=useLocale();
 const [account,setAccount]=useState(false);
 const [theme,setTheme]=useState<Theme>(initialTheme);
 const [themeMenu,setThemeMenu]=useState(false);
 const [localeMenu,setLocaleMenu]=useState(false);
 const rememberTheme=(next:Theme)=>{try{localStorage.setItem('onde-theme',next);document.cookie=`onde-theme=${next};path=/;max-age=31536000;SameSite=Lax${location.protocol==='https:'?';Secure':''}`;}catch{}};
 useEffect(()=>{try{const saved=localStorage.getItem('onde-theme');if(isTheme(saved)){setTheme(saved);rememberTheme(saved);}}catch{}},[]);
 const chooseTheme=(next:Theme)=>{setTheme(next);setThemeMenu(false);rememberTheme(next);};
 useEffect(()=>{
  if(!themeMenu)return;
  const close=(event:MouseEvent)=>{if(!(event.target as HTMLElement).closest('.theme-picker'))setThemeMenu(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setThemeMenu(false);};
  document.addEventListener('mousedown',close);window.addEventListener('keydown',key);
  return()=>{document.removeEventListener('mousedown',close);window.removeEventListener('keydown',key);};
 },[themeMenu]);
 useEffect(()=>{
  if(!localeMenu)return;
  const close=(event:MouseEvent)=>{if(!(event.target as HTMLElement).closest('.locale-picker'))setLocaleMenu(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setLocaleMenu(false);};
  document.addEventListener('mousedown',close);window.addEventListener('keydown',key);
  return()=>{document.removeEventListener('mousedown',close);window.removeEventListener('keydown',key);};
 },[localeMenu]);
 useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
 const [catalogue,setCatalogue]=useState<CataloguePayload|null>(null),[catalogueRefreshing,setCatalogueRefreshing]=useState(false),[catalogueError,setCatalogueError]=useState(false);
 const allChannels=catalogue?.channels||baseChannels;
 const [viewerCountry,setViewerCountry]=useState<ViewerCountry>('XX');
 const [showGeoBlocked,setShowGeoBlocked]=useState(false);
 useEffect(()=>{setViewerCountry(detectViewerCountry());},[]);
 const channels=useMemo(()=>allChannels.filter(c=>showGeoBlocked||!isLikelyGeoBlocked(c,viewerCountry)),[allChannels,viewerCountry,showGeoBlocked]);
 const channelById=(id:string)=>channels.find(c=>c.id===id);
 const isNew=(id:string)=>!!catalogue?.recentIds.includes(id);
 const newCount=channels.filter(c=>isNew(c.id)).length;
 const {data,status,error,mutate,refresh}=usePreferences(userId,allChannels);
 async function loadCatalogue(){setCatalogueRefreshing(true);try{const r=await fetch('/api/catalogue',{cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json() as CataloguePayload;if(!Array.isArray(data.channels)||!data.health||!Array.isArray(data.recentIds))throw new Error();setCatalogue(data);setCatalogueError(false);}catch{setCatalogueError(true);}finally{setCatalogueRefreshing(false);}}
 useEffect(()=>{void loadCatalogue();const update=()=>{if(!document.hidden)void loadCatalogue();};const timer=setInterval(update,300000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[]);
 const [view,setView]=useState<View>('home'),[showPlayer,setShowPlayer]=useState(false),[region,setRegion]=useState('Toutes'),[category,setCategory]=useState('Toutes');
 const [playbackOnly,setPlaybackOnly]=useState(true),[language,setLanguage]=useState('Toutes'),[newOnly,setNewOnly]=useState(false);
 const [visibleCount,setVisibleCount]=useState(48);
 const [search,setSearch]=useState(''),[selected,setSelected]=useState('savoir'),[active,setActive]=useState(false);
 const [searchFocus,setSearchFocus]=useState(false);
 const [sort,setSort]=useState<'default'|'name'|'region'|'recent'>('default');
 const [hideSuspect,setHideSuspect]=useState(false);
 useEffect(()=>{setVisibleCount(48);},[region,category,language,playbackOnly,newOnly,view,search]);
 const [guideChannel,setGuideChannel]=useState('integrated');
 const [programmeDetail,setProgrammeDetail]=useState<{channel:Channel;programme:Programme;source:string;sourceLabel?:string;notice?:string}|null>(null);
 const programmeDialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(programmeDetail)programmeDialogRef.current?.showModal();else programmeDialogRef.current?.close();},[programmeDetail]);
 const [guides,setGuides]=useState<Guide[]>([]),[guideLoading,setGuideLoading]=useState(true),[guideError,setGuideError]=useState(false);
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
 const playerRef=useRef<HTMLDivElement>(null),interacted=useRef(false),dialogRef=useRef<HTMLDialogElement>(null);
 const channel=channelById(selected)||channels[0]||baseChannels[0];
 const selectedGuide=guides.find(g=>g.channel===selected);
 const current=selectedGuide?currentProgramme(selectedGuide.programmes,now):undefined;
 const upcoming=selectedGuide?.programmes.filter(p=>Date.parse(p.start)>now).slice(0,3)||[];
 const last=channelById(data.lastChannel||'');
 useEffect(()=>{setNow(Date.now());const i=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(i);},[]);
 useEffect(()=>{if(data.lastChannel&&!interacted.current){setSelected(data.lastChannel);}},[data.lastChannel]);
 function mergeGuides(incoming:Guide[]){setGuides(previous=>{const byId=new Map(previous.map(g=>[g.channel,g]));for(const guide of incoming)byId.set(guide.channel,guide);return [...byId.values()];});}
 async function fetchGuides(url:string,signal?:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data))throw new Error();return data as Guide[];}
 async function loadGuide(){setGuideLoading(true);const results=await Promise.allSettled(['/api/guide','/api/guide?scope=community'].map(async url=>{mergeGuides(await fetchGuides(url));}));setGuideError(results.every(r=>r.status==='rejected'));setGuideLoading(false);}
 useEffect(()=>{const controller=new AbortController();void fetchGuides('/api/guide?channel='+encodeURIComponent(selected),controller.signal).then(mergeGuides).catch(()=>{});return()=>controller.abort();},[selected]);
 useEffect(()=>{void loadGuide();const i=setInterval(()=>{if(!document.hidden)void loadGuide();},300000);return()=>clearInterval(i);},[]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(id);},[toast]);
 useEffect(()=>{if(modal){dialogRef.current?.showModal();}else dialogRef.current?.close();},[modal]);
 const appRef=useRef<HTMLDivElement>(null);
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
 const navigate=(id:View)=>{
  if(id===view){window.scrollTo({top:0,behavior:'smooth'});return;}
  const run=(smooth:boolean)=>{
   if(id==='favorites'||id==='lists'){setSearch('');setRegion('Toutes');setCategory('Toutes');setLanguage('Toutes');setNewOnly(false);}
   if(id==='guide'){setSearch('');setGuideChannel('integrated');}
   if(id==='selection'){setSearch('');}
   setView(id);setListFilter(null);setMobileMenu(false);
   window.scrollTo({top:0,behavior:smooth?'smooth':'auto'});
  };
  const direction=pageIndex(id)>=pageIndex(view)?'forward':'back';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc=document as ViewTransitionDocument;
  if(!reduced&&doc.startViewTransition){
   const token=++navToken.current;
   const cleanup=()=>{if(navToken.current===token)delete document.documentElement.dataset.nav;};
   document.documentElement.dataset.nav=direction;
   const transition=doc.startViewTransition(()=>{flushSync(()=>run(false));});
   const fallback=window.setTimeout(cleanup,1100);
   void transition.finished.finally(()=>{window.clearTimeout(fallback);cleanup();});
  }else{
   run(!reduced);
   requestAnimationFrame(()=>{
    const main=document.getElementById('contenu');
    main?.animate([{opacity:.2,transform:`translate3d(${direction==='forward'?26:-26}px,0,0)`},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:reduced?1:420,easing:'cubic-bezier(.22,.8,.2,1)'});
   });
  }
 };
 const onTouchStart=(event:React.TouchEvent<HTMLDivElement>)=>{
  if(event.touches.length!==1){swipeStart.current=null;return;}
  const target=event.target as Element;
  if(target.closest?.('input,select,textarea,video,iframe,dialog,details,.player-shell,.home-favorite-row,.home-category-grid,.guide-days,.region-tabs,.theme-menu,.search-results,.topbar,.sidebar,.mobile-nav')){swipeStart.current=null;return;}
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
 const remember=(id:string)=>setRecent(current=>{const next=rememberChannel(current,id,new Date().toISOString());try{localStorage.setItem('onde-recent',JSON.stringify(next));}catch{}return next;});
 const choose=(c:Channel,play=true)=>{interacted.current=true;setSelected(c.id);remember(c.id);setActive(play);mutate({type:'last',channel:c.id});setShowPlayer(true);if(view!=='home')setView('home');requestAnimationFrame(()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));};
 const openChannelGuide=()=>{setGuideChannel(selected);setSearch('');setView('guide');setMobileMenu(false);};
 const showProgramme=(programme:Programme)=>setProgrammeDetail({channel,programme,source:selectedGuide?.source||channel.guide,sourceLabel:selectedGuide?.sourceLabel,notice:selectedGuide?.notice});
 const favorite=(c:Channel)=>{const value=!data.favorites.includes(c.id);if(!mutate({type:'favorite',channel:c.id,value}))return;setToast(value?`${c.name} ajouté aux favoris`:`${c.name} retiré des favoris`);};
 const openCreate=(withChannel=false)=>{if(!withChannel)setMembershipChannel(null);setListName('');setModalError('');setModal('create');setListId(null);};
 const openEdit=(list:ChannelList)=>{setListQuery('');setListId(list.id);setListName(list.name);setConfirmDelete(false);setModalError('');setModal('edit');};
 const openMembership=(c:Channel)=>{setMembershipChannel(c);setModal('membership');};
 const saveList=()=>{
  if(!listName.trim()||listName.trim().length>48){setModalError('Choisissez un nom de 1 à 48 caractères.');return;}
  if(modal==='create'){const id=makeId();if(!mutate({type:'createList',id,name:listName})){setModalError('Impossible de créer cette liste. Vérifiez sa limite de 20 listes.');return;}if(membershipChannel)mutate({type:'listChannel',id,channel:membershipChannel.id,value:true});setSearch('');setRegion('Toutes');setCategory('Toutes');setLanguage('Toutes');setNewOnly(false);setListFilter(id);setView('lists');setToast('Votre liste a été créée');}
  else if(listId){if(!mutate({type:'renameList',id:listId,name:listName})){setModalError('Le nom n’a pas pu être enregistré. Réessayez.');return;}setToast('Nom de la liste modifié');}
  setModal(null);
 };
 const matchingListChannels=channels.filter(c=>c.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(listQuery.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
 const editList=data.lists.find(l=>l.id===listId);
 const filterList=data.lists.find(l=>l.id===listFilter);
 const filterChannels=(items:Channel[])=>{
  const matches=items.filter(c=>(region==='Toutes'||c.region===region)&&(category==='Toutes'||categoryGroup(c.category)===category)&&(language==='Toutes'||(c.language||'fr')===language)&&(!hideSuspect||catalogue?.health[c.id]?.state!=='suspect')&&[c.name,c.category,c.region,languageLabel(c),c.description].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
  if(sort==='name')return [...matches].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  if(sort==='region')return [...matches].sort((a,b)=>a.region.localeCompare(b.region,'fr')||a.name.localeCompare(b.name,'fr'));
  if(sort==='recent'){const rank=new Map(recent.map((entry,position)=>[entry.id,position]));return [...matches].sort((a,b)=>(rank.get(a.id)??999)-(rank.get(b.id)??999));}
  return matches;
 };
 const searchQuery=search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const searchMatches=searchQuery.length>=2?channels.filter(c=>[c.name,c.category,c.region].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(searchQuery)):[];
 const displayed=filterChannels(view==='favorites'?data.favorites.map(id=>channelById(id)).filter((c):c is Channel=>!!c):channels.filter(c=>(!playbackOnly||hasPlayback(c))&&(!newOnly||isNew(c.id))));
 const favoriteChannels=data.favorites.map(id=>channelById(id)).filter((c):c is Channel=>!!c);
 const homeChannels=favoriteChannels.length?favoriteChannels:channels.filter(c=>hasPlayback(c)).slice(0,6);
 const date=now?new Date(now).toLocaleDateString(locale==='fr'?'fr-CA':'en-CA',{weekday:'long',day:'numeric',month:'long'}):'';
 const favorites=favoriteChannels;
 const recentChannels=recent.map(entry=>channelById(entry.id)).filter((c):c is Channel=>!!c).slice(0,6);
 const suspectCount=channels.filter(c=>catalogue?.health[c.id]?.state==='suspect').length;
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
  const guide=guides.find(g=>g.channel===c.id),p=guide?currentProgramme(guide.programmes,now):undefined;
  const isFavorite=data.favorites.includes(c.id),health=catalogue?.health[c.id];
  return <article key={c.id} className={`channel-card ${selected===c.id?'channel-selected':''}`}>
   <div className={`card-visual visual-${c.id}`} style={{'--brand-color':c.color} as React.CSSProperties}>
    <button className="card-select" onClick={()=>choose(c)} aria-label={t('Regarder {name}',{name:c.name})}><Brand channel={c}/><span className="hover-play"><Play size={18} fill="currentColor"/></span></button>
    <button className={`card-favorite ${isFavorite?'is-favorite':''}`} onClick={()=>favorite(c)} title={isFavorite?'Retirer des favoris':'Ajouter aux favoris'} aria-label={`${isFavorite?'Retirer':'Ajouter'} ${c.name} ${isFavorite?'des':'aux'} favoris`} aria-pressed={isFavorite}><Heart size={17} fill={isFavorite?'currentColor':'none'}/></button>
    <span className={`playback-tag ${hasPlayback(c)?'integrated':''}`}>{hasPlayback(c)?<><span/>{t(c.limited?'Selon région':'Dans Onde')}</>:<>{t('Site officiel')}<ArrowUpRight size={10}/></>}</span>
   </div>
   <div className="card-body"><div className="card-title-line"><button onClick={()=>choose(c)} className="card-title">{c.name}</button><button className="icon-button" onClick={()=>openMembership(c)} aria-label={`Ajouter ${c.name} à une liste`} title="Ajouter à une liste"><Plus size={17}/></button></div><p className="card-meta">{c.region}<span>·</span>{t(languageLabel(c))}<span>·</span>{c.category}</p>{p?<p className="card-programme"><span className="tiny-dot"/>{p.title}</p>:<p className="card-programme muted">{t(hasPlayback(c)?'Direct gratuit':'Lecture intégrée non disponible')}</p>}
    {health?.state==='suspect'&&<p className="channel-health" title={health.note}>{t('À vérifier · plusieurs contrôles en échec')}</p>}
    {reorder&&<div className="reorder-controls"><span>Classer ce favori</span><button className="icon-button" disabled={data.favorites.indexOf(c.id)===0} onClick={()=>mutate({type:'move',channel:c.id,direction:-1})} aria-label={`Monter ${c.name}`}><ArrowUp size={15}/></button><button className="icon-button" disabled={data.favorites.indexOf(c.id)===data.favorites.length-1} onClick={()=>mutate({type:'move',channel:c.id,direction:1})} aria-label={`Descendre ${c.name}`}><ArrowDown size={15}/></button></div>}
   </div>
  </article>;
 }
 return <div className="app-shell" data-theme={theme} ref={appRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}><ThemeBackdrop theme={theme}/><a className="skip-link" href="#contenu">Aller au contenu</a>
  <aside className={`sidebar ${mobileMenu?'mobile-open':''}`} aria-label="Navigation principale"><a className="brand-link" href="#" onClick={e=>{e.preventDefault();navigate('home');}} aria-label="Onde, accueil"><Logo/></a><p className="sidebar-caption">{t('VOTRE FENÊTRE SUR LE MONDE')}</p><nav>{navigation.map(item=><button key={item.id} aria-current={(view===item.id||(view==='lists'&&item.id==='favorites'))?'page':undefined} className={`nav-item ${(view===item.id||(view==='lists'&&item.id==='favorites'))?'nav-active':''}`} onClick={()=>navigate(item.id)}><item.icon size={19}/>{t(item.label)}{item.id==='favorites'&&data.favorites.length>0&&<span className="nav-count">{data.favorites.length}</span>}</button>)}</nav><div className="sidebar-lists"><div className="sidebar-section-label">{t('VOS LISTES')}<button className="icon-button" onClick={()=>openCreate()} aria-label={t('Créer une liste')}><Plus size={16}/></button></div>{data.lists.length?data.lists.map(list=><button key={list.id} className={`list-nav ${listFilter===list.id&&view==='lists'?'list-nav-active':''}`} onClick={()=>{navigate('lists');setListFilter(list.id);}}><span className="list-color"/>{list.name}<span>{list.channels.length}</span></button>):<button className="create-list-sidebar" onClick={()=>openCreate()}><Plus size={15}/>{t('Créer ma première liste')}</button>}</div><div className="sidebar-bottom"><div className="device-note"><MonitorSmartphone size={22}/><strong>{t(signedIn?'Votre télé vous suit.':'Votre télé, à votre rythme.')}</strong><p>{t(signedIn?'Vos favoris sur tous vos écrans.':'Vos favoris restent sur cet appareil. Le compte est optionnel.')}</p></div><span className="sidebar-version">{t('FAIT POUR LES MOMENTS SIMPLES')}</span></div></aside>
  {mobileMenu&&<button className="menu-backdrop" onClick={()=>setMobileMenu(false)} aria-label="Fermer le menu"/>}
  <div className="main-shell"><header className={`topbar topbar-${view}`}><div className="mobile-brand"><button className="icon-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label={t('Ouvrir le menu')}><Menu size={22}/></button><Logo/></div><div className="breadcrumb">{t('Mon espace télé')} <ChevronRight size={13}/><span>{t(navigation.find(n=>n.id===view)?.label||'Mes listes')}</span></div><div className="search-wrap"><label className="search-box"><Search size={18}/><input placeholder={t('Rechercher une chaîne…')} value={search} onFocus={()=>setSearchFocus(true)} onBlur={()=>setTimeout(()=>setSearchFocus(false),160)} onChange={e=>{setSearch(e.target.value);setSearchFocus(true);}} onKeyDown={e=>{if(e.key==='Escape'){setSearch('');setSearchFocus(false);(e.target as HTMLInputElement).blur();}else if(e.key==='Enter'&&searchMatches[0]){choose(searchMatches[0]);setSearch('');setSearchFocus(false);}}} aria-label={t('Rechercher une chaîne')} aria-controls="search-results" aria-expanded={searchFocus&&searchMatches.length>0}/>{search&&<button className="icon-button" onClick={()=>setSearch('')} aria-label={t('Effacer la recherche')}><X size={14}/></button>}</label>{searchFocus&&searchMatches.length>0&&<div className="search-results" id="search-results" role="listbox" aria-label={t('Résultats de recherche')}>{searchMatches.slice(0,6).map(c=><button key={c.id} className="search-result" role="option" aria-selected="false" onMouseDown={e=>e.preventDefault()} onClick={()=>{choose(c);setSearch('');setSearchFocus(false);}}><Brand channel={c} small/><span className="search-result-copy"><strong>{c.name}</strong><small>{c.region} · {c.category}</small></span></button>)}{searchMatches.length>6&&<button className="search-all" onMouseDown={e=>e.preventDefault()} onClick={()=>{setView('channels');setSearchFocus(false);}}>{t('Voir les {count} résultats',{count:searchMatches.length})}</button>}</div>}</div><button className={`sync-indicator ${status==='offline'?'sync-offline':''}`} onClick={()=>void refresh()} title={`${t(syncLabels[status])}. ${t('Cliquer pour actualiser.')}`}>{status==='offline'?<CloudOff size={17}/>:status==='loading'||status==='pending'?<RefreshCw size={17} className="spin"/>:<CloudCheck size={17}/>}<span>{t(syncLabels[status])}</span></button><button className="icon-button topbar-help" onClick={()=>setHelp(true)} aria-label={t('Aide et sources')} title={t('Aide et sources')}><CircleHelp size={20}/></button><div className="locale-picker"><button className="locale-switch" onClick={()=>setLocaleMenu(open=>!open)} aria-haspopup="listbox" aria-expanded={localeMenu} aria-label={t('Changer la langue')} title={t('Changer la langue')}><Globe2 size={17}/><span>{locale==='fr'?'FR':'EN'}</span></button>{localeMenu&&<div className="locale-menu" role="listbox" aria-label={t('Changer la langue')}><button type="button" role="option" aria-selected={locale==='fr'} className={locale==='fr'?'is-active':''} onClick={()=>{setLocale('fr');setLocaleMenu(false);}}>Français</button><button type="button" role="option" aria-selected={locale==='en'} className={locale==='en'?'is-active':''} onClick={()=>{setLocale('en');setLocaleMenu(false);}}>English</button></div>}</div><div className="theme-picker"><button className="theme-switch" onClick={()=>setThemeMenu(open=>!open)} aria-haspopup="listbox" aria-expanded={themeMenu} aria-label={t('Choisir un thème')} title={t('Choisir un thème')}><Palette size={20}/></button>{themeMenu&&<div className="theme-menu" role="listbox" aria-label={t('Thèmes')}>{themes.map((entry,index)=><button key={entry.id} type="button" role="option" aria-selected={theme===entry.id} data-theme-id={entry.id} className={'theme-option'+(theme===entry.id?' theme-option-active':'')} style={{'--swatch':entry.swatch,'--accent':entry.accent,'--i':index} as React.CSSProperties} onClick={()=>chooseTheme(entry.id)}><span className="theme-preview" aria-hidden="true"><i/><i/></span><span className="theme-option-label">{t(entry.label)}</span>{theme===entry.id&&<Check size={15} className="theme-option-check"/>}</button>)}</div>}</div>{signedIn?<button className="profile-avatar" onClick={()=>setAccount(true)} aria-label={t('Mon compte')}><UserRound size={20}/></button>:<a className="profile-avatar" href="/sign-in" aria-label={t('Se connecter ou créer un compte')}><UserRound size={20}/></a>}</header>
   <main id="contenu" className={`main-content view-main-${view}`}>
    <span className="sr-only page-announcer" aria-live="polite">{navigation.find(item=>item.id===(view==='lists'?'favorites':view))?.label||'Mes listes'}</span>
    {catalogueError&&<div className="notice" role="status"><span>{t('Actualisation du catalogue indisponible. Les chaînes déjà chargées restent accessibles.')}</span><button onClick={()=>void loadCatalogue()}>{t('Réessayer')}</button></div>}
    {error&&status!=='offline'&&<div className="notice" role="alert"><Info size={17}/><span>{error}</span></div>}{status==='offline'&&<div className="notice" role="status"><CloudOff size={17}/><span>{error||t('Connexion interrompue. Les modifications en attente seront envoyées à la reconnexion.')}</span><button onClick={()=>void refresh()}>{t('Réessayer')}</button></div>}
    <div className={`page-heading heading-${view}`}><div><div className="eyebrow">{t(view==='home'?'BIENVENUE CHEZ VOUS':view==='channels'?'TOUTES VOS ENVIES':view==='favorites'?'VOTRE SÉLECTION PERSONNELLE':view==='guide'?'À CHACUN SON PROGRAMME':view==='selection'?'LE CHOIX D’ONDE':'VOS LISTES')}</div><h1>{t(view==='home'?(showPlayer||active?'À l’écran':'On regarde quoi ?'):view==='channels'?'Les chaînes':view==='favorites'?'Mes favoris':view==='guide'?'Programme':view==='selection'?'La sélection':'Mes listes')}</h1><p>{t(view==='home'?'Votre télé, tout simplement.':view==='channels'?'Découvrez les chaînes qui vous ressemblent.':view==='favorites'?'Retrouvez vos chaînes et vos listes.':view==='guide'?'Découvrez les horaires disponibles.':view==='selection'?'Les meilleures chaînes par genre, choisies à la main.':'Regroupez vos chaînes selon vos envies.')}</p></div><span className="today-date"><span className="tiny-dot"/>{date}</span></div>
    <section className={view==='home'&&(showPlayer||active)?'watch-section':view!=='home'&&active?'watch-dock':'watch-hidden'} aria-label="Lecteur et programmes"><div className="watch-main" ref={playerRef}><Player key={channel.id} channel={channel} programmeTitle={current?.title} programmes={selectedGuide?.programmes} now={now} active={active} onPlay={()=>{setActive(true);interacted.current=true;mutate({type:'last',channel:channel.id});}}/></div>{view==='home'&&<aside className="up-next"><div className="panel-heading"><span className="eyebrow">SUR CETTE CHAÎNE</span><CalendarDays size={17}/></div><div className="now-heading"><span className="tiny-dot"/><span>En ce moment</span></div><h3>{current?.title||(guideLoading?'Chargement de l’horaire…':channel.name)}</h3><p className="now-description">{current?`${time(current.start)} à ${time(current.end)}`:channel.description}</p>{current?.detail&&current.detail!==current.title&&<p className="now-programme-detail">{current.detail}</p>}{current&&<button className="programme-detail-link" onClick={()=>showProgramme(current)}>Détails de l’émission<ArrowUpRight size={13}/></button>}{selectedGuide?.notice&&<p className="guide-notice">{selectedGuide.notice}</p>}{current&&<div className="programme-progress"><span style={{width:`${Math.max(0,Math.min(100,(now-Date.parse(current.start))/(Date.parse(current.end)-Date.parse(current.start))*100))}%`}}/></div>}{!current&&!guideLoading&&<p className="schedule-unavailable">{selectedGuide?.error?'Horaire intégré indisponible.':'La programmation détaillée n’est pas intégrée pour cette chaîne.'}</p>}<div className="next-programmes"><span className="eyebrow">{upcoming.length?'ENSUITE':'POUR CONTINUER'}</span>{upcoming.length?upcoming.map(p=><button className="next-item next-programme-button" key={p.start} onClick={()=>showProgramme(p)}><span>{time(p.start)}</span><span><strong>{p.title}</strong>{p.detail&&p.detail!==p.title&&<small>{p.detail}</small>}</span></button>):<a className="schedule-link" href={channel.guide} target="_blank" rel="noopener noreferrer">{channel.guide===channel.official?'Site du diffuseur':'Horaire de '+channel.name}<ArrowUpRight size={16}/></a>}</div><button className="guide-button" onClick={openChannelGuide}>Guide de cette chaîne<ArrowUpRight size={17}/></button></aside>}{view!=='home'&&active&&<div className="dock-controls"><button onClick={()=>navigate('home')}>Agrandir le lecteur<ArrowUpRight size={14}/></button><button onClick={()=>setActive(false)} aria-label="Arrêter et fermer le lecteur"><X size={16}/></button></div>}</section>
{view==='home'&&<>
     {!showPlayer&&!active&&<section className="desktop-first" aria-labelledby="home-first-title"><Radio size={36}/><span className="hero-eyebrow">{last?t('Reprendre où vous en étiez'):(locale==='fr'?`${channels.length.toLocaleString('fr-CA')} chaînes · sans abonnement`:`${channels.length.toLocaleString('en-CA')} CHANNELS · NO SUBSCRIPTION`)}</span><h2 id="home-first-title">{last?last.name:t('Toute la télé, au même endroit')}</h2><p>{last?last.description:t('Le Québec, le Canada, la France et les États-Unis, réunis dans un lecteur simple et gratuit.')}</p><div className="hero-actions"><button className="primary" onClick={()=>last?choose(last):navigate('channels')}><Play size={17} fill="currentColor"/>{t(last?'Reprendre cette chaîne':'Explorer les chaînes')}</button><button className="hero-secondary" onClick={()=>navigate('guide')}><CalendarDays size={16}/>{t('Voir le programme')}</button></div></section>}
     <aside className="desktop-home-panel" aria-label="Chaînes et programme"><section className="desktop-channel-panel"><div className="desktop-panel-heading"><h2>{t('Mes chaînes')}</h2><button onClick={()=>navigate('channels')}>{t('Voir toutes')} <ChevronRight size={15}/></button></div><div className="desktop-channel-list">{homeChannels.map(c=><div className={`desktop-channel-row ${active&&selected===c.id?'desktop-channel-playing':''}`} key={c.id}><button className="desktop-channel-open" onClick={()=>choose(c)} aria-label={`Regarder ${c.name}`}><Brand channel={c} small/><strong>{c.name}</strong></button><button className={`desktop-channel-heart ${data.favorites.includes(c.id)?'is-favorite':''}`} onClick={()=>favorite(c)} aria-label={`${data.favorites.includes(c.id)?'Retirer':'Ajouter'} ${c.name} ${data.favorites.includes(c.id)?'des':'aux'} favoris`} aria-pressed={data.favorites.includes(c.id)}><Heart size={19} fill={data.favorites.includes(c.id)?'currentColor':'none'}/></button></div>)}</div></section><section className="desktop-programme-panel"><div className="desktop-panel-heading"><h2>{t('Programme')}</h2><button onClick={()=>navigate('guide')}>{t('Voir plus')} <ChevronRight size={15}/></button></div>{(active||showPlayer)?<>{current&&<button className="desktop-programme-row" onClick={()=>showProgramme(current)}><span>En ce moment</span><strong>{current.title}</strong><small>{time(current.start)} à {time(current.end)}</small></button>}{upcoming.map(p=><button className="desktop-programme-row" key={p.start} onClick={()=>showProgramme(p)}><span>{time(p.start)}</span><strong>{p.title}</strong></button>)}{!current&&!upcoming.length&&<p>{t(guideLoading?'Chargement du programme…':'Horaire indisponible pour cette chaîne.')}</p>}</>:<p>{t('Choisissez une chaîne pour voir son programme.')}</p>}</section></aside>
    </>}
    {view==='home'&&<div className="home-discover">
      {!showPlayer&&!active&&<section className="home-hero-group" aria-labelledby="home-hero-title"><div className="home-hero"><div className="hero-copy"><span className="hero-eyebrow">{t(last?'Reprendre où vous en étiez':'Sans abonnement')}</span><h2 id="home-hero-title">{last?last.name:t('Toute la télé, au même endroit')}</h2><p>{last?last.description:t('Le Québec, le Canada, la France et les États-Unis, réunis dans un lecteur simple et gratuit.')}</p></div><div className="hero-brand"><Brand channel={last||channel}/></div></div><div className="hero-actions"><button className="home-primary" onClick={()=>last?choose(last):navigate('channels')}><Play size={18} fill="currentColor"/>{t(last?'Reprendre cette chaîne':'Explorer les chaînes')}</button></div></section>}
      {recentChannels.length>0&&<section className="home-favorites home-recent"><HomeCarousel title="Reprendre" actionLabel="Toutes les chaînes" action={()=>navigate('channels')} trackClass="home-favorite-row">{recentChannels.map(c=><button key={c.id} onClick={()=>choose(c)} aria-label={'Regarder '+c.name}><span className="home-favorite-art"><Brand channel={c}/></span><span className="home-favorite-name">{c.name}</span></button>)}</HomeCarousel></section>}
      <section className="home-favorites"><HomeCarousel title={data.favorites.length?'Mes favoris':'Chaînes à découvrir'} actionLabel={data.favorites.length?undefined:'D’autres idées'} action={()=>data.favorites.length?navigate('favorites'):setDiscoverSeed(seed=>seed+1)} trackClass="home-favorite-row">{(data.favorites.length?favorites:discover).map(c=><button key={c.id} className={active&&selected===c.id?'home-favorite-active':undefined} onClick={()=>choose(c)} aria-label={`Regarder ${c.name}`}><span className="home-favorite-art"><Brand channel={c}/>{data.favorites.includes(c.id)&&<Heart className="home-favorite-heart" size={17} fill="currentColor" aria-label="Favori"/>}</span><span className="home-favorite-name">{c.name}</span></button>)}</HomeCarousel></section>
      <section className="home-categories"><HomeCarousel title="Explorer par genre" trackClass="home-category-grid">{discoveryCategories(channels).map(value=><button key={value} onClick={()=>{setSearch('');setRegion('Toutes');setLanguage('Toutes');setNewOnly(false);setPlaybackOnly(false);setCategory(value);navigate('channels');}}><CategoryIcon category={value}/><span>{value}</span><ArrowUpRight size={18}/></button>)}</HomeCarousel></section>
    </div>}
        {(view==='channels'||view==='favorites')&&<>
     
     {view==='favorites'&&<div className="favorites-lists"><div><h2>Vos listes</h2><p>Retrouvez et organisez vos sélections.</p></div><button className="secondary" onClick={()=>navigate('lists')}>Voir mes listes <ChevronRight size={16}/></button></div>}<section className={`channels-section view-${view}`}>{!(view==='favorites'&&!data.favorites.length)&&<><div className="section-heading"><div><h2><span className="section-title">{t(view==='favorites'?'Votre sélection':(newOnly?'Les nouvelles chaînes':playbackOnly?'À regarder dans Onde':'Toutes les chaînes'))}</span><span className="section-count">{locale==='fr'?`${displayed.length} chaîne${displayed.length!==1?'s':''}`:`${displayed.length} channel${displayed.length!==1?'s':''}`}</span></h2><p>{t(view==='favorites'?'Utilisez les flèches pour changer leur classement.':'Choisissez une chaîne pour ouvrir son lecteur vidéo ici, dans Onde.')}</p></div></div>{viewerCountry!=='XX'&&<p className="geo-filter-note"><Globe2 size={14}/>{showGeoBlocked?t('Toutes les chaînes sont affichées, y compris celles qui peuvent être géo-bloquées.'):t('Chaînes disponibles dans votre région : {region}',{region:t(viewerCountryLabel(viewerCountry))})}</p>}<details className="filter-sheet"><summary><SlidersHorizontal size={17}/> {t('Affiner les chaînes')} {category!=='Toutes'&&<span> · {category}</span>}</summary><div className="catalog-selects"><label className="category-select language-select"><Globe2 size={15}/><select aria-label={t('Filtrer par langue')} value={language} onChange={e=>setLanguage(e.target.value)}><option value="Toutes">{t('Toutes les langues')}</option><option value="fr">{t('Français')}</option><option value="en">{t('Anglais')}</option><option value="zxx">{t('Sans paroles')}</option></select></label><div className="category-select"><SlidersHorizontal size={15}/><select aria-label={t('Filtrer par catégorie')} value={category} onChange={e=>setCategory(e.target.value)}><option value="Toutes">{t('Toutes les catégories')}</option>{discoveryCategories(channels).map(x=><option key={x}>{x}</option>)}</select></div><div className="category-select"><SlidersHorizontal size={15}/><select aria-label={t('Trier les chaînes')} value={sort} onChange={e=>setSort(e.target.value as 'default'|'name'|'region'|'recent')}><option value="default">{t('Tri : par défaut')}</option><option value="name">{t('Nom (A-Z)')}</option><option value="region">{t('Région')}</option><option value="recent">{t('Récemment vues')}</option></select></div></div><div className="filters"><div className="region-tabs" role="group" aria-label={t('Filtrer par région')}>{['Toutes','Québec','Canada','France','USA','International'].map(r=><button key={r} className={region===r?'active':''} onClick={()=>setRegion(r)}>{t(r==='Toutes'?'Toutes les régions':r)}</button>)}</div>{view==='channels'?<div className="catalog-toggles">{newCount>0&&<label className="playback-filter"><input type="checkbox" checked={newOnly} onChange={e=>setNewOnly(e.target.checked)}/>{t('Nouvelles chaînes ({count})',{count:newCount})}</label>}<label className="playback-filter"><input type="checkbox" checked={playbackOnly} onChange={e=>setPlaybackOnly(e.target.checked)}/>{t('Lecture dans Onde')}</label><label className="playback-filter"><input type="checkbox" checked={showGeoBlocked} onChange={e=>setShowGeoBlocked(e.target.checked)}/>{t('Afficher les chaînes géo-bloquées')}</label>{suspectCount>0&&<label className="playback-filter"><input type="checkbox" checked={hideSuspect} onChange={e=>setHideSuspect(e.target.checked)}/>{t('Masquer les chaînes à vérifier ({count})',{count:suspectCount})}</label>}</div>:<span className="free-note"><Check size={14}/>{t('Sans abonnement IPTV')}</span>}</div>{(category!=='Toutes'||region!=='Toutes'||language!=='Toutes'||search||(view==='channels'&&newOnly))&&<button className="clear-catalog-filters" onClick={()=>{setSearch('');setCategory('Toutes');setRegion('Toutes');setLanguage('Toutes');setNewOnly(false);}}>{t('Effacer les filtres')}<X size={13}/></button>}<div className="genre-shortcuts catalogue-redundant-genres" role="group" aria-label={t('Choisir un genre')}>{['Toutes',...discoveryCategories(channels)].map(genre=><button key={genre} aria-pressed={category===genre} className={category===genre?'active':''} onClick={()=>setCategory(genre)}>{t(genre==='Toutes'?'Tous les genres':genre)}</button>)}</div></details></>}{displayed.length?<div className="channel-grid">{(view==='channels'?displayed.slice(0,visibleCount):displayed).map(c=>renderChannelCard(c,view==='favorites'))}</div>:<div className="empty-state"><Heart size={30}/><h3>{t(view==='favorites'&&!data.favorites.length?'Un cœur, et c’est dans vos favoris.':'Aucune chaîne trouvée')}</h3><p>{t(view==='favorites'&&!data.favorites.length?'Appuyez sur le cœur d’une chaîne pour la retrouver ici.':'Essayez une autre recherche ou une autre région.')}</p><button className="secondary" onClick={()=>{setSearch('');setCategory('Toutes');setRegion('Toutes');setLanguage('Toutes');setNewOnly(false);setPlaybackOnly(false);if(view==='favorites'&&!data.favorites.length)navigate('channels');}}>{t(view==='favorites'&&!data.favorites.length?'Découvrir les chaînes':'Effacer les filtres')}</button></div>}{view==='channels'&&displayed.length>visibleCount&&<div className="catalog-more"><p>{t('{shown} chaînes affichées sur {total}',{shown:Math.min(visibleCount,displayed.length),total:displayed.length})}</p><button className="secondary" onClick={()=>setVisibleCount(n=>n+48)}>{t('Afficher 48 chaînes de plus')}<Plus size={16}/></button><span>{t('Vous pouvez aussi choisir un genre ou rechercher une chaîne.')}</span></div>}</section>
    </>}
    {view==='guide'&&<GuideExplorer now={now} onChoose={choose} search={search} onClearSearch={()=>setSearch('')} key={guideChannel} initialChannel={guideChannel} channels={channels} favorites={data.favorites}/>}
    {view==='selection'&&<section className="selection-section">
      <div className="selection-lead"><Sparkles size={22}/><p><strong>Un choix éditorial, pas un classement automatique.</strong> Des diffuseurs publics ou des flux gratuits et légaux, retenus parce qu’on les recommanderait à un ami — avec une raison pour chacun, et tous lisibles depuis le Québec.</p></div>
      {selection.map((theme,index)=><article className="selection-theme" key={theme.id}>
        <header className="selection-theme-head"><span className="eyebrow">{String(index+1).padStart(2,'0')}</span><h2>{theme.title}</h2><p>{theme.intro}</p></header>
        <ol className="selection-list">
          {theme.picks.map((pick,rank)=>{const c=channelById(pick.channelId);return c?<li className="selection-row" key={pick.channelId}>
            <span className="selection-rank">{String(rank+1).padStart(2,'0')}</span>
            <span className="selection-brand"><Brand channel={c} small/></span>
            <div className="selection-copy"><button className="selection-name" onClick={()=>choose(c)}>{c.name}</button><p>{pick.reason}</p><span className="selection-meta">{c.region} · {languageLabel(c)}</span></div>
            <button className="secondary selection-play" onClick={()=>choose(c)} aria-label={'Regarder '+c.name}><Play size={14} fill="currentColor"/>Regarder</button>
          </li>:null;})}
        </ol>
      </article>)}
    </section>}
    {view==='lists'&&<section className="lists-section"><div className="section-heading"><div><h2 className={filterList?'list-detail-title':'list-index-title'}>{filterList?filterList.name:'Mes listes'}<span className="section-count">{filterList?filterList.channels.length:data.lists.length}</span></h2><p>{signedIn?'Vos sélections sont synchronisées avec votre compte.':'Retrouvez vos sélections sur cet appareil.'}</p></div><button className="primary" onClick={()=>filterList?openEdit(filterList):openCreate()}>{filterList?<><Pencil size={16}/>Modifier la liste</>:<><Plus size={17}/>Nouvelle liste</>}</button></div>{filterList?<><button className="text-button" onClick={()=>setListFilter(null)}>← Toutes mes listes</button>{filterList.channels.length?<div className="channel-grid">{filterChannels(filterList.channels.map(id=>channelById(id)).filter((c):c is Channel=>!!c)).map(c=>renderChannelCard(c))}</div>:<div className="empty-state"><ListVideo size={32}/><h3>Cette liste attend vos découvertes.</h3><p>Choisissez les chaînes à y ajouter.</p><button className="secondary" onClick={()=>openEdit(filterList)}>Ajouter des chaînes</button></div>}</>:data.lists.length?<div className="lists-grid">{data.lists.map((list,i)=><article className="list-card" key={list.id}><button className="list-open" onClick={()=>setListFilter(list.id)}><div className={`list-art list-art-${i%3}`}><ListVideo size={42}/><span>{String(i+1).padStart(2,'0')}</span></div><h3>{list.name}</h3><p>{list.channels.length} chaîne{list.channels.length!==1?'s':''}</p></button><button className="icon-button edit-list" onClick={()=>openEdit(list)} aria-label={`Modifier la liste ${list.name}`}><MoreHorizontal size={20}/></button></article>)}</div>:<div className="empty-state"><ListVideo size={36}/><h3>Une liste pour chaque envie.</h3><p>« Culture », « Le matin », « À découvrir »…<br/>Réunissez vos chaînes au même endroit.</p><button className="primary" onClick={()=>openCreate()}><Plus size={17}/>Créer ma première liste</button></div>}</section>}
   </main>
  </div>
  <nav className="mobile-nav" aria-label="Navigation mobile">{navigation.map(n=><button key={n.id} aria-current={(view===n.id||(view==='lists'&&n.id==='favorites'))?'page':undefined} className={(view===n.id||(view==='lists'&&n.id==='favorites'))?'active':''} onClick={()=>navigate(n.id)}><n.icon size={20}/><span>{n.label}</span></button>)}</nav>
  {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
  <dialog ref={programmeDialogRef} className="modal programme-dialog" aria-labelledby="programme-detail-title" onCancel={()=>setProgrammeDetail(null)} onClick={e=>{if(e.target===e.currentTarget)setProgrammeDetail(null);}}><div className="modal-body">{programmeDetail&&<><button className="modal-close icon-button" onClick={()=>setProgrammeDetail(null)} aria-label="Fermer les détails de l’émission"><X size={22}/></button><span className="eyebrow">{programmeDetail.channel.name}</span><h2 id="programme-detail-title">{programmeDetail.programme.title}</h2><p>{new Date(programmeDetail.programme.start).toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long'})} · {time(programmeDetail.programme.start)}{programmeDetail.programme.end?' à '+time(programmeDetail.programme.end):''}</p><p>{programmeDetail.programme.detail||'Le diffuseur n’a pas fourni de description pour cette émission.'}</p>{programmeDetail.notice&&<p className="guide-notice">{programmeDetail.notice}</p>}<a className="schedule-link" href={programmeDetail.source} target="_blank" rel="noopener noreferrer">Source : {programmeDetail.sourceLabel||'grille du diffuseur'}<ArrowUpRight size={14}/></a><button className="primary full-width" onClick={()=>{setProgrammeDetail(null);openChannelGuide();}}>Voir le guide de cette chaîne<CalendarDays size={16}/></button></>}</div></dialog>
  <dialog ref={dialogRef} className="modal" aria-label={modal==='membership'?'Ajouter à une liste':modal==='create'?'Créer une liste':'Modifier la liste'} onCancel={()=>setModal(null)} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}><div className="modal-body"><button className="modal-close icon-button" onClick={()=>setModal(null)} aria-label="Fermer"><X size={22}/></button>{modal==='membership'?<><span className="eyebrow">VOTRE SÉLECTION</span><h2>Ajouter à une liste</h2><p>{membershipChannel?.name}</p>{error&&<p className="form-error" role="alert">{error}</p>}{data.lists.length?<div className="membership-list">{data.lists.map(l=><label key={l.id} className="checkbox-row"><ListVideo size={19}/><span>{l.name}</span><input type="checkbox" checked={!!membershipChannel&&l.channels.includes(membershipChannel.id)} onChange={e=>membershipChannel&&mutate({type:'listChannel',id:l.id,channel:membershipChannel.id,value:e.target.checked})}/></label>)}</div>:<p>Créez une liste pour regrouper vos chaînes.</p>}<button className="secondary full-width" onClick={()=>openCreate(true)}><Plus size={16}/>Créer une liste</button><button className="primary full-width" onClick={()=>setModal(null)}>Terminé<Check size={16}/></button></>:<><span className="eyebrow">MES LISTES</span><h2>{modal==='create'?'Une nouvelle envie ?':'Personnaliser la liste'}</h2><label className="field-label">Nom de la liste<input autoFocus maxLength={48} value={listName} placeholder="Ex. Culture et découvertes" onChange={e=>setListName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveList();}}/></label>{(modalError||error)&&<p className="form-error" role="alert">{modalError||error}</p>}{modal==='edit'&&editList&&<><p className="field-label">Chaînes de cette liste</p><label className="list-editor-search"><Search size={17}/><input aria-label="Rechercher une chaîne à ajouter" placeholder="Rechercher une chaîne…" value={listQuery} onChange={e=>setListQuery(e.target.value)}/></label><div className="edit-channels">{!matchingListChannels.length&&<p className="list-search-empty">Aucune chaîne trouvée. Essayez un autre nom.</p>}{matchingListChannels.map(c=><label className="checkbox-row" key={c.id}><Brand channel={c} small/><span>{c.name}</span><input type="checkbox" checked={editList.channels.includes(c.id)} onChange={e=>mutate({type:'listChannel',id:editList.id,channel:c.id,value:e.target.checked})}/></label>)}</div></>}<button className="primary full-width" onClick={saveList}>{modal==='create'?'Créer la liste':'Enregistrer le nom'}<Check size={16}/></button>{modal==='edit'&&<button className="danger-button full-width" onClick={()=>{if(!confirmDelete){setConfirmDelete(true);return;}if(!listId||!mutate({type:'deleteList',id:listId})){setModalError('La liste n’a pas pu être supprimée. Réessayez.');return;}setListFilter(null);setModal(null);setToast('Liste supprimée');}}><Trash2 size={16}/>{confirmDelete?'Confirmer la suppression':'Supprimer cette liste'}</button>}</>}</div></dialog>
  {account&&userId&&<AccountPanel userId={userId} favoriteCount={data.favorites.length} listCount={data.lists.length} onClose={()=>setAccount(false)}/>}{help&&<div className="help-backdrop" onClick={e=>{if(e.target===e.currentTarget)setHelp(false);}}><Help onClose={()=>setHelp(false)} userId={userId}/></div>}
 </div>;
}
function Help({onClose,userId}:{onClose:()=>void;userId:string|null}){
 const [logoutError,setLogoutError]=useState(''),[loggingOut,setLoggingOut]=useState(false);
 async function logout(){setLoggingOut(true);try{const r=await fetch('/api/session/logout',{method:'POST'});if(!r.ok)throw new Error();try{clearPreferenceCache(localStorage,userId);localStorage.setItem('onde-auth-event',String(Date.now())+':'+makeId());}catch{}window.dispatchEvent(new Event('onde-sign-out'));window.location.assign('/');}catch{setLogoutError('Déconnexion indisponible. Réessayez.');setLoggingOut(false);}}
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="modal help-modal" aria-labelledby="help-title" ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-body"><button className="modal-close icon-button" onClick={onClose} aria-label="Fermer l’aide"><X size={22}/></button><Logo/><h2 id="help-title">Besoin d’un coup de main ?</h2><p>Choisissez un sujet.</p><div className="help-topics">
<details><summary>Regarder une chaîne</summary><p>Choisissez une chaîne, puis appuyez sur Lecture. En cas de coupure, utilisez « Réessayer ». Certaines chaînes dépendent de votre région.</p></details>
<details><summary>Regarder sur ma télé</summary><p>Lancez une chaîne et appuyez sur « Sur ma télé ». Les deux appareils doivent être sur le même Wi-Fi. Les autres méthodes sont dans « Autres façons de diffuser ».</p></details>
<details><summary>Mes favoris et mes listes</summary><p>Le cœur garde une chaîne dans vos favoris. Le bouton + l’ajoute à une liste. Dans vos favoris, les flèches permettent de changer l’ordre.</p></details>
<details><summary>Retrouver mes sélections ailleurs</summary><p>Sans compte, vos sélections restent dans ce navigateur. Un compte Onde est optionnel et permet de les synchroniser entre vos appareils.</p></details>
<details><summary>Consulter le programme</summary><p>Choisissez une date ou « En cours ». Touchez une émission pour ses détails. Si la grille n’est pas disponible, ouvrez l’horaire du diffuseur.</p></details>
<details><summary>Installer Onde</summary><p>Sur Android : menu de Chrome, puis « Ajouter à l’écran d’accueil ». Sur iPhone : Partager, puis « Sur l’écran d’accueil ». Internet reste nécessaire pour regarder.</p></details>
<details><summary>D’où viennent les chaînes ?</summary><p>Onde utilise les lecteurs des diffuseurs et des flux publics, dont ceux répertoriés par IPTV-org. Les sources sont indiquées avec le lecteur et les programmes. La disponibilité peut varier selon la région. Les horaires manquants ne sont pas inventés.</p></details>
</div>{userId?<button className="text-button" type="button" disabled={loggingOut} onClick={logout}>{loggingOut?'Déconnexion…':'Se déconnecter de cet appareil'}</button>:null}{logoutError&&<p role="alert">{logoutError}</p>}<button className="primary full-width" onClick={onClose}>C’est parti<ChevronRight size={17}/></button></div></dialog>;
}
