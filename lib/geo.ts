import type {Channel,ChannelRegion} from './channel-types';

export type ViewerCountry = 'CA' | 'FR' | 'US' | 'SE' | 'CM' | 'BE' | 'CH' | 'LU' | 'SN' | 'CI' | 'CD' | 'HT'
  | 'MA' | 'DZ' | 'TN' | 'TG' | 'BJ' | 'CG' | 'BF' | 'GN' | 'NE' | 'ML' | 'RW' | 'BI' | 'TD' | 'GA' | 'MG' | 'XX';

const CANADA_ZONES = /^America\/(Toronto|Montreal|Quebec|Halifax|St_Johns|Vancouver|Edmonton|Winnipeg|Regina|Whitehorse|Yellowknife|Iqaluit|Moncton|Glace_Bay|Goose_Bay|Thunder_Bay|Nipigon|Rainy_River|Rankin_Inlet|Resolute|Cambridge_Bay|Dawson_Creek|Fort_Nelson|Creston|Dawson|Inuvik)$/;
const USA_ZONES = /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Honolulu|Detroit|Indiana|Kentucky|Boise|Juneau|Nome|Sitka|Adak|Menominee|North_Dakota|Puerto_Rico|Virgin)$/;
// Single-country time zones (IANA) and browser locales, by viewer country.
const ZONES:ReadonlyMap<string,ViewerCountry> = new Map(Object.entries({
  'Europe/Paris':'FR','Europe/Monaco':'FR','Europe/Stockholm':'SE','Africa/Douala':'CM',
  'Europe/Brussels':'BE','Europe/Zurich':'CH','Europe/Luxembourg':'LU','Africa/Dakar':'SN',
  'Africa/Abidjan':'CI','Africa/Kinshasa':'CD','Africa/Lubumbashi':'CD','America/Port-au-Prince':'HT',
  'Africa/Casablanca':'MA','Africa/Algiers':'DZ','Africa/Tunis':'TN','Africa/Lome':'TG','Africa/Porto-Novo':'BJ',
  'Africa/Brazzaville':'CG','Africa/Ouagadougou':'BF','Africa/Conakry':'GN','Africa/Niamey':'NE','Africa/Bamako':'ML',
  'Africa/Kigali':'RW','Africa/Bujumbura':'BI','Africa/Ndjamena':'TD','Africa/Libreville':'GA','Indian/Antananarivo':'MG',
} satisfies Record<string,ViewerCountry>));
const LOCALES:ReadonlyMap<string,ViewerCountry> = new Map(Object.entries({
  'fr-ca':'CA','en-ca':'CA','fr-fr':'FR','fr-mc':'FR','en-us':'US','sv-se':'SE','fr-cm':'CM','en-cm':'CM',
  'fr-be':'BE','nl-be':'BE','fr-ch':'CH','de-ch':'CH','it-ch':'CH','fr-lu':'LU','lb-lu':'LU','de-lu':'LU',
  'fr-sn':'SN','fr-ci':'CI','fr-cd':'CD','fr-ht':'HT','ht-ht':'HT',
  'fr-ma':'MA','fr-dz':'DZ','fr-tn':'TN','fr-tg':'TG','fr-bj':'BJ','fr-cg':'CG','fr-bf':'BF','fr-gn':'GN','fr-ne':'NE',
  'fr-ml':'ML','fr-rw':'RW','rw-rw':'RW','fr-bi':'BI','fr-td':'TD','fr-ga':'GA','fr-mg':'MG','mg-mg':'MG',
} satisfies Record<string,ViewerCountry>));
// Catalogue region of each viewer country (Québec and Canada share CA).
const REGION_COUNTRIES:Readonly<Record<ChannelRegion,ViewerCountry>> = {
  'Québec':'CA','Canada':'CA','France':'FR','USA':'US','Suède':'SE','Cameroun':'CM','Belgique':'BE','Suisse':'CH',
  'Luxembourg':'LU','Sénégal':'SN',"Côte d'Ivoire":'CI','RD Congo':'CD','Haïti':'HT','Maroc':'MA','Algérie':'DZ',
  'Tunisie':'TN','Togo':'TG','Bénin':'BJ','Congo':'CG','Burkina Faso':'BF','Guinée':'GN','Niger':'NE','Mali':'ML',
  'Rwanda':'RW','Burundi':'BI','Tchad':'TD','Gabon':'GA','Madagascar':'MG',
  // Monaco's viewers are detected as France (its zone and fr-MC); the
  // overseas territories span many zones, so their channels count as
  // international (never hidden as foreign).
  'Monaco':'FR','Outre-mer':'XX','International':'XX',
};
const COUNTRY_LABELS:Readonly<Record<ViewerCountry,string>> = {
  CA:'Canada',FR:'France',US:'États-Unis',SE:'Suède',CM:'Cameroun',BE:'Belgique',CH:'Suisse',LU:'Luxembourg',
  SN:'Sénégal',CI:"Côte d'Ivoire",CD:'RD Congo',HT:'Haïti',MA:'Maroc',DZ:'Algérie',TN:'Tunisie',TG:'Togo',BJ:'Bénin',
  CG:'Congo',BF:'Burkina Faso',GN:'Guinée',NE:'Niger',ML:'Mali',RW:'Rwanda',BI:'Burundi',TD:'Tchad',GA:'Gabon',
  MG:'Madagascar',XX:'International',
};

export function detectViewerCountry(input?:{locale?:string;timeZone?:string}):ViewerCountry {
  // The time zone is the better signal for where playback is happening; the
  // browser language is a fallback when the zone is missing or unrecognized.
  const timeZone = input?.timeZone ?? (
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : ''
  );
  const zoneCountry = ZONES.get(timeZone);
  if (zoneCountry) return zoneCountry;
  if (CANADA_ZONES.test(timeZone)) return 'CA';
  if (USA_ZONES.test(timeZone)) return 'US';

  const locale = input?.locale ?? (
    typeof navigator !== 'undefined'
      ? (navigator.languages?.[0] || navigator.language || '')
      : ''
  );
  const normalizedLocale = locale.toLowerCase();
  return LOCALES.get(normalizedLocale) ?? 'XX';
}

export function countryForRegion(region: ChannelRegion): ViewerCountry {
  return REGION_COUNTRIES[region] ?? 'XX';
}

// `limited` is the catalogue's flag for a source that may be geo-restricted or
// otherwise restricted. A foreign limited channel is hidden for the detected
// viewer country; national and international limited channels stay available.
export function isLikelyGeoBlocked(channel:Pick<Channel,'region'|'limited'>, viewerCountry:ViewerCountry):boolean {
  if (!channel.limited || viewerCountry === 'XX') return false;
  const channelCountry = countryForRegion(channel.region);
  if (channelCountry === 'XX') return false;
  return channelCountry !== viewerCountry;
}

export function viewerCountryLabel(country:ViewerCountry):string {
  return COUNTRY_LABELS[country] ?? 'International';
}
