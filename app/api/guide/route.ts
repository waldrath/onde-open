import {addDays,parseSavoir,parseTelequebec,parseTfo,parseTvr,torontoDate,mergeBroadcastDays,type Guide} from '../../../lib/guide';
import {communityGuideSources} from '../../../lib/guide-sources';
import {communitySourceFor,fetchCommunityGuide} from '../../../lib/community-guide';
import {catalogueChannels} from '../../../lib/catalogue-store';
export const dynamic='force-dynamic';
const cache=new Map<string,{at:number;data:Guide}>(),pending=new Map<string,Promise<Guide>>();
const nativeIds=['telequebec','savoir','tfo','tvr'];
function nativeSources(date:string){const offset=(Date.parse(date+'T12:00:00Z')-Date.parse(torontoDate()+'T12:00:00Z'))/86400000;return [
 {channel:'telequebec',url:`https://telequebec.tv/en-direct/telequebec?date=${date}`,parser:parseTelequebec},
 {channel:'savoir',url:`https://horaire.savoir.media/${offset===0?'':offset}`,parser:parseSavoir},
 {channel:'tfo',url:`https://www.tfo.org/grille-horaire/${date}`,parser:parseTfo},
 {channel:'tvr',url:`https://www.tvr.bzh/grille/${date}`,parser:parseTvr},
 ];}
async function retrieve(id:string,date:string):Promise<Guide>{
 const native=nativeSources(date).find(s=>s.channel===id),community=communitySourceFor(id);
 if(!native&&community)return fetchCommunityGuide(community,date);
 const channel=(await catalogueChannels()).find(c=>c.id===id)!;const fetchedAt=new Date().toISOString();
 if(!native)return {channel:id,programmes:[],source:channel.guide,fetchedAt,error:'Cette chaîne ne dispose pas encore de grille intégrée.'};
 try{
  const days=await Promise.all([addDays(date,-1),date].map(async day=>{const source=nativeSources(day).find(s=>s.channel===id)!;try{const r=await fetch(source.url,{signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});if(!r.ok)return [];return source.parser(await r.text(),day);}catch{return [];}}));
  let programmes=mergeBroadcastDays(days.flat(),date);if(!programmes.length)throw new Error();
  let enriched=false;
  if(community){const extra=await fetchCommunityGuide(community,date);programmes=programmes.map(p=>{if(p.detail&&p.detail!==p.title)return p;const other=extra.programmes.find(e=>e.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===p.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()&&Math.abs(Date.parse(e.start)-Date.parse(p.start))<=120000);if(other?.detail){enriched=true;return {...p,detail:other.detail};}return p;});}
  return {channel:id,programmes,source:native.url,fetchedAt,sourceLabel:enriched?'Grille officielle · résumés EPG.pw':'Grille officielle'};
 }catch{if(community)return fetchCommunityGuide(community,date);return {channel:id,programmes:[],source:native.url,fetchedAt,error:'Le diffuseur ne fournit pas de grille accessible pour cette journée. Consulte son horaire officiel.'};}
}
function getGuide(id:string,date:string){
 const key=date+':'+id,found=cache.get(key);if(found&&Date.now()-found.at<(found.data.programmes.length?300000:60000))return Promise.resolve(found.data);
 let task=pending.get(key);if(!task){task=retrieve(id,date).then(data=>{cache.set(key,{at:Date.now(),data});while(cache.size>100)cache.delete(cache.keys().next().value!);return data;}).finally(()=>pending.delete(key));pending.set(key,task);}return task;
}
export async function GET(request:Request){
 const today=torontoDate(),url=new URL(request.url),date=url.searchParams.get('date')||today;
 const offset=(Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(offset)||offset< -1||offset>13||addDays(today,offset)!==date)return Response.json({error:'Choisis une date entre hier et les treize prochains jours.'},{status:400});
 const selected=url.searchParams.get('channel');if(selected&&!(await catalogueChannels()).some(c=>c.id===selected))return Response.json({error:'Chaîne introuvable.'},{status:404});
 const ids=selected?[selected]:url.searchParams.get('scope')==='community'?communityGuideSources.filter(s=>!s.fallbackOnly).map(s=>s.id):nativeIds;
 const results:Guide[]=[];let cursor=0;
 // Stay below Worker subrequest limits and avoid bursts at guide providers.
 await Promise.all(Array.from({length:Math.min(6,ids.length)},async()=>{while(cursor<ids.length){const id=ids[cursor++];results.push(await getGuide(id,date));}}));
 return Response.json(results,{headers:{'Cache-Control':'private, max-age=120'}});
}
