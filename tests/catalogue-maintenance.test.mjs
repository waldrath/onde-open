import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
// channel-utils (compactChannel) is inlined the same way: data: modules cannot resolve relative imports.
const utils='data:text/javascript;base64,'+Buffer.from(ts.transpile(fs.readFileSync('lib/channel-utils.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022})).toString('base64');
const source=ts.transpile(fs.readFileSync('lib/catalogue-maintenance.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}).replace(/from ['"]\.\/channel-utils['"]/,`from '${utils}'`);
const {recordHealth,validateChannel,mergeCatalogue,clientCatalogue}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const c={id:'local-tv',name:'Télé locale',brand:'Télé locale',region:'Québec',language:'fr',category:'Culture',color:'#628a95',description:'La vie locale.',official:'https://diffuseur.example/live',guide:'https://diffuseur.example/horaire',stream:'https://cdn.diffuseur.example/live.m3u8'};
test('one outage and repeated attempts cannot mark a source suspect; a later success restores it',()=>{
 const a=recordHealth(undefined,c.id,'failed','Timeout','a','2026-10-23T08:00:00Z');assert.equal(a.state,'unknown');assert.equal(a.failures,1);
 const b=recordHealth(a,c.id,'failed','Retry','a','2026-10-23T08:15:00Z');assert.equal(b.failures,1);assert.equal(b.state,'unknown');
 const d=recordHealth(b,c.id,'failed','Second independent control','b','2026-10-24T08:00:00Z');assert.equal(d.state,'suspect');assert.equal(d.failures,2);
 const ok=recordHealth(d,c.id,'ok','Actual video and CORS confirmed','c','2026-10-24T09:00:00Z');assert.equal(ok.state,'responding');assert.equal(ok.failures,0);assert.equal(ok.lastSuccessAt,'2026-10-24T09:00:00Z');
});
test('an unverified iframe is not recorded as a successful video test',()=>{
 const h=recordHealth(undefined,c.id,'unverified','Player page responds, playback not confirmed','a','2026-10-23T08:00:00Z');assert.equal(h.state,'unknown');assert.equal(h.lastSuccessAt,undefined);assert.equal(h.failures,0);
});
test('source replacements retain stable IDs and unrelated channels, and new IDs are added once',()=>{
 const other={...c,id:'other'},replacement={...c,stream:'https://new-cdn.example/live.m3u8'},newChannel={...c,id:'new-channel'};
 const merged=mergeCatalogue([c,other],[replacement,newChannel,newChannel]);assert.deepEqual(merged.map(c=>c.id),['local-tv','other','new-channel']);assert.equal(merged[0].stream,replacement.stream);assert.deepEqual(merged[1],other);
});
test('published sources require a public HTTPS player and supported metadata',()=>{
 assert.deepEqual(validateChannel({...c,unexpected:'removed'}),c);
 const withAlts={...c,streamAlts:[{url:'https://alt.example/live.m3u8',label:'HD'},{url:'http://1.2.3.4/b.m3u8'}]};
 assert.deepEqual(validateChannel(withAlts),withAlts);
 for(const changes of [{stream:'http://cdn.example/live.m3u8'},{stream:'https://127.0.0.1/live.m3u8'},{stream:'https://10.0.0.1/a'},{stream:'https://user:secret@cdn.example/a'},{youtube:'https://other.example/live'},{id:'../bad'},{resolve:'unknown'},{stream:undefined,embed:undefined,resolve:undefined},{streamAlts:[]},{streamAlts:[c.stream]},{streamAlts:['https://a.example/1.m3u8','https://a.example/2.m3u8','https://a.example/3.m3u8','https://a.example/4.m3u8']},{streamAlts:['https://127.0.0.1/a.m3u8']},{streamAlts:['not a url']},{stream:undefined,streamAlts:['https://a.example/live.m3u8']}])assert.throws(()=>validateChannel({...c,...changes}));
});
test('a discovered channel can be favorited without changing existing favorites or requiring a new build',async()=>{
 const catalogue='data:text/javascript;base64,'+Buffer.from('export const channels=[{id:"existing"}];').toString('base64');
 const code=ts.transpile(fs.readFileSync('lib/preferences.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}).replace("'./channels'",JSON.stringify(catalogue));
 const {applyOperation,emptyPreferences}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const known=[{id:'existing'},{id:'discovered'}];
 const before=applyOperation(emptyPreferences,{type:'favorite',channel:'existing',value:true},'2026-10-23T08:00:00Z',known);
 const after=applyOperation(before,{type:'favorite',channel:'discovered',value:true},'2026-10-23T08:00:00Z',known);
 assert.deepEqual(after.favorites,['existing','discovered']);assert.deepEqual(before.favorites,['existing']);
 assert.throws(()=>applyOperation(after,{type:'favorite',channel:'unknown',value:true},'2026-10-23T08:00:00Z',known));
 // A channel that left the catalogue can still be removed, but only with a well-formed id.
 const retired=applyOperation(after,{type:'favorite',channel:'existing',value:false},'2026-10-23T08:00:00Z',[{id:'discovered'}]);
 assert.deepEqual(retired.favorites,['discovered']);
 assert.throws(()=>applyOperation(after,{type:'favorite',channel:'../bad',value:false},'2026-10-23T08:00:00Z',known));
});
test('the page payload drops maintenance provenance and passing checks without touching the stored catalogue',()=>{
 const withProvenance={...c,directory:'https://iptv-org.github.io/iptv/countries/ca.m3u',note:'Part-time schedule'};
 const ok=recordHealth(undefined,c.id,'ok','Video confirmed','a','2026-10-23T08:00:00Z');
 const suspect={...recordHealth(undefined,'other','failed','Timeout','a','2026-10-23T08:00:00Z'),state:'suspect'};
 const payload={channels:[withProvenance],health:{[c.id]:ok,other:suspect},latest:null,recentIds:[c.id],updatedAt:'2026-10-23T08:00:00Z'};
 const view=clientCatalogue(payload);
 assert.equal('directory' in view.channels[0],false);assert.equal('note' in view.channels[0],false);
 assert.equal(view.channels[0].stream,c.stream);assert.deepEqual(Object.keys(view.health),['other']);
 assert.deepEqual(view.recentIds,[c.id]);assert.equal(payload.channels[0].directory,withProvenance.directory);assert.ok(payload.health[c.id]);
 assert.equal(clientCatalogue(payload),view,'a cached payload is projected once');
});
