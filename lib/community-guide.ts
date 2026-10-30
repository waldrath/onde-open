import {addDays,localTime,type Guide,type Programme} from './guide';
import {communityGuideSources,type CommunityGuideSource} from './guide-sources';
function plain(value:unknown){if(typeof value!=='string')return '';return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>{const v=parseInt(n,16);return v<=0x10ffff?String.fromCodePoint(v):'';}).replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/&quot;/g,'"').replace(/&apos;|&#039;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
function relevant(programmes:Programme[],date:string){const start=Date.parse(localTime(date,0,0)),end=Date.parse(localTime(addDays(date,1),6,0));return programmes.filter(p=>Date.parse(p.start)<end&&(p.end?Date.parse(p.end)>start:Date.parse(p.start)>=start));}
export function parseCommunityJSON(payload:unknown,date:string):Programme[]{
 const data=payload as {epg_list?:{start_date?:unknown;title?:unknown;desc?:unknown}[];error_message?:unknown};
 if(!Array.isArray(data?.epg_list)||data.epg_list.length>3000||data.error_message)throw new Error('Grille indisponible');
 const unique=new Map<string,Programme>();
 for(const row of data.epg_list){
  if(typeof row.start_date!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(row.start_date))continue;
  const time=Date.parse(row.start_date),title=plain(row.title).slice(0,400);if(!Number.isFinite(time)||!title)continue;
  const start=new Date(time).toISOString();if(!unique.has(start))unique.set(start,{start,end:'',title,detail:plain(row.desc).slice(0,6000)});
 }
 const rows=[...unique.values()].sort((a,b)=>a.start.localeCompare(b.start));
 const programmes=rows.map((p,i)=>{const next=rows[i+1];const gap=next?Date.parse(next.start)-Date.parse(p.start):0;return {...p,end:next&&gap<=12*3600000?next.start:''};});
 return relevant(programmes,date);
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
export async function fetchCommunityGuide(source:CommunityGuideSource,date:string):Promise<Guide>{
 const fetchedAt=new Date().toISOString(),label=source.provider==='epg.pw'?'EPG.pw · '+source.sourceName:'Samsung TV Plus GB · via i.mjh.nz';
 const url=source.provider==='epg.pw'?`https://epg.pw/api/epg.json?channel_id=${source.apiId}&date=${date.replaceAll('-','')}`:source.url!;
 try{
  let programmes:Programme[];
  if(source.provider==='epg.pw'){
   const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error();
   const text=await r.text();if(text.length>2000000)throw new Error();programmes=parseCommunityJSON(JSON.parse(text),date);
  }else programmes=parseCommunityXML(await fetchXML(url),source.xmlChannelId!,date);
  if(!programmes.length)throw new Error('Aucune grille publiée pour cette date');
  return {channel:source.id,programmes,source:source.provider==='epg.pw'?`https://epg.pw/channels/${source.apiId}/${date.replaceAll('-','')}.html`:url,sourceLabel:label,fetchedAt,notice:source.provider==='epg.pw'?'Guide communautaire : les horaires peuvent changer. Les heures de fin sont déduites du début de l’émission suivante.':'Grille Samsung TV Plus Royaume-Uni, correspondant à cette version du flux. La couverture peut se limiter aux prochaines heures.'};
 }catch{return {channel:source.id,programmes:[],source:source.provider==='epg.pw'?`https://epg.pw/last/${source.apiId}.html`:url,sourceLabel:label,fetchedAt,error:'Aucune grille accessible pour cette chaîne et cette journée. La source peut ne publier que quelques heures ou quelques jours à l’avance.'};}
}
export const communitySourceFor=(id:string)=>communityGuideSources.find(s=>s.id===id);
