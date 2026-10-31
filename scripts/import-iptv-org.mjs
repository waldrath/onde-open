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
 *   - Playlists: https://iptv-org.github.io/iptv/countries/{ca,fr,us,se}.m3u
 *     Override with IPTV_PLAYLIST_DIR=<dir containing ca.m3u/fr.m3u/…>.
 *   - Channel metadata: https://iptv-org.github.io/api/channels.json
 *     Override with IPTV_CHANNELS_API=<file path>.
 *   - Streams: https://iptv-org.github.io/api/streams.json
 *     Override with IPTV_STREAMS_API=<file path>.
 *   - Logos: https://iptv-org.github.io/api/logos.json
 *     Override with IPTV_LOGOS_API=<file path>.
 *
 * HLS detection: a stream URL is HLS when it contains `.m3u8`, but some
 * public lists serve HLS from an extensionless URL (`?mode=hls`, `/play/…`).
 * Those candidates are sniffed once per run (first bytes / content type);
 * set IPTV_PROBE_CACHE=<file> to persist the probe results, which keeps
 * runs reproducible and avoids re-probing dead hosts.
 *
 * Output: data/channels/{ca,fr,us}.json (one file per country), merged at
 * load time by lib/channels.ts with data/channels/base.json into ONE logical
 * catalogue. The base file is never modified here.
 *
 * Coverage: every active, non-NSFW channel of the iptv-org database whose
 * country is Canada, France, the USA or Sweden, plus every channel of the
 * matching country playlist (playlists also list foreign feeds available in
 * that country). A channel is kept only when it can actually play inside
 * Onde:
 *   - NSFW channels are excluded;
 *   - closed/defunct channels are excluded;
 *   - streams that are not HLS (DASH/.mpd, FLV, …) are excluded, unless the
 *     content sniffing above identifies them as HLS — the Onde player is
 *     HLS-only;
 *   - hosts a browser cannot reach publicly are excluded: localhost, private
 *     address ranges and IPv6 literals;
 *   - one card per channel: every playlist entry and every database stream
 *     of the same channel (all its feeds) is a candidate, so the catalogue
 *     lists the channel once. The best stream is `stream` (bare-IP hosts
 *     before domain hosts; https before http inside each family); the other
 *     playable candidates (up to 8, same order) are `streamAlts`, labelled
 *     with their feed, which the player lists in its source selector and
 *     retries automatically when the primary host stops answering.
 *
 * Any plain http:// stream is flagged `insecureStream: true` (browsers block
 * it by default on the HTTPS app; the player explains the Chrome setting
 * that unblocks it, and that Safari/iOS has no equivalent). A `streamAlts`
 * fallback can be http without the flag: the player marks that source
 * itself.
 *
 * De-duplication, in order:
 *   - against `base.json` by normalized display name — when the curated
 *     entry already has a playable source (stream/embed/resolve) the
 *     generated copy is skipped (base wins); a link-only base entry never
 *     blocks a playable import;
 *   - across the generated files and against the base catalogue by generated
 *     id, channel tvg-id, stream URL and normalized display name.
 *
 * HTTPS_STREAM_UPGRADES lists playlist streams that also answer over HTTPS
 * on the same host and path; those URLs are rewritten to their https form.
 *
 * Field mapping (schema: see data/README.md):
 *   id        stable slug from the tvg-id (see makeId);
 *   name      playlist name cleaned of "(720p)"-style quality suffixes and
 *             "[Geo-blocked]" / "[Not 24/7]" flags (the flags are kept as
 *             data: geo-blocked -> `limited: true`, both are explained in
 *             `note`); database-only channels use the database name; the
 *             Radio-Canada stations share one "ICI Télé" card, each station
 *             being a variant (see variantLabel);
 *   logoUrl   the playlist's tvg-logo, or the database logo, copied verbatim
 *             (never invented);
 *   category  first `group-title` token ("Undefined"/empty -> "General");
 *             database-only channels use the first database category;
 *   region    ca -> "Canada", fr -> "France", us -> "USA", se -> "Suède";
 *             ICI Télé cards use "Québec";
 *   language  ca -> "en", fr -> "fr", us -> "en", se -> "sv";
 *   official/guide
 *             the broadcaster website from the iptv-org database for the
 *             channel's tvg-id (http upgraded to https);
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
  { code: 'se', region: 'Suède', language: 'sv', databaseCountry: 'SE' },
];

/** Feed suffixes that carry no identity (quality only) — dropped from ids. */
const GENERIC_FEEDS = new Set(['sd', 'hd', 'uhd', 'fhd', '4k', '720p', '1080p']);

/** Accent colour used for iptv-org-sourced entries. */
const IMPORT_COLOR = '#6b8c92';

/**
 * Playlist streams listed over http that also answer over HTTPS on the same
 * host and path (HTTP 200): keyed by full tvg-id, valued by the https URL.
 * Re-verify before extending the map.
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
 * Stream preference: bare-IP hosts first, then domain hosts; https before
 * http inside each family. The order is therefore https bare IP, http bare
 * IP, https domain, http domain. Playlist streams win ties so the generated
 * data stays stable between runs.
 */
function streamRank(candidate, fromPlaylist) {
  const url = new URL(candidate);
  let rank = 0;
  if (!isBareIp(url.hostname)) rank += 2;
  if (url.protocol !== 'https:') rank += 1;
  if (!fromPlaylist) rank += 0.5;
  return rank;
}

/** Maximum number of variant streams stored per channel card. */
const MAX_STREAM_VARIANTS = 8;

/** Label shown in the player's source selector for one variant stream. */
function variantLabel(feed, baseTvgId) {
  const station = baseTvgId === 'IciRadioCanadaTele.ca' ? RADIO_CANADA_STATIONS[feed] : null;
  if (station) return station[0];
  return feed || 'Autre source';
}

/** Hosts the catalogue never serves: local names, private ranges, IPv6. */
const isSupportedStreamHost = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('.')
      && !hostname.includes(':')
      && !['localhost', 'localhost.localdomain'].includes(hostname)
      && !/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
  } catch {
    return false;
  }
};

/**
 * Choose the best stream of a channel card and its variants, or null when
 * none is HLS. Variants keep the same preference order (bare-IP first) and
 * are capped when the card is written, so one slow or dead host never
 * removes the channel.
 */
function pickStreams(candidates, isHlsCandidate) {
  const unique = new Map();
  for (const candidate of candidates) {
    if (isHlsCandidate(candidate.url) && isSupportedStreamHost(candidate.url) && !unique.has(candidate.url)) {
      unique.set(candidate.url, candidate);
    }
  }
  const playable = [...unique.values()];
  if (!playable.length) return null;
  const ranked = playable
    .slice()
    .sort((a, b) => streamRank(a.url, a.fromPlaylist) - streamRank(b.url, b.fromPlaylist));
  return { best: ranked[0], alternates: ranked.slice(1) };
}

/** Max time spent sniffing one extensionless stream for an HLS playlist. */
const HLS_PROBE_TIMEOUT_MS = 6000;

/** Optional JSON cache of probe results, so runs stay reproducible offline. */
const PROBE_CACHE_FILE = process.env.IPTV_PROBE_CACHE;
const probeCache = new Map();
if (PROBE_CACHE_FILE && fs.existsSync(PROBE_CACHE_FILE)) {
  for (const [url, value] of Object.entries(JSON.parse(fs.readFileSync(PROBE_CACHE_FILE, 'utf8')))) {
    probeCache.set(url, value === true);
  }
}

/**
 * Some lists serve HLS from a URL without `.m3u8` (`?mode=hls`, `/play/…`,
 * `/0.ts`). For those candidates the first bytes decide: an `#EXTM3U`
 * header or an `application/vnd.apple.mpegurl` content type means HLS.
 * Results are memoized per run (and cached on disk when IPTV_PROBE_CACHE
 * points at a file), so a dead host is not re-probed on every group.
 */
async function probeHls(url) {
  if (probeCache.has(url)) return probeCache.get(url);
  let hls = false;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(HLS_PROBE_TIMEOUT_MS),
      headers: { Range: 'bytes=0-4095' },
      redirect: 'follow',
    });
    const type = response.headers.get('content-type') || '';
    let head = '';
    const reader = response.body?.getReader();
    if (reader) {
      const chunk = await reader.read();
      head = chunk.value ? Buffer.from(chunk.value).toString('utf8', 0, 512) : '';
      await reader.cancel().catch(() => {});
    }
    hls = head.startsWith('#EXTM3U') || /mpegurl/i.test(type);
  } catch {
    hls = false;
  }
  probeCache.set(url, hls);
  return hls;
}

/** Probe every candidate that is not HLS by extension, once, concurrently. */
async function probeUnknownHls(playlists, databaseStreams, channelsById) {
  const scope = new Set(COUNTRIES.map((country) => country.databaseCountry));
  const unknown = new Set();
  for (const text of playlists.values()) {
    for (const raw of parsePlaylist(text)) {
      if (raw.url && !isHls(raw.url)) unknown.add(raw.url);
    }
  }
  for (const stream of databaseStreams) {
    if (!stream.url || isHls(stream.url)) continue;
    const channel = channelsById.get(stream.channel);
    if (channel && scope.has(channel.country)) unknown.add(stream.url);
  }
  const found = new Set();
  const queue = [...unknown];
  await Promise.all(
    Array.from({ length: Math.min(8, queue.length || 1) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        if (await probeHls(url)) found.add(url);
      }
    }),
  );
  if (PROBE_CACHE_FILE) {
    fs.writeFileSync(PROBE_CACHE_FILE, `${JSON.stringify(Object.fromEntries(probeCache), null, 2)}\n`);
  }
  return { found, candidates: unknown.size };
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
  // Base catalogue (never modified): the split layout under data/channels/.
  const base = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'base.json'), 'utf8'));

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
  const seenAlternateUrls = new Set();
  const seenTvgIds = new Set();
  const seenNames = new Set();
  const basePlayableNames = new Set(
    base
      .filter((channel) => channel.stream || channel.embed || channel.resolve)
      .map((channel) => nameKey(channel.name)),
  );

  const report = {};

  // Playlists are read once, then every candidate that is not HLS by its
  // extension is sniffed: some lists serve HLS from an extensionless URL.
  const playlists = new Map();
  for (const country of COUNTRIES) {
    const playlistUrl = `${PLAYLIST_BASE}/${country.code}.m3u`;
    playlists.set(country.code, await readText(playlistUrl, process.env.IPTV_PLAYLIST_DIR
      ? path.join(process.env.IPTV_PLAYLIST_DIR, `${country.code}.m3u`)
      : undefined));
  }
  const contentHls = await probeUnknownHls(playlists, databaseStreams, channelsById);
  const isHlsCandidate = (url) => isHls(url) || contentHls.found.has(url);

  for (const country of COUNTRIES) {
    const playlistUrl = `${PLAYLIST_BASE}/${country.code}.m3u`;
    const text = playlists.get(country.code);
    const rawEntries = parsePlaylist(text);
    const stats = {
      playlistEntries: rawEntries.length,
      databaseChannels: 0, databaseOnlyFeeds: 0,
      kept: 0, keptFromDatabase: 0,
      excludedNonHls: 0, excludedNsfw: 0, excludedClosed: 0,
      excludedBaseDuplicate: 0, excludedDuplicateName: 0,
      excludedDuplicateId: 0, excludedDuplicateTvgId: 0, excludedDuplicateStream: 0,
      keptGeoBlocked: 0, keptNot247: 0, keptWithoutLogo: 0, keptWithoutWebsite: 0,
      keptInsecure: 0, keptBareIp: 0, keptHttpsUpgrades: 0, keptAlternates: 0, keptProbedHls: 0,
    };

    // One card per channel (tvg-id without its feed): every playlist entry
    // and every database stream of that channel is a candidate, so several
    // variants share one card and the player picks the one that works.
    const groups = new Map();
    const groupFor = (key) => {
      if (!groups.has(key)) {
        groups.set(key, {
          key, tvgId: key, name: '', logo: '', group: '',
          geoBlocked: false, not247: false, fromPlaylist: false,
          databaseChannel: null, candidates: [],
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
      const groupKey = tvgId ? tvgId.split('@')[0] : `name:${nameKey(name)}`;
      const group = groupFor(groupKey);
      group.name = group.name || name;
      group.group = group.group || attribute(raw.inf, 'group-title');
      group.logo = group.logo || attribute(raw.inf, 'tvg-logo');
      group.geoBlocked = group.geoBlocked || geoBlocked;
      group.not247 = group.not247 || not247;
      group.fromPlaylist = true;
      const upgraded = HTTPS_STREAM_UPGRADES.get(tvgId);
      if (upgraded) stats.keptHttpsUpgrades++;
      group.candidates.push({ url: upgraded || url, fromPlaylist: true, label: tvgId.split('@')[1] || name });
    }

    for (const channel of databaseChannels) {
      if (channel.country !== country.databaseCountry) continue;
      stats.databaseChannels++;
      const streams = streamsByChannel.get(channel.id) || [];
      if (!streams.length) continue;
      for (const stream of streams) {
        if (!stream.url) continue;
        const group = groupFor(channel.id);
        group.databaseChannel = group.databaseChannel || channel;
        group.candidates.push({ url: stream.url, fromPlaylist: false, label: stream.feed || 'SD' });
      }
    }
    stats.databaseOnlyFeeds = [...groups.values()].filter((group) => !group.fromPlaylist).length;

    const channels = [];

    for (const group of groups.values()) {
      const picked = pickStreams(group.candidates, isHlsCandidate);
      if (!picked) { stats.excludedNonHls++; continue; }
      const best = picked.best;
      const record = group.databaseChannel || channelsById.get(group.tvgId.split('@')[0]);
      if (record?.closed) { stats.excludedClosed++; continue; }
      if (record?.is_nsfw) { stats.excludedNsfw++; continue; }

      const streamUrl = best.url;
      const parsed = new URL(streamUrl);
      const bareIp = isBareIp(parsed.hostname);

      // Region / name / language.
      let region = country.region;
      let displayName = group.name || record?.name || group.tvgId.split('.')[0];
      if (!group.name) stats.keptFromDatabase++;
      let language = country.code === 'ca' ? canadaLanguage(displayName, group.tvgId) : country.language;
      if (country.code === 'fr' && /english/i.test(displayName)) language = 'en';
      // One card for every ICI Télé station: the station is a variant of the
      // card (its city is the label), not a separate channel.
      if (group.tvgId === 'IciRadioCanadaTele.ca') {
        displayName = 'ICI Télé';
        region = 'Québec';
        language = 'fr';
      }
      if (group.tvgId === 'IciRDI.ca') language = 'fr';

      // De-duplication: curated playable card first, then tvg-id / id /
      // stream URL / display name. Variants of a channel share one card
      // (see streamAlts), so a channel is never listed twice.
      const id = makeId(group.tvgId, displayName);
      const key = nameKey(displayName);
      if (basePlayableNames.has(key)) { stats.excludedBaseDuplicate++; continue; }
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
      // Variants of the same channel, as labelled fallbacks: the player lists
      // them in its source selector and switches automatically to the first
      // one that plays (see defaultSources in lib/playback.ts).
      const alternates = picked.alternates
        .filter((candidate) => candidate.url !== streamUrl && !seenStreams.has(candidate.url) && !seenAlternateUrls.has(candidate.url))
        .map((candidate) => ({ url: candidate.url, label: variantLabel(candidate.label, group.tvgId) }))
        .slice(0, MAX_STREAM_VARIANTS);
      // Two relays of the same feed would both read "SD": add the host to the
      // label so the player's selector stays readable.
      const usedLabels = new Set();
      for (const alternate of alternates) {
        let label = alternate.label;
        if (usedLabels.has(label)) label = `${label} · ${new URL(alternate.url).hostname}`;
        if (label.length > 40) label = `${label.slice(0, 39)}…`;
        usedLabels.add(label);
        alternate.label = label;
      }
      if (alternates.length) {
        entry.streamAlts = alternates;
        for (const alternate of alternates) seenAlternateUrls.add(alternate.url);
        stats.keptAlternates += alternates.length;
      }
      if (contentHls.found.has(streamUrl) || alternates.some((alternate) => contentHls.found.has(alternate.url))) {
        stats.keptProbedHls++;
      }
      if (parsed.protocol !== 'https:') { entry.insecureStream = true; stats.keptInsecure++; }
      if (bareIp) stats.keptBareIp++;
      if (group.geoBlocked) { entry.limited = true; stats.keptGeoBlocked++; }
      if (group.not247) stats.keptNot247++;
      const note = flagNote(group.geoBlocked, group.not247, language);
      if (note) entry.note = note;

      const logo = (group.logo.startsWith('https://') && group.logo)
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

  console.log(JSON.stringify({
    base: base.length,
    probe: { candidates: contentHls.candidates, hlsByContent: contentHls.found.size },
    report,
  }, null, 2));
}

await main();
