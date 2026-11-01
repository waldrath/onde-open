import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('lib/playback.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const {france24Embed,youtubeLiveWatchURL,defaultSources,startIndex,stallTimeout,failoverStep}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
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
test('an https page starts on the first secure source and keeps http sources as fallbacks',()=>{
 const sources=defaultSources({id:'x',stream:'http://1.2.3.4/live.m3u8',streamAlts:[{url:'http://5.6.7.8/b.m3u8'},{url:'https://alt.example/c.m3u8'}],embed:'https://embed.example/e'});
 assert.equal(startIndex(sources,true),2);
 assert.equal(startIndex(sources,false),0);
 assert.equal(startIndex(defaultSources({id:'x',stream:'http://1.2.3.4/live.m3u8',streamAlts:[{url:'http://5.6.7.8/b.m3u8'}]}),true),0);
 assert.equal(startIndex(defaultSources({id:'x',stream:'https://cdn.example/live.m3u8'}),true),0);
 assert.equal(startIndex([],true),0);
 // From the secure start the ring still reaches the http sources before giving up.
 const visited=[];let index=startIndex(sources,true),step;
 do{visited.push(index);step=failoverStep({retries:1,everPlayed:false,index,count:sources.length,first:2});if(step.action==='next')index=step.index;}while(step.action==='next');
 assert.deepEqual(visited,[2,3,0,1]);
 assert.equal(step.action,'give-up');
});
test('a source that never played gets one quick retry and a short startup window',()=>{
 assert.deepEqual(failoverStep({retries:0,everPlayed:false,index:0,count:3}),{action:'retry',delay:1000});
 assert.deepEqual(failoverStep({retries:1,everPlayed:false,index:0,count:3}),{action:'next',index:1});
 assert.ok(stallTimeout(false)<=12000);
 assert.equal(stallTimeout(true),25000);
});
test('a source that played and dropped keeps the patient backoff before failing over',()=>{
 assert.deepEqual([0,1,2].map(retries=>failoverStep({retries,everPlayed:true,index:1,count:3})),[{action:'retry',delay:1000},{action:'retry',delay:2000},{action:'retry',delay:4000}]);
 assert.deepEqual(failoverStep({retries:3,everPlayed:true,index:1,count:3}),{action:'next',index:2});
});
test('failover gives up once every source of the round has been tried',()=>{
 assert.deepEqual(failoverStep({retries:1,everPlayed:false,index:2,count:3}),{action:'give-up'});
 assert.deepEqual(failoverStep({retries:3,everPlayed:true,index:0,count:1}),{action:'give-up'});
 assert.deepEqual(failoverStep({retries:1,everPlayed:false,index:0,count:0}),{action:'give-up'});
 // A round started by a manual pick in the middle wraps around to the start of the list.
 assert.deepEqual(failoverStep({retries:1,everPlayed:false,index:2,count:3,first:1}),{action:'next',index:0});
 assert.deepEqual(failoverStep({retries:1,everPlayed:false,index:0,count:3,first:1}),{action:'give-up'});
 // A stale origin outside the list never loops forever.
 assert.deepEqual(failoverStep({retries:1,everPlayed:false,index:2,count:3,first:7}),{action:'give-up'});
});
