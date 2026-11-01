/**
 * Client-safe channel helpers.
 *
 * Nothing here imports the catalogue JSON: components receive their channel
 * list through props (server component -> client component), so the ~1.7 MB
 * catalogue stays in the server bundle instead of being shipped to every
 * visitor and validated in the browser. Only pure, data-free helpers live in
 * this module; the catalogue itself is `lib/channels.ts` (server-only).
 */

import type { Channel } from './channel-types';

export type {
  Channel,
  ChannelLanguage,
  ChannelRegion,
  ChannelResolver,
  ChannelSource,
} from './channel-types';

/**
 * Pay-TV brands recognised by name, so the "Chaînes premium" filter catches
 * the premium relays the iptv-org import carries (sports, cinema and
 * streaming tiers) and the free channels those brands run themselves (CBS
 * Sports HQ, NBC Sports NOW, NFL Channel, Paramount+ Picks, Stories by AMC,
 * CNN Originals...). An explicit `premium: true` wins, and official-link-only
 * entries count as premium without the flag.
 */
const PREMIUM_BRAND = /(?:^|[^a-z0-9])(rds|tva sports|canal\+|canal plus|bein sports|hbo|espn|tsn|sportsnet|sky sports|dazn|netflix|disney\+|prime video|apple tv|paramount|cbs sports|nbc sports|nfl channel|mlb|nhl network|tennis channel|stories by amc|cnn originals|peacock|hulu|starz|showtime|cin[eé]pop|super [eé]cran|illico|crave|amc\+|movie network|eurosport|rmc sport|viaplay|c more|discovery\+|sky cinema|bt sport)(?![a-z0-9])/i;

/** A channel is premium when flagged, link-only (paywalled) or a pay-TV brand. */
export const isPremiumChannel = (channel: Channel): boolean =>
  channel.premium === true
  || !(channel.stream || channel.embed || channel.resolve)
  || PREMIUM_BRAND.test(channel.name);

/** Accent of every imported card (IMPORT_COLOR in scripts/import-iptv-org.mjs). */
const IMPORTED_COLOR = '#6b8c92';

/** The description the importer writes for an iptv-org card (describe() in scripts/import-iptv-org.mjs). */
export const importedDescription = (category: string, language?: Channel['language']): string =>
  language === 'fr'
    ? `En lecture directe dans Onde via le flux public répertorié par iptv-org (catégorie : ${category}).`
    : `Playing directly in Onde via the public stream listed by iptv-org (category: ${category}).`;

/**
 * A channel as the page ships it: the fields a browser can rebuild are left
 * out when they hold their default (brand = name, guide = official site,
 * the imported accent, the importer's description), about a third of the
 * catalogue embedded in the HTML. expandChannel restores them.
 */
export type CompactChannel = Omit<Channel, 'brand' | 'guide' | 'color' | 'description'>
  & Partial<Pick<Channel, 'brand' | 'guide' | 'color' | 'description'>>;

export function compactChannel(channel: Channel): CompactChannel {
  const compact: CompactChannel = { ...channel };
  if (compact.brand === channel.name) delete compact.brand;
  if (compact.guide === channel.official) delete compact.guide;
  if (compact.color === IMPORTED_COLOR) delete compact.color;
  if (channel.source === 'iptv-org' && compact.description === importedDescription(channel.category, channel.language)) delete compact.description;
  return compact;
}

export function expandChannel(channel: CompactChannel): Channel {
  return {
    ...channel,
    brand: channel.brand ?? channel.name,
    guide: channel.guide ?? channel.official,
    color: channel.color ?? IMPORTED_COLOR,
    description: channel.description ?? importedDescription(channel.category, channel.language),
  };
}

export const languageLabel = (channel: Channel): string =>
  channel.language === 'en'
    ? 'Anglais'
    : channel.language === 'sv'
      ? 'Suédois'
      : channel.language === 'zxx'
        ? 'Sans paroles'
        : 'Français';
