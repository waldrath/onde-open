/**
 * Import the iptv-org catalogue (database + country playlists) into Onde's
 * JSON channel catalogue.
 *
 * Usage:
 *   node scripts/import-iptv-org.mjs
 * (Importing the module runs nothing: tests import its pure helpers.)
 *
 * Inputs (downloaded fresh, or read locally when the matching environment
 * variable points at a file / directory, which makes runs reproducible and
 * lets maintainers diff the report before committing):
 *   - Playlists: https://iptv-org.github.io/iptv/countries/<code>.m3u for
 *     every country of COUNTRIES (ca, fr, us, se, cm, be, ch, lu, sn, ci, cd, ht),
 *     and https://iptv-org.github.io/iptv/languages/fra.m3u for `monde`
 *     (French-language channels of every other country).
 *     Override with IPTV_PLAYLIST_DIR=<dir containing ca.m3u/fr.m3u/…/monde.m3u>.
 *   - Channel metadata: https://iptv-org.github.io/api/channels.json
 *     Override with IPTV_CHANNELS_API=<file path>.
 *   - Streams: https://iptv-org.github.io/api/streams.json
 *     Override with IPTV_STREAMS_API=<file path>.
 *   - Logos: https://iptv-org.github.io/api/logos.json
 *     Override with IPTV_LOGOS_API=<file path>.
 *   - Feeds (spoken languages): https://iptv-org.github.io/api/feeds.json
 *     Override with IPTV_FEEDS_API=<file path>.
 *
 * HLS detection: a stream URL is HLS when it contains `.m3u8`, but some
 * public lists serve HLS from an extensionless URL (`?mode=hls`, `/play/…`).
 * Those candidates are sniffed once per run (first bytes / content type);
 * set IPTV_PROBE_CACHE=<file> to persist the probe results, which keeps
 * runs reproducible and avoids re-probing dead hosts.
 *
 * Playability probe (on by default; IPTV_PLAYABILITY_PROBE=off skips it):
 * every candidate stream is requested the way the player requests it from
 * the deployed app (hls.js: a CORS GET with the app's Origin (ONDE_APP_ORIGIN),
 * redirects CORS-checked hop by hop), then its first variant playlist and
 * its latest segment. A candidate plays when every step answers with a
 * valid HLS body and an Access-Control-Allow-Origin that admits the app:
 * without CORS the browser withholds the response, so the stream can never
 * play through hls.js. Such a stream still plays in Safari (macOS, and every
 * iOS browser), whose native HLS player loads media without CORS: when the
 * rest of the probe passes (https, HLS playlists, reachable segment) the
 * candidate is "native only". The https form of every http candidate is
 * probed too and replaces it when it plays. Failing candidates are dropped,
 * native-only ones too when the channel has a candidate that plays
 * everywhere; a channel left with native-only candidates is written with
 * `nativeHlsOnly: true` (the UI offers it to native-HLS browsers only), and
 * a channel left without any candidate is not written. A 403 is read as
 * geo-blocking from the probing country (IPTV_PROBE_COUNTRY, default ca):
 * the channel is kept as `limited` when it is foreign; one of the probing
 * country is dropped, unless it is already in the catalogue. Timeouts,
 * unreachable hosts and 5xx answers are probed a second time before they
 * count. IPTV_PLAYABILITY_CACHE=<file> stores the verdicts, so a run can be
 * replayed without the network.
 *
 * Home checks: Onde's audience is in Canada, but the weekly GitHub Actions
 * refresh runs in the USA, where other streams answer (ICI RDI plays there
 * and answers 403 in Québec; US-only hosts refuse Canadian connections).
 * A run from Canada (IPTV_PROBE_COUNTRY=ca, the default) therefore writes
 * every verdict, dated, to data/geo-checks.json (committed). A run from
 * elsewhere reads the checks younger than IPTV_GEO_CHECK_MAX_AGE_DAYS
 * (default 60) and merges them with its own verdicts (see mergeHomeCheck):
 * a stream that fails from Canada never plays for a Canadian channel and
 * makes a foreign one `limited`; a stream that plays from Canada is not
 * dropped because it fails from the runner; and a card new to the
 * catalogue is held back until a source of it has a Canadian check. The
 * report lists held cards and stale checks; refresh the checks with a run
 * from Canada. Geo verdicts of the runner never shrink the catalogue
 * either: a card keeps `limited` once set, and a 403 from another country
 * never removes it.
 *
 * Report: the JSON report on stdout counts, per country, every exclusion
 * and the cards added/removed against the previous files;
 * IPTV_REPORT_MARKDOWN=<file> also writes it as a Markdown summary (the
 * refresh pull request body).
 *
 * Output: data/channels/<code>.json (one file per country), merged at
 * load time by lib/channels.ts with data/channels/base.json into ONE logical
 * catalogue. The base file is never modified here.
 *
 * Coverage: every active, non-NSFW channel of the iptv-org database whose
 * country is in COUNTRIES, plus every channel of the
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
 *   - streams the playability probe sees fail in a browser are excluded
 *     (see above), and so are channels left without any stream;
 *   - Belgium, Switzerland and Luxembourg keep French-speaking channels
 *     only; Senegal, Côte d'Ivoire, DR Congo and Haiti keep French- or
 *     English-speaking ones (no language data: French). Languages come
 *     from the database feeds (see cardLanguage);
 *   - one card per channel: every playlist entry and every database stream
 *     of the same channel (all its feeds) is a candidate, so the catalogue
 *     lists the channel once. The best stream is `stream` (probe verdict
 *     first: plays over HTTPS, then over http only, then 403; inside a
 *     verdict https before http, then bare-IP hosts before domain hosts); the other
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
 *     generated copy is skipped (base wins; a native-only curated entry only
 *     wins over a native-only import); a link-only base entry never
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
 *   region    the country's `region` in COUNTRIES; ICI Télé cards use "Québec";
 *   language  ca -> heuristic ("fr"/"en"), fr -> "fr", us -> "en",
 *             se -> "sv"; the other countries -> the feeds' languages
 *             through cardLanguage;
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
const FEEDS_API_URL = 'https://iptv-org.github.io/api/feeds.json';

/** Country playlists to import, in catalogue order. */
const COUNTRIES = [
  { code: 'ca', region: 'Canada', language: 'en', databaseCountry: 'CA' },
  { code: 'fr', region: 'France', language: 'fr', databaseCountry: 'FR' },
  { code: 'us', region: 'USA', language: 'en', databaseCountry: 'US' },
  { code: 'se', region: 'Suède', language: 'sv', databaseCountry: 'SE' },
  { code: 'cm', region: 'Cameroun', language: 'fr', databaseCountry: 'CM', languagePolicy: 'lenient' },
  { code: 'be', region: 'Belgique', language: 'fr', databaseCountry: 'BE', languagePolicy: 'french' },
  { code: 'ch', region: 'Suisse', language: 'fr', databaseCountry: 'CH', languagePolicy: 'french' },
  { code: 'lu', region: 'Luxembourg', language: 'fr', databaseCountry: 'LU', languagePolicy: 'french' },
  { code: 'sn', region: 'Sénégal', language: 'fr', databaseCountry: 'SN', languagePolicy: 'francophone' },
  { code: 'ci', region: "Côte d'Ivoire", language: 'fr', databaseCountry: 'CI', languagePolicy: 'francophone' },
  { code: 'cd', region: 'RD Congo', language: 'fr', databaseCountry: 'CD', languagePolicy: 'francophone' },
  { code: 'ht', region: 'Haïti', language: 'fr', databaseCountry: 'HT', languagePolicy: 'francophone' },
  // French-language channels of every other country: the iptv-org French
  // playlist plus the database channels with a French feed (see inWorldScope).
  // Last, so a country file above always wins a duplicate. Cards take their
  // country's region (worldRegion), International otherwise.
  { code: 'monde', region: 'International', language: 'fr', databaseCountry: null, languagePolicy: 'lenient', playlistUrl: 'https://iptv-org.github.io/iptv/languages/fra.m3u' },
];

/** Playlist of a COUNTRIES entry: its country list, or its own (French world). */
const playlistUrlOf = (country) => country.playlistUrl || `${PLAYLIST_BASE}/${country.code}.m3u`;

/** Database countries that have their own file above. */
const COVERED_COUNTRIES = new Set(COUNTRIES.map((country) => country.databaseCountry).filter(Boolean));

/** Catalogue region of a French-world card, by database country (ISO 3166-1). */
const WORLD_REGIONS = {
  MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie', MC: 'Monaco',
  TG: 'Togo', BJ: 'Bénin', CG: 'Congo', BF: 'Burkina Faso', GN: 'Guinée', NE: 'Niger', ML: 'Mali',
  RW: 'Rwanda', BI: 'Burundi', TD: 'Tchad', GA: 'Gabon', MG: 'Madagascar',
  GP: 'Outre-mer', MQ: 'Outre-mer', GF: 'Outre-mer', RE: 'Outre-mer', YT: 'Outre-mer', PF: 'Outre-mer',
  NC: 'Outre-mer', PM: 'Outre-mer', WF: 'Outre-mer', BL: 'Outre-mer', MF: 'Outre-mer',
};

export function worldRegion(countryCode) {
  return WORLD_REGIONS[countryCode] || 'International';
}

/** A database channel belongs to the French world: another country, a French feed. */
export function inWorldScope(countryCode, languages) {
  return !COVERED_COUNTRIES.has(countryCode) && languages.has('fr');
}

/**
 * Card language from the catalogue languages of a channel's feeds (a Set,
 * see FEED_LANGUAGES) under a country's `languagePolicy`: French first,
 * then English. 'lenient' never drops (default language otherwise),
 * 'francophone' defaults to French only without language data, 'french'
 * keeps French channels only. Null drops the channel.
 */
export function cardLanguage(policy, languages, fallback) {
  if (languages.has('fr')) return 'fr';
  if (policy === 'french') return null;
  if (languages.has('en')) return 'en';
  if (policy === 'lenient') return fallback;
  return languages.size ? null : fallback;
}

/** Database feed languages (ISO 639-3) the catalogue can label. */
const FEED_LANGUAGES = { fra: 'fr', fre: 'fr', eng: 'en', swe: 'sv' };

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
function flagNote(geoBlocked, not247, language, probedGeo = false) {
  const parts = [];
  if (geoBlocked) {
    parts.push(
      language === 'fr'
        ? "Flux marqué géo-bloqué dans l'annuaire iptv-org : lecture réservée aux régions autorisées par le diffuseur (limité)."
        : 'Stream flagged geo-blocked in the iptv-org directory: playback is limited to the regions the broadcaster allows.',
    );
  } else if (probedGeo) {
    parts.push(
      language === 'fr'
        ? 'Flux refusé (HTTP 403) hors de sa région lors de la vérification : lecture probablement réservée au pays du diffuseur (limité).'
        : "Stream refused (HTTP 403) from outside its region when checked: playback is probably limited to the broadcaster's country.",
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
 * Stream preference inside one probe verdict: https before http (an https
 * page cannot load http media by default), then bare-IP hosts before domain
 * hosts. The order is therefore https bare IP, https domain, http bare IP,
 * http domain. Playlist streams win ties so the generated data stays stable
 * between runs.
 */
function streamRank(candidate, fromPlaylist) {
  const url = new URL(candidate);
  let rank = 0;
  if (url.protocol !== 'https:') rank += 2;
  if (!isBareIp(url.hostname)) rank += 1;
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

/** The same stream URL over https. */
const httpsForm = (url) => url.replace(/^http:/, 'https:');

/**
 * Probe tier of a candidate, best first: 0 plays over HTTPS (or was not
 * probed), 1 plays over http only (the viewer must allow insecure content),
 * 2 answered 403 (geo-blocked from the probing country), 3 plays in native
 * HLS players only (no CORS). Null: it fails in a browser and is dropped.
 */
export function playabilityTier(url, verdict) {
  if (!verdict) return 0;
  if (verdict.ok) return url.startsWith('https:') ? 0 : 1;
  if (verdict.reason === 'geo') return 2;
  return verdict.native === true && url.startsWith('https:') ? 3 : null;
}

/**
 * Choose the best stream of a channel card and its variants, or null when
 * none is HLS. `playability(url)` returns the probe verdict (null when not
 * probed): an http candidate whose https form plays is upgraded, failing
 * candidates are dropped (their reasons are returned in `failures`), and
 * the rest is ordered by tier, then streamRank. Native-only candidates are
 * kept only when nothing better is left (`best.tier` 3: a native-only
 * card). `best` is null when no candidate plays. Variants are capped when
 * the card is written, so one slow or dead host never removes the channel.
 */
export function pickStreams(candidates, isHlsCandidate, playability) {
  const unique = new Map();
  for (const candidate of candidates) {
    if (isHlsCandidate(candidate.url) && isSupportedStreamHost(candidate.url) && !unique.has(candidate.url)) {
      unique.set(candidate.url, candidate);
    }
  }
  if (!unique.size) return null;
  const kept = new Map();
  const failures = [];
  let upgrades = 0;
  for (const candidate of unique.values()) {
    const secure = candidate.url.startsWith('http://') ? httpsForm(candidate.url) : null;
    if (secure && playability(secure)?.ok) {
      if (!unique.has(secure) && !kept.has(secure)) { kept.set(secure, { ...candidate, url: secure, tier: 0 }); upgrades++; }
      continue;
    }
    const verdict = playability(candidate.url);
    const tier = playabilityTier(candidate.url, verdict);
    if (tier === null) failures.push(verdict.reason);
    else kept.set(candidate.url, { ...candidate, tier, home: verdict?.home === true });
  }
  let ranked = [...kept.values()]
    .sort((a, b) => a.tier - b.tier || streamRank(a.url, a.fromPlaylist) - streamRank(b.url, b.fromPlaylist));
  if (ranked.length && ranked[0].tier < 3) {
    for (const candidate of ranked) if (candidate.tier === 3) failures.push('no-cors');
    ranked = ranked.filter((candidate) => candidate.tier < 3);
  }
  return { best: ranked[0] ?? null, alternates: ranked.slice(1), failures, upgrades };
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
async function probeUnknownHls(playlists, databaseStreams, channelsById, inWorld) {
  const scope = COVERED_COUNTRIES;
  const unknown = new Set();
  for (const text of playlists.values()) {
    for (const raw of parsePlaylist(text)) {
      if (raw.url && !isHls(raw.url)) unknown.add(raw.url);
    }
  }
  for (const stream of databaseStreams) {
    if (!stream.url || isHls(stream.url)) continue;
    const channel = channelsById.get(stream.channel);
    if (channel && (scope.has(channel.country) || inWorld(channel))) unknown.add(stream.url);
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

/** Origin of the deployed app (ONDE_APP_ORIGIN): streams are requested as its player requests them. */
const APP_ORIGIN = process.env.ONDE_APP_ORIGIN ?? 'http://localhost:3000';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const PLAYABILITY_PROBE = process.env.IPTV_PLAYABILITY_PROBE !== 'off';
const PLAYABILITY_CACHE_FILE = process.env.IPTV_PLAYABILITY_CACHE;
/** Country the probe runs from: its own channels answering 403 cannot play for its viewers. */
const PROBE_COUNTRY = (process.env.IPTV_PROBE_COUNTRY || 'ca').toLowerCase();
/** Country of Onde's audience: its runs write the home checks, others read them. */
const HOME_COUNTRY = 'ca';
const GEO_CHECKS_FILE = path.join(ROOT, 'data', 'geo-checks.json');
const GEO_CHECK_MAX_AGE_DAYS = Number(process.env.IPTV_GEO_CHECK_MAX_AGE_DAYS || 60);

/** A dated home check still usable at `now` (null when missing or stale). */
export function freshHomeCheck(check, now, maxAgeDays) {
  if (!check?.checkedAt) return null;
  const age = (now - Date.parse(`${check.checkedAt}T00:00:00Z`)) / 86400000;
  return age >= 0 && age <= maxAgeDays ? check : null;
}

/**
 * The verdict a run from another country uses for one stream, given its own
 * `run` verdict and the fresh home (Canadian) `check`, for a card of the
 * home country or not. Without a check the run's verdict stands, marked
 * `unchecked`. A stream that plays at home keeps playing even when the
 * runner cannot reach it. One that fails at home never plays for a home
 * card ('home-blocked': dropped) and is geo-blocked for a foreign card
 * that the runner can play (tier 2 marked `home`: `limited`, hidden for
 * Canadian viewers, while it plays in its own country).
 */
export function mergeHomeCheck(run, check, homeCard) {
  if (!check) return run ? { ...run, unchecked: true } : null;
  const plays = (verdict) => verdict?.ok === true || verdict?.native === true;
  if (plays(check)) {
    if (plays(run)) return run;
    return check.ok ? { ok: true } : { ok: false, reason: check.reason, native: true };
  }
  if (homeCard) return { ok: false, reason: 'home-blocked' };
  return plays(run) ? { ok: false, reason: 'geo', home: true } : run;
}
const PLAYABILITY_TIMEOUT_MS = 8000;
/** Polite load: concurrent streams overall, concurrent requests per host. */
const PLAYABILITY_CONCURRENCY = 24;
const PLAYABILITY_PER_HOST = 3;
/** Failures probed a second time: the host may only be slow or briefly down. */
const TRANSIENT_FAILURES = new Set(['timeout', 'unreachable', 'server-error']);
/** Reason reported for a channel left without a playing stream, most telling first. */
const FAILURE_PRIORITY = ['home-blocked', 'no-cors', 'mixed-content', 'not-hls', 'tls', 'gone', 'http-error', 'server-error', 'timeout', 'unreachable'];

const hostLoad = new Map();
/** Wait for a free request slot on `host`; resolves to its release function. */
async function hostSlot(host) {
  let entry = hostLoad.get(host);
  if (!entry) hostLoad.set(host, (entry = { active: 0, waiting: [] }));
  while (entry.active >= PLAYABILITY_PER_HOST) await new Promise((resolve) => entry.waiting.push(resolve));
  entry.active++;
  return () => { entry.active--; entry.waiting.shift()?.(); };
}

/** Verdict reason of a network failure. */
function networkFailure(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  return /CERT|SSL|TLS|UNABLE_TO_VERIFY|SELF_SIGNED/i.test(String(error?.cause?.code || error?.code || '')) ? 'tls' : 'unreachable';
}

/** Verdict reason of an HTTP status, or null when the answer is usable. */
function statusFailure(status) {
  if (status === 403 || status === 451) return 'geo';
  if (status === 404 || status === 410) return 'gone';
  if (status >= 500) return 'server-error';
  return status >= 200 && status < 300 ? null : 'http-error';
}

/**
 * One request as hls.js sends it from the app: CORS mode, no credentials.
 * Redirects are followed by hand because the browser CORS-checks every hop,
 * and a redirect to another origin turns the Origin into "null" (Fetch
 * standard). Reads a playlist whole, a segment's first bytes only. `cors`
 * is false when any hop withheld CORS: the chain is still followed, as a
 * native player (no CORS) would.
 */
async function browserRequest(url, { playlist, insecureSource }) {
  let current = url;
  let origin = APP_ORIGIN;
  let corsKept = true;
  for (let hop = 0; hop < 8; hop++) {
    const parsed = new URL(current);
    const release = await hostSlot(parsed.host);
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(PLAYABILITY_TIMEOUT_MS),
        headers: { Origin: origin, Referer: `${APP_ORIGIN}/`, 'User-Agent': BROWSER_USER_AGENT, Accept: '*/*' },
      });
      const allowOrigin = (response.headers.get('access-control-allow-origin') || '').trim();
      const cors = allowOrigin === '*' || allowOrigin === origin;
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => {});
        corsKept &&= cors;
        const next = new URL(location, current);
        if (next.protocol === 'http:' && !insecureSource) return { reason: 'mixed-content' };
        if (next.origin !== parsed.origin) origin = 'null';
        current = next.toString();
        continue;
      }
      const failure = statusFailure(response.status);
      if (failure) {
        await response.body?.cancel().catch(() => {});
        return { reason: failure };
      }
      const chunks = [];
      if (response.body) {
        const reader = response.body.getReader();
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          size += value.length;
          if (!playlist || size >= 1 << 20) break;
        }
        await reader.cancel().catch(() => {});
      }
      return { url: current, cors: cors && corsKept, text: playlist ? Buffer.concat(chunks).toString('utf8') : '' };
    } catch (error) {
      return { reason: networkFailure(error) };
    } finally {
      release();
    }
  }
  return { reason: 'unreachable' };
}

/** First URI line of a playlist (the latest one when `last`), resolved against its URL. */
function playlistUri(text, base, last) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const line = last ? lines[lines.length - 1] : lines[0];
  try {
    return line ? new URL(line, base).toString() : null;
  } catch {
    return null;
  }
}

/** One step of the probe: a usable answer (HLS body for playlists); `cors` tells whether hls.js may read it. */
async function probeStep(url, insecureSource, playlist) {
  if (url.startsWith('http:') && !insecureSource) return { reason: 'mixed-content' };
  const answer = await browserRequest(url, { playlist, insecureSource });
  if (answer.reason) return answer;
  if (playlist && !answer.text.trimStart().startsWith('#EXTM3U')) return { reason: 'not-hls' };
  return answer;
}

/**
 * Browser playability of one stream: the playlist, its first variant when it
 * is a master playlist, and the latest segment must all be readable from the
 * app. An http stream is judged as if the viewer allowed insecure content.
 * A stream whose only fault is CORS gets `{ reason: 'no-cors', native: true }`
 * when it is https (native HLS players need no CORS, but still block http).
 */
export async function probePlayback(url) {
  const insecure = url.startsWith('http:');
  const manifest = await probeStep(url, insecure, true);
  if (manifest.reason) return { ok: false, reason: manifest.reason };
  let media = manifest;
  if (/#EXT-X-STREAM-INF/.test(manifest.text)) {
    const variant = playlistUri(manifest.text, manifest.url, false);
    if (!variant) return { ok: false, reason: 'not-hls' };
    media = await probeStep(variant, insecure, true);
    if (media.reason) return { ok: false, reason: media.reason };
  }
  const segment = playlistUri(media.text, media.url, true);
  if (!segment) return { ok: false, reason: 'not-hls' };
  const answer = await probeStep(segment, insecure, false);
  if (answer.reason) return { ok: false, reason: answer.reason };
  if (manifest.cors && media.cors && answer.cors) return { ok: true };
  return insecure ? { ok: false, reason: 'no-cors' } : { ok: false, reason: 'no-cors', native: true };
}

/**
 * Verdicts for every URL: cached verdicts are reused, the others probed with
 * bounded concurrency, then this run's transient failures probed once more.
 */
async function probePlayability(urls) {
  const verdicts = new Map();
  if (PLAYABILITY_CACHE_FILE && fs.existsSync(PLAYABILITY_CACHE_FILE)) {
    for (const [url, verdict] of Object.entries(JSON.parse(fs.readFileSync(PLAYABILITY_CACHE_FILE, 'utf8')))) verdicts.set(url, verdict);
  }
  const checkedAt = new Date().toISOString().slice(0, 10);
  const run = async (queue) => {
    await Promise.all(Array.from({ length: Math.min(PLAYABILITY_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift();
        try {
          verdicts.set(url, { ...await probePlayback(url), checkedAt });
        } catch (error) {
          console.error(JSON.stringify({ probe: url, error: String(error) }));
          verdicts.set(url, { ok: false, reason: 'unreachable', checkedAt });
        }
      }
    }));
  };
  const fresh = [...urls].filter((url) => !verdicts.has(url));
  await run(fresh.slice());
  await run(fresh.filter((url) => TRANSIENT_FAILURES.has(verdicts.get(url).reason)));
  if (PLAYABILITY_CACHE_FILE) {
    const sorted = Object.fromEntries([...verdicts].sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(PLAYABILITY_CACHE_FILE, `${JSON.stringify(sorted, null, 1)}\n`);
  }
  return { verdicts, probed: fresh.length };
}

/**
 * Write the home checks: one dated verdict per probed stream, one line per
 * stream (sorted, so a refresh diffs well). Verdicts without a date (an old
 * IPTV_PLAYABILITY_CACHE) are left out.
 */
function writeHomeChecks(urls, verdicts) {
  const lines = [...urls].sort()
    .map((url) => [url, verdicts.get(url)])
    .filter(([, verdict]) => verdict?.checkedAt)
    .map(([url, { ok, reason, native, checkedAt }]) => `    ${JSON.stringify(url)}: ${JSON.stringify({ ok, reason, native, checkedAt })}`);
  fs.writeFileSync(GEO_CHECKS_FILE, [
    '{',
    `  "country": "${HOME_COUNTRY}",`,
    '  "about": "Playability of every iptv-org stream as probed from Canada by scripts/import-iptv-org.mjs. Runs from other countries (the weekly GitHub Actions refresh) merge it with their own verdicts. Refresh: run the importer from Canada (see data/README.md).",',
    '  "streams": {',
    lines.join(',\n'),
    '  }',
    '}',
    '',
  ].join('\n'));
  return lines.length;
}

/** The committed home checks (empty when the file does not exist yet). */
function readHomeChecks() {
  return fs.existsSync(GEO_CHECKS_FILE) ? JSON.parse(fs.readFileSync(GEO_CHECKS_FILE, 'utf8')).streams : {};
}

/** Ids of a generated file before this run (empty when it does not exist yet). */
function previousEntries(code) {
  const file = path.join(DATA_DIR, `${code}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/**
 * Markdown summary of a run (the refresh pull request body): one row per
 * country with its card count and the cards added/removed against the
 * previous files, then the ids, then the full JSON report folded away. A
 * pull request body holds 65,536 characters: id lists are cut after
 * MARKDOWN_IDS ids and a long JSON report is left to the workflow log.
 */
const MARKDOWN_IDS = 40;
const MARKDOWN_JSON_LIMIT = 20000;
export function reportMarkdown(summary) {
  const ids = (list) => list.length > MARKDOWN_IDS
    ? `${list.slice(0, MARKDOWN_IDS).join(', ')} … (+${list.length - MARKDOWN_IDS})`
    : list.join(', ');
  const rows = Object.entries(summary.report).map(([code, stats]) =>
    `| ${code} | ${stats.kept} | +${stats.added.length} | -${stats.removed.length} | ${stats.keptNativeOnly} | ${stats.excludedUnplayable} |`);
  const changes = Object.entries(summary.report).flatMap(([code, stats]) => [
    ...(stats.added.length ? [`- **${code}** added: ${ids(stats.added)}`] : []),
    ...(stats.removed.length ? [`- **${code}** removed: ${ids(stats.removed)}`] : []),
  ]);
  const held = Object.entries(summary.report)
    .filter(([, stats]) => stats.heldForHomeCheck?.length)
    .map(([code, stats]) => `- **${code}** held until checked from Canada: ${ids(stats.heldForHomeCheck)}`);
  const checks = summary.homeChecks;
  const homeLines = !checks || checks.mode !== 'read' ? [] : [
    `Canadian checks (data/geo-checks.json): ${checks.fresh} fresh, ${checks.stale} older than ${checks.maxAgeDays} days, oldest ${checks.oldest || 'none'}.`,
    ...(checks.stale || !checks.fresh || held.length
      ? ['**Refresh them**: run `node scripts/import-iptv-org.mjs` from Canada and commit data/geo-checks.json with the data (see data/README.md).']
      : []),
    ...held,
    '',
  ];
  const json = JSON.stringify(summary, null, 2);
  const details = json.length > MARKDOWN_JSON_LIMIT
    ? ['_Full importer report: see the workflow log._']
    : ['<details><summary>Full importer report</summary>', '', '```json', json, '```', '</details>'];
  return [
    '## iptv-org refresh',
    '',
    '| Country | Cards | Added | Removed | Native HLS only | Unplayable (dropped) |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    ...(changes.length ? changes : ['No card added or removed.']),
    '',
    ...homeLines,
    ...details,
    '',
  ].join('\n');
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
  const databaseFeeds = await readJson(FEEDS_API_URL, process.env.IPTV_FEEDS_API);

  const channelsById = new Map(databaseChannels.map((channel) => [channel.id, channel]));
  const logosByKey = buildLogoIndex(databaseLogos);
  const feedsByChannel = new Map();
  for (const feed of databaseFeeds) {
    if (!feedsByChannel.has(feed.channel)) feedsByChannel.set(feed.channel, []);
    feedsByChannel.get(feed.channel).push(feed);
  }
  // Languages of the channel's feeds: catalogue languages (FEED_LANGUAGES),
  // plus "other" for the rest, so a channel without data stays empty.
  const feedLanguages = (channelId) => new Set((feedsByChannel.get(channelId) || [])
    .flatMap((feed) => feed.languages || [])
    .map((code) => FEED_LANGUAGES[code] || 'other'));
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
  // A native-only curated entry (Safari) claims its name against native-only
  // imports, not against an import that plays in every browser.
  const basePlayableNames = new Set(
    base
      .filter((channel) => channel.stream || channel.embed || channel.resolve)
      .map((channel) => nameKey(channel.name)),
  );
  const baseEverywhereNames = new Set(
    base
      .filter((channel) => (channel.stream || channel.embed || channel.resolve) && !channel.nativeHlsOnly)
      .map((channel) => nameKey(channel.name)),
  );

  const report = {};
  // The previous generated files: geo verdicts never shrink them (see header).
  const previous = new Map(COUNTRIES.map((country) => [country.code, previousEntries(country.code)]));
  const previousCards = new Map([...previous].map(([code, entries]) => [code, new Map(entries.map((entry) => [entry.id, entry]))]));

  // Playlists are read once, then every candidate that is not HLS by its
  // extension is sniffed: some lists serve HLS from an extensionless URL.
  const playlists = new Map();
  for (const country of COUNTRIES) {
    playlists.set(country.code, await readText(playlistUrlOf(country), process.env.IPTV_PLAYLIST_DIR
      ? path.join(process.env.IPTV_PLAYLIST_DIR, `${country.code}.m3u`)
      : undefined));
  }
  const inWorld = (channel) => inWorldScope(channel.country, feedLanguages(channel.id));
  const contentHls = await probeUnknownHls(playlists, databaseStreams, channelsById, inWorld);
  const isHlsCandidate = (url) => isHls(url) || contentHls.found.has(url);

  // Every country's cards are grouped first, so the playability probe can
  // run once over all their candidates before any file is written.
  const prepared = [];
  for (const country of COUNTRIES) {
    const playlistUrl = playlistUrlOf(country);
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
      excludedUnplayable: 0, unplayableReasons: {}, keptProbeGeoBlocked: 0,
      keptProbeHttpsUpgrades: 0, droppedFailingVariants: 0, excludedLanguage: 0,
      keptNativeOnly: 0, keptGeoFromPrevious: 0, heldForHomeCheck: [], excludedOtherFile: 0,
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
      if (country.databaseCountry ? channel.country !== country.databaseCountry : !inWorld(channel)) continue;
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
    prepared.push({ country, playlistUrl, stats, groups });
  }

  // Browser playability of every candidate of the open, non-NSFW cards
  // (and of the https form of each http candidate).
  const recordOf = (group) => group.databaseChannel || channelsById.get(group.tvgId.split('@')[0]);
  const probeUrls = new Set();
  if (PLAYABILITY_PROBE) {
    for (const { groups } of prepared) {
      for (const group of groups.values()) {
        const record = recordOf(group);
        if (record?.closed || record?.is_nsfw) continue;
        for (const { url } of group.candidates) {
          if (!isHlsCandidate(url) || !isSupportedStreamHost(url)) continue;
          probeUrls.add(url);
          if (url.startsWith('http://')) probeUrls.add(httpsForm(url));
        }
      }
    }
  }
  const playability = PLAYABILITY_PROBE ? await probePlayability(probeUrls) : null;
  const verdictOf = (url) => playability?.verdicts.get(url) ?? null;
  // Home checks: written by a run from Canada, merged into a run from elsewhere.
  const readChecks = PROBE_COUNTRY !== HOME_COUNTRY;
  const homeChecks = readChecks ? readHomeChecks() : {};
  const now = Date.now();
  const homeCheckOf = (url) => freshHomeCheck(homeChecks[url], now, GEO_CHECK_MAX_AGE_DAYS);
  const verdictFor = (homeCard) => (readChecks ? (url) => mergeHomeCheck(verdictOf(url), homeCheckOf(url), homeCard) : verdictOf);
  const checkDates = Object.values(homeChecks).map((check) => check.checkedAt).filter(Boolean).sort();
  const homeCheckSummary = readChecks
    ? {
      mode: 'read', file: 'data/geo-checks.json', maxAgeDays: GEO_CHECK_MAX_AGE_DAYS,
      fresh: Object.values(homeChecks).filter((check) => freshHomeCheck(check, now, GEO_CHECK_MAX_AGE_DAYS)).length,
      stale: Object.values(homeChecks).filter((check) => !freshHomeCheck(check, now, GEO_CHECK_MAX_AGE_DAYS)).length,
      oldest: checkDates[0] ?? null,
    }
    : { mode: PLAYABILITY_PROBE ? 'write' : 'off', file: 'data/geo-checks.json', written: PLAYABILITY_PROBE ? writeHomeChecks(probeUrls, playability.verdicts) : 0 };

  // Two passes over the countries: cards that play in every browser claim
  // names, ids, tvg-ids and streams first (pass 0), native-only cards come
  // after (pass 1), so a Safari-only card never displaces a card of a later
  // country that plays everywhere. Each file keeps its group order.
  const picks = new Map();
  const emitted = new Map(prepared.map(({ country }) => [country.code, []]));
  for (const [pass, { country, playlistUrl, stats, groups }] of [0, 1].flatMap((pass) => prepared.map((item) => [pass, item]))) {
    const channels = emitted.get(country.code);

    for (const [order, group] of [...groups.values()].entries()) {
      if (!picks.has(group)) picks.set(group, pickStreams(group.candidates, isHlsCandidate, verdictFor(country.code === HOME_COUNTRY)));
      const picked = picks.get(group);
      if ((picked?.best?.tier === 3) !== (pass === 1)) continue;
      if (!picked) { stats.excludedNonHls++; continue; }
      const record = recordOf(group);
      if (record?.closed) { stats.excludedClosed++; continue; }
      if (record?.is_nsfw) { stats.excludedNsfw++; continue; }
      const unplayable = (reason) => {
        stats.excludedUnplayable++;
        stats.unplayableReasons[reason] = (stats.unplayableReasons[reason] || 0) + 1;
      };
      // No candidate plays in a browser: the card cannot play.
      if (!picked.best) { unplayable(FAILURE_PRIORITY.find((item) => picked.failures.includes(item)) || 'unreachable'); continue; }
      const best = picked.best;

      const streamUrl = best.url;
      const parsed = new URL(streamUrl);
      const bareIp = isBareIp(parsed.hostname);

      // The French playlist also lists channels of the countries above: their own file carries them.
      if (!country.databaseCountry && record && COVERED_COUNTRIES.has(record.country)) { stats.excludedOtherFile++; continue; }
      // Region / name / language.
      let region = country.databaseCountry ? country.region : worldRegion(record?.country);
      let displayName = group.name || record?.name || group.tvgId.split('.')[0];
      if (!group.name) stats.keptFromDatabase++;
      let language = country.code === 'ca' ? canadaLanguage(displayName, group.tvgId) : country.language;
      if (country.languagePolicy) {
        language = cardLanguage(country.languagePolicy, feedLanguages(record?.id ?? group.tvgId.split('@')[0]), country.language);
        if (!language) { stats.excludedLanguage++; continue; }
      }
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
      // A 403 is geo-blocking from the probing country: one of its own
      // channels cannot play for its viewers, unless it is already in its
      // country file (another run's country may see it play). A card that was
      // `limited` stays so: this run may not see the restriction.
      const before = previousCards.get(country.code).get(id);
      // (A 403 seen from Canada only, `home`, is not one: the runner plays it.)
      if (best.tier === 2 && !best.home && country.code === PROBE_COUNTRY && (!before || PROBE_COUNTRY === HOME_COUNTRY)) { unplayable('geo'); continue; }
      // A new card needs a source checked from Canada (see mergeHomeCheck).
      if (readChecks && PLAYABILITY_PROBE && !before && ![best, ...picked.alternates].some((candidate) => homeCheckOf(candidate.url))) {
        stats.heldForHomeCheck.push(id);
        continue;
      }
      const probedGeo = best.tier === 2 || (before?.limited === true && !group.geoBlocked);
      if ((best.tier === 3 ? basePlayableNames : baseEverywhereNames).has(key)) { stats.excludedBaseDuplicate++; continue; }
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
      else if (probedGeo) { entry.limited = true; if (best.tier === 2) stats.keptProbeGeoBlocked++; else stats.keptGeoFromPrevious++; }
      if (best.tier === 3) { entry.nativeHlsOnly = true; stats.keptNativeOnly++; }
      stats.keptProbeHttpsUpgrades += picked.upgrades;
      stats.droppedFailingVariants += picked.failures.length;
      if (group.not247) stats.keptNot247++;
      const note = flagNote(group.geoBlocked, group.not247, language, probedGeo);
      if (note) entry.note = note;

      const logo = (group.logo.startsWith('https://') && group.logo)
        || logosByKey.get(record?.id)?.url
        || '';
      if (logo) entry.logoUrl = logo;
      else stats.keptWithoutLogo++;
      entry.source = 'iptv-org';

      channels.push({ order, entry });
      stats.kept++;
    }
  }

  for (const { country, stats } of prepared) {
    const channels = emitted.get(country.code).sort((a, b) => a.order - b.order).map((item) => item.entry);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const outFile = path.join(DATA_DIR, `${country.code}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(channels, null, 2)}\n`);
    const ids = new Set(channels.map((channel) => channel.id));
    const previousIds = new Set(previous.get(country.code).map((channel) => channel.id));
    report[country.code] = {
      ...stats,
      added: [...ids].filter((id) => !previousIds.has(id)),
      removed: [...previousIds].filter((id) => !ids.has(id)),
      file: `data/channels/${country.code}.json`, bytes: fs.statSync(outFile).size,
    };
  }

  const summary = {
    base: base.length,
    probe: { candidates: contentHls.candidates, hlsByContent: contentHls.found.size },
    homeChecks: homeCheckSummary,
    playability: playability
      ? {
        country: PROBE_COUNTRY, urls: probeUrls.size, probedThisRun: playability.probed,
        playing: [...probeUrls].filter((url) => verdictOf(url)?.ok).length,
        nativeOnly: [...probeUrls].filter((url) => verdictOf(url)?.native).length,
      }
      : 'off',
    report,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.IPTV_REPORT_MARKDOWN) fs.writeFileSync(process.env.IPTV_REPORT_MARKDOWN, reportMarkdown(summary));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
