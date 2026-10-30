'use client';
import {createContext,useContext,useEffect,type ReactNode} from 'react';
import {isLocale,translate,type Locale} from '../lib/i18n';

type LocaleContextValue={
 locale:Locale;
 setLocale:(next:Locale)=>void;
 t:(fr:string,vars?:Record<string,string|number>)=>string;
};
const LocaleContext=createContext<LocaleContextValue>({locale:'fr',setLocale:()=>{},t:(fr)=>fr});

function writeLocale(next:Locale){
 try{
  localStorage.setItem('onde-locale',next);
  document.cookie=`onde-locale=${next};path=/;max-age=31536000;SameSite=Lax${location.protocol==='https:'?';Secure':''}`;
  document.documentElement.lang=next==='fr'?'fr-CA':'en';
 }catch{}
}

export function LocaleProvider({children,initialLocale='fr'}:{children:ReactNode;initialLocale?:Locale}){
 useEffect(()=>{
  document.documentElement.lang=initialLocale==='fr'?'fr-CA':'en';
  try{
   const saved=localStorage.getItem('onde-locale');
   if(isLocale(saved)&&saved!==initialLocale){writeLocale(saved);window.location.reload();}
  }catch{}
 },[initialLocale]);
 const setLocale=(next:Locale)=>{if(next===initialLocale)return;writeLocale(next);window.location.reload();};
 const t=(fr:string,vars?:Record<string,string|number>)=>translate(initialLocale,fr,vars);
 return <LocaleContext.Provider value={{locale:initialLocale,setLocale,t}}>{children}</LocaleContext.Provider>;
}

export function useLocale(){
 return useContext(LocaleContext);
}
