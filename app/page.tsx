import Television from './television';
import {LocaleProvider} from './locale-provider';
import {getOndeUser} from '../lib/session';
import {getInitialTheme} from '../lib/theme-server';
import {getInitialLocale} from '../lib/locale-server';
export const dynamic='force-dynamic';
export default async function Page(){
 let user=null;try{user=await getOndeUser();}catch{}
 const theme=await getInitialTheme();
 const locale=await getInitialLocale();
 return <LocaleProvider initialLocale={locale}><Television key={user?.authId||'guest'} userId={user?.authId||null} initialTheme={theme}/></LocaleProvider>;
}
