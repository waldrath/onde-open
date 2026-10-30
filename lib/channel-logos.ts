/**
 * Channel logo lookup — backward-compatibility shim.
 *
 * Logo URLs now live on each channel entry as `logoUrl` in
 * `data/channels/*.json`, and this module only resolves them. It is kept so
 * existing imports (`app/television.tsx`, `app/player.tsx`) keep working.
 *
 * Provenance of the URLs (carried over from the former hand-maintained map
 * that lived in this file): iptv-org/database `data/channels.csv` and
 * `data/logos.csv`, read at
 * https://github.com/iptv-org/database/tree/d38154951b3077ec6b80317e6bc78c91ca708354/data
 * The database metadata is public domain (repository LICENSE / Unlicense).
 * Artwork and trademarks retain their respective owners' rights; an entry
 * is not a claim that the image is public domain or official-hosted.
 *
 * Rules that still apply:
 * - No logo URL is ever synthesized from a channel slug. A URL is used
 *   only when it was explicitly matched to that exact channel id.
 * - Missing or failed images must use the UI's text fallback (`brand`).
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
