import {db} from './database';
import {channels as baseChannels,type Channel} from './channels';
import {mergeCatalogue,type CataloguePayload,type ChannelHealth,type MaintenanceRun} from './catalogue-maintenance';

// The catalogue is read on every page render (server component prop) and by
// several routes. A short in-memory cache with stale-while-revalidate keeps
// warm serverless instances from re-querying Neon for identical data. Only
// successful reads are cached: a failed refresh keeps serving the last good
// data, and a write bumps the generation so a read already in flight cannot
// re-cache what the write replaced.
const TTL=60000;
let cached:{at:number;data:CataloguePayload}|null=null,pending:Promise<CataloguePayload>|null=null,generation=0;

// Database entries may predate the `logoUrl` field; the base catalogue is the
// single source for it, so merge it in once instead of shipping the whole
// catalogue to the client just for logo fallbacks.
const baseLogos=new Map(baseChannels.map(c=>[c.id,c.logoUrl]));

/** The bundled channels, for pages that must render while the database is unreachable. */
export function fallbackCatalogue():CataloguePayload{
 return {channels:baseChannels,health:{},latest:null,recentIds:[],updatedAt:null};
}

/** Read the shared catalogue straight from the database (maintenance writes use this). */
export async function loadCatalogue():Promise<CataloguePayload>{
 const [entries,checks,runs]=await Promise.all([
  db.prepare('SELECT channel_id,data,added_at,updated_at FROM catalogue_entries ORDER BY added_at,channel_id').all<{channel_id:string;data:string;added_at:string;updated_at:string}>(),
  db.prepare('SELECT channel_id,data FROM catalogue_health').all<{channel_id:string;data:string}>(),
  db.prepare('SELECT data FROM catalogue_runs ORDER BY started_at DESC LIMIT 10').all<{data:string}>(),
 ]);
 const updates=entries.results.map(e=>JSON.parse(e.data) as Channel),allRuns=runs.results.map(r=>JSON.parse(r.data) as MaintenanceRun);
 const baseIds=new Set(baseChannels.map(c=>c.id));
 const recentIds=entries.results.filter(e=>Date.parse(e.added_at)>=Date.now()-30*86400000&&!baseIds.has(e.channel_id)).map(e=>e.channel_id);
 const merged=mergeCatalogue(baseChannels,updates);
 for(const channel of merged){const logo=baseLogos.get(channel.id);if(logo&&!channel.logoUrl)channel.logoUrl=logo;}
 return {channels:merged,health:Object.fromEntries(checks.results.map(c=>[c.channel_id,JSON.parse(c.data) as ChannelHealth])),latest:allRuns.find(r=>r.finishedAt)||null,recentIds,updatedAt:entries.results.map(e=>e.updated_at).sort().at(-1)||null};
}

function refresh():Promise<CataloguePayload>{
 if(!pending){
  const started=generation;
  pending=loadCatalogue().then(data=>{if(started===generation)cached={at:Date.now(),data};return data;}).finally(()=>{pending=null;});
 }
 return pending;
}

/** Drop the cached catalogue after a maintenance write. */
export function invalidateCatalogue(){cached=null;pending=null;generation++;}

/** Read the shared catalogue: cached when fresh, revalidated in the background. Throws when the database is unreachable and nothing is cached yet. */
export async function readCatalogue():Promise<CataloguePayload>{
 const found=cached;
 if(found){
  if(Date.now()-found.at>=TTL)refresh().catch(error=>logReadFailure(error));
  return found.data;
 }
 return refresh();
}

export function logReadFailure(error:unknown){
 console.error(JSON.stringify({event:'catalogue_read_failed',message:error instanceof Error?error.message:String(error)}));
}

export async function catalogueChannels(){try{return (await readCatalogue()).channels;}catch{return baseChannels;}}
