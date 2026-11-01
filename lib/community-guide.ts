import {addDays,localTime,type Guide,type Programme} from './guide';
import {communityGuideSources,type CommunityGuideSource} from './guide-sources';
function plain(value:unknown){if(typeof value!=='string')return '';return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>{const v=parseInt(n,16);return v<=0x10ffff?String.fromCodePoint(v):'';}).replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/&quot;/g,'"').replace(/&apos;|&#039;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
function relevant(programmes:Programme[],date:string){const start=Date.parse(localTime(date,0,0)),end=Date.parse(localTime(addDays(date,1),6,0));return programmes.filter(p=>Date.parse(p.start)<end&&(p.end?Date.parse(p.end)>start:Date.parse(p.start)>=start));}
// Only explicit offsets are accepted: a bare local time would be silently read in the server's zone.
const zoned=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
const unix=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0?new Date(value*1000).toISOString():'';
const detailOf=(title:string,...parts:unknown[])=>parts.map(plain).filter((s,i,a)=>!!s&&s!==title&&a.indexOf(s)===i).join(' · ').slice(0,6000);
// Rows with explicit start and end times: keep the first row per start, drop empty or inverted slots.
function timed(rows:Programme[],date:string){const unique=new Map<string,Programme>();for(const p of rows)if(p.start&&p.end&&p.end>p.start&&p.title&&!unique.has(p.start))unique.set(p.start,{...p,title:p.title.slice(0,400)});return relevant([...unique.values()].sort((a,b)=>a.start.localeCompare(b.start)),date);}
// Rows without end times end where the next one starts, unless the gap suggests missing data.
function chained(rows:Programme[]){return rows.map((p,i)=>{const next=rows[i+1];const gap=next?Date.parse(next.start)-Date.parse(p.start):0;return {...p,end:next&&gap<=12*3600000?next.start:''};});}
export function parseCommunityJSON(payload:unknown,date:string):Programme[]{
 const data=payload as {epg_list?:{start_date?:unknown;title?:unknown;desc?:unknown}[];error_message?:unknown};
 if(!Array.isArray(data?.epg_list)||data.epg_list.length>3000||data.error_message)throw new Error('Grille indisponible');
 const unique=new Map<string,Programme>();
 for(const row of data.epg_list){
  if(typeof row.start_date!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(row.start_date))continue;
  const time=Date.parse(row.start_date),title=plain(row.title).slice(0,400);if(!Number.isFinite(time)||!title)continue;
  const start=new Date(time).toISOString();if(!unique.has(start))unique.set(start,{start,end:'',title,detail:plain(row.desc).slice(0,6000)});
 }
 return relevant(chained([...unique.values()].sort((a,b)=>a.start.localeCompare(b.start))),date);
}
type BlueNode={Kind?:unknown;Content?:{Description?:{Title?:unknown;Summary?:unknown;ShortSummary?:unknown};Nodes?:{Items?:unknown}};Availabilities?:unknown};
// Swisscom blue TV catalogue: one Channel node whose children are Broadcast nodes with UTC availability windows.
export function parseBlueJSON(payload:unknown,date:string):Programme[]{
 const top=(payload as {Nodes?:{Items?:unknown}})?.Nodes?.Items,channel=Array.isArray(top)?(top as BlueNode[]).find(n=>n?.Kind==='Channel'):undefined,items=channel?.Content?.Nodes?.Items;
 if(!Array.isArray(items)||items.length>3000)throw new Error('Grille indisponible');
 return timed((items as BlueNode[]).filter(n=>n?.Kind==='Broadcast').map(n=>{const slot=(Array.isArray(n.Availabilities)?n.Availabilities[0]:undefined) as {AvailabilityStart?:unknown;AvailabilityEnd?:unknown}|undefined,d=n.Content?.Description,title=plain(d?.Title);return {start:zoned(slot?.AvailabilityStart),end:zoned(slot?.AvailabilityEnd),title:title==='Sendepause'?'':title,detail:detailOf(title,d?.Summary||d?.ShortSummary)};}),date);
}
// POST Luxembourg TV guide: one payload per local day, Unix-second boundaries.
export function parsePostJSON(payloads:unknown[],date:string):Programme[]{
 const rows:Programme[]=[];let found=false;
 for(const payload of payloads){const list=(payload as {result?:{epg?:{programme?:unknown}}})?.result?.epg?.programme;if(!Array.isArray(list)||list.length>3000)continue;found=true;
  for(const p of list as {tsStart?:unknown;tsEnd?:unknown;title?:unknown;description?:unknown}[]){const title=plain(p?.title);rows.push({start:unix(p?.tsStart),end:unix(p?.tsEnd),title,detail:detailOf(title,p?.description)});}}
 if(!found)throw new Error('Grille indisponible');return timed(rows,date);
}
// SRG SSR integration layer (RTS): one payload per Swiss day, ISO times with offsets.
export function parseSrgJSON(payloads:unknown[],date:string):Programme[]{
 const rows:Programme[]=[];let found=false;
 for(const payload of payloads){const guide=(payload as {programGuide?:unknown})?.programGuide,list=Array.isArray(guide)?(guide[0] as {programList?:unknown})?.programList:undefined;if(!Array.isArray(list)||list.length>3000)continue;found=true;
  for(const p of list as {startTime?:unknown;endTime?:unknown;title?:unknown;subtitle?:unknown;description?:unknown}[]){const title=plain(p?.title);rows.push({start:zoned(p?.startTime),end:zoned(p?.endTime),title,detail:detailOf(title,p?.subtitle,p?.description)});}}
 if(!found)throw new Error('Grille indisponible');return timed(rows,date);
}
export function xmltvDate(value:string){const m=/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-])(\d{2})(\d{2})$/.exec(value);if(!m)return '';const offset=(+m[8]*60 + +m[9])*(m[7]==='+'?1:-1);return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])-offset*60000).toISOString();}
export function parseCommunityXML(xml:string,xmlChannelId:string,date:string):Programme[]{
 const result:Programme[]=[];
 for(const m of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)){
  const attr=(name:string)=>m[1].match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1]||'';
  if(attr('channel')!==xmlChannelId)continue;
  const tag=(name:string)=>plain(m[2].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>'))?.[1]);
  const start=xmltvDate(attr('start')),end=xmltvDate(attr('stop')),title=tag('title');if(!start||!end||end<=start||!title)continue;
  const sub=tag('sub-title'),desc=tag('desc');result.push({start,end,title:title.slice(0,400),detail:[sub,desc].filter((s,i,a)=>!!s&&s!==title&&a.indexOf(s)===i).join(' · ').slice(0,6000)});
 }
 return relevant(result.sort((a,b)=>a.start.localeCompare(b.start)),date);
}
const xmlCache=new Map<string,{at:number;xml:string}>(),xmlPending=new Map<string,Promise<string>>();
async function fetchXML(url:string){
 const cached=xmlCache.get(url);if(cached&&Date.now()-cached.at<600000)return cached.xml;
 let task=xmlPending.get(url);if(!task){task=(async()=>{
  const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Source indisponible');
  const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.byteLength>2000000)throw new Error('Grille trop volumineuse');
  const stream=new Blob([bytes]).stream();const body=bytes[0]===0x1f&&bytes[1]===0x8b?stream.pipeThrough(new DecompressionStream('gzip')):stream;
  const reader=body.getReader(),decoder=new TextDecoder();let xml='',size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>5000000){await reader.cancel();throw new Error('Grille trop volumineuse');}xml+=decoder.decode(part.value,{stream:true});}xml+=decoder.decode();
  xmlCache.set(url,{at:Date.now(),xml});return xml;
 })();xmlPending.set(url,task);}
 try{return await task;}finally{xmlPending.delete(url);}
}
async function fetchText(url:string,accept:string){const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:accept}});if(!r.ok)throw new Error('Source indisponible');const text=await r.text();if(text.length>2000000)throw new Error('Grille trop volumineuse');return text;}
const fetchJSON=async(url:string):Promise<unknown>=>JSON.parse(await fetchText(url,'application/json'));
// Per-day sources: a Toronto day overlaps two European days, so tomorrow is optional but today is not.
async function fetchDays(url:(day:string)=>string,date:string){const [today,tomorrow]=await Promise.allSettled([date,addDays(date,1)].map(d=>fetchJSON(url(d))));if(today.status==='rejected')throw today.reason;return tomorrow.status==='fulfilled'?[today.value,tomorrow.value]:[today.value];}
const compact=(date:string)=>date.replaceAll('-',''),stamp=(iso:string)=>iso.replace(/\D/g,'').slice(0,12);
const CONTINUED='Les heures de fin sont déduites du début de l’émission suivante.';
type Provider={label:(s:CommunityGuideSource)=>string;page:(s:CommunityGuideSource,date:string,failed:boolean)=>string;notice:string;load:(s:CommunityGuideSource,date:string)=>Promise<Programme[]>};
const providers:Record<CommunityGuideSource['provider'],Provider>={
 'epg.pw':{label:s=>'EPG.pw · '+s.sourceName,page:(s,date,failed)=>failed?`https://epg.pw/last/${s.apiId}.html`:`https://epg.pw/channels/${s.apiId}/${compact(date)}.html`,notice:'Guide communautaire : les horaires peuvent changer. '+CONTINUED,load:async(s,date)=>parseCommunityJSON(await fetchJSON(`https://epg.pw/api/epg.json?channel_id=${encodeURIComponent(s.apiId!)}&date=${compact(date)}`),date)},
 SamsungTVPlus:{label:()=>'Samsung TV Plus GB · via i.mjh.nz',page:s=>s.url!,notice:'Grille Samsung TV Plus Royaume-Uni, correspondant à cette version du flux. La couverture peut se limiter aux prochaines heures.',load:async(s,date)=>parseCommunityXML(await fetchXML(s.url!),s.xmlChannelId!,date)},
 'blue.ch':{label:s=>'blue TV (Swisscom) · '+s.sourceName,page:()=>'https://tv.blue.ch/',notice:'Grille de l’opérateur suisse blue TV (Swisscom). Les horaires peuvent changer.',load:async(s,date)=>parseBlueJSON(await fetchJSON(`https://services.sg101.prd.sctv.ch/catalog/tv/channels/list/(ids=${encodeURIComponent(s.apiId!)};start=${stamp(localTime(date,0,0))};end=${stamp(localTime(addDays(date,1),6,0))};level=normal)`),date)},
 'post.lu':{label:s=>'POST TV Luxembourg · '+s.sourceName,page:()=>'https://tv.post.lu/',notice:'Grille du guide TV de POST Luxembourg. Les horaires peuvent changer.',load:async(s,date)=>parsePostJSON(await fetchDays(d=>`https://tv.post.lu/api/channels?id=${encodeURIComponent(s.apiId!)}&date=${d}`,date),date)},
 'rts.ch':{label:s=>'RTS · '+s.sourceName,page:()=>'https://www.rts.ch/play/tv/programme-tv',notice:'Grille officielle publiée par la RTS (SRG SSR).',load:async(s,date)=>parseSrgJSON(await fetchDays(d=>`https://il.srgssr.ch/integrationlayer/2.0/rts/programGuide/tv/byDate/${d}?reduced=false&channelId=${encodeURIComponent(s.apiId!)}`,date),date)},
};
export async function fetchCommunityGuide(source:CommunityGuideSource,date:string):Promise<Guide>{
 const provider=providers[source.provider],fetchedAt=new Date().toISOString(),label=provider.label(source);
 try{
  const programmes=await provider.load(source,date);
  if(!programmes.length)throw new Error('Aucune grille publiée pour cette date');
  return {channel:source.id,programmes,source:provider.page(source,date,false),sourceLabel:label,fetchedAt,notice:provider.notice};
 }catch{return {channel:source.id,programmes:[],source:provider.page(source,date,true),sourceLabel:label,fetchedAt,error:'Aucune grille accessible pour cette chaîne et cette journée. La source peut ne publier que quelques heures ou quelques jours à l’avance.'};}
}
export const communitySourceFor=(id:string)=>communityGuideSources.find(s=>s.id===id);
