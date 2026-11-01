import {redirect} from 'next/navigation';
import {authConfigured} from '../../lib/auth-server';
import {getOndeUser} from '../../lib/session';
import SignInShell from './sign-in-shell';
import SignInContent from './sign-in-content';
import {getInitialTheme} from '../../lib/theme-server';
import {getInitialLocale} from '../../lib/locale-server';
import {LocaleProvider} from '../locale-provider';
export const dynamic='force-dynamic';
export default async function SignIn({searchParams}:{searchParams:Promise<{token?:string;mode?:string}>}){
 const params=await searchParams,reset=!!params.token;
 // "Créer un compte" in Réglages opens the form on sign-up; anything else signs in.
 const initialMode=params.mode==='sign-up'?'sign-up':'sign-in';
 const initialTheme=await getInitialTheme();
 const initialLocale=await getInitialLocale();
 let ready=authConfigured();
 if(ready&&!reset){let user=null;try{user=await getOndeUser();}catch{ready=false;}if(user)redirect('/');}
 return <LocaleProvider initialLocale={initialLocale}><SignInShell initialTheme={initialTheme}><SignInContent ready={ready} initialMode={initialMode}/></SignInShell></LocaleProvider>;
}
