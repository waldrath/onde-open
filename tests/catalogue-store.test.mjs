import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// The store is loaded with a scripted database so the cache rules can be
// exercised without Neon: each query batch resolves or rejects on demand.
const transpile=file=>ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const maintenance=url(transpile('lib/catalogue-maintenance.ts'));
const database=url(`export const db={prepare:sql=>({all:()=>globalThis.__catalogueDb(sql)})};`);
const channels=url(`export const channels=[{id:'base',name:'Base',brand:'Base',region:'Québec',category:'Culture',color:'#000000',description:'',official:'https://example.com',guide:'https://example.com'}];`);
const source=transpile('lib/catalogue-store.ts').replace(/from ['"]\.\/database['"]/,`from '${database}'`).replace(/from ['"]\.\/channels['"]/,`from '${channels}'`).replace(/from ['"]\.\/catalogue-maintenance['"]/,`from '${maintenance}'`);
const store=await import(url(source));

// One database read = three queries; `answer` decides how the next read goes.
let answer=()=>({entries:[],checks:[]});
globalThis.__catalogueDb=async sql=>{
 const a=answer();if(a instanceof Error)throw a;
 if(sql.includes('catalogue_entries'))return {results:a.entries};
 if(sql.includes('catalogue_health'))return {results:a.checks};
 return {results:[]};
};
const entry=id=>({channel_id:id,data:JSON.stringify({id,name:id,brand:id,region:'Canada',category:'Culture',color:'#111111',description:'',official:'https://example.com',guide:'https://example.com'}),added_at:'2026-10-30T00:00:00Z',updated_at:'2026-10-30T00:00:00Z'});
const realNow=Date.now;
test.afterEach(()=>{Date.now=realNow;store.invalidateCatalogue();});

test('a failed first read throws and is not cached, so the next read retries the database',async()=>{
 answer=()=>new Error('connection refused');
 await assert.rejects(store.readCatalogue(),/connection refused/);
 answer=()=>({entries:[entry('added')],checks:[]});
 assert.deepEqual((await store.readCatalogue()).channels.map(c=>c.id),['base','added']);
});

test('after a good read, a failed background refresh keeps serving the last good catalogue',async()=>{
 answer=()=>({entries:[entry('added')],checks:[]});
 await store.readCatalogue();
 answer=()=>new Error('timeout');
 Date.now=()=>realNow()+120000;
 const stale=await store.readCatalogue();
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.deepEqual(stale.channels.map(c=>c.id),['base','added']);
 assert.deepEqual((await store.readCatalogue()).channels.map(c=>c.id),['base','added']);
});

test('a write invalidates the cache, and a read already in flight cannot re-cache the older data',async()=>{
 let release;const slow=new Promise(resolve=>{release=resolve;});
 answer=()=>({entries:[entry('old')],checks:[]});
 const original=globalThis.__catalogueDb;
 globalThis.__catalogueDb=async sql=>{await slow;return original(sql);};
 const inFlight=store.readCatalogue();
 store.invalidateCatalogue();
 release();await inFlight;
 globalThis.__catalogueDb=original;
 answer=()=>({entries:[entry('new')],checks:[]});
 assert.deepEqual((await store.readCatalogue()).channels.map(c=>c.id),['base','new']);
});

test('the bundled fallback is available to pages without touching the cache',()=>{
 assert.deepEqual(store.fallbackCatalogue().channels.map(c=>c.id),['base']);
 assert.deepEqual(store.fallbackCatalogue().health,{});
});
