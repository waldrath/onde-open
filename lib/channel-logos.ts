/**
 * Channel logo lookup.
 *
 * Logo URLs live on each channel entry as `logoUrl` in
 * `data/channels/*.json`; this module only resolves them for
 * `app/television.tsx` and `app/player.tsx`.
 *
 * Sources: iptv-org/database `data/channels.csv` and `data/logos.csv`
 * (https://github.com/iptv-org/database/tree/master/data). The database
 * metadata is public domain (repository LICENSE / Unlicense); artwork and
 * trademarks remain their owners' rights, and an entry is not a claim that
 * the image is public domain or officially hosted.
 *
 * Rules:
 * - No logo URL is ever synthesized from a channel slug; a URL is used only
 *   when it was explicitly matched to that exact channel id.
 * - Missing or failed images use the UI's text fallback (`brand`).
 */

import { channelsById } from './channels';

/**
 * Resolve the logo URL for a channel. Accepts a full channel (its own
 * `logoUrl` wins) or any object carrying a channel `id`; the id fallback
 * covers catalogue entries merged in from the database, whose stored
 * payload may predate the `logoUrl` field.
 */
export function getChannelLogo(channel: {
  id: string;
  logoUrl?: string;
}): string | undefined {
  return channel.logoUrl ?? channelsById.get(channel.id)?.logoUrl;
}
