import type { Channel } from './channels';
export type PlaybackSource={kind:'hls'|'embed';url:string;label:string};
export type PlaybackResult={sources:PlaybackSource[];message?:string;expiresAt?:number};
export function hasPlayback(channel:Channel){return !!(channel.stream||channel.embed||channel.resolve);}
export function defaultSources(channel:Channel):PlaybackSource[]{
 const sources:PlaybackSource[]=[];
 if(channel.stream)sources.push({kind:'hls',url:channel.stream,label:'Lecteur Onde'});
 if(channel.embed)sources.push({kind:'embed',url:channel.embed,label:'Lecteur du diffuseur'});
 return sources;
}
function allowed(raw:string,hosts:string[]){const url=new URL(raw);if(url.protocol!=='https:'||!hosts.includes(url.hostname)||url.username||url.password)throw new Error('Source non prise en charge');return url.toString();}
export function telequebecSource(html:string):PlaybackSource{
 const start=html.indexOf('streamController.enqueue(');if(start<0)throw new Error('Lecteur introuvable');
 // The public route serializes its player configuration as a JSON string.
 const match=html.slice(start).match(/^streamController\.enqueue\(("(?:[^"\\]|\\.)*")/);
 if(!match)throw new Error('Configuration introuvable');
 const values:unknown[]=JSON.parse(JSON.parse(match[1]));
 const field=(name:string)=>{const key=values.indexOf(name);if(key<0)return null;for(const obj of values){if(obj&&typeof obj==='object'&&!Array.isArray(obj)){const index=(obj as Record<string,unknown>)['_'+key];if(typeof index==='number'&&index>=0)return values[index];}}return null;};
 const account=field('brightcoveAccountId'),player=field('brightcovePlayerId'),video=field('brightcoveMediaId');
 if(typeof account!=='string'||!/^\d+$/.test(account)||typeof player!=='string'||!/^\w+$/.test(player)||typeof video!=='string'||!/^\d+$/.test(video))throw new Error('Configuration du lecteur invalide');
 return {kind:'embed',label:'Lecteur officiel Télé-Québec',url:`https://players.brightcove.net/${account}/${player}_default/index.html?videoId=${video}&autoplay=true`};
}
export function cpacSource(payload:unknown):PlaybackSource{
 const list=(payload as {item?:unknown[]})?.item;if(!Array.isArray(list))throw new Error('Grille de diffusion indisponible');
 const item=list.find((x):x is {type:string;videoUrl:string}=>!!x&&typeof x==='object'&&(x as {type?:string}).type==='cpactv'&&typeof (x as {videoUrl?:string}).videoUrl==='string');
 if(!item)throw new Error('La chaîne CPAC ne répond pas');
 return {kind:'hls',url:allowed(item.videoUrl,['cpac-ca-live.cdn.vustreams.com']),label:'CPAC · Direct'};
}

function youtubePlayerData(html:string){
 const marker=/(?:var )?ytInitialPlayerResponse\s*=\s*/.exec(html);
 if(!marker)throw new Error('Configuration du direct indisponible');
 const start=marker.index+marker[0].length;
 let depth=0,inString=false,escaped=false,end=-1;
 for(let i=start;i<html.length;i++){
  const c=html[i];
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}
  if(c==='"'){inString=true;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break;}
 }
 if(end<0)throw new Error('Configuration invalide');
 return JSON.parse(html.slice(start,end));
}
export function france24Embed(html:string,label='France 24'):PlaybackSource{
 const data=youtubePlayerData(html);
 const id=data.videoDetails?.videoId;
 if(data.playabilityStatus?.status!=='OK'||data.playabilityStatus?.playableInEmbed===false||data.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow!==true||typeof id!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('Aucun direct confirmé');
 return {kind:'embed',url:'https://www.youtube.com/embed/'+id,label:label+' · Lecteur officiel YouTube'};
}

// Some official /channel/.../live pages omit liveBroadcastDetails. Confirm their
// current video on its watch page instead of treating a replay as a live feed.
export function youtubeLiveWatchURL(html:string):string{
 const data=youtubePlayerData(html),id=data.videoDetails?.videoId;
 if(!data.microformat?.microformatDataRenderer||data.playabilityStatus?.status!=='OK'||data.playabilityStatus?.playableInEmbed===false||data.videoDetails?.isLive!==true||data.videoDetails?.isUpcoming===true||data.playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.videoId!==id||typeof id!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('Aucun direct à confirmer');
 return 'https://www.youtube.com/watch?v='+id;
}

export function tfoSource(payload:unknown):PlaybackResult{
 const data=payload as {mediaId?:unknown;exp?:unknown;playlist?:{playlist?:{mediaid?:unknown;sources?:{file?:unknown;type?:unknown}[]}[]}};
 if(data?.mediaId!=='o9WzVuTG')throw new Error('Direct TFO introuvable');
 const item=data.playlist?.playlist?.find(p=>p.mediaid==='o9WzVuTG');
 const source=item?.sources?.find(s=>typeof s.type==='string'&&/mpegurl/i.test(s.type)&&typeof s.file==='string');
 if(typeof source?.file!=='string')throw new Error('Le direct TFO ne propose pas de flux compatible');
 const url=new URL(allowed(source.file,['cdn.jwplayer.com']));
 if(url.pathname!=='/live/broadcast/o9WzVuTG.m3u8')throw new Error('Ce flux ne correspond pas au direct TFO');
 const expiresAt=typeof data.exp==='number'?data.exp*1000:undefined;
 if(expiresAt&&expiresAt<=Date.now())throw new Error('Le lien du direct TFO a expiré');
 return {sources:[{kind:'hls',url:url.toString(),label:'TFO · Direct officiel'}],expiresAt};
}

export function publicSenatSource(payload:unknown):PlaybackResult{
 const data=payload as {isLive?:unknown;hideLcpPrograms?:unknown;liveData?:{id?:unknown}};
 if(!data||data.hideLcpPrograms)return {sources:[],message:'Ce programme n’est pas proposé en direct sur Internet par Public Sénat.'};
 if(data.isLive!==true)return {sources:[],message:'Le direct de Public Sénat est hors antenne pour le moment. Réessaie à la prochaine émission.'};
 const id=data.liveData?.id;
 if(typeof id!=='string'||!/^x[A-Za-z0-9]{4,20}$/.test(id))throw new Error('Configuration du direct indisponible');
 return {sources:[{kind:'embed',url:`https://geo.dailymotion.com/player/xev0m.html?video=${id}&autoplay=1`,label:'Public Sénat · Lecteur officiel'}]};
}
