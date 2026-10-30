import {catalogueChannels} from '../../../lib/catalogue-store';
import { defaultSources, telequebecSource, cpacSource, france24Embed, youtubeLiveWatchURL, tfoSource, publicSenatSource, type PlaybackResult } from '../../../lib/playback';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){
 const channel=(await catalogueChannels()).find(c=>c.id===(new URL(request.url).searchParams.get('channel')||''));
 if(!channel)return response({sources:[],message:'Chaîne introuvable.'},404);
 const fallback=defaultSources(channel);
 if(!channel.resolve)return response({sources:fallback,message:fallback.length?undefined:'Ce diffuseur ne propose pas de lecteur intégrable compatible avec Onde.'});
 // A verified publisher iframe plays in the visitor's browser. It does not
 // depend on server-side access to YouTube's HTML pages.
 if(channel.resolve==='youtube'&&channel.embed?.startsWith('https://www.youtube.com/embed/'))return response({sources:fallback});
 const fetchSource=(url:string)=>fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html,application/json'}});
 try{
  let result:PlaybackResult;
  if(channel.resolve==='telequebec'){
   const r=await fetchSource('https://telequebec.tv/regarder/en-direct/telequebec');if(!r.ok)throw new Error();
   result={sources:[telequebecSource(await r.text())]};
  }else if(channel.resolve==='public-senat'){
   const r=await fetchSource('https://www.publicsenat.fr/wp-json/hemicycle/live-status');if(!r.ok)throw new Error();result=publicSenatSource(await r.json());
  }else if(channel.resolve==='tfo'){
   const r=await fetchSource('https://www.tfo.org/endpoints/live/get-live-url');if(!r.ok)throw new Error();result=tfoSource(await r.json());
  }else if(channel.resolve==='france24'||channel.resolve==='youtube'){
   const r=await fetchSource(channel.youtube||'https://www.youtube.com/@FRANCE24/live');if(!r.ok)throw new Error();
   const html=await r.text();let source;
   try{source=france24Embed(html,channel.name);}catch{
    const confirmation=await fetchSource(youtubeLiveWatchURL(html));if(!confirmation.ok)throw new Error();
    source=france24Embed(await confirmation.text(),channel.name);
   }
   result={sources:[...fallback.filter(s=>!s.url.includes('youtube.com')),source]};
  }else{
   const url='https://www.cpac.ca/api/1/services/item-list.json?localId=%2Fsite%2Fcomponents%2Fcpac-item-lists%2Flivestreams.xml&crafterSite=cpactv&removeCpacTv=false';
   const r=await fetchSource(url);if(!r.ok)throw new Error();result={sources:[cpacSource(await r.json())]};
  }
  return response(result);
 }catch{return response({sources:fallback,message:fallback.length?undefined:'Le diffuseur ne répond pas pour le moment. Réessaie dans quelques instants.'},fallback.length?200:503);}
}
