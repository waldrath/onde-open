import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const compile=p=>ts.transpile(fs.readFileSync(p,'utf8'),{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022});const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const guide=data(compile('lib/guide.ts')),sources=data(compile('lib/guide-sources.ts'));
const {parseCommunityJSON,parseCommunityXML,xmltvDate,parseBlueJSON,parsePostJSON,parseSrgJSON}=await import(data(compile('lib/community-guide.ts').replace("'./guide'",JSON.stringify(guide)).replace("'./guide-sources'",JSON.stringify(sources))));
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
// 2026-10-31 in Toronto (EDT) runs from 04:00Z to 2026-11-01 11:00Z (06:00 EST).
const broadcast=(title,start,end,summary)=>({Kind:'Broadcast',Content:{Description:{Title:title,Summary:summary}},Availabilities:[{AvailabilityStart:start,AvailabilityEnd:end}]});
test('blue TV keeps broadcasts of the requested channel with explicit UTC windows and drops off-air or malformed slots',()=>{
 const payload={Nodes:{Items:[{Kind:'Channel',Content:{Description:{Title:'CARAC 1'},Nodes:{Items:[broadcast('Hier','2026-10-30T20:00:00Z','2026-10-30T22:00:00Z'),broadcast('Le journal','2026-10-31T17:00:00Z','2026-10-31T17:30:00Z','Toute l&#039;actualité <b>locale</b>.'),broadcast('Sendepause','2026-10-31T17:30:00Z','2026-10-31T18:00:00Z'),broadcast('Sans fuseau','2026-10-31T18:00:00','2026-10-31T19:00:00'),broadcast('Film','2026-10-31T18:00:00Z','2026-10-31T19:40:00Z','Film'),{Kind:'Image',Content:{Description:{Title:'Affiche'}}}]}}}]}};
 const rows=parseBlueJSON(payload,'2026-10-31');assert.deepEqual(rows.map(p=>p.title),['Le journal','Film']);assert.equal(rows[0].start,'2026-10-31T17:00:00.000Z');assert.equal(rows[0].end,'2026-10-31T17:30:00.000Z');assert.equal(rows[0].detail,'Toute l\'actualité locale.');assert.equal(rows[1].detail,'');
 assert.throws(()=>parseBlueJSON({Nodes:{Items:[]}},'2026-10-31'));assert.throws(()=>parseBlueJSON('nope','2026-10-31'));
});
test('POST Luxembourg and RTS day pages merge across the European midnight with exact end times',()=>{
 const post=(...rows)=>({success:true,result:{epg:{programme:rows}}}),at=iso=>Date.parse(iso)/1000;
 const lux=parsePostJSON([post({tsStart:at('2026-10-31T18:37:00Z'),tsEnd:at('2026-10-31T19:35:00Z'),title:'Passepartout',description:''},{tsStart:'bad',tsEnd:at('2026-10-31T20:00:00Z'),title:'Invalide'}),{success:false},post({tsStart:at('2026-11-01T05:00:00Z'),tsEnd:at('2026-11-01T06:00:00Z'),title:'De Journal',description:'Rediffusioun'})],'2026-10-31');
 assert.deepEqual(lux.map(p=>[p.title,p.start,p.end,p.detail]),[['Passepartout','2026-10-31T18:37:00.000Z','2026-10-31T19:35:00.000Z',''],['De Journal','2026-11-01T05:00:00.000Z','2026-11-01T06:00:00.000Z','Rediffusioun']]);
 assert.throws(()=>parsePostJSON([{success:false}],'2026-10-31'));
 const rts=parseSrgJSON([{programGuide:[{programList:[{title:'L\'essentiel',subtitle:'Édition du soir',description:'Les titres.',startTime:'2026-10-31T19:00:00+01:00',endTime:'2026-11-01T07:00:00+01:00'},{title:'Sans fin',startTime:'2026-10-31T19:00:00+01:00'}]}]}],'2026-10-31');
 assert.equal(rts.length,1);assert.equal(rts[0].start,'2026-10-31T18:00:00.000Z');assert.equal(rts[0].end,'2026-11-01T06:00:00.000Z');assert.equal(rts[0].detail,'Édition du soir · Les titres.');assert.throws(()=>parseSrgJSON([{programGuide:[]}],'2026-10-31'));
});
test('every community guide source targets a catalogue channel once and carries its provider key',async()=>{
 const ids=new Set(fs.readdirSync('data/channels').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(fs.readFileSync('data/channels/'+f,'utf8')).map(c=>c.id)));
 const {communityGuideSources:all}=await import(sources);assert.equal(new Set(all.map(s=>s.id)).size,all.length);
 for(const s of all){assert(ids.has(s.id),s.id+' absent du catalogue');assert(s.provider==='SamsungTVPlus'?s.url&&s.xmlChannelId:s.apiId,s.id);}
});

const {mergeBroadcastDays}=await import(guide);
test('an overnight programme from the previous broadcast day remains current after midnight',()=>{
 const rows=mergeBroadcastDays([{start:'2026-10-23T03:00:00.000Z',end:'',title:'Film du soir',detail:'Résumé'},{start:'2026-10-23T10:00:00.000Z',end:'2026-10-23T10:30:00.000Z',title:'Matin',detail:''}],'2026-10-23');
 assert.equal(rows[0].title,'Film du soir');assert.equal(rows[0].end,'2026-10-23T10:00:00.000Z');const now=Date.parse('2026-10-23T04:30:00Z');assert(rows.some(p=>Date.parse(p.start)<=now&&Date.parse(p.end)>now));
});
