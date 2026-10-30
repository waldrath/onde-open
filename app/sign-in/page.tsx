import {redirect} from 'next/navigation';
import {authConfigured} from '../../lib/auth-server';
import {getOndeUser} from '../../lib/session';
import SignInShell from './sign-in-shell';
import SignInContent from './sign-in-content';
import {getInitialTheme} from '../../lib/theme-server';
import {getInitialLocale} from '../../lib/locale-server';
import {LocaleProvider} from '../locale-provider';
export const dynamic='force-dynamic';
export default async function SignIn({searchParams}:{searchParams:Promise<{token?:string}>}){
 const reset=!!(await searchParams).token;
 const initialTheme=await getInitialTheme();
 const initialLocale=await getInitialLocale();
 let ready=authConfigured();
 if(ready&&!reset){let user=null;try{user=await getOndeUser();}catch{ready=false;}if(user)redirect('/');}
 return <LocaleProvider initialLocale={initialLocale}><SignInShell initialTheme={initialTheme}><SignInContent ready={ready}/></SignInShell></LocaleProvider>;
}
