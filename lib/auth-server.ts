import {createNeonAuth} from '@neondatabase/auth/next/server';

export function authConfigured():boolean {
 try {
  const url=new URL(process.env.NEON_AUTH_BASE_URL||'');
  return url.protocol==='https:'&&!url.username&&!url.password&&(process.env.NEON_AUTH_COOKIE_SECRET?.length??0)>=32;
 }catch{return false;}
}
let instance:ReturnType<typeof createNeonAuth>|undefined;
/** Lazy construction keeps unconfigured installations on an explicit setup screen. */
export function getAuth(){
 if(!authConfigured())throw new Error('Connexion Onde en cours de configuration');
 return instance??=createNeonAuth({baseUrl:process.env.NEON_AUTH_BASE_URL!,cookies:{secret:process.env.NEON_AUTH_COOKIE_SECRET!,sessionDataTtl:60},logLevel:'silent'});
}
