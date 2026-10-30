export type AuthIdentity = {id:string;email:string;emailVerified:boolean;name?:string|null};
export function verifiedAccount(user:unknown):AuthIdentity|null {
 if(!user||typeof user!=='object')return null;
 const u=user as AuthIdentity;
 return typeof u.id==='string'&&u.id.length>0&&u.id.length<=160&&typeof u.email==='string'&&u.email.length>0&&u.email.length<=254&&u.emailVerified===true?u:null;
}
export function sameOrigin(request:Request):boolean {
 return request.headers.get('origin')===new URL(request.url).origin;
}
