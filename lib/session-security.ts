import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export const randomToken=()=>randomBytes(32).toString('base64url');
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export function secretMatches(actual:string|null,expected:string|undefined){if(!actual||!expected||expected.length<32)return false;const a=Buffer.from(actual),b=Buffer.from('Bearer '+expected);return a.length===b.length&&timingSafeEqual(a,b);}
export function validState(value:unknown):value is string{return typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);}
