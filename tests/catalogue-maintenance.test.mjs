import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('lib/catalogue-maintenance.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const {recordHealth,validateChannel,mergeCatalogue}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
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
 for(const changes of [{stream:'http://cdn.example/live.m3u8'},{stream:'https://127.0.0.1/live.m3u8'},{stream:'https://10.0.0.1/a'},{stream:'https://user:secret@cdn.example/a'},{youtube:'https://other.example/live'},{id:'../bad'},{resolve:'unknown'},{stream:undefined,embed:undefined,resolve:undefined}])assert.throws(()=>validateChannel({...c,...changes}));
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
});
