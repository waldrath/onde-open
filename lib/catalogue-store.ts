import {db} from './database';
import {channels as baseChannels,type Channel} from './channels';
import {mergeCatalogue,type CataloguePayload,type ChannelHealth,type MaintenanceRun} from './catalogue-maintenance';
export async function readCatalogue():Promise<CataloguePayload>{
 
 const [entries,checks,runs]=await Promise.all([
  db.prepare('SELECT channel_id,data,added_at,updated_at FROM catalogue_entries ORDER BY added_at,channel_id').all<{channel_id:string;data:string;added_at:string;updated_at:string}>(),
  db.prepare('SELECT channel_id,data FROM catalogue_health').all<{channel_id:string;data:string}>(),
  db.prepare('SELECT data FROM catalogue_runs ORDER BY started_at DESC LIMIT 10').all<{data:string}>(),
 ]);
 const updates=entries.results.map(e=>JSON.parse(e.data) as Channel),allRuns=runs.results.map(r=>JSON.parse(r.data) as MaintenanceRun);
 const baseIds=new Set(baseChannels.map(c=>c.id));
 const recentIds=entries.results.filter(e=>Date.parse(e.added_at)>=Date.now()-30*86400000&&!baseIds.has(e.channel_id)).map(e=>e.channel_id);
 return {channels:mergeCatalogue(baseChannels,updates),health:Object.fromEntries(checks.results.map(c=>[c.channel_id,JSON.parse(c.data) as ChannelHealth])),latest:allRuns.find(r=>r.finishedAt)||null,recentIds,updatedAt:entries.results.map(e=>e.updated_at).sort().at(-1)||null};
}
export async function catalogueChannels(){try{return (await readCatalogue()).channels;}catch{return baseChannels;}}
