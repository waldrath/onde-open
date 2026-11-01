import type { Metadata, Viewport } from 'next';
import type {CSSProperties} from 'react';
import {Anton,Bangers,DM_Sans,Fraunces,JetBrains_Mono,Manrope,Michroma,Space_Grotesk} from 'next/font/google';
import './globals.css';
import './skins.css';
// One art-direction file per skin, after the shared styles so a skin's own rules win ties.
import './themes/dark.css';
import './themes/light.css';
import './themes/retro.css';
import './themes/matrix.css';
import './themes/anime.css';
import './themes/blueprint.css';
import './themes/noir.css';
import './themes/ocean.css';
import './themes/cosmos.css';
import './themes/arcade.css';
import './themes/sumi.css';
import './themes/ember.css';
import './themes/millennium.css';
import './themes/bureau.css';
import './themes/comics.css';
import './themes/aura.css';
// Self-hosted by next/font at build time: no blocking request to fonts.googleapis.com.
const bodyFont=DM_Sans({subsets:['latin'],display:'swap'});
const headingFont=Manrope({subsets:['latin'],display:'swap'});
// Display faces some skins use for headings. Not preloaded: a browser only
// downloads one when the active skin actually sets text in it.
const serifFont=Fraunces({subsets:['latin'],display:'swap',preload:false});
const groteskFont=Space_Grotesk({subsets:['latin'],display:'swap',preload:false});
const monoFont=JetBrains_Mono({subsets:['latin'],display:'swap',preload:false});
const wideFont=Michroma({subsets:['latin'],weight:'400',display:'swap',preload:false});
const comicFont=Bangers({subsets:['latin'],weight:'400',display:'swap',preload:false});
const impactFont=Anton({subsets:['latin'],weight:'400',display:'swap',preload:false});
// Set as inline custom properties on <html>: the :root fallbacks in globals.css keep the
// same specificity as next/font's variable classes, so only an inline style is order-proof.
const fontVars={'--font-body':bodyFont.style.fontFamily,'--font-heading':headingFont.style.fontFamily,'--font-serif':serifFont.style.fontFamily,'--font-grotesk':groteskFont.style.fontFamily,'--font-mono':monoFont.style.fontFamily,'--font-wide':wideFont.style.fontFamily,'--font-comic':comicFont.style.fontFamily,'--font-impact':impactFont.style.fontFamily} as CSSProperties;
export const metadata: Metadata = {
 title: 'Onde · Votre télé, simplement',
 description: 'Les chaînes gratuites du Québec, du Canada, de France et des États-Unis — plus de 2 600 chaînes dans un lecteur simple. Favoris, listes et dernière chaîne sur tous vos appareils.',
 manifest: '/manifest.webmanifest',
 icons: {icon:'/favicon.svg', apple:'/apple-touch-icon.png'},
};
export const viewport: Viewport = {
 width: 'device-width',
 initialScale: 1,
 themeColor: [
  {media:'(prefers-color-scheme: light)', color:'#f6f3eb'},
  {media:'(prefers-color-scheme: dark)', color:'#07162e'},
 ],
};
export default function Layout({children}:Readonly<{children:React.ReactNode}>) {
 return <html lang="fr-CA" style={fontVars}><body>{children}</body></html>;
}
