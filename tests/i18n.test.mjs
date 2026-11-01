import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// The French copy is the key: a t('…') call whose text is missing from the
// English dictionary silently stays French, so every literal must be a key.
const source=ts.transpile(fs.readFileSync('lib/i18n.ts','utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});
const {translate}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const dictionary=fs.readFileSync('lib/i18n.ts','utf8');
const unquote=value=>value.replace(/\\'/g,"'");
const entries=[...dictionary.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/gm)].map(m=>[unquote(m[1]),unquote(m[2])]);
const keys=new Set(entries.map(([key])=>key));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const components=walk('app').filter(file=>file.endsWith('.tsx'));

test('every translated literal in the interface has an English entry',()=>{
 const missing=[];
 for(const file of components){
  const src=fs.readFileSync(file,'utf8');
  for(const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g))if(!keys.has(unquote(m[1])))missing.push(`${file}: ${unquote(m[1])}`);
  for(const m of src.matchAll(/\bt\([^()']*\?'((?:[^'\\]|\\.)*)':'((?:[^'\\]|\\.)*)'/g))for(const key of [m[1],m[2]].map(unquote))if(!keys.has(key))missing.push(`${file}: ${key}`);
 }
 assert.deepEqual(missing,[]);
});

test('English templates keep exactly the placeholders of their French key',()=>{
 const names=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 for(const [key,value] of entries)assert.deepEqual(names(value),names(key),key);
});

test('the dictionary declares each key once',()=>{
 assert.ok(entries.length>300,'the parser reads the dictionary');
 assert.equal(keys.size,entries.length);
});

test('templates are filled in both languages and unknown text falls back to French',()=>{
 assert.equal(translate('fr','{name} ajouté aux favoris',{name:'Télé-Québec'}),'Télé-Québec ajouté aux favoris');
 assert.match(translate('en','{name} ajouté aux favoris',{name:'Télé-Québec'}),/Télé-Québec/);
 assert.notEqual(translate('en','{name} ajouté aux favoris',{name:'X'}),'X ajouté aux favoris');
 assert.equal(translate('en','Texte sans traduction'),'Texte sans traduction');
});
