import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const compile=p=>ts.transpile(fs.readFileSync(p,'utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const guide=data(compile('lib/guide.ts')),sources=data(compile('lib/guide-sources.ts'));
const {parseCommunityJSON,parseCommunityXML,xmltvDate}=await import(data(compile('lib/community-guide.ts').replace("'./guide'",JSON.stringify(guide)).replace("'./guide-sources'",JSON.stringify(sources))));
test('community programme times retain UTC offsets across a Québec midnight and descriptions are plain text',()=>{
 const rows=parseCommunityJSON({epg_list:[{start_date:'2026-10-23T01:00:00+00:00',title:'Une série',desc:'Une <b>description</b> &amp; une histoire.'},{start_date:'2026-10-23T02:00:00Z',title:'Le journal',desc:''},{start_date:'2026-10-23T03:00:00+00:00',title:'La suite',desc:''}]},'2026-10-22');
 assert.equal(rows.length,3);assert.equal(rows[0].start,'2026-10-23T01:00:00.000Z');assert.equal(rows[0].end,rows[1].start);assert.equal(rows[0].detail,'Une description & une histoire.');assert.equal(rows.at(-1).end,'');
});
test('stale dates, malformed times and missing descriptions never produce invented current programmes',()=>{
 assert.deepEqual(parseCommunityJSON({epg_list:[{start_date:'2025-10-23T01:00:00Z',title:'Archive'},{start_date:'2026-10-23T01:00:00',title:'Missing timezone'}]},'2026-10-23'),[]);
 const r=parseCommunityJSON({epg_list:[{start_date:'2026-10-23T10:00:00Z',title:'A'},{start_date:'2026-10-24T10:00:00Z',title:'B'}]},'2026-10-23');assert.equal(r[0].end,'');assert.equal(r[0].detail,'');
});
test('XMLTV matches exact provider IDs, parses descriptions and explicit end times',()=>{
 const xml='<tv><programme channel="other" start="20261023140000 +0200" stop="20261023143000 +0200"><title>Wrong channel</title></programme><programme channel="correct" start="20261023140000 +0200" stop="20261023143000 +0200"><title>Nature &amp; découvertes</title><sub-title>Épisode 2</sub-title><desc><![CDATA[La vie des animaux.]]></desc></programme></tv>';
 const rows=parseCommunityXML(xml,'correct','2026-10-23');assert.equal(rows.length,1);assert.equal(rows[0].start,'2026-10-23T12:00:00.000Z');assert.equal(rows[0].end,'2026-10-23T12:30:00.000Z');assert.equal(rows[0].title,'Nature & découvertes');assert.equal(rows[0].detail,'Épisode 2 · La vie des animaux.');assert.equal(xmltvDate('invalid'),'');
});

const {mergeBroadcastDays}=await import(guide);
test('an overnight programme from the previous broadcast day remains current after midnight',()=>{
 const rows=mergeBroadcastDays([{start:'2026-10-23T03:00:00.000Z',end:'',title:'Film du soir',detail:'Résumé'},{start:'2026-10-23T10:00:00.000Z',end:'2026-10-23T10:30:00.000Z',title:'Matin',detail:''}],'2026-10-23');
 assert.equal(rows[0].title,'Film du soir');assert.equal(rows[0].end,'2026-10-23T10:00:00.000Z');const now=Date.parse('2026-10-23T04:30:00Z');assert(rows.some(p=>Date.parse(p.start)<=now&&Date.parse(p.end)>now));
});
