import {db} from '../../../lib/database';
import {readCatalogue} from '../../../lib/catalogue-store';
import {parseReport} from '../../../lib/reports';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
let schema:Promise<unknown>|undefined;
function ensureSchema(){return schema??=db.prepare('CREATE TABLE IF NOT EXISTS channel_reports (id text PRIMARY KEY, channel_id text NOT NULL, reason text NOT NULL, created_at text NOT NULL, reporter text NOT NULL)').run();}
function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 return !origin||origin===new URL(request.url).origin;
}
async function reporterFrom(request:Request){
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'local';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
 return [...new Uint8Array(digest)].slice(0,8).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function parseBody(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json'))return {error:response({error:'JSON requis'},415)} as const;
 const raw=await request.text();if(raw.length>2000)return {error:response({error:'Requête trop volumineuse'},413)} as const;
 const report=parseReport(JSON.parse(raw));if(!report)return {error:response({error:'Signalement invalide'},400)} as const;
 const catalogue=await readCatalogue();if(!catalogue.channels.some(channel=>channel.id===report.channelId))return {error:response({error:'Chaîne inconnue'},404)} as const;
 return {report} as const;
}
export async function POST(request:Request){
 if(!sameOrigin(request))return response({error:'Origine invalide'},403);
 try{
  const parsed=await parseBody(request);if('error' in parsed)return parsed.error;
  await ensureSchema();
  const reporter=await reporterFrom(request);
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const recent=await db.prepare('SELECT COUNT(*)::int AS count FROM channel_reports WHERE reporter=? AND created_at>?').bind(reporter,since).first<{count:number}>();
  if((recent?.count||0)>=5)return response({error:'Trop de signalements, réessaie dans quelques minutes'},429);
  await db.prepare('INSERT INTO channel_reports (id,channel_id,reason,created_at,reporter) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),parsed.report.channelId,parsed.report.reason,new Date().toISOString(),reporter).run();
  return response({ok:true});
 }catch{return response({error:'Signalement momentanément indisponible'},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return response({error:'Origine invalide'},403);
 try{
  const parsed=await parseBody(request);if('error' in parsed)return parsed.error;
  await ensureSchema();
  const reporter=await reporterFrom(request);
  const result=await db.prepare('DELETE FROM channel_reports WHERE channel_id=? AND reporter=?').bind(parsed.report.channelId,reporter).run();
  return response({ok:true,removed:result.meta.changes});
 }catch{return response({error:'Signalement momentanément indisponible'},503);}
}
