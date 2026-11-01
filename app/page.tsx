import { Suspense } from 'react';
import Television from './television';
import {LocaleProvider} from './locale-provider';
import {getOndeUser} from '../lib/session';
import {getInitialTheme} from '../lib/theme-server';
import {getInitialLocale} from '../lib/locale-server';
import {fallbackCatalogue,logReadFailure,readCatalogue} from '../lib/catalogue-store';
import {headers} from 'next/headers';
import {clientCatalogue,likelyNativeHls} from '../lib/catalogue-maintenance';
import type {Theme} from '../lib/themes';
// The catalogue is server data: read it here (cached in memory) and hand it to
// the client component, so the channel JSON stays out of the browser bundle.
// The Suspense boundary streams the themed shell as soon as it is ready
// instead of blocking the first bytes of HTML on the database.
export const dynamic='force-dynamic';
export default async function Page(){
 // A failed session lookup leaves the visitor signed out: the app stays usable as a guest.
 const [user,theme,locale]=await Promise.all([getOndeUser().catch((error:unknown)=>{console.error(JSON.stringify({event:'session_lookup_failed',message:error instanceof Error?error.message:String(error)}));return null;}),getInitialTheme(),getInitialLocale()]);
 const userId=user?.authId||null;
 // Only the signed-in person sees their own name and address, in Réglages.
 const account=user?{name:user.fullName,email:user.email}:null;
 return <LocaleProvider initialLocale={locale}><Suspense fallback={<Shell theme={theme}/>}><CatalogueApp userId={userId} account={account} initialTheme={theme}/></Suspense></LocaleProvider>;
}
function Shell({theme}:{theme:Theme}){
 return <div className="app-shell" data-theme={theme} aria-busy="true"><span className="sr-only">Chargement d’Onde…</span></div>;
}
async function CatalogueApp({userId,account,initialTheme}:{userId:string|null;account:{name:string|null;email:string}|null;initialTheme:Theme}){
 // The bundled channels keep the page usable during a database outage; they are
 // never cached, so the shared catalogue returns as soon as the database does.
 const catalogue=await readCatalogue().catch((error:unknown)=>{logReadFailure(error);return fallbackCatalogue();});
 // Browsers that cannot play Safari-only channels do not download them.
 const initialCatalogue=clientCatalogue(catalogue,likelyNativeHls((await headers()).get('user-agent')));
 return <Television key={userId||'guest'} userId={userId} account={account} initialTheme={initialTheme} initialCatalogue={initialCatalogue}/>;
}
