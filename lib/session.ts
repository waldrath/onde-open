import {authConfigured,getAuth} from './auth-server';
import {verifiedAccount} from './owner-auth';
export {randomToken,hashToken,secretMatches,validState} from './session-security';
export type OndeUser={userId:string;authId:string;email:string;displayName:string;fullName:string|null};

export async function getOndeUser():Promise<OndeUser|null>{
 if(!authConfigured())return null;
 // Bypass the cookie cache for authorization and observe revoked sessions promptly.
 const {data:session,error}=await getAuth().getSession({query:{disableCookieCache:'true'}});
 if(error)return null;
 const user=verifiedAccount(session?.user);
 if(!user)return null;
 // New Onde accounts begin with a separate, empty set of preferences.
 const userId='onde-v2:'+user.id;
 return {userId,authId:user.id,email:user.email,displayName:user.name||'Mon compte Onde',fullName:user.name||null};
}
