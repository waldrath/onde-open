'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,RefreshCw,ArrowUpRight,Play,Search,Clock3,ChevronLeft,ChevronRight,BellRing} from 'lucide-react';
import {type Channel} from '../lib/channel-utils';
import {getChannelLogo} from '../lib/channel-logos';
import {addDays,torontoDate,type Guide,type Programme} from '../lib/guide';
import {useLocale} from './locale-provider';
import {useReminders} from './use-reminders';
import ReminderToggle from './reminder-toggle';
const hours=(value:string,tag:string)=>new Date(value).toLocaleTimeString(tag,{hour:'2-digit',minute:'2-digit'});
const dateLabel=(day:string,tag:string)=>new Date(day+'T12:00:00Z').toLocaleDateString(tag,{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
export default function GuideExplorer({now,onChoose,search,onClearSearch,initialChannel='integrated',channels,favorites=[]}:{now:number;onChoose:(c:Channel)=>void;search:string;onClearSearch:()=>void;initialChannel?:string;channels:Channel[];favorites?:string[]}){
 const {t,locale}=useLocale(),tag=locale==='fr'?'fr-CA':'en-CA';
 const {has:hasReminder}=useReminders();
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
 const normalize=(v:string)=>v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const visible=channels.filter(c=>(!favoritesOnly||favorites.includes(c.id))&&(channel==='integrated'?integrated.includes(c.id):channel==='all'||c.id===channel)&&normalize(c.name+' '+c.region).includes(normalize(search)));
 function programmes(g:Guide|undefined){return (g?.programmes||[]).filter(p=>{
  const h=new Date(p.start).getHours();
  const matches=period==='all'||period==='now'&&Date.parse(p.start)<=now&&!!p.end&&Date.parse(p.end)>now||period==='morning'&&h>=5&&h<12||period==='afternoon'&&h>=12&&h<18||period==='evening'&&(h>=18||h<5);
  return matches&&normalize(p.title+' '+p.detail).includes(normalize(query));
 });}
 const count=visible.reduce((sum,c)=>sum+programmes(guides.find(g=>g.channel===c.id)).length,0);
 return <section className="guide-explorer">
  <div className="guide-overview"><div><CalendarDays size={25}/><div><strong>{t('Votre prochaine envie commence ici.')}</strong><p>{t('Parcourez les émissions et retrouvez ce qui joue maintenant.')}</p></div></div><button className="secondary" onClick={()=>setRevision(x=>x+1)} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/>{loading?t('Chargement…'):t('Actualiser')}</button></div>
  <div className="guide-date-navigation"><button className="icon-button" aria-label={t('Jour précédent')} disabled={!day||day<=addDays(today||'2000-01-01',-1)} onClick={()=>{setDay(addDays(day,-1));if(period==='now')setPeriod('all');}}><ChevronLeft size={20}/></button><label className="guide-date-input"><span className="guide-date-label">{day?dateLabel(day,tag):t('Chargement…')}</span><input aria-label={t('Choisir la journée du guide')} type="date" value={day} min={today?addDays(today,-1):undefined} max={today?addDays(today,13):undefined} onChange={e=>{if(e.target.value){setDay(e.target.value);if(period==='now')setPeriod('all');}}}/></label><button className="icon-button" aria-label={t('Jour suivant')} disabled={!day||day>=addDays(today||'2000-01-01',13)} onClick={()=>{setDay(addDays(day,1));if(period==='now')setPeriod('all');}}><ChevronRight size={20}/></button><button className="text-button" onClick={()=>{setDay(today);setPeriod('now');}}>{t('En ce moment')}</button></div>
  <div className="guide-days" aria-label={t('Journées disponibles')}>{today&&Array.from({length:14},(_,i)=>{const d=addDays(today,i);return <button key={d} aria-pressed={d===day} onClick={()=>{setDay(d);if(period==='now'&&i>0)setPeriod('all');}}><span>{i===0?t('Aujourd’hui'):i===1?t('Demain'):new Date(d+'T12:00:00Z').toLocaleDateString(tag,{weekday:'short',timeZone:'UTC'})}</span><strong>{new Date(d+'T12:00:00Z').getUTCDate()}</strong></button>;})}</div>
  <details className="guide-filter-disclosure"><summary>{t('Rechercher et filtrer')}{(query||favoritesOnly||channel!=='integrated')&&<span> · {t('Filtres actifs')}</span>}</summary><div className="guide-tools"><label>{t('Chaînes')}<select aria-label={t('Chaînes du guide')} value={channel} onChange={e=>setChannel(e.target.value)}><option value="integrated">{t('Grilles intégrées')}</option><option value="all">{t('Toutes les chaînes')}</option>{channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="guide-search"><Search size={16}/><input aria-label={t('Rechercher une émission')} value={query} placeholder={t('Rechercher une émission…')} onChange={e=>setQuery(e.target.value)}/></label></div>
  <label className="guide-favorites-toggle"><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> {t('Mes favoris seulement')}</label></details><div className="guide-periods" role="group" aria-label={t('Période de la journée')}>{[['all','Journée complète'],['now','En cours'],['morning','Matin'],['afternoon','Après-midi'],['evening','Soir et nuit']].map(([id,label])=><button key={id} aria-pressed={id===period} onClick={()=>{setPeriod(id);if(id==='now')setDay(today);}}>{t(label)}</button>)}</div>
  <p className="guide-coverage" role="status">{loading?t('Récupération des grilles disponibles…'):t('{count} émissions · {grids} grilles disponibles pour cette date',{count,grids:guides.filter(g=>g.programmes.length).length})}<span>{t('Heures locales.')}</span></p>
  {error&&<div className="notice" role="status">{t('Le guide ne répond pas. Réessayez ou consultez l’horaire officiel.')}</div>}
  <div className="expanded-guides">{visible.filter(c=>!query&&period==='all'||programmes(guides.find(g=>g.channel===c.id)).length>0).map(c=>{
   const g=guides.find(g=>g.channel===c.id),items=programmes(g);
   return <details className="expanded-guide" key={c.id} open={channel!=='integrated'&&channel!=='all'}><summary className="guide-channel-summary"><span className="guide-channel-logo">{getChannelLogo(c)?<img src={getChannelLogo(c)!} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<span>{c.name.slice(0,2)}</span>}</span><div><h2>{c.name}</h2><span>{g?.programmes.length?t('{count} émissions',{count:items.length}):t('Horaire du diffuseur')}</span></div><ChevronRight className="guide-disclosure" size={20}/></summary><div className="guide-channel-actions"><button className="secondary" onClick={()=>onChoose(c)}><Play size={14}/>{t('Regarder le direct')}</button><a href={g?.source||c.guide} target="_blank" rel="noopener noreferrer">{t('Horaire du diffuseur')}<ArrowUpRight size={15}/></a></div>
    {g?.notice&&<p className="guide-notice">{t(g.notice)}</p>}<div className="expanded-programmes" aria-label={t('Émissions de {name}',{name:c.name})} tabIndex={0}>{items.length?(expanded[c.id]?items:items.slice(0,8)).map((p,index)=>{
     const live=Date.parse(p.start)<=now&&!!p.end&&Date.parse(p.end)>now;
     return <button key={p.start+index} className={`expanded-programme ${live?'programme-live':''}`} onClick={()=>setDetail({channel:c,programme:p})}><time dateTime={p.start}>{hours(p.start,tag)}<small>{p.end?hours(p.end,tag):t('Fin non précisée')}</small></time><span><strong>{p.title}{hasReminder(c.id,p.start)&&<BellRing size={13} className="programme-reminder" aria-label={t('Rappel activé')}/>}</strong>{p.detail&&p.detail!==p.title&&<small>{p.detail}</small>}</span>{live&&<span className="programme-live-label"><span className="tiny-dot"/>{t('En cours')}</span>}</button>;
    }):<div className="expanded-guide-empty"><Clock3 size={22}/><p>{loading?t('Chargement de la programmation…'):g?.error?t(g.error):(g?.programmes.length?t('Aucune émission pour ces filtres.'):t('La programmation détaillée de cette chaîne n’est pas intégrée. Retrouvez ses informations sur le site du diffuseur.'))}</p>{!loading&&<a href={g?.source||c.guide} target="_blank" rel="noopener noreferrer">{g?.sourceLabel?t('Consulter la source du guide'):c.guide===c.official?t('Site du diffuseur'):t('Consulter l’horaire officiel')}<ArrowUpRight size={14}/></a>}</div>}</div>
    {items.length>8&&<button className="guide-show-more secondary" onClick={()=>setExpanded(previous=>({...previous,[c.id]:!previous[c.id]}))}>{expanded[c.id]?t('Réduire la liste'):t('Voir les {count} autres émissions',{count:items.length-8})}</button>}{g&&g.programmes.length>0&&<footer>{t('Source : {label} · récupération à {time}',{label:g.sourceLabel?t(g.sourceLabel):t('grille du diffuseur'),time:hours(g.fetchedAt,tag)})}</footer>}
   </details>;
  })}</div>
  {!loading&&count===0&&visible.length>0&&<div className="guide-no-results" role="status"><p>{t('Aucune émission ne correspond à cette sélection.')}</p><button className="secondary" onClick={()=>{onClearSearch();setQuery('');setPeriod('all');setFavoritesOnly(false);setChannel('integrated');}}>{t('Réinitialiser les filtres')}</button></div>}{!visible.length&&<div className="empty-state"><h3>{favoritesOnly&&!favorites.length?t('Ajoutez vos premières chaînes aux favoris.'):channel==='integrated'?t('Aucune grille disponible pour cette journée.'):t('Aucune chaîne ne correspond à votre recherche.')}</h3>{channel==='integrated'&&<p>{t('Choisissez une autre journée ou une chaîne précise. Certaines sources ne publient que les prochaines heures.')}</p>}<button className="secondary" onClick={()=>{onClearSearch();setDay(today);setQuery('');setFavoritesOnly(false);setPeriod('all');setChannel('all');}}>{t('Voir toutes les chaînes aujourd’hui')}</button></div>}

  <dialog ref={dialog} className="modal programme-dialog" aria-label={t('Détails de l’émission')} onCancel={()=>setDetail(null)} onClick={e=>{if(e.target===e.currentTarget)setDetail(null);}}><div className="modal-body">{detail&&<><button className="modal-close icon-button" onClick={()=>setDetail(null)} aria-label={t('Fermer les détails')}>×</button><span className="eyebrow">{detail.channel.name}</span><h2>{detail.programme.title}</h2><p>{new Date(detail.programme.start).toLocaleDateString(tag,{weekday:'long',day:'numeric',month:'long'})} · {detail.programme.end?t('{start} à {end}',{start:hours(detail.programme.start,tag),end:hours(detail.programme.end,tag)}):hours(detail.programme.start,tag)}</p>{detail.programme.detail&&<p>{detail.programme.detail}</p>}<p className="programme-live-note">{t('Le bouton ci-dessous ouvre le direct actuel de la chaîne.')}</p><button className="primary" onClick={()=>{onChoose(detail.channel);setDetail(null);}}><Play size={16}/>{t('Regarder {name} en direct',{name:detail.channel.name})}</button><ReminderToggle channelId={detail.channel.id} programme={detail.programme}/></>}</div></dialog>
 </section>;
}
