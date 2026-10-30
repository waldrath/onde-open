export type Programme={start:string;end:string;title:string;detail:string};
export type Guide={channel:string;programmes:Programme[];source:string;fetchedAt:string;sourceLabel?:string;notice?:string;error?:string};
function decode(s:string){return s.replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x))).replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}
export function torontoDate(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`;
}
// Determine each civil-time offset independently, including DST transitions.
export function localTime(day:string,hour:number,minute:number,timeZone='America/Toronto'){
 const utc=Date.parse(day+'T00:00:00Z')+(hour*60+minute)*60000;
 let guess=utc+5*3600000;
 for(let i=0;i<2;i++){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
  const get=(t:string)=>p.find(x=>x.type===t)!.value;
  const rendered=Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00Z`);
  guess+=utc-rendered;
 }
 return new Date(guess).toISOString();
}
function makeProgrammes(rows:{hour:number;minute:number;title:string;detail:string}[],day:string,rollover:boolean,timeZone='America/Toronto'){
 let nextDay=false,previous=-1;
 const programs=rows.map(r=>{
  const minutes=r.hour*60+r.minute;
  if(rollover&&previous>=0&&minutes<previous)nextDay=true;
  previous=minutes;
  const date=nextDay?new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10):day;
  return {start:localTime(date,r.hour,r.minute,timeZone),end:'',title:r.title,detail:r.detail};
 });
 return programs.map((p,i)=>({...p,end:programs.slice(i+1).find(next=>next.start>p.start)?.start||''}));
}
export function parseTelequebec(html:string,expectedDate:string):Programme[]{
 const selected=html.match(/id="schedule-date-item-(\d{4}-\d{2}-\d{2})"[^>]*aria-current="date"/);
 if(selected?.[1]!==expectedDate)throw new Error('Horaire non actualisé');
 const rows=[];
 for(const match of html.matchAll(/<a\b[^>]*data-testid="schedule-row[^>]*>/g)){
  const name=match[0].match(/data-tq_item_name="([^"]+)"/);if(!name)continue;
  const m=decode(name[1]).match(/^Diffusé à (\d{2})h(\d{2})\. (.+)$/);if(!m)continue;
  const title=m[3].split('. Saison ')[0].replace(/\. Classement.*$/,'');
  rows.push({hour:Number(m[1]),minute:Number(m[2]),title,detail:m[3]});
 }
 return makeProgrammes(rows,expectedDate,true);
}
export function parseSavoir(html:string,day:string):Programme[]{
 const heading=html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1]||'';
 const expected=new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 if(!decode(heading.replace(/<[^>]*>/g,'')).includes(expected))throw new Error('Horaire non actualisé');
 const rows=[];
 for(const m of html.matchAll(/<div[^>]*class="heure"[^>]*>(\d{2}):(\d{2})<\/div>\s*<div class="text-content">\s*<h5>([\s\S]*?)<\/h5>/g)){
  const title=decode(m[3].replace(/<[^>]*>/g,''));rows.push({hour:Number(m[1]),minute:Number(m[2]),title,detail:''});
 }
 return makeProgrammes(rows,day,false);
}

export function addDays(day:string,offset:number){return new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);}
export function parseTfo(html:string,day:string):Programme[]{
 const rows:Programme[]=[];
 for(const match of html.matchAll(/<article\b[^>]*class="schedule-slot[^>]*>[\s\S]*?<\/article>/g)){
  const block=match[0],start=block.match(/data-start-time="(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):\d{2}"/);
  const title=block.match(/<h3[^>]*class="[^"]*airing-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
  if(!start||!title)continue;
  const end=block.match(/data-end-time-jump="(\d{2})(\d{2})\d{2}"/);
  const episode=block.match(/<h4[^>]*class="[^"]*episode-title[^"]*"[^>]*>([\s\S]*?)<\/h4>/);
  const startTime=localTime(start[1],+start[2],+start[3]);
  let endTime=end?localTime(start[1],+end[1],+end[2]):'';
  if(endTime&&endTime<=startTime)endTime=localTime(addDays(start[1],1),+end![1],+end![2]);
  rows.push({start:startTime,end:endTime,title:decode(title[1].replace(/<[^>]*>/g,'')),detail:episode?decode(episode[1].replace(/<[^>]*>/g,'')):''});
 }
 if(!rows.length||!rows.some(p=>torontoDate(new Date(p.start))===day))throw new Error('Horaire non actualisé');
 return rows;
}
export function parseTvr(html:string,day:string):Programme[]{
 // A dated canonical link prevents a redirect to today's grid being mislabelled.
 if(!html.includes('content="https://www.tvr.bzh/grille/'+day+'"'))throw new Error('Horaire non actualisé');
 const rows:{hour:number;minute:number;title:string;detail:string}[]=[];
 for(const m of html.matchAll(/class="c-program__label">(\d{2})h(\d{2})<\/div>([\s\S]*?)class="c-program__title">([\s\S]*?)<\/div>/g)){
  rows.push({hour:+m[1],minute:+m[2],title:decode(m[4].replace(/<[^>]*>/g,'')),detail:''});
 }
 return makeProgrammes(rows,day,true,'Europe/Paris');
}

export function mergeBroadcastDays(rows:Programme[],day:string):Programme[]{
 const unique=new Map(rows.map(p=>[p.start,p]));
 const ordered=[...unique.values()].sort((a,b)=>a.start.localeCompare(b.start));
 const start=Date.parse(localTime(day,0,0)),end=Date.parse(localTime(addDays(day,1),6,0));
 return ordered.map((p,i)=>{const next=ordered[i+1];const gap=next?Date.parse(next.start)-Date.parse(p.start):0;return p.end||!next||gap>12*3600000?p:{...p,end:next.start};}).filter(p=>Date.parse(p.start)<end&&(p.end?Date.parse(p.end)>start:Date.parse(p.start)>=start));
}
