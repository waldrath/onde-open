'use client';
import {useCallback,useEffect,useState} from 'react';
import type {Theme} from '../lib/themes';
import {gifProblem,isWallpaperStrength,keepsAnimation,wallpaperProblem,wallpaperSize,type WallpaperStrength} from '../lib/wallpaper';
// Personal backgrounds (lib/wallpaper.ts), one per skin, kept in IndexedDB:
// an image is too large for localStorage, and nothing here is ever uploaded.
// An animated GIF is stored as chosen, with a still first frame for reduced motion.
type Stored={image:Blob;still?:Blob;strength:WallpaperStrength};
const DB='onde-device',STORE='wallpapers',CHANGED='onde-wallpaper-changed';
function database():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{request.result.createObjectStore(STORE);};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function run<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();
 try{return await new Promise<T>((resolve,reject)=>{const request=work(db.transaction(STORE,mode).objectStore(STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
 finally{db.close();}
}
const read=(theme:Theme)=>run<Stored|undefined>('readonly',store=>store.get(theme) as IDBRequest<Stored|undefined>);
const announce=()=>window.dispatchEvent(new Event(CHANGED));
// Drawn again at most WALLPAPER_MAX_SIDE wide: a 12-megapixel photo would
// otherwise be decoded and composited at full size behind every page.
async function shrink(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);
 try{
  const size=wallpaperSize(bitmap.width,bitmap.height),canvas=document.createElement('canvas');
  canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas indisponible');
  context.drawImage(bitmap,0,0,size.width,size.height);
  const encoded=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.86));
  if(!encoded)throw new Error('Encodage impossible');
  return encoded;
 }finally{bitmap.close();}
}
export function useWallpaper(theme:Theme){
 const [url,setUrl]=useState<string|null>(null),[stillUrl,setStillUrl]=useState<string|null>(null),[strength,setStrength]=useState<WallpaperStrength>('soft');
 useEffect(()=>{
  let current:string[]=[],cancelled=false;
  const release=()=>{for(const item of current)URL.revokeObjectURL(item);current=[];};
  const load=()=>{void read(theme).then(stored=>{
   if(cancelled)return;
   release();
   const image=stored?.image instanceof Blob?URL.createObjectURL(stored.image):null,still=stored?.still instanceof Blob?URL.createObjectURL(stored.still):null;
   current=[image,still].filter((item):item is string=>!!item);
   setUrl(image);setStillUrl(still);setStrength(isWallpaperStrength(stored?.strength)?stored.strength:'soft');
  }).catch(error=>{console.warn(JSON.stringify({event:'wallpaper_read_failed',theme,error:String(error)}));if(!cancelled)setUrl(null);});};
  load();window.addEventListener(CHANGED,load);
  return()=>{cancelled=true;window.removeEventListener(CHANGED,load);release();};
 },[theme]);
 /** Returns a French problem to show, or null once the image is saved. */
 const choose=useCallback(async(file:File):Promise<string|null>=>{
  const problem=wallpaperProblem(file);if(problem)return problem;
  try{
   if(keepsAnimation(file.type)){const bitmap=await createImageBitmap(file);const tooLarge=gifProblem(bitmap.width,bitmap.height);bitmap.close();if(tooLarge)return tooLarge;}
   const record:Stored=keepsAnimation(file.type)?{image:file,still:await shrink(file),strength}:{image:await shrink(file),strength};
   await run('readwrite',store=>store.put(record,theme));announce();return null;
  }
  catch(error){console.warn(JSON.stringify({event:'wallpaper_save_failed',theme,error:String(error)}));return 'Cette image n’a pas pu être lue. Essayez-en une autre.';}
 },[theme,strength]);
 const remove=useCallback(async()=>{await run('readwrite',store=>store.delete(theme));announce();},[theme]);
 const setLevel=useCallback(async(next:WallpaperStrength)=>{
  const stored=await read(theme);if(!stored)return;
  await run('readwrite',store=>store.put({...stored,strength:next} satisfies Stored,theme));announce();
 },[theme]);
 return {url,stillUrl,strength,choose,remove,setLevel};
}
