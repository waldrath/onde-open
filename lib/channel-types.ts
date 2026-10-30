/**
 * Channel catalogue types.
 *
 * The channel data itself lives in the JSON files under `data/channels/`
 * (single logical catalogue, split by origin; see `data/README.md`).
 * This module only describes its shape, so types can be imported
 * without loading or validating the catalogue.
 */

export type ChannelRegion = 'Québec' | 'Canada' | 'France' | 'USA' | 'International';

export type ChannelLanguage = 'fr' | 'en' | 'zxx';

/** Server-side resolvers that turn an official page into a playable source. */
export type ChannelResolver =
  | 'telequebec'
  | 'cpac'
  | 'france24'
  | 'youtube'
  | 'tfo'
  | 'public-senat';

/**
 * Where a channel entry came from. `core` / `additional` / `expanded`
 * are the legacy hand-maintained lists migrated in phase 1 (kept as
 * provenance metadata, and used to rebuild the compatibility exports in
 * `lib/catalogue.ts` and `lib/expanded-catalogue.ts`). `iptv-org` marks
 * entries imported from the iptv-org country playlists by
 * `scripts/import-iptv-org.mjs`.
 */
export type ChannelSource = 'core' | 'additional' | 'expanded' | 'iptv-org';

export type Channel = {
  id: string;
  name: string;
  /** Short label rendered as text when no logo image is available. */
  brand: string;
  region: ChannelRegion;
  category: string;
  /** Accent colour, `#rrggbb`. */
  color: string;
  language?: ChannelLanguage;
  description: string;
  /** Official broadcaster page for this channel. */
  official: string;
  /** Official schedule / programme guide page. */
  guide: string;
  /** Direct HLS stream URL, when the broadcaster publishes a free one. */
  stream?: string;
  /**
   * True when `stream` is plain HTTP (the source offers no HTTPS).
   * Browsers block http streams on the HTTPS app until the viewer
   * allows insecure content for the site, so the player explains that
   * setting before playback instead of failing silently. Set on every
   * generated iptv-org import whose best available stream is http,
   * including bare-IP hosts.
   */
  insecureStream?: boolean;
  /** Official embeddable player URL. */
  embed?: string;
  /** Resolver used to obtain a playable source from the official page. */
  resolve?: ChannelResolver;
  youtube?: string;
  directory?: string;
  /** Playback exists but may be geo-restricted or otherwise limited. */
  limited?: boolean;
  note?: string;
  /**
   * Logo image URL for this channel.
   *
   * Provenance: values were merged from the former hand-maintained map in
   * `lib/channel-logos.ts`, itself sourced from iptv-org/database
   * (`data/channels.csv` + `data/logos.csv`; the database metadata is
   * public domain, while artwork and trademarks remain their owners').
   * Rules carried over from that file: never synthesize a logo URL from a
   * channel slug, and when `logoUrl` is absent the UI must fall back to
   * the text `brand`. Do not add a URL here unless it was explicitly
   * matched to this channel id in that source. Imported (`iptv-org`)
   * entries carry the playlist's own `tvg-logo` value, copied verbatim
   * by `scripts/import-iptv-org.mjs`.
   */
  logoUrl?: string;
  source?: ChannelSource;
};
