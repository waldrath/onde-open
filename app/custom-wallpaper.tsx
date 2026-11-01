'use client';
import type {CSSProperties} from 'react';
import type {WallpaperStrength} from '../lib/wallpaper';
// The viewer's own background for this skin (see app/use-wallpaper.ts). It
// replaces the skin's animated backdrop, which it would hide anyway. The image
// and the veil that keeps text readable are separate compositor layers, so an
// animated GIF repaints only its own pixels, never the veil or the page; when
// motion is reduced the GIF shows its still first frame (CSS).
export default function CustomWallpaper({url,stillUrl,strength,resting=false}:{url:string;stillUrl:string|null;strength:WallpaperStrength;resting?:boolean}){
 return <div className={`custom-wallpaper is-${strength}${resting?' is-resting':''}`} aria-hidden="true">
  <div className="custom-wallpaper-image" style={{'--wallpaper':`url("${url}")`,'--wallpaper-still':`url("${stillUrl||url}")`} as CSSProperties}/>
  <div className="custom-wallpaper-veil"/>
 </div>;
}
