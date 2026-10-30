'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,RefreshCw,ArrowUpRight,Play,Search,Clock3,ChevronLeft,ChevronRight} from 'lucide-react';
import {channels as baseChannels,type Channel} from '../lib/channels';
import {getChannelLogo} from '../lib/channel-logos';
import {addDays,torontoDate,type Guide,type Programme} from '../lib/guide';
const hours=(value:string)=>new Date(value).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'});
const dateLabel=(day:string)=>new Date(day+'T12:00:00Z').toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
export default function GuideExplorer({now,onChoose,search,onClearSearch,initialChannel='integrated',channels=baseChannels,favorites=[]}:{now:number;onChoose:(c:Channel)=>void;search:string;onClearSearch:()=>void;initialChannel?:string;channels?:Channel[];favorites?:string[]}){
 const [day,setDay]=useState(''),[guides,setGuides]=useState<Guide[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const [favoritesOnly,setFavoritesOnly]=useState(false),[expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [period,setPeriod]=useState('all'),[channel,setChannel]=useState(initialChannel),[query,setQuery]=useState('');
 const [detail,setDetail]=useState<{channel:Channel;programme:Programme}|null>(null);
 const cache=useRef(new Map<string,Guide[]>()),dialog=useRef<HTMLDialogElement>(null);
 const today=now?torontoDate(new Date(now)):'';
 useEffect(()=>{if(today)setDay(d=>d||today);},[today]);
 useEffect(()=>{if(detail)dialog.current?.showModal();else dialog.current?.close();},[detail]);
 useEffect(()=>{
  if(!day)return;
  const controller=new AbortController();const cached=cache.current.get(day+':'+channel);setGuides(cached||[]);setLoading(true);setError(false);
  const urls=channel!=='integrated'&&channel!=='all'?['/api/guide?date='+day+'&channel='+encodeURIComponent(channel)]:['/api/guide?date='+day,'/api/guide?date='+day+'&scope=community'];
  const collected:Guide[]=[];
  void Promise.allSettled(urls.map(async url=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data))throw new Error();collected.push(...data as Guide[]);if(!controller.signal.aborted){const merged=[...new Map(collected.map(g=>[g.channel,g])).values()];cache.current.set(day+':'+channel,merged);setGuides(merged);}})).then(results=>{if(!controller.signal.aborted){setError(results.every(r=>r.status==='rejected'));setLoading(false);}});
  return()=>controller.abort();
 },[day,revision,channel]);
 useEffect(()=>{const i=setInterval(()=>{if(!document.hidden)setRevision(x=>x+1);},300000);return()=>clearInterval(i);},[]);
 const integrated=guides.filter(g=>g.programmes.length>0).map(g=>g.channel);
 if(loading&&!integrated.length)integrated.push('telequebec','savoir','tfo','tvr');
 const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const visible=channels.filter(c=>(!favoritesOnly||favorites.includes(c.id))&&(channel==='integrated'?integrated.includes(c.id):channel==='all'||c.id===channel)&&normalize(c.name+' '+c.region).includes(normalize(search)));
 function programmes(g:Guide|undefined){return (g?.programmes||[]).filter(p=>{
  const h=new Date(p.start).getHours();
  const matches=period==='all'||period==='now'&&Date.parse(p.start)<=now&&!!p.end&&Date.parse(p.end)>now||period==='morning'&&h>=5&&h<12||period==='afternoon'&&h>=12&&h<18||period==='evening'&&(h>=18||h<5);
  return matches&&normalize(p.title+' '+p.detail).includes(normalize(query));
 });}
 const count=visible.reduce((sum,c)=>sum+programmes(guides.find(g=>g.channel===c.id)).length,0);
 return <section className="guide-explorer">
  <div className="guide-overview"><div><CalendarDays size={25}/><div><strong>Votre prochaine envie commence ici.</strong><p>Parcourez les émissions et retrouvez ce qui joue maintenant.</p></div></div><button className="secondary" onClick={()=>setRevision(x=>x+1)} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/>{loading?'Chargement…':'Actualiser'}</button></div>
  <div className="guide-date-navigation"><button className="icon-button" aria-label="Jour précédent" disabled={!day||day<=addDays(today||'2000-01-01',-1)} onClick={()=>{setDay(addDays(day,-1));if(period==='now')setPeriod('all');}}><ChevronLeft size={20}/></button><label className="guide-date-input"><span className="guide-date-label">{day?dateLabel(day):'Chargement…'}</span><input aria-label="Choisir la journée du guide" type="date" value={day} min={today?addDays(today,-1):undefined} max={today?addDays(today,13):undefined} onChange={e=>{if(e.target.value){setDay(e.target.value);if(period==='now')setPeriod('all');}}}/></label><button className="icon-button" aria-label="Jour suivant" disabled={!day||day>=addDays(today||'2000-01-01',13)} onClick={()=>{setDay(addDays(day,1));if(period==='now')setPeriod('all');}}><ChevronRight size={20}/></button><button className="text-button" onClick={()=>{setDay(today);setPeriod('now');}}>En ce moment</button></div>
  <div className="guide-days" aria-label="Journées disponibles">{today&&Array.from({length:14},(_,i)=>{const d=addDays(today,i);return <button key={d} aria-pressed={d===day} onClick={()=>{setDay(d);if(period==='now'&&i>0)setPeriod('all');}}><span>{i===0?'Aujourd’hui':i===1?'Demain':new Date(d+'T12:00:00Z').toLocaleDateString('fr-CA',{weekday:'short',timeZone:'UTC'})}</span><strong>{new Date(d+'T12:00:00Z').getUTCDate()}</strong></button>;})}</div>
  <details className="guide-filter-disclosure"><summary>Rechercher et filtrer{(query||favoritesOnly||channel!=='integrated')&&<span> · Filtres actifs</span>}</summary><div className="guide-tools"><label>Chaînes<select aria-label="Chaînes du guide" value={channel} onChange={e=>setChannel(e.target.value)}><option value="integrated">Grilles intégrées</option><option value="all">Toutes les chaînes</option>{channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="guide-search"><Search size={16}/><input aria-label="Rechercher une émission" value={query} placeholder="Rechercher une émission…" onChange={e=>setQuery(e.target.value)}/></label></div>
  <label className="guide-favorites-toggle"><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> Mes favoris seulement</label></details><div className="guide-periods" role="group" aria-label="Période de la journée">{[['all','Journée complète'],['now','En cours'],['morning','Matin'],['afternoon','Après-midi'],['evening','Soir et nuit']].map(([id,label])=><button key={id} aria-pressed={id===period} onClick={()=>{setPeriod(id);if(id==='now')setDay(today);}}>{label}</button>)}</div>
  <p className="guide-coverage" role="status">{loading?'Récupération des grilles disponibles…':`${count} émissions · ${guides.filter(g=>g.programmes.length).length} grilles disponibles pour cette date`}<span>Heures locales.</span></p>
  {error&&<div className="notice" role="status">Le guide ne répond pas. Réessayez ou consultez l’horaire officiel.</div>}
  <div className="expanded-guides">{visible.filter(c=>!query&&period==='all'||programmes(guides.find(g=>g.channel===c.id)).length>0).map((c,channelIndex)=>{
   const g=guides.find(g=>g.channel===c.id),items=programmes(g);
   return <details className="expanded-guide" key={c.id} open={channelIndex<2}><summary className="guide-channel-summary"><span className="guide-channel-logo">{getChannelLogo(c)?<img src={getChannelLogo(c)!} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<span>{c.name.slice(0,2)}</span>}</span><div><h2>{c.name}</h2><span>{g?.programmes.length?`${items.length} émissions`:'Horaire du diffuseur'}</span></div><ChevronRight className="guide-disclosure" size={20}/></summary><div className="guide-channel-actions"><button className="secondary" onClick={()=>onChoose(c)}><Play size={14}/>Regarder le direct</button><a href={g?.source||c.guide} target="_blank" rel="noopener noreferrer">Horaire du diffuseur<ArrowUpRight size={15}/></a></div>
    {g?.notice&&<p className="guide-notice">{g.notice}</p>}<div className="expanded-programmes" aria-label={`Émissions de ${c.name}`} tabIndex={0}>{items.length?(expanded[c.id]?items:items.slice(0,8)).map((p,index)=>{
     const live=Date.parse(p.start)<=now&&!!p.end&&Date.parse(p.end)>now;
     return <button key={p.start+index} className={`expanded-programme ${live?'programme-live':''}`} onClick={()=>setDetail({channel:c,programme:p})}><time dateTime={p.start}>{hours(p.start)}<small>{p.end?hours(p.end):'Fin non précisée'}</small></time><span><strong>{p.title}</strong>{p.detail&&p.detail!==p.title&&<small>{p.detail}</small>}</span>{live&&<span className="programme-live-label"><span className="tiny-dot"/>En cours</span>}</button>;
    }):<div className="expanded-guide-empty"><Clock3 size={22}/><p>{loading?'Chargement de la programmation…':g?.error|| (g?.programmes.length?'Aucune émission pour ces filtres.':'La programmation détaillée de cette chaîne n’est pas intégrée. Retrouvez ses informations sur le site du diffuseur.')}</p>{!loading&&<a href={g?.source||c.guide} target="_blank" rel="noopener noreferrer">{g?.sourceLabel?'Consulter la source du guide':c.guide===c.official?'Site du diffuseur':'Consulter l’horaire officiel'}<ArrowUpRight size={14}/></a>}</div>}</div>
    {items.length>8&&<button className="guide-show-more secondary" onClick={()=>setExpanded(previous=>({...previous,[c.id]:!previous[c.id]}))}>{expanded[c.id]?'Réduire la liste':`Voir les ${items.length-8} autres émissions`}</button>}{g&&g.programmes.length>0&&<footer>Source : {g.sourceLabel||'grille du diffuseur'} · récupération à {hours(g.fetchedAt)}</footer>}
   </details>;
  })}</div>
  {!loading&&count===0&&visible.length>0&&<div className="guide-no-results" role="status"><p>Aucune émission ne correspond à cette sélection.</p><button className="secondary" onClick={()=>{onClearSearch();setQuery('');setPeriod('all');setFavoritesOnly(false);setChannel('integrated');}}>Réinitialiser les filtres</button></div>}{!visible.length&&<div className="empty-state"><h3>{favoritesOnly&&!favorites.length?'Ajoutez vos premières chaînes aux favoris.':channel==='integrated'?'Aucune grille disponible pour cette journée.':'Aucune chaîne ne correspond à votre recherche.'}</h3>{channel==='integrated'&&<p>Choisissez une autre journée ou une chaîne précise. Certaines sources ne publient que les prochaines heures.</p>}<button className="secondary" onClick={()=>{onClearSearch();setDay(today);setQuery('');setFavoritesOnly(false);setPeriod('all');setChannel('all');}}>Voir toutes les chaînes aujourd’hui</button></div>}
  
  <dialog ref={dialog} className="modal programme-dialog" aria-label="Détails de l’émission" onCancel={()=>setDetail(null)} onClick={e=>{if(e.target===e.currentTarget)setDetail(null);}}><div className="modal-body">{detail&&<><button className="modal-close icon-button" onClick={()=>setDetail(null)} aria-label="Fermer les détails">×</button><span className="eyebrow">{detail.channel.name}</span><h2>{detail.programme.title}</h2><p>{new Date(detail.programme.start).toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long'})} · {hours(detail.programme.start)}{detail.programme.end?` à ${hours(detail.programme.end)}`:''}</p>{detail.programme.detail&&<p>{detail.programme.detail}</p>}<p className="programme-live-note">Le bouton ci-dessous ouvre le direct actuel de la chaîne.</p><button className="primary" onClick={()=>{onChoose(detail.channel);setDetail(null);}}><Play size={16}/>Regarder {detail.channel.name} en direct</button></>}</div></dialog>
 </section>;
}
