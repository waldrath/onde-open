'use client';
import {useRef,useState} from 'react';
import {ImagePlus,Trash2} from 'lucide-react';
import {themes,type Theme} from '../lib/themes';
import {WALLPAPER_TYPES,type WallpaperStrength} from '../lib/wallpaper';
import {useLocale} from './locale-provider';
import {useWallpaper} from './use-wallpaper';
// Réglages › Apparence: a background image of the viewer's own for the current skin.
export default function WallpaperSettings({theme}:{theme:Theme}){
 const {t}=useLocale();
 const {url,stillUrl,strength,choose,remove,setLevel}=useWallpaper(theme);
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[problem,setProblem]=useState('');
 const label=themes.find(entry=>entry.id===theme)?.label||theme;
 const pick=async(file:File|undefined)=>{if(!file)return;setBusy(true);setProblem('');const result=await choose(file);setBusy(false);if(result)setProblem(t(result));if(input.current)input.current.value='';};
 return <div className="wallpaper-settings">
  <span className="settings-label" id="settings-wallpaper">{t('Image de fond pour « {name} »',{name:t(label)})}</span>
  <div className="wallpaper-row">
   <span className="wallpaper-preview" style={url?{backgroundImage:`url("${stillUrl||url}")`}:undefined} aria-hidden="true">{!url&&<ImagePlus size={20}/>}</span>
   <div className="wallpaper-actions">
    <input ref={input} type="file" accept={WALLPAPER_TYPES.join(',')} hidden onChange={e=>void pick(e.target.files?.[0])}/>
    <button type="button" className="secondary" disabled={busy} onClick={()=>input.current?.click()}><ImagePlus size={16}/>{t(busy?'Préparation…':url?'Changer l’image':'Choisir une image')}</button>
    {url&&<button type="button" className="secondary" onClick={()=>void remove()}><Trash2 size={16}/>{t('Retirer')}</button>}
   </div>
  </div>
  {url&&<div className="region-tabs settings-choice" role="group" aria-labelledby="settings-wallpaper">{([['soft','Discrète'],['vivid','Bien visible']] as [WallpaperStrength,string][]).map(([id,name])=><button key={id} type="button" aria-pressed={strength===id} className={strength===id?'active':''} onClick={()=>void setLevel(id)}>{t(name)}</button>)}</div>}
  {problem&&<p className="form-error" role="alert">{problem}</p>}
  <small className="settings-hint">{t('Une image de votre appareil (un GIF reste animé), pour ce thème seulement. Elle reste sur cet appareil : Onde ne l’envoie nulle part.')}</small>
 </div>;
}
