/**
 * Import the iptv-org catalogue (database + country playlists) into Onde's
 * JSON channel catalogue.
 *
 * Usage:
 *   node scripts/import-iptv-org.mjs
 *
 * Inputs (downloaded fresh, or read locally when the matching environment
 * variable points at a file / directory, which makes runs reproducible and
 * lets maintainers diff the report before committing):
 *   - Playlists: https://iptv-org.github.io/iptv/countries/{ca,fr,us}.m3u
 *     Override with IPTV_PLAYLIST_DIR=<dir containing ca.m3u/fr.m3u/us.m3u>.
 *   - Channel metadata: https://iptv-org.github.io/api/channels.json
 *     Override with IPTV_CHANNELS_API=<file path>.
 *   - Streams: https://iptv-org.github.io/api/streams.json
 *     Override with IPTV_STREAMS_API=<file path>.
 *   - Logos: https://iptv-org.github.io/api/logos.json
 *     Override with IPTV_LOGOS_API=<file path>.
 *
 * Output: data/channels/{ca,fr,us}.json (one file per country), merged at
 * load time by lib/channels.ts with data/channels/base.json into ONE logical
 * catalogue. The base file is never modified here.
 *
 * Coverage (owner decision, 2026-10-29): every active, non-NSFW channel of
 * the iptv-org database whose country is Canada, France or the USA, plus
 * every channel of the matching country playlist (playlists also list
 * foreign feeds available in that country). A channel is kept only when it
 * can actually play inside Onde:
 *   - NSFW channels are excluded;
 *   - closed/defunct channels are excluded;
 *   - non-HLS streams (no `.m3u8`: DASH/.mpd, FLV, …) are excluded — the
 *     Onde player is HLS-only;
 *   - one stream is picked per channel feed (see pickBestStream), so a
 *     channel is never listed twice for the same feed.
 *
 * Unlike the first import, bare-IP hosts and third-party relays of premium
 * channels are no longer dropped: the owner asked for full country coverage,
 * and those streams are already publicly listed by iptv-org. Any plain
 * http:// stream is flagged `insecureStream: true` (browsers block it by
 * default on the HTTPS app; the player explains the Chrome setting that
 * unblocks it, and that Safari/iOS has no equivalent).
 *
 * De-duplication, in order:
 *   - against `base.json` by normalized display name — when the curated
 *     entry already has a playable source (stream/embed/resolve) the
 *     generated copy is skipped (base wins); a link-only base entry never
 *     blocks a playable import;
 *   - across all three generated files and against the base catalogue by
 *     generated id, full tvg-id, stream URL, and normalized display name
 *     (so two feeds rendered under the same name are not shown twice).
 *
 * Two Canada-playlist entries are listed over http but verified to answer
 * over HTTPS on the same host and path; HTTPS_STREAM_UPGRADES rewrites
 * exactly those stream URLs to their verified https form.
 *
 * Field mapping (schema: see data/README.md):
 *   id        stable slug from the tvg-id (see makeId);
 *   name      playlist name cleaned of "(720p)"-style quality suffixes
 *             and "[Geo-blocked]" / "[Not 24/7]" flags (the flags are
 *             kept as data: geo-blocked -> `limited: true`, both are
 *             explained in `note`); database-only channels use the
 *             database name, with the feed in brackets when the channel
 *             has several feeds;
 *   logoUrl   the playlist's tvg-logo, or the database logo, copied
 *             verbatim (never invented);
 *   category  first `group-title` token ("Undefined"/empty -> "General");
 *             database-only channels use the first database category;
 *   region    ca -> "Canada", fr -> "France", us -> "USA" (Radio-Canada
 *             Québec stations are the one documented exception below);
 *   official/guide
 *             the broadcaster website from the iptv-org database for
 *             the channel's base tvg-id (http upgraded to https);
 *   directory the country playlist URL the stream was found in, or the
 *             streams API export for database-only channels;
 *   source    "iptv-org".
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data', 'channels');
const PLAYLIST_BASE = 'https://iptv-org.github.io/iptv/countries';
const CHANNELS_API_URL = 'https://iptv-org.github.io/api/channels.json';
const STREAMS_API_URL = 'https://iptv-org.github.io/api/streams.json';
const LOGOS_API_URL = 'https://iptv-org.github.io/api/logos.json';

/** Country playlists to import, in catalogue order. */
const COUNTRIES = [
  { code: 'ca', region: 'Canada', language: 'en', databaseCountry: 'CA' },
  { code: 'fr', region: 'France', language: 'fr', databaseCountry: 'FR' },
  { code: 'us', region: 'USA', language: 'en', databaseCountry: 'US' },
];

/** Feed suffixes that carry no identity (quality only) — dropped from ids. */
const GENERIC_FEEDS = new Set(['sd', 'hd', 'uhd', 'fhd', '4k', '720p', '1080p']);

/** Accent colour used for iptv-org-sourced entries (phase-1 precedent). */
const IMPORT_COLOR = '#6b8c92';

/**
 * Streams the playlists list over http but that were verified (2026-10-29)
 * to serve the same host + path over HTTPS with HTTP 200: keyed by full
 * tvg-id, valued by the verified https URL. Re-verify before extending.
 */
const HTTPS_STREAM_UPGRADES = new Map([
  ['MontrealGreekTV.ca@SD', 'https://live.greektv.ca/hls1/greektv.m3u8'],
  ['PamirTV.ca@SD', 'https://live.stream.cdn.pamirtv.com/ptv/d0dbe915091d400bd8ee7f27f0791303.sdp/index.m3u8'],
]);

/**
 * Radio-Canada (ICI Télé) regional stations in the Canada playlist.
 * Feed call-sign -> [city, region]. The flagship CBFT (Montréal) is the
 * main, clearly named variant; every other kept variant names its city
 * so viewers are not shown several identical "ICI Télé" cards.
 * CFHD-DT is deliberately absent: upstream labels it IciRadioCanadaTele
 * but its stream is a different service, so it keeps its raw name.
 */
const RADIO_CANADA_STATIONS = {
  CBAFTDT: ['Moncton', 'Canada'],
  CBFTDT: ['Montréal', 'Québec'],
  CBKFTDT: ['Regina', 'Canada'],
  CBLFTDT: ['Toronto', 'Canada'],
  CBOFTDT: ['Ottawa', 'Canada'],
  CBUFTDT: ['Vancouver', 'Canada'],
  CBVTDT: ['Québec', 'Québec'],
  CBWFTDT: ['Winnipeg', 'Canada'],
  CBXFTDT: ['Edmonton', 'Canada'],
  CJBRDT: ['Rimouski', 'Québec'],
  CKSHDT: ['Sherbrooke', 'Québec'],
  CKTMDT: ['Trois-Rivières', 'Québec'],
  CKTVDT: ['Saguenay', 'Québec'],
};

/** Category keys of the iptv-org database, rendered like the playlists' group-title. */
const CATEGORY_LABELS = {
  animation: 'Animation', auto: 'Auto', business: 'Business', classic: 'Classic',
  comedy: 'Comedy', cooking: 'Cooking', culture: 'Culture', documentary: 'Documentary',
  education: 'Education', entertainment: 'Entertainment', family: 'Family',
  general: 'General', kids: 'Kids', legislative: 'Legislative', lifestyle: 'Lifestyle',
  movies: 'Movies', music: 'Music', news: 'News', outdoor: 'Outdoor', relax: 'Relax',
  religious: 'Religious', science: 'Science', series: 'Series', shop: 'Shop',
  sports: 'Sports', travel: 'Travel', weather: 'Weather',
};

/** Fetch a text resource, or read it from a local override when set. */
async function readText(url, localPath) {
  if (localPath) return fs.readFileSync(localPath, 'utf8');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response.text();
}

/** Read a JSON resource, or a local override when set. */
async function readJson(url, localPath) {
  return JSON.parse(await readText(url, localPath));
}

/** Parse one M3U playlist into raw entries (EXTINF attributes + URL). */
function parsePlaylist(text) {
  const entries = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('#EXTINF')) {
      entries.push({ inf: line, url: null });
    } else if (line.startsWith('#') || !line) {
      continue; // #EXTVLCOPT and friends: header hints a web player cannot honour anyway.
    } else if (entries.length && entries[entries.length - 1].url === null) {
      entries[entries.length - 1].url = line;
    }
  }
  return entries;
}

/** Read one `key="value"` attribute from an EXTINF line. */
function attribute(inf, key) {
  const match = inf.match(new RegExp(`${key}="([^"]*)"`));
  return match ? match[1] : '';
}

/** Convert a CamelCase / dotted token into a kebab-case slug fragment. */
function slugPart(token) {
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Stable channel id from a tvg-id: drop the country suffix of the base
 * id ("IciRDI.ca" -> "ici-rdi") and append the feed when it identifies a
 * distinct variant ("IciRadioCanadaTele.ca@CBFTDT" ->
 * "ici-radio-canada-tele-cbftdt"); quality-only feeds (SD/HD…) are
 * dropped. Falls back to a slug of the cleaned name without a tvg-id.
 */
function makeId(tvgId, fallbackName) {
  if (!tvgId) return slugPart(fallbackName).slice(0, 80).replace(/-+$/g, '');
  const [rawBase, rawFeed] = tvgId.split('@');
  let base = rawBase;
  const dot = base.lastIndexOf('.');
  if (dot > 0 && base.length - dot - 1 === 2) base = base.slice(0, dot); // country code
  let id = slugPart(base);
  if (rawFeed && !GENERIC_FEEDS.has(rawFeed.toLowerCase())) {
    id = `${id}-${slugPart(rawFeed)}`;
  }
  return id.slice(0, 80).replace(/-+$/g, '');
}

/**
 * Clean a playlist display name: strip quality suffixes ("(720p)") and
 * the "[Geo-blocked]" / "[Not 24/7]" flags, reporting the flags so they
 * can be stored as data instead of display noise.
 */
function cleanName(rawName) {
  const geoBlocked = /geo-blocked/i.test(rawName);
  const not247 = /not 24\/7/i.test(rawName);
  const name = rawName
    .replace(/\[\s*(?:not 24\/7|geo-blocked)(?:\s*;\s*(?:not 24\/7|geo-blocked))*\s*\]/gi, '')
    .replace(/\(\d{3,4}p\)/gi, '')
    .replace(/\(1080i\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, geoBlocked, not247 };
}

/**
 * Comparison key for display names: case-, accent- and punctuation-
 * insensitive, so "NBC News NOW" and "NBC News Now" are the same card.
 * Parentheses are kept (they name a variant: "ICI Télé (Montréal)").
 */
function nameKey(name) {
  return name
    .replace(/\+/g, ' plus ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** True when the URL host is a bare IPv4/IPv6 address (no domain). */
function isBareIp(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

/** Best-effort spoken language for a Canada-playlist entry. */
function canadaLanguage(name, tvgId) {
  const haystack = `${name} ${tvgId}`;
  if (/télé|français|francais|radio-canada|\bici\b|rdi|\btva\b|noovo|savoir|unis tv|canal vie|canal d/i.test(haystack)) return 'fr';
  if (/[éèêà]/.test(name)) return 'fr';
  return 'en';
}

/** Build the viewer-facing description for an imported entry. */
function describe(name, region, category, language) {
  return language === 'fr'
    ? `En lecture directe dans Onde via le flux public répertorié par iptv-org (catégorie : ${category}).`
    : `Playing directly in Onde via the public stream listed by iptv-org (category: ${category}).`;
}

/** Build the flag note (geo-blocked / part-time), in the entry language. */
function flagNote(geoBlocked, not247, language) {
  const parts = [];
  if (geoBlocked) {
    parts.push(
      language === 'fr'
        ? "Flux marqué géo-bloqué dans l'annuaire iptv-org : lecture réservée aux régions autorisées par le diffuseur (limité)."
        : 'Stream flagged geo-blocked in the iptv-org directory: playback is limited to the regions the broadcaster allows.',
    );
  }
  if (not247) {
    parts.push(
      language === 'fr'
        ? "Chaîne marquée « Not 24/7 » dans l'annuaire iptv-org : diffusion à temps partiel."
        : 'Channel flagged "Not 24/7" in the iptv-org directory: part-time schedule.',
    );
  }
  return parts.join(' ');
}

/** True when a URL is a playable HLS stream (the Onde player is HLS-only). */
function isHls(url) {
  try {
    return new URL(url).pathname.includes('.m3u8');
  } catch {
    return false;
  }
}

/**
 * Stream preference: https + domain first, then https + bare IP, then
 * http + domain, then http + bare IP. Playlist streams win ties so the
 * generated data stays stable between runs.
 */
function streamRank(candidate, fromPlaylist) {
  const url = new URL(candidate);
  let rank = 0;
  if (url.protocol !== 'https:') rank += 2;
  if (isBareIp(url.hostname)) rank += 1;
  if (!fromPlaylist) rank += 0.5;
  return rank;
}

/** Choose the best stream of a channel feed, or null when none is HLS. */
function pickBestStream(candidates) {
  const playable = candidates.filter((candidate) => isHls(candidate.url));
  if (!playable.length) return null;
  return playable.slice().sort((a, b) => streamRank(a.url, a.fromPlaylist) - streamRank(b.url, b.fromPlaylist))[0];
}

/** Best logo of the iptv-org database, keyed by `channel` and `channel@feed`. */
function buildLogoIndex(logos) {
  const index = new Map();
  const weight = (logo) => (logo.in_use ? 2 : 0) + (logo.format === 'SVG' ? 0 : 1);
  for (const logo of logos) {
    if (!logo.channel || !logo.url || !logo.url.startsWith('https://')) continue;
    const keys = [logo.channel];
    if (logo.feed) keys.push(`${logo.channel}@${logo.feed}`);
    for (const key of keys) {
      const previous = index.get(key);
      if (!previous || weight(logo) > weight(previous)) index.set(key, logo);
    }
  }
  return index;
}

async function main() {
  // Base catalogue (never modified): accept both the phase-1 layout
  // (data/channels.json) and the split layout (data/channels/base.json).
  const splitBase = path.join(DATA_DIR, 'base.json');
  const legacyBase = path.join(ROOT, 'data', 'channels.json');
  const baseFile = fs.existsSync(splitBase) ? splitBase : legacyBase;
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));

  // Database exports: channel metadata, streams, logos.
  const databaseChannels = await readJson(CHANNELS_API_URL, process.env.IPTV_CHANNELS_API);
  const databaseStreams = await readJson(STREAMS_API_URL, process.env.IPTV_STREAMS_API);
  const databaseLogos = await readJson(LOGOS_API_URL, process.env.IPTV_LOGOS_API);

  const channelsById = new Map(databaseChannels.map((channel) => [channel.id, channel]));
  const logosByKey = buildLogoIndex(databaseLogos);
  const streamsByChannel = new Map();
  for (const stream of databaseStreams) {
    if (!stream.channel) continue;
    if (!streamsByChannel.has(stream.channel)) streamsByChannel.set(stream.channel, []);
    streamsByChannel.get(stream.channel).push(stream);
  }

  // Global de-duplication state, seeded from the base catalogue. A curated
  // entry with a playable source claims its display name: the generated
  // copy would only duplicate the same card.
  const seenIds = new Set(base.map((channel) => channel.id));
  const seenStreams = new Set(base.map((channel) => channel.stream).filter(Boolean));
  const seenTvgIds = new Set();
  const seenNames = new Set();
  const basePlayableNames = new Set(
    base
      .filter((channel) => channel.stream || channel.embed || channel.resolve)
      .map((channel) => nameKey(channel.name)),
  );

  const report = {};

  for (const country of COUNTRIES) {
    const playlistUrl = `${PLAYLIST_BASE}/${country.code}.m3u`;
    const text = await readText(playlistUrl, process.env.IPTV_PLAYLIST_DIR
      ? path.join(process.env.IPTV_PLAYLIST_DIR, `${country.code}.m3u`)
      : undefined);
    const rawEntries = parsePlaylist(text);
    const stats = {
      playlistEntries: rawEntries.length,
      databaseChannels: 0, databaseOnlyFeeds: 0,
      kept: 0, keptFromDatabase: 0,
      excludedNonHls: 0, excludedNsfw: 0, excludedClosed: 0,
      excludedBaseDuplicate: 0, excludedDuplicateName: 0,
      excludedDuplicateId: 0, excludedDuplicateTvgId: 0, excludedDuplicateStream: 0,
      keptGeoBlocked: 0, keptNot247: 0, keptWithoutLogo: 0, keptWithoutWebsite: 0,
      keptInsecure: 0, keptBareIp: 0, keptHttpsUpgrades: 0,
    };

    // One group per channel feed: playlist entry first, then every stream of
    // the matching database channels. Group key = full tvg-id.
    const groups = new Map();
    const groupFor = (key) => {
      if (!groups.has(key)) {
        groups.set(key, {
          key, tvgId: key, name: '', logo: '', group: '',
          geoBlocked: false, not247: false, fromPlaylist: false,
          databaseChannel: null, databaseFeed: null, candidates: [],
        });
      }
      return groups.get(key);
    };

    for (const raw of rawEntries) {
      const url = raw.url || '';
      if (!url) continue;
      const tvgId = attribute(raw.inf, 'tvg-id');
      const rawName = raw.inf.slice(raw.inf.lastIndexOf(',') + 1).trim();
      const { name, geoBlocked, not247 } = cleanName(rawName);
      const groupKey = tvgId || `name:${nameKey(name)}`;
      const group = groupFor(groupKey);
      group.tvgId = tvgId || group.tvgId;
      group.name = group.name || name;
      group.group = group.group || attribute(raw.inf, 'group-title');
      group.logo = group.logo || attribute(raw.inf, 'tvg-logo');
      group.geoBlocked = group.geoBlocked || geoBlocked;
      group.not247 = group.not247 || not247;
      group.fromPlaylist = true;
      const upgraded = HTTPS_STREAM_UPGRADES.get(tvgId);
      if (upgraded) stats.keptHttpsUpgrades++;
      group.candidates.push({ url: upgraded || url, fromPlaylist: true });
    }

    for (const channel of databaseChannels) {
      if (channel.country !== country.databaseCountry) continue;
      stats.databaseChannels++;
      const streams = streamsByChannel.get(channel.id) || [];
      if (!streams.length) continue;
      for (const stream of streams) {
        if (!stream.url) continue;
        const feed = stream.feed || 'SD';
        const tvgId = `${channel.id}@${feed}`;
        const group = groupFor(tvgId);
        group.tvgId = tvgId;
        group.databaseChannel = channel;
        group.databaseFeed = stream.feed || null;
        group.candidates.push({ url: stream.url, fromPlaylist: false });
      }
    }
    stats.databaseOnlyFeeds = [...groups.values()].filter((group) => !group.fromPlaylist).length;

    // Name of a database-only channel: the database name, with the feed in
    // brackets when the same channel has several playable feeds.
    const feedsPerChannel = new Map();
    for (const group of groups.values()) {
      if (!group.databaseChannel || !group.databaseFeed) continue;
      const list = feedsPerChannel.get(group.databaseChannel.id) || new Set();
      list.add(group.databaseFeed);
      feedsPerChannel.set(group.databaseChannel.id, list);
    }

    const channels = [];

    for (const group of groups.values()) {
      const best = pickBestStream(group.candidates);
      if (!best) { stats.excludedNonHls++; continue; }
      const record = group.databaseChannel || channelsById.get(group.tvgId.split('@')[0]);
      if (record?.closed) { stats.excludedClosed++; continue; }
      if (record?.is_nsfw) { stats.excludedNsfw++; continue; }

      const streamUrl = best.url;
      const parsed = new URL(streamUrl);
      const bareIp = isBareIp(parsed.hostname);

      // Region / name / language.
      let region = country.region;
      let displayName = group.name;
      if (!displayName) {
        displayName = record?.name || group.tvgId.split('.')[0];
        const feeds = group.databaseChannel ? feedsPerChannel.get(group.databaseChannel.id) : null;
        if (group.databaseFeed && feeds && feeds.size > 1 && !GENERIC_FEEDS.has(group.databaseFeed.toLowerCase())) {
          displayName = `${displayName} (${group.databaseFeed})`;
        }
        stats.keptFromDatabase++;
      }
      let language = country.code === 'ca' ? canadaLanguage(displayName, group.tvgId) : country.language;
      if (country.code === 'fr' && /english/i.test(displayName)) language = 'en';
      const rcMatch = group.tvgId.match(/^IciRadioCanadaTele\.ca@([A-Z]+)$/);
      if (rcMatch && RADIO_CANADA_STATIONS[rcMatch[1]]) {
        const [city, rcRegion] = RADIO_CANADA_STATIONS[rcMatch[1]];
        displayName = `ICI Télé (${city})`;
        region = rcRegion;
        language = 'fr';
      }
      if (group.tvgId.split('@')[0] === 'IciRDI.ca') language = 'fr';

      // De-duplication: curated playable card first, then id / tvg-id /
      // stream URL / display name across everything imported so far.
      const key = nameKey(displayName);
      if (basePlayableNames.has(key)) { stats.excludedBaseDuplicate++; continue; }
      const id = makeId(group.tvgId, displayName);
      if (seenTvgIds.has(group.tvgId)) { stats.excludedDuplicateTvgId++; continue; }
      if (seenIds.has(id)) { stats.excludedDuplicateId++; continue; }
      if (seenStreams.has(streamUrl)) { stats.excludedDuplicateStream++; continue; }
      if (seenNames.has(key)) { stats.excludedDuplicateName++; continue; }
      seenTvgIds.add(group.tvgId); seenIds.add(id); seenStreams.add(streamUrl); seenNames.add(key);

      const groupToken = group.group.split(';')[0].trim();
      const databaseCategory = record?.categories?.[0];
      const category = groupToken && groupToken !== 'Undefined'
        ? groupToken
        : (CATEGORY_LABELS[databaseCategory] || 'General');

      // Official site: database website for the channel, http upgraded to
      // https (the loader requires public HTTPS URLs).
      let official = record?.website ? record.website.replace(/^http:\/\//, 'https://') : '';
      if (!official.startsWith('https://')) {
        official = group.fromPlaylist ? playlistUrl : STREAMS_API_URL;
        stats.keptWithoutWebsite++;
      }

      const entry = {
        id,
        name: displayName,
        brand: displayName,
        region,
        category,
        color: IMPORT_COLOR,
        language,
        description: describe(displayName, region, category, language),
        official,
        guide: official,
        stream: streamUrl,
        directory: group.fromPlaylist ? playlistUrl : STREAMS_API_URL,
      };
      if (parsed.protocol !== 'https:') { entry.insecureStream = true; stats.keptInsecure++; }
      if (bareIp) stats.keptBareIp++;
      if (group.geoBlocked) { entry.limited = true; stats.keptGeoBlocked++; }
      if (group.not247) stats.keptNot247++;
      const note = flagNote(group.geoBlocked, group.not247, language);
      if (note) entry.note = note;

      const logo = (group.logo.startsWith('https://') && group.logo)
        || logosByKey.get(`${record?.id}@${group.databaseFeed}`)?.url
        || logosByKey.get(record?.id)?.url
        || '';
      if (logo) entry.logoUrl = logo;
      else stats.keptWithoutLogo++;
      entry.source = 'iptv-org';

      channels.push(entry);
      stats.kept++;
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    const outFile = path.join(DATA_DIR, `${country.code}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(channels, null, 2)}\n`);
    report[country.code] = { ...stats, file: `data/channels/${country.code}.json`, bytes: fs.statSync(outFile).size };
  }

  console.log(JSON.stringify({ base: base.length, report }, null, 2));
}

await main();
