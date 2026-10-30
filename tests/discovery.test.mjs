import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {categoryGroup,discoveryCategories} from '../lib/discovery.ts';
test('discovery merges related genres into the same catalogue filter',()=>{
 for(const genre of ['Films','Séries','Animation'])assert.equal(categoryGroup(genre),'Films et séries');
 for(const genre of ['Culture','Science','Histoire','Documentaires','Découvertes'])assert.equal(categoryGroup(genre),'Culture et savoir');
 for(const genre of ['Cuisine','Mode','Maison','Art de vivre'])assert.equal(categoryGroup(genre),'Art de vivre');
});
test('every category, including future additions, remains reachable',()=>{
 const channels=[{category:'Science'},{category:'Films'},{category:'Inédit'},{category:'Films'}];
 const groups=discoveryCategories(channels);
 assert.deepEqual(groups,['Films et séries','Culture et savoir','Autres chaînes']);
 for(const c of channels)assert.ok(groups.includes(categoryGroup(c.category)));
 assert.equal(groups.filter(x=>x==='Films et séries').length,1);
});
test('empty catalogues do not advertise empty discovery categories',()=>assert.deepEqual(discoveryCategories([]),[]));

// iptv-org stores its own English categories verbatim; they must reach the
// same filters as the curated French ones instead of all piling up under
// "Autres chaînes".
test('imported English categories join the French discovery groups',()=>{
 const expected={
  News:'Actualités',Business:'Actualités',Weather:'Actualités',Legislative:'Actualités',Enquêtes:'Actualités',
  Movies:'Films et séries',Series:'Films et séries',Classic:'Films et séries',
  Documentary:'Culture et savoir',Education:'Culture et savoir',
  Entertainment:'Divertissement',Comedy:'Divertissement',General:'Divertissement',Family:'Divertissement',
  Kids:'Jeunesse',Music:'Musique',Outdoor:'Nature et plein air',Relax:'Nature et plein air',
  Lifestyle:'Art de vivre',Cooking:'Art de vivre',Travel:'Voyages',Sports:'Sport',
  Religious:'Autres chaînes',Shop:'Autres chaînes',
 };
 for(const [category,group] of Object.entries(expected))assert.equal(categoryGroup(category),group,category);
});
test('every catalogue category has a deliberate discovery group',()=>{
 const files=['base','ca','fr','us'].map(name=>`data/channels/${name}.json`);
 const catalogue=files.flatMap(file=>JSON.parse(fs.readFileSync(file,'utf8')));
 const deliberate=new Set(['Religion','Religious','Téléachat','Shop','Paranormal']);
 for(const channel of catalogue){
  if(deliberate.has(channel.category))continue;
  assert.notEqual(categoryGroup(channel.category),'Autres chaînes',`${channel.id}: ${channel.category}`);
 }
});

