import {db} from '../../../lib/database';
import {readCatalogue} from '../../../lib/catalogue-store';
import {parseOutcome,outcomeBucket,RELIABILITY_DAYS} from '../../../lib/reliability';
export const dynamic='force-dynamic';
// Anonymous playback outcomes (see lib/reliability.ts). A viewer is a short
// digest of their address, as for reports; nothing else about them is kept.
const response=(data:unknown,status=200,cache='no-store')=>Response.json(data,{status,headers:{'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
let schema:Promise<unknown>|undefined;
function ensureSchema(){return schema??=db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS playback_outcomes (channel_id text NOT NULL, reporter text NOT NULL, bucket text NOT NULL, ok boolean NOT NULL, created_at text NOT NULL, PRIMARY KEY (channel_id, reporter, bucket))'),
 db.prepare('CREATE INDEX IF NOT EXISTS playback_outcome_created ON playback_outcomes(created_at)'),
]).catch(error=>{schema=undefined;throw error;});}
function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 return !origin||origin===new URL(request.url).origin;
}
async function reporterFrom(request:Request){
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||request.headers.get('x-real-ip')||'local';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('outcome:'+ip));
 return [...new Uint8Array(digest)].slice(0,8).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
// The aggregate is read by every visitor: one query per instance every ten
// minutes, shared through the CDN as well.
const TTL=600000;
let cached:{at:number;channels:Record<string,[number,number]>}|null=null;
export async function GET(){
 try{
  if(!cached||Date.now()-cached.at>=TTL){
   await ensureSchema();
   const since=new Date(Date.now()-RELIABILITY_DAYS*86400000).toISOString();
   const rows=await db.prepare('SELECT channel_id, SUM(CASE WHEN ok THEN 1 ELSE 0 END)::int AS ok, SUM(CASE WHEN ok THEN 0 ELSE 1 END)::int AS failed FROM playback_outcomes WHERE created_at>? GROUP BY channel_id').bind(since).all<{channel_id:string;ok:number;failed:number}>();
   cached={at:Date.now(),channels:Object.fromEntries(rows.results.map(row=>[row.channel_id,[row.ok,row.failed]]))};
   // Outcomes older than twice the window no longer count for anything.
   void db.prepare('DELETE FROM playback_outcomes WHERE created_at<?').bind(new Date(Date.now()-2*RELIABILITY_DAYS*86400000).toISOString()).run().catch(error=>console.error(JSON.stringify({event:'reliability_prune_failed',error:String(error)})));
  }
  return response({channels:cached.channels},200,'public, max-age=300, s-maxage=600, stale-while-revalidate=3600');
 }catch(error){
  console.error(JSON.stringify({event:'reliability_read_failed',error:String(error)}));
  return response({channels:{}},503);
 }
}
export async function POST(request:Request){
 if(!sameOrigin(request))return response({error:'Origine invalide'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return response({error:'JSON requis'},415);
 try{
  const raw=await request.text();if(raw.length>500)return response({error:'Requête trop volumineuse'},413);
  let body:unknown;try{body=JSON.parse(raw);}catch{return response({error:'Résultat invalide'},400);}
  const outcome=parseOutcome(body);if(!outcome)return response({error:'Résultat invalide'},400);
  const catalogue=await readCatalogue();if(!catalogue.channels.some(channel=>channel.id===outcome.channelId))return response({error:'Chaîne inconnue'},404);
  await ensureSchema();
  const reporter=await reporterFrom(request),now=new Date();
  const recent=await db.prepare('SELECT COUNT(*)::int AS count FROM playback_outcomes WHERE reporter=? AND created_at>?').bind(reporter,new Date(now.getTime()-600000).toISOString()).first<{count:number}>();
  if((recent?.count||0)>=60)return response({error:'Trop de résultats, réessaie plus tard'},429);
  await db.prepare('INSERT INTO playback_outcomes (channel_id,reporter,bucket,ok,created_at) VALUES (?,?,?,?,?) ON CONFLICT (channel_id,reporter,bucket) DO UPDATE SET ok=excluded.ok, created_at=excluded.created_at').bind(outcome.channelId,reporter,outcomeBucket(now),outcome.ok,now.toISOString()).run();
  return response({ok:true});
 }catch(error){
  console.error(JSON.stringify({event:'reliability_write_failed',error:String(error)}));
  return response({error:'Résultat momentanément indisponible'},503);
 }
}
