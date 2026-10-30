// Google Cast is optional and client-only. The TV loads the public media URL,
// never this private application's page or its sign-in credentials.
export type CastMedia = {
 contentId:string; contentType:string; streamType:string;
 metadata?:{title?:string;subtitle?:string}; customData?:{ondeChannelId?:string};
};
type MediaSession={media?:CastMedia};
export type CastSession={
 getCastDevice:()=>{friendlyName:string};loadMedia:(request:{media:CastMedia;autoplay?:boolean})=>Promise<unknown>;
 getMediaSession:()=>MediaSession|null;
};
type Context={setOptions:(options:{receiverApplicationId:string;autoJoinPolicy:string})=>void;getCastState:()=>string;getCurrentSession:()=>CastSession|null;requestSession:()=>Promise<unknown>;endCurrentSession:(stopCasting:boolean)=>void;addEventListener:(event:string,listener:()=>void)=>void};
type RemotePlayer={isConnected:boolean;isMediaLoaded:boolean;isPaused:boolean;volumeLevel:number;mediaInfo?:CastMedia};
type RemoteController={addEventListener:(event:string,listener:()=>void)=>void;playOrPause:()=>void;setVolumeLevel:()=>void};
export type CastSDK={
 framework:{CastContext:{getInstance:()=>Context};CastContextEventType:{CAST_STATE_CHANGED:string;SESSION_STATE_CHANGED:string};RemotePlayer:new()=>RemotePlayer;RemotePlayerController:new(player:RemotePlayer)=>RemoteController;RemotePlayerEventType:{ANY_CHANGE:string}};
 base:{AutoJoinPolicy:{ORIGIN_SCOPED:string};media:{DEFAULT_MEDIA_RECEIVER_APP_ID:string;StreamType:{LIVE:string};MediaInfo:new(url:string,mime:string)=>CastMedia;GenericMediaMetadata:new()=>{title?:string;subtitle?:string};LoadRequest:new(media:CastMedia)=>{media:CastMedia;autoplay?:boolean}}};
};
type CastGlobal=Window&{cast?:{framework:CastSDK['framework']};chrome?:{cast:CastSDK['base']};__onGCastApiAvailable?:(available:boolean)=>void};
let sdkPromise:Promise<CastSDK>|undefined;
function currentSDK(scope:CastGlobal):CastSDK|undefined{return scope.cast?.framework&&scope.chrome?.cast?{framework:scope.cast.framework,base:scope.chrome.cast}:undefined;}
export function loadCastSDK():Promise<CastSDK>{
 if(typeof window==='undefined')return Promise.reject(new Error('Google Cast nécessite un navigateur.'));
 const scope=window as CastGlobal,existing=currentSDK(scope);if(existing)return Promise.resolve(existing);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise<CastSDK>((resolve,reject)=>{
  if(!window.isSecureContext){reject(new Error('Ouvrez Onde à son adresse HTTPS pour utiliser Google Cast.'));return;}
  let settled=false;
  const previous=scope.__onGCastApiAvailable;
  const finish=(sdk?:CastSDK)=>{if(settled)return;settled=true;clearTimeout(timeout);if(scope.__onGCastApiAvailable===available)scope.__onGCastApiAvailable=previous;if(sdk)resolve(sdk);else reject(new Error('Google Cast est indisponible dans ce navigateur. Essayez Chrome sur Android ou ordinateur.'));};
  const available=(ok:boolean)=>{try{previous?.(ok);}finally{finish(ok?currentSDK(scope):undefined);}};
  const timeout=setTimeout(()=>finish(),15000);
  scope.__onGCastApiAvailable=available;
  document.getElementById('onde-google-cast-sdk')?.remove();
  const script=document.createElement('script');script.id='onde-google-cast-sdk';script.async=true;
  script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  script.onerror=()=>finish();document.head.appendChild(script);
 }).catch(error=>{sdkPromise=undefined;throw error;});
 return sdkPromise;
}
export type CastSnapshot={phase:'idle'|'loading'|'ready'|'unavailable';available:boolean;connected:boolean;busy:boolean;deviceName:string;channelId:string;mediaName:string;mediaLoaded:boolean;paused:boolean;volume:number;error:string};
export const initialCastSnapshot:CastSnapshot={phase:'idle',available:false,connected:false,busy:false,deviceName:'',channelId:'',mediaName:'',mediaLoaded:false,paused:false,volume:1,error:''};
function cancelled(error:unknown){const code=typeof error==='string'?error:(error as {code?:unknown;name?:unknown})?.code||(error as {name?:unknown})?.name;return /cancel|abort/i.test(String(code));}
type MediaSource={kind:string;url:string};
function isCastSource(source:MediaSource|undefined):source is MediaSource{
 if(source?.kind!=='hls')return false;
 try{const url=new URL(source.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
// A browser may fall back to an iframe while the receiver can still load HLS.
// Choose from this channel's resolved sources independently of its local player.
export function selectCastSource<T extends MediaSource>(sources:readonly T[],current?:T):T|undefined{
 if(current&&isCastSource(current)&&sources.some(s=>s.kind===current.kind&&s.url===current.url))return current;
 return sources.find(isCastSource);
}
export function castMediaRequest(sdk:CastSDK,source:{kind:string;url:string},channel:{id:string;name:string;region:string}){
 if(!isCastSource(source))throw new Error('Cette chaîne ne fournit pas de flux compatible avec Google Cast.');
 const url=new URL(source.url);
 const media=new sdk.base.media.MediaInfo(url.toString(),'application/x-mpegURL');
 media.streamType=sdk.base.media.StreamType.LIVE;
 const metadata=new sdk.base.media.GenericMediaMetadata();metadata.title=channel.name;metadata.subtitle='Onde · '+channel.region;media.metadata=metadata;media.customData={ondeChannelId:channel.id};
 const request=new sdk.base.media.LoadRequest(media);request.autoplay=true;return request;
}
export class CastManager{
 private state:CastSnapshot=initialCastSnapshot;
 private listeners=new Set<()=>void>();private sdk?:CastSDK;private context?:Context;private remote?:RemotePlayer;private controller?:RemoteController;private initialization?:Promise<void>;
 constructor(private loader:()=>Promise<CastSDK>=loadCastSDK){}
 getSnapshot=()=>this.state;
 getServerSnapshot=()=>initialCastSnapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish=(patch:Partial<CastSnapshot>)=>{const next={...this.state,...patch};if(JSON.stringify(next)===JSON.stringify(this.state))return;this.state=next;this.listeners.forEach(f=>f());};
 private refresh=()=>{
  const session=this.context?.getCurrentSession();const info=session?.getMediaSession()?.media||this.remote?.mediaInfo;
  this.publish({available:this.context?.getCastState()!=='NO_DEVICES_AVAILABLE',connected:!!session,deviceName:session?.getCastDevice().friendlyName||'',channelId:session?info?.customData?.ondeChannelId||'':'',mediaName:session?info?.metadata?.title||'':'',mediaLoaded:!!session&&!!this.remote?.isMediaLoaded,paused:!!this.remote?.isPaused,volume:this.remote?.volumeLevel??1});
 };
 initialize=()=>{
  if(this.sdk)return Promise.resolve();if(this.initialization)return this.initialization;
  this.publish({phase:'loading',error:''});
  this.initialization=this.loader().then(sdk=>{
   const context=sdk.framework.CastContext.getInstance();
   context.setOptions({receiverApplicationId:sdk.base.media.DEFAULT_MEDIA_RECEIVER_APP_ID,autoJoinPolicy:sdk.base.AutoJoinPolicy.ORIGIN_SCOPED});
   const remote=new sdk.framework.RemotePlayer(),controller=new sdk.framework.RemotePlayerController(remote);
   this.sdk=sdk;this.context=context;this.remote=remote;this.controller=controller;
   context.addEventListener(sdk.framework.CastContextEventType.CAST_STATE_CHANGED,this.refresh);
   context.addEventListener(sdk.framework.CastContextEventType.SESSION_STATE_CHANGED,this.refresh);
   controller.addEventListener(sdk.framework.RemotePlayerEventType.ANY_CHANGE,this.refresh);
   this.publish({phase:'ready'});this.refresh();
  }).catch(error=>{this.publish({phase:'unavailable',error:error instanceof Error?error.message:'Google Cast est indisponible.'});}).finally(()=>{this.initialization=undefined;});
  return this.initialization;
 };
 cast=async(source:{kind:string;url:string},channel:{id:string;name:string;region:string})=>{
  if(!this.sdk||!this.context)throw new Error('Google Cast n’est pas encore prêt.');
  if(this.state.busy)return false;
  // Validate before opening a device chooser. Embedded webpages are never sent as video.
  const request=castMediaRequest(this.sdk,source,channel);
  this.publish({busy:true,error:''});
  try{
   if(!this.context.getCurrentSession())await this.context.requestSession();
   const session=this.context.getCurrentSession();if(!session)throw new Error('Aucune télé sélectionnée.');
   await session.loadMedia(request);
   if(this.context.getCurrentSession()!==session)throw new Error('La connexion à la télé a été interrompue.');
   this.refresh();return true;
  }catch(error){if(cancelled(error)){this.refresh();return false;}this.publish({error:'La télé n’a pas pu ouvrir ce direct. Vérifiez le réseau Wi-Fi et essayez une autre chaîne; le diffuseur peut limiter la lecture sur télé.'});throw error;}
  finally{this.publish({busy:false});}
 };
 togglePause=()=>{if(this.state.mediaLoaded)this.controller?.playOrPause();};
 setVolume=(volume:number)=>{if(!this.remote||!this.state.connected||!Number.isFinite(volume))return;this.remote.volumeLevel=Math.min(1,Math.max(0,volume));this.controller?.setVolumeLevel();this.publish({volume:this.remote.volumeLevel});};
 stop=()=>{this.context?.endCurrentSession(true);this.publish({connected:false,busy:false,deviceName:'',channelId:'',mediaName:'',mediaLoaded:false,error:''});};
}
// One session survives player remounts and navigation inside Onde.
export const castManager=new CastManager();
