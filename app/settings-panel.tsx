'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {X,UserRound,LogOut,Heart,ListVideo,Palette,MonitorPlay,HardDrive,Check,PanelRight,PanelLeft,PanelTop} from 'lucide-react';
import {clearPreferenceCache} from '../lib/preference-cache';
import {makeId} from '../lib/identifiers';
import {themes,type Theme} from '../lib/themes';
import type {DeviceSettings,DockPosition} from '../lib/settings';
import {useLocale} from './locale-provider';
import WallpaperSettings from './wallpaper-settings';
const docks:{id:DockPosition;label:string;icon:typeof PanelRight}[]=[{id:'right',label:'À droite',icon:PanelRight},{id:'left',label:'À gauche',icon:PanelLeft},{id:'top',label:'En haut',icon:PanelTop}];
// Réglages: the account (or how to create one) and how Onde behaves on this
// device. It replaces the old account panel and the top-bar language and skin menus.
export default function SettingsPanel({onClose,userId,account,favoriteCount,listCount,recentCount,onClearRecent,onNewIdeas,theme,onTheme,settings,onSettings}:{onClose:()=>void;userId:string|null;account:{name:string|null;email:string}|null;favoriteCount:number;listCount:number;recentCount:number;onClearRecent:()=>void;onNewIdeas:()=>void;theme:Theme;onTheme:(theme:Theme)=>void;settings:DeviceSettings;onSettings:(patch:Partial<DeviceSettings>)=>void}){
 const {t,locale,setLocale}=useLocale();
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 const dismiss=()=>dialog.current?.close();
 useEffect(()=>{if(!done)return;const id=setTimeout(()=>setDone(''),2600);return()=>clearTimeout(id);},[done]);
 async function logout(){setBusy(true);setError('');try{const r=await fetch('/api/session/logout',{method:'POST'});if(!r.ok)throw new Error();try{clearPreferenceCache(localStorage,userId);localStorage.setItem('onde-auth-event',String(Date.now())+':'+makeId());}catch{}window.dispatchEvent(new Event('onde-sign-out'));window.location.assign('/');}catch{setBusy(false);setError(t('La déconnexion a échoué. Réessayez.'));}}
 const signedIn=!!userId;
 return <dialog ref={dialog} className="modal settings-panel" aria-labelledby="settings-title" onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)dismiss();}}><div className="modal-body">
  <button className="modal-close icon-button" onClick={dismiss} aria-label={t('Fermer les réglages')}><X size={22}/></button>
  <span className="eyebrow">{t('VOTRE ONDE')}</span>
  <h2 id="settings-title">{t('Réglages')}</h2>
  <p>{t('Votre compte, et la façon dont Onde s’affiche sur cet appareil.')}</p>

  <section className="settings-section" aria-labelledby="settings-account"><h3 id="settings-account"><UserRound size={17}/>{t('Compte')}</h3>
   {signedIn?<>
    <div className="settings-account"><span className="settings-initial" aria-hidden="true">{(account?.name||'O').trim().charAt(0).toUpperCase()}</span><span><strong>{account?.name||t('Mon compte Onde')}</strong>{account?.email&&<small>{account.email}</small>}</span></div>
    <p>{t('Vos favoris et vos listes sont synchronisés sur tous vos écrans.')}</p>
    <div className="account-stats"><span><Heart size={18}/>{t('{count} favoris',{count:favoriteCount})}</span><span><ListVideo size={18}/>{t('{count} listes',{count:listCount})}</span></div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <button className="secondary full-width" disabled={busy} onClick={()=>void logout()}><LogOut size={17}/>{t(busy?'Déconnexion…':'Se déconnecter')}</button>
   </>:<>
    <p>{t('Sans compte, vos favoris et vos listes restent sur cet appareil. Un compte gratuit les retrouve sur tous vos écrans.')}</p>
    <div className="settings-actions"><a className="primary" href="/sign-in?mode=sign-up">{t('Créer un compte')}</a><a className="secondary" href="/sign-in">{t('Se connecter')}</a></div>
   </>}
  </section>

  <section className="settings-section" aria-labelledby="settings-look"><h3 id="settings-look"><Palette size={17}/>{t('Apparence')}</h3>
   <span className="settings-label" id="settings-theme">{t('Thème')}</span>
   <div className="settings-skins" role="group" aria-labelledby="settings-theme">{themes.map((entry,index)=><button key={entry.id} type="button" aria-pressed={theme===entry.id} data-theme-id={entry.id} className={'theme-option'+(theme===entry.id?' theme-option-active':'')} style={{'--swatch':entry.swatch,'--accent':entry.accent,'--i':index} as CSSProperties} onClick={()=>onTheme(entry.id)}><span className="theme-preview" aria-hidden="true"><i/><i/></span><span className="theme-option-label">{t(entry.label)}</span>{theme===entry.id&&<Check size={15} className="theme-option-check"/>}</button>)}</div>
   <WallpaperSettings theme={theme}/>
   <span className="settings-label" id="settings-language">{t('Langue')}</span>
   {/* The language names stay in their own language. */}
   <div className="region-tabs settings-choice" role="group" aria-labelledby="settings-language">{([['fr','Français'],['en','English']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={locale===id} className={locale===id?'active':''} onClick={()=>setLocale(id)}>{label}</button>)}</div>
   <span className="settings-label" id="settings-motion">{t('Animations')}</span>
   <div className="region-tabs settings-choice" role="group" aria-labelledby="settings-motion">{([['system','Selon l’appareil'],['reduced','Réduites']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={settings.motion===id} className={settings.motion===id?'active':''} onClick={()=>onSettings({motion:id})}>{t(label)}</button>)}</div>
  </section>

  <section className="settings-section" aria-labelledby="settings-player"><h3 id="settings-player"><MonitorPlay size={17}/>{t('Lecteur')}</h3>
   <span className="settings-label" id="settings-dock">{t('Mini-lecteur')}</span>
   <div className="region-tabs settings-choice" role="group" aria-labelledby="settings-dock">{docks.map(dock=><button key={dock.id} type="button" aria-pressed={settings.dock===dock.id} className={settings.dock===dock.id?'active':''} onClick={()=>onSettings({dock:dock.id})}><dock.icon size={16} aria-hidden="true"/>{t(dock.label)}</button>)}</div>
   <small className="settings-hint">{t('Le mini-lecteur garde la chaîne à l’écran quand vous quittez l’accueil. Une chaîne choisie pendant qu’il est ouvert s’y lance directement.')}</small>
   <label className="playback-filter settings-toggle"><input type="checkbox" checked={settings.schedule} onChange={e=>onSettings({schedule:e.target.checked})}/>{t('Afficher l’horaire sous le lecteur')}</label>
   <label className="playback-filter settings-toggle"><input type="checkbox" checked={settings.audioOnly} onChange={e=>onSettings({audioOnly:e.target.checked})}/>{t('Mode audio seul')}</label>
   <small className="settings-hint">{t('Le son sans l’image : la qualité vidéo la plus basse est chargée et rien n’est affiché, pour économiser les données et la batterie.')}</small>
  </section>

  <section className="settings-section" aria-labelledby="settings-device"><h3 id="settings-device"><HardDrive size={17}/>{t('Sur cet appareil')}</h3>
   <div className="settings-row"><span><strong>{t('Chaînes récentes')}</strong><small>{t(recentCount===1?'{count} chaîne dans « Reprendre »':'{count} chaînes dans « Reprendre »',{count:recentCount})}</small></span><button type="button" className="secondary" disabled={!recentCount} onClick={()=>{onClearRecent();setDone(t('Historique effacé'));}}>{t('Effacer')}</button></div>
   <div className="settings-row"><span><strong>{t('Chaînes à découvrir')}</strong><small>{t('Repartir de zéro dans les suggestions de l’accueil.')}</small></span><button type="button" className="secondary" onClick={()=>{onNewIdeas();setDone(t('Nouvelles suggestions prêtes'));}}>{t('Renouveler')}</button></div>
   {done&&<p className="settings-done" role="status"><Check size={15}/>{done}</p>}
  </section>
  <button className="primary full-width" onClick={dismiss}>{t('Terminé')}<Check size={16}/></button>
 </div></dialog>;
}
