'use client';
import {Bell,BellRing} from 'lucide-react';
import type {Programme} from '../lib/guide';
import {useLocale} from './locale-provider';
import {useReminders} from './use-reminders';
// "Me prévenir" for a programme that has not started yet (see lib/reminders.ts).
export default function ReminderToggle({channelId,programme}:{channelId:string;programme:Programme}){
 const {t}=useLocale();
 const {has,toggle}=useReminders();
 if(Date.parse(programme.start)<=Date.now())return null;
 const on=has(channelId,programme.start);
 const blocked=typeof Notification!=='undefined'&&Notification.permission==='denied';
 return <div className="reminder-toggle">
  <button type="button" className={`secondary full-width ${on?'is-on':''}`} aria-pressed={on} onClick={()=>toggle({channelId,start:programme.start,title:programme.title})}>{on?<BellRing size={16}/>:<Bell size={16}/>}{t(on?'Rappel activé · touchez pour l’annuler':'Me prévenir quand ça commence')}</button>
  {on&&<p>{t(blocked?'Les notifications sont bloquées dans ce navigateur : le rappel s’affichera dans Onde, s’il est ouvert.':'Onde vous préviendra au début de l’émission, tant qu’un onglet Onde reste ouvert.')}</p>}
 </div>;
}
