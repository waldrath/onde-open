export type CommunityGuideSource={id:string;provider:string;apiId?:string;url?:string;xmlChannelId?:string;sourceName:string;version?:string;fallbackOnly?:boolean};
export const communityGuideSources:CommunityGuideSource[]=[
 {
  "id": "tva",
  "provider": "epg.pw",
  "apiId": "470458",
  "version": "Montréal, Québec",
  "sourceName": "CFTM Montréal",
  "fallbackOnly": false
 },
 {
  "id": "cpac",
  "provider": "epg.pw",
  "apiId": "470353",
  "version": "Canada, français",
  "sourceName": "[CPACF] Cable Public Affairs Channel (French)",
  "fallbackOnly": false
 },
 {
  "id": "cpac-en",
  "provider": "epg.pw",
  "apiId": "470901",
  "version": "Canada, anglais",
  "sourceName": "[CPAC] Cable Public Affairs Channel HD",
  "fallbackOnly": false
 },
 {
  "id": "savoir",
  "provider": "epg.pw",
  "apiId": "470884",
  "version": "Québec",
  "sourceName": "Savoir média",
  "fallbackOnly": true
 },
 {
  "id": "tfo",
  "provider": "epg.pw",
  "apiId": "470598",
  "version": "Ontario français",
  "sourceName": "TFO",
  "fallbackOnly": true
 },
 {
  "id": "france24",
  "provider": "epg.pw",
  "apiId": "55716",
  "version": "France 24 français",
  "sourceName": "France 24",
  "fallbackOnly": false
 },
 {
  "id": "france24-en",
  "provider": "epg.pw",
  "apiId": "443227",
  "version": "France 24 anglais",
  "sourceName": "France 24 Anglais",
  "fallbackOnly": false
 },
 {
  "id": "franceinfo",
  "provider": "epg.pw",
  "apiId": "55824",
  "version": "France, direct national",
  "sourceName": "franceinfo:",
  "fallbackOnly": false
 },
 {
  "id": "euronews",
  "provider": "epg.pw",
  "apiId": "52000",
  "version": "Version française, source France",
  "sourceName": "Euronews",
  "fallbackOnly": false
 },
 {
  "id": "bfm2",
  "provider": "epg.pw",
  "apiId": "448549",
  "version": "France, BFM2 et non BFMTV",
  "sourceName": "BFM2",
  "fallbackOnly": false
 },
 {
  "id": "tebeo",
  "provider": "epg.pw",
  "apiId": "55744",
  "version": "Bretagne, France",
  "sourceName": "TEBEO",
  "fallbackOnly": false
 },
 {
  "id": "arte",
  "provider": "epg.pw",
  "apiId": "55730",
  "version": "Version française",
  "sourceName": "Arte",
  "fallbackOnly": false
 },
 {
  "id": "sky-news",
  "provider": "epg.pw",
  "apiId": "443268",
  "version": "Sky News international anglais",
  "sourceName": "Sky News",
  "fallbackOnly": false
 },
 {
  "id": "aljazeera-en",
  "provider": "epg.pw",
  "apiId": "443134",
  "version": "Al Jazeera anglais international",
  "sourceName": "Al Jazeera English",
  "fallbackOnly": false
 },
 {
  "id": "nhk-world",
  "provider": "epg.pw",
  "apiId": "443124",
  "version": "NHK World Japan anglais international",
  "sourceName": "NHK WORLD-JAPAN",
  "fallbackOnly": false
 },
 {
  "id": "20minutestv",
  "provider": "epg.pw",
  "apiId": "443244",
  "version": "Île-de-France",
  "sourceName": "20 Minutes TV",
  "fallbackOnly": false
 },
 {
  "id": "africa24",
  "provider": "epg.pw",
  "apiId": "55960",
  "version": "Version française",
  "sourceName": "Africa 24",
  "fallbackOnly": false
 },
 {
  "id": "canneslerinstv",
  "provider": "epg.pw",
  "apiId": "448558",
  "version": "Cannes, France",
  "sourceName": "Cannes Lérins TV",
  "fallbackOnly": false
 },
 {
  "id": "iltv",
  "provider": "epg.pw",
  "apiId": "55786",
  "version": "Hénin-Carvin, France",
  "sourceName": "IL TV",
  "fallbackOnly": false
 },
 {
  "id": "lefigarotviledefrance",
  "provider": "epg.pw",
  "apiId": "448596",
  "version": "Île-de-France",
  "sourceName": "Le Figaro TV",
  "fallbackOnly": false
 },
 {
  "id": "puissancetv",
  "provider": "epg.pw",
  "apiId": "448602",
  "version": "France",
  "sourceName": "Puissance TV",
  "fallbackOnly": false
 },
 {
  "id": "rmcdecouverte",
  "provider": "epg.pw",
  "apiId": "54916",
  "version": "France, direct national",
  "sourceName": "RMC Découverte",
  "fallbackOnly": false
 },
 {
  "id": "rmcstory",
  "provider": "epg.pw",
  "apiId": "54996",
  "version": "France, direct national",
  "sourceName": "RMC Story",
  "fallbackOnly": false
 },
 {
  "id": "tvmonaco",
  "provider": "epg.pw",
  "apiId": "448559",
  "version": "Monaco, direct national",
  "sourceName": "TVMonaco",
  "fallbackOnly": false
 },
 {
  "id": "failarmy",
  "provider": "SamsungTVPlus",
  "url": "https://i.mjh.nz/SamsungTVPlus/gb.xml.gz",
  "xmlChannelId": "GBAJ40003642",
  "sourceName": "FailArmy"
 },
 {
  "id": "pet-collective",
  "provider": "SamsungTVPlus",
  "url": "https://i.mjh.nz/SamsungTVPlus/gb.xml.gz",
  "xmlChannelId": "GBAJ40003481",
  "sourceName": "The Pet Collective"
 },
 {
  "id": "are-we-there-yet",
  "provider": "SamsungTVPlus",
  "url": "https://i.mjh.nz/SamsungTVPlus/gb.xml.gz",
  "xmlChannelId": "GBBB1600006RS",
  "sourceName": "Are We There Yet?"
 },
 {
  "id": "lovetheplanet",
  "provider": "SamsungTVPlus",
  "url": "https://i.mjh.nz/SamsungTVPlus/gb.xml.gz",
  "xmlChannelId": "GBBD500001F5",
  "sourceName": "Love the Planet"
 },
 {
  "id": "waterbear",
  "provider": "SamsungTVPlus",
  "url": "https://i.mjh.nz/SamsungTVPlus/gb.xml.gz",
  "xmlChannelId": "GBBC300003UQ",
  "sourceName": "WaterBear"
 }
];
