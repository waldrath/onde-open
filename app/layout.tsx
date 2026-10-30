import type { Metadata, Viewport } from 'next';
import './globals.css';
import './skins.css';
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
 return <html lang="fr-CA"><body>{children}</body></html>;
}
