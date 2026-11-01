import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=ts.transpile(fs.readFileSync('lib/settings.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const {parseSettings,readSettings,writeSettings,defaultSettings,SETTINGS_KEY}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const memory=(initial={})=>{const data=new Map(Object.entries(initial));return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};

test('valid stored settings are kept and everything else falls back field by field',()=>{
 assert.deepEqual(parseSettings({dock:'top',motion:'reduced',schedule:false}),{dock:'top',motion:'reduced',schedule:false});
 assert.deepEqual(parseSettings({dock:'bottom',motion:'fast',schedule:'yes'}),defaultSettings);
 assert.deepEqual(parseSettings(null),defaultSettings);
 assert.deepEqual(parseSettings(['top']),defaultSettings);
 assert.equal(parseSettings({dock:'left'}).dock,'left');
});

test('corrupted storage never throws and yields the defaults',()=>{
 assert.deepEqual(readSettings(memory({[SETTINGS_KEY]:'{not json'})),defaultSettings);
 assert.deepEqual(readSettings(memory()),defaultSettings);
});

test('the schedule choice made before settings existed is carried over, then retired on save',()=>{
 const storage=memory({'onde-schedule-open':'0'});
 const settings=readSettings(storage);
 assert.equal(settings.schedule,false);
 writeSettings(storage,{...settings,dock:'left'});
 assert.equal(storage.data.has('onde-schedule-open'),false);
 assert.deepEqual(readSettings(storage),{dock:'left',motion:'system',schedule:false});
});
