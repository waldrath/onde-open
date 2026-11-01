import test from 'node:test';
import assert from 'node:assert/strict';
import {cardLanguage,freshHomeCheck,inWorldScope,mergeHomeCheck,pickStreams,playabilityTier,reportMarkdown,worldRegion} from '../scripts/import-iptv-org.mjs';

// Pure helpers of the iptv-org importer (importing the script runs nothing).
const hls=()=>true;
const verdicts=map=>url=>map[url]??null;
const candidate=(url,fromPlaylist=true)=>({url,fromPlaylist,label:'SD'});

test('probe verdicts rank everywhere-playable, http-only, geo-blocked, then native-only sources',()=>{
 assert.equal(playabilityTier('https://a.example/x.m3u8',null),0);
 assert.equal(playabilityTier('https://a.example/x.m3u8',{ok:true}),0);
 assert.equal(playabilityTier('http://a.example/x.m3u8',{ok:true}),1);
 assert.equal(playabilityTier('https://a.example/x.m3u8',{ok:false,reason:'geo'}),2);
 assert.equal(playabilityTier('https://a.example/x.m3u8',{ok:false,reason:'no-cors',native:true}),3);
 // Native players still refuse http media on the HTTPS app.
 assert.equal(playabilityTier('http://a.example/x.m3u8',{ok:false,reason:'no-cors',native:true}),null);
 assert.equal(playabilityTier('https://a.example/x.m3u8',{ok:false,reason:'no-cors'}),null);
 assert.equal(playabilityTier('https://a.example/x.m3u8',{ok:false,reason:'gone'}),null);
});

test('native-only sources are dropped when the channel has a source that plays everywhere',()=>{
 const picked=pickStreams([candidate('https://pluto.example/a.m3u8'),candidate('https://ok.example/b.m3u8'),candidate('https://dead.example/c.m3u8')],hls,verdicts({
  'https://pluto.example/a.m3u8':{ok:false,reason:'no-cors',native:true},
  'https://ok.example/b.m3u8':{ok:true},
  'https://dead.example/c.m3u8':{ok:false,reason:'gone'},
 }));
 assert.equal(picked.best.url,'https://ok.example/b.m3u8');
 assert.deepEqual(picked.alternates,[]);
 assert.deepEqual(picked.failures.sort(),['gone','no-cors']);
});

test('a channel whose sources only lack CORS keeps them as a native-only card',()=>{
 const picked=pickStreams([candidate('https://jmp2.example/a.m3u8'),candidate('https://jmp2.example/b.m3u8',false),candidate('https://dead.example/c.m3u8')],hls,verdicts({
  'https://jmp2.example/a.m3u8':{ok:false,reason:'no-cors',native:true},
  'https://jmp2.example/b.m3u8':{ok:false,reason:'no-cors',native:true},
  'https://dead.example/c.m3u8':{ok:false,reason:'timeout'},
 }));
 assert.equal(picked.best.tier,3);
 assert.deepEqual([picked.best.url,...picked.alternates.map(item=>item.url)],['https://jmp2.example/a.m3u8','https://jmp2.example/b.m3u8']);
 assert.deepEqual(picked.failures,['timeout']);
});

test('http sources are upgraded when their https form plays, and nothing playable yields no best stream',()=>{
 const upgraded=pickStreams([candidate('http://cdn.example/live.m3u8')],hls,verdicts({'https://cdn.example/live.m3u8':{ok:true},'http://cdn.example/live.m3u8':{ok:true}}));
 assert.equal(upgraded.best.url,'https://cdn.example/live.m3u8');
 assert.equal(upgraded.upgrades,1);
 const dead=pickStreams([candidate('https://dead.example/x.m3u8')],hls,verdicts({'https://dead.example/x.m3u8':{ok:false,reason:'no-cors'}}));
 assert.equal(dead.best,null);
 assert.equal(pickStreams([candidate('https://a.example/x.mpd')],()=>false,verdicts({})),null);
 // Without the probe every HLS candidate stays, https first.
 const unprobed=pickStreams([candidate('http://1.2.3.4/a.m3u8'),candidate('https://b.example/b.m3u8')],hls,()=>null);
 assert.equal(unprobed.best.url,'https://b.example/b.m3u8');
});

test('card languages follow each country policy',()=>{
 const set=(...items)=>new Set(items);
 assert.equal(cardLanguage('french',set('fr','other'),'fr'),'fr');
 assert.equal(cardLanguage('french',set('en'),'fr'),null);
 assert.equal(cardLanguage('french',set(),'fr'),null);
 assert.equal(cardLanguage('francophone',set('en','other'),'fr'),'en');
 assert.equal(cardLanguage('francophone',set(),'fr'),'fr');
 assert.equal(cardLanguage('francophone',set('other'),'fr'),null);
 assert.equal(cardLanguage('lenient',set('other'),'fr'),'fr');
 assert.equal(cardLanguage('lenient',set('en','fr'),'fr'),'fr');
});

test('the refresh report lists cards added and removed per country',()=>{
 const stats={kept:3,keptNativeOnly:1,excludedUnplayable:2};
 const markdown=reportMarkdown({report:{be:{...stats,added:['rtbf'],removed:[]},ht:{...stats,added:[],removed:['old-tv']}}});
 assert.match(markdown,/\| be \| 3 \| \+1 \| -0 \| 1 \| 2 \|/);
 assert.match(markdown,/\*\*be\*\* added: rtbf/);
 assert.match(markdown,/\*\*ht\*\* removed: old-tv/);
 assert.match(reportMarkdown({report:{se:{...stats,added:[],removed:[]}}}),/No card added or removed\./);
 assert.match(markdown,/<details>/);
 // A huge change list still fits a pull request body (65,536 characters).
 const huge=reportMarkdown({report:Object.fromEntries(['us','fr','ca'].map(code=>[code,{...stats,added:Array.from({length:6000},(_,i)=>`${code}-channel-${i}`),removed:[]}]))});
 assert.doesNotMatch(huge,/<details>/);
 assert.match(huge,/… \(\+5960\)/);
 assert.ok(huge.length<65536);
});

test('home checks from Canada are used only while fresh',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z');
 assert.deepEqual(freshHomeCheck({ok:true,checkedAt:'2026-10-01'},now,60),{ok:true,checkedAt:'2026-10-01'});
 assert.equal(freshHomeCheck({ok:true,checkedAt:'2026-08-01'},now,60),null);
 assert.equal(freshHomeCheck({ok:true},now,60),null);
 assert.equal(freshHomeCheck(undefined,now,60),null);
 assert.equal(freshHomeCheck({ok:true,checkedAt:'2027-01-01'},now,60),null);
});

test('a run from the USA merges its verdicts with the Canadian checks',()=>{
 const ok={ok:true},geo={ok:false,reason:'geo'},dead={ok:false,reason:'unreachable'},native={ok:false,reason:'no-cors',native:true};
 // ICI RDI: 403 in Québec, 200 from the runner: never plays for a Canadian card.
 assert.deepEqual(mergeHomeCheck(ok,geo,true),{ok:false,reason:'home-blocked'});
 assert.equal(playabilityTier('https://a.example/x.m3u8',mergeHomeCheck(ok,geo,true)),null);
 // A US-only host that refuses Canada: geo-blocked (limited) for a foreign card.
 assert.deepEqual(mergeHomeCheck(ok,dead,false),{ok:false,reason:'geo',home:true});
 assert.equal(playabilityTier('https://a.example/x.m3u8',mergeHomeCheck(ok,dead,false)),2);
 // Dead from both: the runner's verdict.
 assert.deepEqual(mergeHomeCheck(dead,geo,false),dead);
 // The candidate keeps the origin of its 403, so the runner's own country does not drop it.
 const picked=pickStreams([candidate('https://us-only.example/x.m3u8')],hls,()=>mergeHomeCheck(ok,dead,false));
 assert.equal(picked.best.tier,2);
 assert.equal(picked.best.home,true);
 // Plays from Canada but not from the runner: kept as it plays at home.
 assert.deepEqual(mergeHomeCheck(dead,ok,false),{ok:true});
 assert.deepEqual(mergeHomeCheck(geo,native,true),{ok:false,reason:'no-cors',native:true});
 assert.deepEqual(mergeHomeCheck(ok,ok,true),ok);
 // No check: the runner's verdict, marked unchecked.
 assert.deepEqual(mergeHomeCheck(ok,null,true),{ok:true,unchecked:true});
 assert.equal(mergeHomeCheck(null,null,true),null);
});

test('the refresh report flags stale Canadian checks and held cards',()=>{
 const stats={kept:1,keptNativeOnly:0,excludedUnplayable:0,added:[],removed:[]};
 const fresh=reportMarkdown({homeChecks:{mode:'read',fresh:10,stale:0,maxAgeDays:60,oldest:'2026-11-01'},report:{ca:{...stats,heldForHomeCheck:[]}}});
 assert.match(fresh,/Canadian checks .*10 fresh, 0 older than 60 days/);
 assert.doesNotMatch(fresh,/Refresh them/);
 const held=reportMarkdown({homeChecks:{mode:'read',fresh:10,stale:2,maxAgeDays:60,oldest:'2026-08-01'},report:{ca:{...stats,heldForHomeCheck:['ici-rdi']}}});
 assert.match(held,/Refresh them/);
 assert.match(held,/\*\*ca\*\* held until checked from Canada: ici-rdi/);
});

test('French world: other countries with a French feed, in their region or International',()=>{
 assert.equal(inWorldScope('TG',new Set(['fr'])),true);
 assert.equal(inWorldScope('DE',new Set(['fr','other'])),true);
 // Countries with their own file, and channels without a French feed, stay out.
 assert.equal(inWorldScope('FR',new Set(['fr'])),false);
 assert.equal(inWorldScope('BE',new Set(['fr'])),false);
 assert.equal(inWorldScope('MA',new Set(['other'])),false);
 assert.equal(inWorldScope('UK',new Set()),false);
 assert.equal(worldRegion('TG'),'Togo');
 assert.equal(worldRegion('MQ'),'Outre-mer');
 assert.equal(worldRegion('MC'),'Monaco');
 assert.equal(worldRegion('DE'),'International');
 assert.equal(worldRegion(undefined),'International');
});
