/**
 * Channel catalogue types.
 *
 * The channel data itself lives in the JSON files under `data/channels/`
 * (single logical catalogue, split by origin; see `data/README.md`).
 * This module only describes its shape, so types can be imported
 * without loading or validating the catalogue.
 */

export type ChannelRegion = 'Québec' | 'Canada' | 'France' | 'USA' | 'Suède' | 'International';

export type ChannelLanguage = 'fr' | 'en' | 'sv' | 'zxx';

/** Server-side resolvers that turn an official page into a playable source. */
export type ChannelResolver =
  | 'telequebec'
  | 'cpac'
  | 'france24'
  | 'youtube'
  | 'tfo'
  | 'public-senat';

/**
 * Where a channel entry came from. `core` / `additional` / `expanded` label
 * the curated entries of `base.json`; `iptv-org` marks entries imported from
 * the iptv-org country playlists by `scripts/import-iptv-org.mjs`.
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
  /**
   * Variant streams of the same channel (other feeds or relays), tried in
   * order when `stream` fails. Generated iptv-org imports merge every feed
   * of a channel into one card and list the extra ones here (up to 8), so
   * the player offers them in its source selector and switches
   * automatically to the first that plays. `insecureStream` describes
   * `stream` only: a variant may be plain http, and the player explains
   * the browser setting when it falls back to one.
   */
  streamAlts?: { url: string; label?: string }[];
  /** Official embeddable player URL. */
  embed?: string;
  /** Resolver used to obtain a playable source from the official page. */
  resolve?: ChannelResolver;
  youtube?: string;
  directory?: string;
  /** Playback exists but may be geo-restricted or otherwise limited. */
  limited?: boolean;
  /**
   * Paid/premium channel. Official-link-only entries (no stream/embed/
   * resolve, i.e. the `ici-tele` pattern) count as premium without the
   * flag; set it explicitly when a channel is paywalled but still carries
   * a public relay, so the app's "Chaînes premium" filter can find it.
   */
  premium?: boolean;
  note?: string;
  /**
   * Logo image URL for this channel.
   *
   * Values come from an explicit match to the channel, either in the
   * iptv-org/database (`data/channels.csv` + `data/logos.csv`; the database
   * metadata is public domain, while artwork and trademarks remain their
   * owners') or from the playlist's own `tvg-logo` for imported entries.
   * Never synthesize a logo URL from a channel slug; when `logoUrl` is
   * absent the UI falls back to the text `brand`.
   */
  logoUrl?: string;
  source?: ChannelSource;
};
