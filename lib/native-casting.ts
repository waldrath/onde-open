export type NativeRemotePlayback={state:string;prompt:()=>Promise<void>;addEventListener:(type:string,listener:()=>void)=>void;removeEventListener:(type:string,listener:()=>void)=>void};
export type WirelessVideo=HTMLVideoElement&{webkitShowPlaybackTargetPicker?:()=>void;webkitCurrentPlaybackTargetIsWireless?:boolean;remote?:NativeRemotePlayback};
// Safari uses a real HLS URL for AirPlay; other MSE-capable browsers retain hls.js.
export function prefersNativeHls(video:HTMLVideoElement){return typeof (video as WirelessVideo).webkitShowPlaybackTargetPicker==='function'&&!!video.canPlayType('application/vnd.apple.mpegurl');}
export function canUseNativeRemote(video:WirelessVideo){return typeof video.webkitShowPlaybackTargetPicker==='function'||!!video.remote&&/^https:/i.test(video.currentSrc||video.src);}
export function showNativeRemote(video:WirelessVideo){
 if(video.webkitShowPlaybackTargetPicker){video.webkitShowPlaybackTargetPicker();return Promise.resolve();}
 if(video.remote&&/^https:/i.test(video.currentSrc||video.src))return video.remote.prompt();
 return Promise.reject(new Error('La diffusion vidéo native n’est pas disponible dans ce navigateur.'));
}
