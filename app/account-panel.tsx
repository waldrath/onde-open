'use client';
import {useEffect,useRef,useState} from 'react';
import {X,UserRound,LogOut,Heart,ListVideo} from 'lucide-react';
import {clearPreferenceCache} from '../lib/preference-cache';
export default function AccountPanel({userId,favoriteCount,listCount,onClose}:{userId:string;favoriteCount:number;listCount:number;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function logout(){setBusy(true);setError('');try{const r=await fetch('/api/session/logout',{method:'POST'});if(!r.ok)throw Error();try{clearPreferenceCache(localStorage,userId);localStorage.setItem('onde-auth-event',String(Date.now()));}catch{}window.dispatchEvent(new Event('onde-sign-out'));window.location.assign('/');}catch{setBusy(false);setError('La déconnexion a échoué. Réessayez.');}}
 return <dialog ref={dialog} className="modal account-panel" aria-labelledby="account-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-body"><button className="modal-close icon-button" onClick={onClose} aria-label="Fermer mon compte"><X size={22}/></button><UserRound size={32}/><h2 id="account-title">Mon compte Onde</h2><p>Vos sélections sont synchronisées avec votre compte.</p><div className="account-stats"><span><Heart size={20}/>{favoriteCount} favoris</span><span><ListVideo size={20}/>{listCount} listes</span></div>{error&&<p role="alert" className="form-error">{error}</p>}<button className="secondary full-width" disabled={busy} onClick={()=>void logout()}><LogOut size={18}/>{busy?'Déconnexion…':'Se déconnecter'}</button></div></dialog>;
}
