import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(fs.readFileSync(path,'utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022})).toString('base64'));
const {CastManager,castMediaRequest,selectCastSource}=await load('lib/casting.ts');
const {prefersNativeHls,showNativeRemote,canUseNativeRemote}=await load('lib/native-casting.ts');
function environment(){
 let session=null,selectionError=null,loadError=null,loadedRequest,requestCount=0,stopFlag;
 const events=new Map();const emit=()=>events.forEach(f=>f());
 const remote={isConnected:false,isMediaLoaded:false,isPaused:false,volumeLevel:.5,mediaInfo:undefined};
 const selected={getCastDevice:()=>({friendlyName:'Télé du salon'}),getMediaSession:()=>remote.mediaInfo?{media:remote.mediaInfo}:null,loadMedia:async request=>{if(loadError)throw loadError;loadedRequest=request;remote.mediaInfo=request.media;remote.isMediaLoaded=true;emit();}};
 const context={setOptions(o){assert.equal(o.receiverApplicationId,'default');},getCastState:()=>session?'CONNECTED':'NOT_CONNECTED',getCurrentSession:()=>session,async requestSession(){requestCount++;if(selectionError)throw selectionError;session=selected;remote.isConnected=true;emit();},endCurrentSession(flag){stopFlag=flag;session=null;remote.isConnected=false;remote.isMediaLoaded=false;remote.mediaInfo=undefined;emit();},addEventListener:(k,f)=>events.set(k,f)};
 const controller={addEventListener:(k,f)=>events.set(k,f),playOrPause(){remote.isPaused=!remote.isPaused;emit();},setVolumeLevel(){emit();}};
 const sdk={framework:{CastContext:{getInstance:()=>context},CastContextEventType:{CAST_STATE_CHANGED:'state',SESSION_STATE_CHANGED:'session'},RemotePlayer:function(){return remote;},RemotePlayerController:function(){return controller;},RemotePlayerEventType:{ANY_CHANGE:'remote'}},base:{AutoJoinPolicy:{ORIGIN_SCOPED:'origin'},media:{DEFAULT_MEDIA_RECEIVER_APP_ID:'default',StreamType:{LIVE:'LIVE'},MediaInfo:function(contentId,contentType){Object.assign(this,{contentId,contentType});},GenericMediaMetadata:function(){},LoadRequest:function(media){this.media=media;}}}};
 return {sdk,remote,context,emit,get request(){return loadedRequest;},get requestCount(){return requestCount;},get stopFlag(){return stopFlag;},cancel(){selectionError='cancel';},failLoad(){loadError='LOAD_FAILED';}};
}
const source={kind:'hls',url:'https://media.example.org/live/playlist.m3u8'},channel={id:'cpac-en',name:'CPAC English',region:'Canada'};
test('a local iframe fallback retains the channel HLS source for the TV',async()=>{
 const embed={kind:'embed',url:'https://www.youtube.com/embed/abcdefghijk'};
 const candidates=[source,embed],selected=selectCastSource(candidates,embed);
 assert.equal(selected,source);
 const e=environment(),m=new CastManager(async()=>e.sdk);await m.initialize();
 assert.equal(await m.cast(selected,channel),true);assert.equal(e.request.media.contentId,source.url);
 assert.equal(selectCastSource(candidates,source),source);
 const alternate={...source,url:'https://media.example.org/alternate.m3u8'};
 assert.equal(selectCastSource([...candidates,alternate],alternate),alternate);
});
test('embed-only channels and stale or unsafe sources never masquerade as castable video',()=>{
 const embed={kind:'embed',url:'https://www.youtube.com/embed/abcdefghijk'};
 assert.equal(selectCastSource([embed],source),undefined);
 assert.equal(selectCastSource([],source),undefined);
 const invalid=[{kind:'hls',url:'not-a-url'},{kind:'hls',url:'blob:https://onde.example/123'},{kind:'hls',url:'http://example.org/a.m3u8'},{kind:'hls',url:'https://name:secret@example.org/a.m3u8'}];
 for(const s of invalid)assert.equal(selectCastSource([embed,s],s),undefined);
 assert.equal(selectCastSource([...invalid,source]),source);
});
test('send the original HTTPS live URL and public metadata, never an embedded page or blob',()=>{
 const e=environment(),r=castMediaRequest(e.sdk,source,channel);assert.equal(r.media.contentId,source.url);assert.equal(r.media.streamType,'LIVE');assert.equal(r.autoplay,true);assert.equal(r.media.metadata.title,'CPAC English');assert.deepEqual(r.media.customData,{ondeChannelId:'cpac-en'});
 for(const s of [{kind:'embed',url:'https://youtube.com/embed/abcdefghijk'},{kind:'hls',url:'blob:https://onde.example/123'},{kind:'hls',url:'http://media.example/a.m3u8'},{kind:'hls',url:'https://secret:password@example.org/a.m3u8'}])assert.throws(()=>castMediaRequest(e.sdk,s,channel));
});
test('cancelled device chooser does not report a connection or successful load',async()=>{
 const e=environment(),m=new CastManager(async()=>e.sdk);await m.initialize();e.cancel();assert.equal(await m.cast(source,channel),false);assert.equal(m.getSnapshot().connected,false);assert.equal(m.getSnapshot().error,'');assert.equal(m.getSnapshot().busy,false);assert.equal(e.request,undefined);
});
test('real receiver events drive session state, playback controls, channel changes and stop',async()=>{
 const e=environment(),m=new CastManager(async()=>e.sdk);await m.initialize();assert.equal(await m.cast(source,channel),true);assert.equal(m.getSnapshot().deviceName,'Télé du salon');assert.equal(m.getSnapshot().channelId,'cpac-en');assert.equal(m.getSnapshot().mediaLoaded,true);m.togglePause();assert.equal(m.getSnapshot().paused,true);m.setVolume(.25);assert.equal(m.getSnapshot().volume,.25);
 const unsubscribe=m.subscribe(()=>{});unsubscribe(); // Unmounting a player never ends the TV session.
 assert.equal(m.getSnapshot().connected,true);await m.cast(source,{...channel,id:'savoir',name:'Savoir média'});assert.equal(e.requestCount,1);assert.equal(m.getSnapshot().channelId,'savoir');m.stop();assert.equal(e.stopFlag,true);assert.equal(m.getSnapshot().connected,false);
});
test('receiver load failure remains actionable and never claims media is playing',async()=>{
 const e=environment(),m=new CastManager(async()=>e.sdk);await m.initialize();e.failLoad();await assert.rejects(m.cast(source,channel));assert.equal(m.getSnapshot().mediaLoaded,false);assert.equal(m.getSnapshot().busy,false);assert.match(m.getSnapshot().error,/n’a pas pu ouvrir/);
});
test('unavailable SDK is recoverable without a stuck loading state',async()=>{
 const e=environment();let fail=true;const m=new CastManager(async()=>{if(fail)throw Error('SDK inaccessible');return e.sdk;});await m.initialize();assert.equal(m.getSnapshot().phase,'unavailable');fail=false;await m.initialize();assert.equal(m.getSnapshot().phase,'ready');
});
test('Safari AirPlay gets native HLS; Chrome keeps MSE; no remote prompt for blob media',async()=>{
 let calls=0;const safari={canPlayType:()=> 'maybe',webkitShowPlaybackTargetPicker(){calls++;},src:'https://media.example/a.m3u8'};assert.equal(prefersNativeHls(safari),true);assert.equal(prefersNativeHls({canPlayType:()=> 'maybe'}),false);await showNativeRemote(safari);assert.equal(calls,1);const blob={currentSrc:'blob:https://onde.example/123',remote:{prompt:async()=>{throw Error('Do not prompt');}}};assert.equal(canUseNativeRemote(blob),false);await assert.rejects(showNativeRemote(blob));
});
