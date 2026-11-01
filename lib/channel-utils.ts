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
 * streaming tiers). An explicit `premium: true` wins, and official-link-only
 * entries count as premium without the flag.
 */
const PREMIUM_BRAND = /(?:^|[^a-z0-9])(rds|tva sports|canal\+|canal plus|bein sports|hbo|espn|tsn|sportsnet|sky sports|dazn|netflix|disney\+|prime video|apple tv|paramount\+|peacock|hulu|starz|showtime|cin[eé]pop|super [eé]cran|illico|crave|amc\+|movie network|eurosport|rmc sport|viaplay|c more|discovery\+|sky cinema|bt sport)(?![a-z0-9])/i;

/** A channel is premium when flagged, link-only (paywalled) or a pay-TV brand. */
export const isPremiumChannel = (channel: Channel): boolean =>
  channel.premium === true
  || !(channel.stream || channel.embed || channel.resolve)
  || PREMIUM_BRAND.test(channel.name);

export const languageLabel = (channel: Channel): string =>
  channel.language === 'en'
    ? 'Anglais'
    : channel.language === 'sv'
      ? 'Suédois'
      : channel.language === 'zxx'
        ? 'Sans paroles'
        : 'Français';
