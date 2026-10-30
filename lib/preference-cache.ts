import {emptyPreferences,type Preferences,type Operation} from './preferences';
import {validatePreferences} from './preference-import';
export type Snapshot={data:Preferences;revision:number};
export type Pending={id:string;operation:Operation;queuedAt?:number};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
export function preferenceKeys(userId:string|null){const scope=userId?'account:'+encodeURIComponent(userId):'guest';return {snapshot:'onde-preferences-v2:'+scope,pending:'onde-pending-v2:'+scope+':'};}
/** Clear visible data, retaining the account-bound outbox for the same user's return. */
export function clearPreferenceCache(storage:Storage,userId:string|null){storage.removeItem(preferenceKeys(userId).snapshot);storage.removeItem('onde-preferences-v1');storage.removeItem('onde-pending-v1');}
/** Requests retain their original store; deactivation rejects late responses. */
export class PreferenceCache {
 base:Snapshot={data:structuredClone(emptyPreferences),revision:0};
 queue:Pending[]=[];active=true;busy=false;serverFresh=false;authorized=true;generation=0;
 private persisted=new Set<string>();
 constructor(readonly userId:string|null){}
 load(storage:Storage){
  storage.removeItem('onde-preferences-v1');storage.removeItem('onde-pending-v1');
  const keys=preferenceKeys(this.userId);
  try{const saved=JSON.parse(storage.getItem(keys.snapshot)||'null');if(Number.isSafeInteger(saved?.revision)&&saved.revision>=0)this.base={data:validatePreferences(saved.data),revision:saved.revision};}catch{}
  // Each operation owns a separate key, so simultaneous tabs cannot replace queues.
  this.queue=[];this.persisted.clear();
  if(this.userId)for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(keys.pending))continue;try{const p=JSON.parse(storage.getItem(key)||'null');if(p&&typeof p.id==='string'&&/^[a-zA-Z0-9-]{10,80}$/.test(p.id)&&key===keys.pending+p.id&&p.operation&&typeof p.operation==='object'){this.queue.push(p);this.persisted.add(p.id);}}catch{}}
  this.queue.sort((a,b)=>(a.queuedAt??0)-(b.queuedAt??0)||a.id.localeCompare(b.id));
 }
 save(storage:Storage){
  if(!this.active)return;const keys=preferenceKeys(this.userId);
  let previous=-1;try{previous=JSON.parse(storage.getItem(keys.snapshot)||'null')?.revision??-1;}catch{}
  if(this.base.revision>=previous)storage.setItem(keys.snapshot,JSON.stringify(this.base));
  for(const [index,p] of this.queue.entries())if(!this.persisted.has(p.id)){p.queuedAt??=Date.now()+index/1000;storage.setItem(keys.pending+p.id,JSON.stringify(p));this.persisted.add(p.id);}
 }
 complete(id:string,storage:Storage){if(!this.active)return;try{storage.removeItem(preferenceKeys(this.userId).pending+id);}catch{}this.queue=this.queue.filter(p=>p.id!==id);}
 accept(snapshot:Snapshot,generation=this.generation){if(!this.active||generation!==this.generation||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||this.serverFresh&&snapshot.revision<this.base.revision)return false;const data=validatePreferences(snapshot.data);this.base={data,revision:snapshot.revision};this.serverFresh=true;this.authorized=true;return true;}
 deactivate(){this.generation++;this.active=false;this.authorized=false;this.base={data:structuredClone(emptyPreferences),revision:0};this.queue=[];}
}
