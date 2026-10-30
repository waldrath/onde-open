'use client';
import {makeId} from '../lib/identifiers';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {applyOperation,emptyPreferences,type Operation,type Preferences} from '../lib/preferences';
import {channels as baseChannels} from '../lib/channels';
import {PreferenceCache,clearPreferenceCache,type Snapshot} from '../lib/preference-cache';
export function usePreferences(userId:string|null,knownChannels:readonly {id:string}[]=baseChannels){
 const known=useRef(knownChannels);known.current=knownChannels;
 const store=useMemo(()=>new PreferenceCache(userId),[userId]);
 const [rendered,setRendered]=useState<{scope:string|null;data:Preferences}>({scope:userId,data:emptyPreferences});
 const [status,setStatus]=useState<'loading'|'synced'|'pending'|'offline'|'local'>('loading'),[error,setError]=useState('');
 const abort=useRef<AbortController|null>(null);
 const render=useCallback(()=>{if(!store.active)return;let data=store.authorized?store.base.data:emptyPreferences;for(const op of store.authorized?store.queue:[]){try{data=applyOperation(data,op.operation,new Date().toISOString(),known.current);}catch{}}setRendered({scope:userId,data});try{store.save(localStorage);}catch{}},[store,userId]);
 const expired=useCallback(()=>{try{clearPreferenceCache(localStorage,userId);}catch{}store.deactivate();setRendered({scope:userId,data:emptyPreferences});setStatus('offline');setError('Votre session a changé. Reconnectez-vous.');window.location.assign('/sign-in');},[store,userId]);
 const flush=useCallback(async()=>{
  if(store.busy||!userId||!store.active||!store.authorized)return;const generation=store.generation,signal=abort.current?.signal;store.busy=true;
  try{while(store.queue.length&&store.active){setStatus('pending');const current=store.queue[0];const r=await fetch('/api/preferences',{method:'POST',headers:{'Content-Type':'application/json','X-Onde-Account':userId},body:JSON.stringify(current),signal});if(!store.active||generation!==store.generation)return;if(r.status===401){expired();return;}const result=await r.json() as Snapshot&{error?:string};if(!store.active||generation!==store.generation)return;if(!r.ok){if(r.status===400){store.complete(current.id,localStorage);render();setError(result.error||'Action impossible');continue;}throw new Error(result.error||'Connexion interrompue');}if(store.accept(result,generation)){store.complete(current.id,localStorage);render();setError('');}else throw new Error('Synchronisation à réessayer.');}
   if(store.active&&generation===store.generation)setStatus('synced');
  }catch(e){if(store.active&&generation===store.generation){setStatus('offline');setError(e instanceof Error?e.message:'Connexion interrompue');}}finally{if(generation===store.generation)store.busy=false;}
 },[store,userId,render,expired]);
 const refresh=useCallback(async()=>{
  if(!store.active||store.busy)return;if(!userId){setStatus('local');return;}const generation=store.generation,signal=abort.current?.signal;
  try{const r=await fetch('/api/preferences',{cache:'no-store',headers:{'X-Onde-Account':userId},signal});if(!store.active||generation!==store.generation)return;if(r.status===401){expired();return;}if(!r.ok)throw new Error();const result=await r.json() as Snapshot;if(!store.active||generation!==store.generation)return;if(!store.busy&&store.accept(result,generation))render();if(store.active){setStatus(store.queue.length?'pending':'synced');setError('');await flush();}}catch{if(store.active&&generation===store.generation)setStatus('offline');}
 },[store,userId,render,flush,expired]);
 useEffect(()=>{
  store.active=true;store.authorized=true;abort.current=new AbortController();setError('');setStatus('loading');try{store.load(localStorage);}catch{}render();void refresh();
  const update=()=>{if(!document.hidden)void refresh();};const timer=setInterval(update,15000);const logout=()=>{abort.current?.abort();store.deactivate();setRendered({scope:userId,data:emptyPreferences});};const restored=(event:PageTransitionEvent)=>{if(event.persisted&&userId){abort.current?.abort();abort.current=new AbortController();store.generation++;store.busy=false;store.authorized=false;setRendered({scope:userId,data:emptyPreferences});store.serverFresh=false;void refresh();}};const accountEvent=(event:StorageEvent)=>{if(userId&&event.key==='onde-auth-event'){try{clearPreferenceCache(localStorage,userId);}catch{}logout();window.location.assign('/sign-in');}};
  window.addEventListener('focus',update);window.addEventListener('online',update);window.addEventListener('onde-sign-out',logout);window.addEventListener('storage',accountEvent);window.addEventListener('pageshow',restored);document.addEventListener('visibilitychange',update);
  return()=>{abort.current?.abort();store.deactivate();clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('online',update);window.removeEventListener('onde-sign-out',logout);window.removeEventListener('storage',accountEvent);window.removeEventListener('pageshow',restored);document.removeEventListener('visibilitychange',update);};
 },[store,userId,render,refresh]);
 const data=rendered.scope===userId?rendered.data:emptyPreferences;
 const mutate=useCallback((operation:Operation)=>{if(!store.active||!store.authorized)return false;try{let latest=store.base.data;for(const entry of store.queue)latest=applyOperation(latest,entry.operation,new Date().toISOString(),known.current);applyOperation(latest,operation,new Date().toISOString(),known.current);if(userId){store.queue.push({id:makeId(),operation});setStatus('pending');}else{store.base.data=applyOperation(store.base.data,operation,new Date().toISOString(),known.current);setStatus('local');}render();setError('');void flush();return true;}catch(e){setError(e instanceof Error?e.message:'Action impossible');return false;}},[data,store,userId,render,flush]);
 return {data,status,error,mutate,refresh};
}
