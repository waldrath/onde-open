import {db} from '../../../lib/database';
import {getOndeUser} from '../../../lib/session';
import {catalogueChannels} from '../../../lib/catalogue-store';
import { applyOperation, emptyPreferences, type Operation, type Preferences } from '../../../lib/preferences';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await getOndeUser();if(!user||request.headers.get('x-onde-account')!==user.authId)return response({error:'Connexion requise'},401);
 try{
  const row=await db.prepare('SELECT data, revision, updated_at FROM preferences WHERE user_id = ?').bind(user.userId).first<{data:string;revision:number;updated_at:string}>();
  return response({data:row?JSON.parse(row.data):emptyPreferences,revision:row?.revision??0,updatedAt:row?.updated_at??null});
 }catch{return response({error:'Synchronisation momentanément indisponible'},503);}
}
export async function POST(request:Request){
 const user=await getOndeUser();if(!user||request.headers.get('x-onde-account')!==user.authId)return response({error:'Connexion requise'},401);
 const origin=request.headers.get('origin');if(origin!==new URL(request.url).origin)return response({error:'Origine invalide'},403);
 const knownChannels=await catalogueChannels();
 if(Number(request.headers.get('content-length')||0)>4096)return response({error:'Requête trop longue'},413);
 let op:Operation;let operationId:string;try{const raw=await request.text();if(raw.length>4096)return response({error:'Requête trop longue'},413);const payload=JSON.parse(raw);op=payload.operation;operationId=payload.id;if(typeof operationId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(operationId))throw new Error('Identifiant de modification invalide');applyOperation(emptyPreferences,op.type==='listChannel'||op.type==='renameList'?{type:'deleteList',id:''}:op,new Date().toISOString(),knownChannels);}catch(e){return response({error:e instanceof Error?e.message:'Action invalide'},400);}
 try{
  
  await db.prepare('INSERT OR IGNORE INTO preferences (user_id, data, revision, updated_at) VALUES (?, ?, 0, ?)').bind(user.userId,JSON.stringify(emptyPreferences),new Date().toISOString()).run();
  for(let attempt=0;attempt<5;attempt++){
   const row=await db.prepare('SELECT data, revision, last_operations FROM preferences WHERE user_id = ?').bind(user.userId).first<{data:string;revision:number;last_operations:string}>();if(!row)throw new Error('Missing state');
   const completed:string[]=JSON.parse(row.last_operations);if(completed.includes(operationId))return response({data:JSON.parse(row.data),revision:row.revision});
   let data:Preferences;try{data=applyOperation(JSON.parse(row.data),op,new Date().toISOString(),knownChannels);}catch(e){return response({error:e instanceof Error?e.message:'Action invalide'},400);}
   const updatedAt=new Date().toISOString();
   const result=await db.prepare('UPDATE preferences SET data = ?, revision = revision + 1, updated_at = ?, last_operations = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(data),updatedAt,JSON.stringify([...completed,operationId].slice(-128)),user.userId,row.revision).run();
   if(result.meta.changes===1)return response({data,revision:row.revision+1,updatedAt});
  }
  return response({error:'Une autre modification est en cours. Réessaie.'},409);
 }catch{return response({error:'Synchronisation indisponible. Ta modification reste en attente sur cet appareil.'},503);}
}
