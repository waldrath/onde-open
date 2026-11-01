import type {NextConfig} from 'next';
// Public assets are not content-hashed: cache one day, revalidate a week in the background.
const asset={key:'Cache-Control',value:'public, max-age=86400, stale-while-revalidate=604800'};
const config:NextConfig={async headers(){return [
 {source:'/:path*',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Content-Type-Options',value:'nosniff'}]},
 {source:'/images/:path*',headers:[asset]},
 {source:'/themes/:path*',headers:[asset]},
 {source:'/favicon.svg',headers:[asset]},
 {source:'/icon-192.png',headers:[asset]},
 {source:'/icon-512.png',headers:[asset]},
 {source:'/apple-touch-icon.png',headers:[asset]},
 {source:'/app-icon.svg',headers:[asset]},
 // The service worker must never be served from a long-lived cache or it cannot update.
 {source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache'}]},
];}};
export default config;
