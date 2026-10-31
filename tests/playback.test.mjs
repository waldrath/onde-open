import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('lib/playback.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const {france24Embed,youtubeLiveWatchURL,defaultSources}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const html=data=>'var ytInitialPlayerResponse = '+JSON.stringify(data)+';';
const id='MML7T6yqC4U';
const live={playabilityStatus:{status:'OK',playableInEmbed:true,liveStreamability:{liveStreamabilityRenderer:{videoId:id}}},videoDetails:{videoId:id,isLive:true},microformat:{microformatDataRenderer:{}}};
test('a new-format channel page yields a fixed YouTube watch URL for independent live confirmation',()=>{
 assert.equal(youtubeLiveWatchURL(html(live)),'https://www.youtube.com/watch?v='+id);
 assert.throws(()=>france24Embed(html(live)));
 const confirmed={...live,microformat:{playerMicroformatRenderer:{liveBroadcastDetails:{isLiveNow:true}}}};
 assert.equal(france24Embed(html(confirmed)).url,'https://www.youtube.com/embed/'+id);
});
test('replays, upcoming videos, restricted embeds and mismatched IDs cannot request confirmation',()=>{
 for(const data of [
  {...live,videoDetails:{videoId:id,isLive:false,isLiveContent:true}},
  {...live,videoDetails:{videoId:id,isLive:true,isUpcoming:true}},
  {...live,playabilityStatus:{...live.playabilityStatus,playableInEmbed:false}},
  {...live,playabilityStatus:{status:'LOGIN_REQUIRED'}},
  {...live,videoDetails:{videoId:'https://other.invalid',isLive:true}},
  {...live,videoDetails:{videoId:'abcdefghijk',isLive:true}},
 ])assert.throws(()=>youtubeLiveWatchURL(html(data)));
 const replay={...live,microformat:{playerMicroformatRenderer:{liveBroadcastDetails:{isLiveNow:false}}}};
 assert.throws(()=>france24Embed(html(replay)));
});
test('variant streams follow the primary and carry an insecure marker when http',()=>{
 const channel={id:'x',stream:'https://cdn.example/live.m3u8',streamAlts:[{url:'http://1.2.3.4/a.m3u8',label:'SD'},{url:'https://alt.example/b.m3u8'}]};
 const sources=defaultSources(channel);
 assert.deepEqual(sources.map(source=>source.url),['https://cdn.example/live.m3u8','http://1.2.3.4/a.m3u8','https://alt.example/b.m3u8']);
 assert.deepEqual(sources.map(source=>source.label),['Lecteur Onde','Lecteur Onde · SD','Lecteur Onde · secours 2']);
 assert.equal(sources[0].insecure,undefined);
 assert.equal(sources[1].insecure,true);
 assert.equal(sources[2].insecure,undefined);
 assert.deepEqual(defaultSources({id:'x',embed:'https://embed.example/e'}),[{kind:'embed',url:'https://embed.example/e',label:'Lecteur du diffuseur'}]);
});
