import {secretMatches} from '../../../lib/session';
import {db} from '../../../lib/database';
import {channels as baseChannels} from '../../../lib/channels';
import {readCatalogue} from '../../../lib/catalogue-store';
import {recordHealth,validateChannel,type MaintenanceRun,type ChannelHealth} from '../../../lib/catalogue-maintenance';
import {maintenanceInstructions} from '../../../lib/maintenance-instructions';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Catalogue reads are public; maintenance instructions and writes require the admin secret.
export async function GET(request:Request){
 if(new URL(request.url).searchParams.has('instructions')){if(!secretMatches(request.headers.get('authorization'),process.env.CATALOGUE_ADMIN_SECRET))return response({error:'Accès refusé'},401);return response({version:1,instructions:maintenanceInstructions});}
 try{return response(await readCatalogue());}catch{return response({error:'Catalogue partagé momentanément indisponible'},503);}
}
export async function POST(request:Request){
 if(!secretMatches(request.headers.get('authorization'),process.env.CATALOGUE_ADMIN_SECRET))return response({error:'Accès refusé'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return response({error:'Origine invalide'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return response({error:'JSON requis'},415);
 try{
  const raw=await request.text();if(raw.length>100000)return response({error:'Lot trop volumineux'},413);
  const body=JSON.parse(raw),now=new Date().toISOString();
  if(body.operation==='begin'){
   const run:MaintenanceRun={id:crypto.randomUUID(),startedAt:now,checked:0,added:0,updated:0,summary:''};
   await db.prepare('INSERT INTO catalogue_runs (run_id,data,started_at) VALUES (?,?,?)').bind(run.id,JSON.stringify(run),now).run();return response({run});
  }
  if(typeof body.runId!=='string'||body.runId.length>80)throw new Error('Entretien invalide');
  const stored=await db.prepare('SELECT data FROM catalogue_runs WHERE run_id=?').bind(body.runId).first<{data:string}>();if(!stored)throw new Error('Entretien inconnu');
  const run=JSON.parse(stored.data) as MaintenanceRun;if(run.finishedAt)throw new Error('Cet entretien est terminé');
  const catalogue=await readCatalogue(),known=new Set(catalogue.channels.map(c=>c.id));
  if(body.operation==='checks'){
   if(!Array.isArray(body.checks)||!body.checks.length||body.checks.length>50)throw new Error('Lot de contrôles invalide');
   const ids=new Set<string>();const rows=body.checks.map((c:{id:string;result:ChannelHealth['result'];note:string})=>{
    if(!known.has(c.id)||ids.has(c.id))throw new Error('Chaîne inconnue ou contrôle en double');ids.add(c.id);
    return recordHealth(catalogue.health[c.id],c.id,c.result,c.note,run.id,now);
   });
   await db.batch(rows.map((h:ChannelHealth)=>db.prepare('INSERT INTO catalogue_health (channel_id,data) VALUES (?,?) ON CONFLICT(channel_id) DO UPDATE SET data=excluded.data').bind(h.id,JSON.stringify(h))));return response({saved:rows.length});
  }
  if(body.operation==='upsert'){
   if(!Array.isArray(body.channels)||!body.channels.length||body.channels.length>20||typeof body.evidence!=='string'||body.evidence.trim().length<20||body.evidence.length>8000)throw new Error('Sources et preuves requises');
   const rows=(body.channels as unknown[]).map(validateChannel);if(new Set(rows.map(c=>c.id)).size!==rows.length)throw new Error('Identifiants en double');
   const statements=[];
   for(const c of rows){
    const prior=catalogue.channels.find(p=>p.id===c.id);
    statements.push(db.prepare('INSERT INTO catalogue_entries (channel_id,data,added_at,updated_at,run_id) VALUES (?,?,?,?,?) ON CONFLICT(channel_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,run_id=excluded.run_id').bind(c.id,JSON.stringify(c),now,now,run.id));
    if(prior&&(prior.stream!==c.stream||prior.embed!==c.embed||prior.resolve!==c.resolve||prior.youtube!==c.youtube))statements.push(db.prepare('DELETE FROM catalogue_health WHERE channel_id=?').bind(c.id));
   }
   run.sources=[...(run.sources||[]),{ids:rows.map(c=>c.id),evidence:body.evidence}].slice(-30);
   statements.push(db.prepare('UPDATE catalogue_runs SET data=? WHERE run_id=?').bind(JSON.stringify(run),run.id));
   await db.batch(statements);return response({saved:rows.length,ids:rows.map(c=>c.id)});
  }
  if(body.operation==='finish'){
   if(typeof body.summary!=='string'||!body.summary.trim()||body.summary.length>2500)throw new Error('Résumé requis');
   const checks=Object.values(catalogue.health).filter(h=>h.runId===run.id),changed=await db.prepare('SELECT channel_id,added_at FROM catalogue_entries WHERE run_id=?').bind(run.id).all<{channel_id:string;added_at:string}>();
   run.checked=checks.length;run.added=changed.results.filter(c=>c.added_at>=run.startedAt&&!baseChannels.some(b=>b.id===c.channel_id)).length;run.updated=changed.results.length-run.added;run.finishedAt=now;run.summary=body.summary;
   await db.prepare('UPDATE catalogue_runs SET data=? WHERE run_id=?').bind(JSON.stringify(run),run.id).run();return response({run});
  }
  throw new Error('Opération inconnue');
 }catch(e){return response({error:e instanceof Error?e.message:'Entretien indisponible'},400);}
}
