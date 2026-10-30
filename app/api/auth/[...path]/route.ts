import {authConfigured,getAuth} from '../../../../lib/auth-server';
import {sameOrigin} from '../../../../lib/owner-auth';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
const json=(message:string,status:number,code:string)=>Response.json({message,code},{status,headers:{'Cache-Control':'no-store'}});
const emailPaths=new Set(['sign-in/email','sign-up/email','send-verification-email','email-otp/send-verification-otp','email-otp/verify-email','request-password-reset']);
export async function GET(request:Request,context:Context){
 const path=(await context.params).path.join('/');
 if(path!=='get-session'&&path!=='verify-email'&&!/^reset-password\/[^/]+$/.test(path))return json('Action indisponible',404,'NOT_FOUND');
 if(!authConfigured())return json('La connexion Onde est en cours de configuration.',503,'AUTH_NOT_CONFIGURED');
 return getAuth().handler().GET(request,context);
}
export async function POST(request:Request,context:Context){
 if(!sameOrigin(request))return json('Origine invalide',403,'INVALID_ORIGIN');
 const path=(await context.params).path.join('/');
 if(!emailPaths.has(path)&&path!=='sign-out'&&path!=='reset-password')return json('Action indisponible',404,'NOT_FOUND');
 if(!authConfigured())return json('La connexion Onde est en cours de configuration.',503,'AUTH_NOT_CONFIGURED');
 try{
  const raw=await request.clone().text();if(raw.length>8192)return json('Requête trop longue',413,'INVALID_REQUEST');
  const body=raw?JSON.parse(raw):{};
  if(emailPaths.has(path)&&(typeof body.email!=='string'||body.email.length>254||!body.email.includes('@')))return json('Courriel invalide',400,'INVALID_EMAIL');
  // Prevent callback links from sending tokens or visitors to another origin.
  for(const key of ['callbackURL','redirectTo','errorCallbackURL','newUserCallbackURL'])if(body[key]&&new URL(body[key],request.url).origin!==new URL(request.url).origin)return json('Adresse de retour invalide',400,'INVALID_REQUEST');
 }catch{return json('Requête invalide',400,'INVALID_REQUEST');}
 return getAuth().handler().POST(request,context);
}
