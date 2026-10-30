'use client';
import {useEffect,useState} from 'react';
import ThemeBackdrop from '../theme-backdrop';
import {isTheme,type Theme} from '../../lib/themes';

export default function SignInShell({children,initialTheme='dark'}:{children:React.ReactNode;initialTheme?:Theme}){
 const [theme,setTheme]=useState<Theme>(initialTheme);
 useEffect(()=>{
  const read=()=>{try{const saved=localStorage.getItem('onde-theme');setTheme(isTheme(saved)?saved:'dark');}catch{setTheme('dark');}};
  read();
  const onStorage=(event:StorageEvent)=>{if(event.key==='onde-theme')read();};
  window.addEventListener('storage',onStorage);
  return()=>window.removeEventListener('storage',onStorage);
 },[]);
 return <main className="access-page app-shell" data-theme={theme}>
  <ThemeBackdrop theme={theme}/>
  <div className="access-halo" aria-hidden="true"/>
  {children}
 </main>;
}
