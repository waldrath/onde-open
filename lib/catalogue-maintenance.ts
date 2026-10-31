import type {Channel} from './channels';
export type ChannelHealth={id:string;result:'ok'|'failed'|'unverified';state:'responding'|'suspect'|'unknown';checkedAt:string;lastSuccessAt?:string;lastFailureAt?:string;failures:number;note:string;runId:string};
export type MaintenanceRun={id:string;startedAt:string;finishedAt?:string;checked:number;added:number;updated:number;summary:string;sources?:{ids:string[];evidence:string}[]};
export type CataloguePayload={channels:Channel[];health:Record<string,ChannelHealth>;latest:MaintenanceRun|null;recentIds:string[];updatedAt:string|null};
const fields=['id','name','brand','region','category','color','language','directory','description','official','guide','stream','streamAlts','embed','resolve','youtube','limited','premium','note','logoUrl','insecureStream'] as const;
const resolves=['telequebec','cpac','france24','youtube','tfo','public-senat'];
export function validateChannel(raw:unknown):Channel{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Chaîne invalide');
 const c=Object.fromEntries(fields.filter(k=>k in raw).map(k=>[k,(raw as Record<string,unknown>)[k]])) as unknown as Channel;
 if(typeof c.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(c.id))throw new Error('Identifiant de chaîne invalide');
 for(const key of ['name','brand','category','description'] as const)if(typeof c[key]!=='string'||!c[key].trim()||c[key].length>(key==='description'?1200:120))throw new Error('Description de chaîne invalide');
 if(!['Québec','Canada','France','USA','Suède','International'].includes(c.region)||!['fr','en','sv','zxx'].includes(c.language||'fr')||!/^#[0-9a-f]{6}$/i.test(c.color))throw new Error('Région, langue ou couleur invalide');
 if(c.resolve&&!resolves.includes(c.resolve))throw new Error('Résolveur inconnu');
 if(c.limited!==undefined&&typeof c.limited!=='boolean')throw new Error('Restriction invalide');
 if(c.premium!==undefined&&typeof c.premium!=='boolean')throw new Error('Marqueur premium invalide');
 if(c.insecureStream!==undefined&&(typeof c.insecureStream!=='boolean'||(c.insecureStream&&!(typeof c.stream==='string'&&c.stream.startsWith('http://')))))throw new Error('Marqueur de flux non sécurisé invalide');
 if(c.streamAlts!==undefined){
  if(!Array.isArray(c.streamAlts)||!c.streamAlts.length||c.streamAlts.length>8)throw new Error('Liste de flux de secours invalide');
  if(typeof c.stream!=='string')throw new Error('Flux de secours sans flux principal');
  const seenAlts=new Set<string>();
  for(const alternate of c.streamAlts as unknown[]){
   if(!alternate||typeof alternate!=='object')throw new Error('Flux de secours invalide');
   const {url:alternateUrl,label}=alternate as {url?:unknown;label?:unknown};
   if(typeof alternateUrl!=='string'||alternateUrl===c.stream||seenAlts.has(alternateUrl))throw new Error('Flux de secours invalide');
   if(label!==undefined&&(typeof label!=='string'||!label.trim()||label.length>40))throw new Error('Libellé de secours invalide');
   seenAlts.add(alternateUrl);
   const u=new URL(alternateUrl);
   // Alternates may be plain http (bare-IP relays); everything else must
   // still be a public host, as for `stream`.
   if(!['https:','http:'].includes(u.protocol)||u.username||u.password||['localhost','localhost.localdomain'].includes(u.hostname)||!u.hostname.includes('.')||/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)||u.hostname.includes(':'))throw new Error('Flux de secours non public');
  }
 }
 if(c.note!==undefined&&(typeof c.note!=='string'||c.note.length>1800))throw new Error('Note trop longue');
 for(const key of ['official','guide','directory','stream','embed','youtube','logoUrl'] as const){
  const value=c[key];if(value===undefined)continue;
  if(typeof value!=='string'||value.length>3000)throw new Error('URL invalide');
  const u=new URL(value);
  // Same single exception as the JSON loader: an http stream explicitly
  // flagged `insecureStream` (the player explains the browser setting).
  const insecureHttpStream=key==='stream'&&u.protocol==='http:'&&c.insecureStream===true;
  if((u.protocol!=='https:'&&!insecureHttpStream)||u.username||u.password||(u.protocol==='https:'&&u.port&&!['443','8443'].includes(u.port)))throw new Error('Une source HTTPS publique est requise');
  if(['localhost','localhost.localdomain'].includes(u.hostname)||!u.hostname.includes('.')||/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)||u.hostname.includes(':'))throw new Error('Source locale interdite');
  if(key==='youtube'&&!['www.youtube.com','youtube.com'].includes(u.hostname))throw new Error('Source YouTube invalide');
 }
 if(!c.official||!c.guide||!(c.stream||c.embed||c.resolve))throw new Error('Provenance et lecteur intégrable requis');
 return c;
}
export function mergeCatalogue(base:Channel[],updates:Channel[]):Channel[]{
 const byId=new Map(base.map(c=>[c.id,c]));for(const c of updates)byId.set(c.id,c);return [...byId.values()];
}
export function recordHealth(previous:ChannelHealth|undefined,id:string,result:ChannelHealth['result'],note:string,runId:string,now=new Date().toISOString()):ChannelHealth{
 if(!['ok','failed','unverified'].includes(result)||typeof note!=='string'||note.length>1200)throw new Error('Contrôle invalide');
 const next:ChannelHealth={id,result,state:'unknown',checkedAt:now,failures:previous?.failures||0,note,runId,lastSuccessAt:previous?.lastSuccessAt,lastFailureAt:previous?.lastFailureAt};
 if(result==='ok'){next.state='responding';next.lastSuccessAt=now;next.failures=0;next.lastFailureAt=undefined;}
 else if(result==='failed'){
  // Repeated requests in one audit cannot turn a single outage into a verdict.
  if(!previous?.lastFailureAt||Date.parse(now)-Date.parse(previous.lastFailureAt)>=6*3600000){next.failures++;next.lastFailureAt=now;}
  next.state=next.failures>=2?'suspect':'unknown';
 }else{next.state=previous?.state==='suspect'?'suspect':'unknown';}
 return next;
}
