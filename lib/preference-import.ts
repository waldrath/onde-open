import {emptyPreferences,type Preferences} from './preferences';
export function validatePreferences(raw:unknown):Preferences{
 if(raw==null)return structuredClone(emptyPreferences);const p=raw as Preferences;
 const ids=(x:unknown)=>Array.isArray(x)&&x.length<=1000&&x.every(id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(id));
 if(!ids(p.favorites)||new Set(p.favorites).size!==p.favorites.length||!Array.isArray(p.lists)||p.lists.length>50||!p.lists.every(l=>l&&typeof l.id==='string'&&l.id.length<=100&&typeof l.name==='string'&&l.name.length<=48&&ids(l.channels))||(p.lastChannel!==null&&p.lastChannel!==undefined&&!ids([p.lastChannel])))throw new Error('Préférences invalides');
 return {favorites:[...p.favorites],lists:p.lists.map(l=>({id:l.id,name:l.name,channels:[...l.channels]})),lastChannel:p.lastChannel??null,lastAt:typeof p.lastAt==='string'&&Number.isFinite(Date.parse(p.lastAt))?p.lastAt:null};
}
