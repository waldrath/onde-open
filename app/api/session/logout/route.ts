import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {authConfigured,getAuth} from '../../../../lib/auth-server';
import {sameOrigin} from '../../../../lib/owner-auth';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 if(authConfigured()){
  const {error}=await getAuth().signOut();
  if(error)return Response.json({error:'Déconnexion indisponible. Réessaie.'},{status:503});
 }
 const store=await cookies();
 for(const name of ['__Host-onde-session','__Host-onde-state'])store.set(name,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
 return NextResponse.redirect(new URL('/sign-in',request.url),303);
}
