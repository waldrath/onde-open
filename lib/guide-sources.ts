// apiId is the provider’s own channel key (epg.pw, blue.ch, post.lu, rts.ch); XMLTV providers use url + xmlChannelId.
export type CommunityGuideSource={id:string;provider:'epg.pw'|'SamsungTVPlus'|'blue.ch'|'post.lu'|'rts.ch';apiId?:string;url?:string;xmlChannelId?:string;sourceName:string;version?:string;fallbackOnly?:boolean};
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
 },
 {
  "id": "crtv",
  "provider": "epg.pw",
  "apiId": "568372",
  "version": "Cameroun, chaîne nationale",
  "sourceName": "CRTV",
  "fallbackOnly": false
 },
 {
  "id": "la-une",
  "provider": "epg.pw",
  "apiId": "459202",
  "version": "Belgique, RTBF",
  "sourceName": "La Une",
  "fallbackOnly": false
 },
 {
  "id": "tipik",
  "provider": "epg.pw",
  "apiId": "459205",
  "version": "Belgique, RTBF",
  "sourceName": "Tipik",
  "fallbackOnly": false
 },
 {
  "id": "matele",
  "provider": "epg.pw",
  "apiId": "443180",
  "version": "Dinant, Belgique",
  "sourceName": "Vià MATÉLÉ",
  "fallbackOnly": false
 },
 {
  "id": "tvm3",
  "provider": "epg.pw",
  "apiId": "539601",
  "version": "Suisse romande",
  "sourceName": "TVM3 [CH]",
  "fallbackOnly": false
 },
 {
  "id": "carac1",
  "provider": "blue.ch",
  "apiId": "355",
  "version": "Suisse romande",
  "sourceName": "CARAC 1",
  "fallbackOnly": false
 },
 {
  "id": "carac2",
  "provider": "blue.ch",
  "apiId": "301",
  "version": "Suisse romande",
  "sourceName": "CARAC 2",
  "fallbackOnly": false
 },
 {
  "id": "carac3",
  "provider": "blue.ch",
  "apiId": "246",
  "version": "Suisse romande",
  "sourceName": "CARAC 3",
  "fallbackOnly": false
 },
 {
  "id": "carac4",
  "provider": "blue.ch",
  "apiId": "1082",
  "version": "Suisse romande",
  "sourceName": "CARAC 4",
  "fallbackOnly": false
 },
 {
  "id": "carac5",
  "provider": "blue.ch",
  "apiId": "41",
  "version": "Suisse romande",
  "sourceName": "CARAC 5",
  "fallbackOnly": false
 },
 {
  "id": "maxtv",
  "provider": "blue.ch",
  "apiId": "253",
  "version": "Suisse romande",
  "sourceName": "Max TV",
  "fallbackOnly": false
 },
 {
  "id": "canal9",
  "provider": "blue.ch",
  "apiId": "72",
  "version": "Valais, Suisse",
  "sourceName": "Canal 9",
  "fallbackOnly": false
 },
 {
  "id": "leman-bleu",
  "provider": "blue.ch",
  "apiId": "244",
  "version": "Genève, Suisse",
  "sourceName": "Léman Bleu Télévision",
  "fallbackOnly": false
 },
 {
  "id": "rhone-tv",
  "provider": "blue.ch",
  "apiId": "2096",
  "version": "Valais, Suisse",
  "sourceName": "Rhône TV",
  "fallbackOnly": false
 },
 {
  "id": "rts-info",
  "provider": "rts.ch",
  "apiId": "5d332a26e06d08eec8ad385d566187df72955623",
  "version": "Suisse, RTS",
  "sourceName": "RTS Info",
  "fallbackOnly": false
 },
 {
  "id": "rtl-zwee",
  "provider": "post.lu",
  "apiId": "5c2aa860-8096-11e9-b5ca-f345a2ed0fbe",
  "version": "Luxembourg",
  "sourceName": "RTL Zwee",
  "fallbackOnly": false
 },
 {
  "id": "tv-lux",
  "provider": "post.lu",
  "apiId": "bdd3df00-1411-11ea-934c-4323fc36d546",
  "version": "Province de Luxembourg, Belgique",
  "sourceName": "TVLux",
  "fallbackOnly": false
 }
];
