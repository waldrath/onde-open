import type {Channel,ChannelRegion} from './channel-types';

export type ViewerCountry = 'CA' | 'FR' | 'US' | 'XX';

const CANADA_ZONES = /^America\/(Toronto|Montreal|Quebec|Halifax|St_Johns|Vancouver|Edmonton|Winnipeg|Regina|Whitehorse|Yellowknife|Iqaluit|Moncton|Glace_Bay|Goose_Bay|Thunder_Bay|Nipigon|Rainy_River|Rankin_Inlet|Resolute|Cambridge_Bay|Dawson_Creek|Fort_Nelson|Creston|Dawson|Inuvik)$/;
const USA_ZONES = /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Honolulu|Detroit|Indiana|Kentucky|Boise|Juneau|Nome|Sitka|Adak|Menominee|North_Dakota|Puerto_Rico|Virgin)$/;

export function detectViewerCountry(input?:{locale?:string;timeZone?:string}):ViewerCountry {
  // The time zone is the better signal for where playback is happening; the
  // browser language is a fallback when the zone is missing or unrecognized.
  const timeZone = input?.timeZone ?? (
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : ''
  );
  if (timeZone === 'Europe/Paris' || timeZone === 'Europe/Monaco') return 'FR';
  if (CANADA_ZONES.test(timeZone)) return 'CA';
  if (USA_ZONES.test(timeZone)) return 'US';

  const locale = input?.locale ?? (
    typeof navigator !== 'undefined'
      ? (navigator.languages?.[0] || navigator.language || '')
      : ''
  );
  const normalizedLocale = locale.toLowerCase();
  if (normalizedLocale === 'fr-ca' || normalizedLocale === 'en-ca') return 'CA';
  if (normalizedLocale === 'fr-fr' || normalizedLocale === 'fr-mc') return 'FR';
  if (normalizedLocale === 'en-us') return 'US';
  return 'XX';
}

export function countryForRegion(region: ChannelRegion): ViewerCountry {
  if (region === 'Québec' || region === 'Canada') return 'CA';
  if (region === 'France') return 'FR';
  if (region === 'USA') return 'US';
  return 'XX';
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
  if (country === 'CA') return 'Canada';
  if (country === 'FR') return 'France';
  if (country === 'US') return 'États-Unis';
  return 'International';
}
