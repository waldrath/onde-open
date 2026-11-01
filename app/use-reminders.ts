'use client';
import {useCallback,useSyncExternalStore} from 'react';
import {REMINDERS_KEY,parseReminders,reminderKey,toggleReminder,type Reminder} from '../lib/reminders';
// One store for the whole page (the guide, the programme dialog and the
// scheduler in television.tsx read the same list); other tabs stay in sync
// through the storage event.
const listeners=new Set<()=>void>();
const EMPTY:Reminder[]=[];
let current:Reminder[]|null=null;
function read(){
 if(current)return current;
 try{current=parseReminders(JSON.parse(localStorage.getItem(REMINDERS_KEY)||'[]'),Date.now());}catch{current=[];}
 return current;
}
function write(next:Reminder[]){
 current=next;
 try{localStorage.setItem(REMINDERS_KEY,JSON.stringify(next));}catch{}
 for(const listener of listeners)listener();
}
function subscribe(listener:()=>void){
 listeners.add(listener);
 const storage=(event:StorageEvent)=>{if(event.key===REMINDERS_KEY){current=null;listener();}};
 window.addEventListener('storage',storage);
 return()=>{listeners.delete(listener);window.removeEventListener('storage',storage);};
}
export function useReminders(){
 const reminders=useSyncExternalStore(subscribe,read,()=>EMPTY);
 // Returns true when the reminder was added. The first one asks for the
 // notification permission, from the tap itself as browsers require.
 const toggle=useCallback((reminder:Reminder)=>{
  const before=read(),had=before.some(item=>reminderKey(item)===reminderKey(reminder));
  write(toggleReminder(before,reminder,Date.now()));
  if(!had&&'Notification' in window&&Notification.permission==='default')void Notification.requestPermission().catch(()=>{});
  return !had;
 },[]);
 const dismiss=useCallback((reminder:Reminder)=>write(read().filter(item=>reminderKey(item)!==reminderKey(reminder))),[]);
 const has=useCallback((channelId:string,start:string)=>reminders.some(item=>item.channelId===channelId&&Date.parse(item.start)===Date.parse(start)),[reminders]);
 return {reminders,toggle,dismiss,has};
}
