import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const utils='data:text/javascript;base64,'+Buffer.from(ts.transpile(fs.readFileSync('lib/channel-utils.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022})).toString('base64');
const source=ts.transpile(fs.readFileSync('lib/catalogue-maintenance.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}).replace(/from ['"]\.\/channel-utils['"]/,`from '${utils}'`);
const {validateChannel,clientCatalogue,likelyNativeHls}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const c={id:'pluto-film',name:'Pluto Film',brand:'Pluto Film',region:'France',language:'fr',category:'Movies',color:'#6b8c92',description:'Films en continu.',official:'https://pluto.example/',guide:'https://pluto.example/',stream:'https://jmp2.example/plu-1.m3u8'};
test('a native-HLS-only channel keeps its flag and requires an https stream',()=>{
 assert.equal(validateChannel({...c,nativeHlsOnly:true}).nativeHlsOnly,true);
 assert.equal(validateChannel(c).nativeHlsOnly,undefined);
 assert.throws(()=>validateChannel({...c,nativeHlsOnly:'yes'}),/lecture native/);
 assert.throws(()=>validateChannel({...c,stream:'http://jmp2.example/plu-1.m3u8',insecureStream:true,nativeHlsOnly:true}),/lecture native/);
 assert.throws(()=>validateChannel({...c,stream:undefined,embed:'https://player.example/e',nativeHlsOnly:true}),/lecture native/);
 // The browser catalogue keeps the flag: the UI needs it to hide the card.
 const payload={channels:[validateChannel({...c,nativeHlsOnly:true})],health:{},latest:null,recentIds:[],updatedAt:null};
 assert.equal(clientCatalogue(payload).channels[0].nativeHlsOnly,true);
});
test('the francophone regions are valid catalogue regions',()=>{
 for(const region of ['Belgique','Suisse','Luxembourg','Sénégal',"Côte d'Ivoire",'RD Congo','Haïti','Cameroun','Suède'])assert.equal(validateChannel({...c,region}).region,region);
 assert.throws(()=>validateChannel({...c,region:'Belgium'}),/Région/);
});

test('a browser without native HLS gets a lean catalogue that still names the Safari-only ids',()=>{
 const payload={channels:[validateChannel({...c,nativeHlsOnly:true}),validateChannel({...c,id:'everywhere',name:'Everywhere'})],health:{},latest:null,recentIds:[],updatedAt:null};
 const lean=clientCatalogue(payload,false);
 assert.deepEqual(lean.channels.map(channel=>channel.id),['everywhere']);
 assert.deepEqual(lean.nativeOnlyIds,['pluto-film']);
 assert.equal(clientCatalogue(payload,false),lean,'the lean projection is cached too');
 assert.equal(clientCatalogue(payload).channels.length,2);assert.equal(clientCatalogue(payload).nativeOnlyIds,undefined);
});
test('native HLS is guessed from the user agent, and an unknown agent keeps everything',()=>{
 const agents={
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1':true,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15':true,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36':false,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0':false,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0':false,
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36':false,
  'SomeSmartTV/1.0':true,
 };
 for(const [agent,expected] of Object.entries(agents))assert.equal(likelyNativeHls(agent),expected,agent);
 assert.equal(likelyNativeHls(null),true);
});
