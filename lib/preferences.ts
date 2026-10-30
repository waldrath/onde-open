import { channels } from './channels';
export type ChannelList={id:string;name:string;channels:string[]};
export type Preferences={favorites:string[];lists:ChannelList[];lastChannel:string|null;lastAt:string|null};
export const emptyPreferences:Preferences={favorites:[],lists:[],lastChannel:null,lastAt:null};
export type Operation =
 | {type:'favorite';channel:string;value:boolean}
 | {type:'move';channel:string;direction:-1|1}
 | {type:'last';channel:string}
 | {type:'createList';id:string;name:string}
 | {type:'renameList';id:string;name:string}
 | {type:'deleteList';id:string}
 | {type:'listChannel';id:string;channel:string;value:boolean};
export function applyOperation(state:Preferences,op:Operation,now=new Date().toISOString(),knownChannels:readonly {id:string}[]=channels):Preferences {
 const s=structuredClone(state);
 if(!op || typeof op!=='object')throw new Error('Action invalide');
 if('channel' in op&&!(typeof op.channel==='string'&&knownChannels.some(c=>c.id===op.channel)))throw new Error('Chaîne inconnue');
 switch(op.type){
 case 'favorite':if(typeof op.value!=='boolean')throw new Error('Valeur invalide');if(op.value){if(!s.favorites.includes(op.channel))s.favorites.push(op.channel);}else{s.favorites=s.favorites.filter(x=>x!==op.channel);}break;
 case 'move':{if(op.direction!==-1&&op.direction!==1)throw new Error('Direction invalide');const i=s.favorites.indexOf(op.channel),j=i+op.direction;if(i>=0&&j>=0&&j<s.favorites.length)[s.favorites[i],s.favorites[j]]=[s.favorites[j],s.favorites[i]];break;}
 case 'last':s.lastChannel=op.channel;s.lastAt=now;break;
 case 'createList':{if(s.lists.some(l=>l.id===op.id))return s;if(s.lists.length>=20)throw new Error('Maximum de 20 listes');if(typeof op.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(op.id))throw new Error('Identifiant invalide');const name=cleanName(op.name);s.lists.push({id:op.id,name,channels:[]});break;}
 case 'renameList':{const l=s.lists.find(l=>l.id===op.id);if(!l)throw new Error('Liste introuvable');l.name=cleanName(op.name);break;}
 case 'deleteList':s.lists=s.lists.filter(l=>l.id!==op.id);break;
 case 'listChannel':{if(typeof op.value!=='boolean')throw new Error('Valeur invalide');const l=s.lists.find(l=>l.id===op.id);if(!l)throw new Error('Liste introuvable');l.channels=l.channels.filter(x=>x!==op.channel);if(op.value)l.channels.push(op.channel);break;}
 default:throw new Error('Action inconnue');
 }
 return s;
}
function cleanName(s:string){if(typeof s!=='string'||!s.trim()||s.trim().length>48)throw new Error('Le nom doit contenir de 1 à 48 caractères');return s.trim();}
