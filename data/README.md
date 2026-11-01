# Channel catalogue data

The JSON files in `channels/` form **one logical catalogue** — the single
source of truth for Onde's base channels — split by origin so each file
stays reviewable and one of them is machine-generated:

| File | Contents | How to change it |
| --- | --- | --- |
| `channels/base.json` | The hand-curated catalogue (477 channels, `core` / `additional` / `expanded` sources). | Edit by hand, following the schema and rules below. |
| `channels/ca.json` | Channels imported from the iptv-org database and Canada playlist. | **Generated** — run `node scripts/import-iptv-org.mjs`; never edit by hand. |
| `channels/fr.json` | Channels imported from the iptv-org database and France playlist. | Generated, same script. |
| `channels/us.json` | Channels imported from the iptv-org database and USA playlist. | Generated, same script. |
| `channels/se.json` | Swedish channels imported from the iptv-org database and Sweden playlist (`region: Suède`, `language: sv`). | Generated, same script. |
| `channels/cm.json` | Cameroonian channels imported from the iptv-org database and Cameroon playlist (`region: Cameroun`, `language` from the database feeds: `fr` or `en`). | Generated, same script. |
| `channels/{be,ch,lu}.json` | French-speaking channels of Belgium, Switzerland and Luxembourg (`region: Belgique` / `Suisse` / `Luxembourg`, `language: fr`; channels whose feeds do not speak French are skipped). | Generated, same script. |
| `channels/{sn,ci,cd,ht}.json` | Channels of Senegal, Côte d'Ivoire, DR Congo and Haiti (`region: Sénégal` / `Côte d'Ivoire` / `RD Congo` / `Haïti`; `language` `fr`, or `en` when the feeds speak English only, `fr` without language data; other languages are skipped). | Generated, same script. |
| `geo-checks.json` | Playability of every iptv-org stream **as seen from Canada**, one dated verdict per stream URL (see "Canadian checks" below). Not loaded by the app. | **Generated** by a run of the importer from Canada; commit it with the data. |

`lib/channels.ts` loads `base.json`, then the country files in the order
`ca, fr, us, se, cm, be, ch, lu, sn, ci, cd, ht`, validates every
entry, deduplicates by id and builds the lookup indexes — at runtime
there is exactly one catalogue, and every existing import keeps working.
Catalogue entries stored in Postgres (Neon) are merged on top of this
base list at runtime by `lib/catalogue-store.ts`, unchanged.

## Importing the iptv-org catalogue

`scripts/import-iptv-org.mjs` combines the iptv-org country playlists
(`https://iptv-org.github.io/iptv/countries/<code>.m3u`, one per country
file above) with the
iptv-org database exports (`api/channels.json`, `api/streams.json`,
`api/logos.json`, `api/feeds.json`) and regenerates every country file. It prints a
per-country report with every exclusion counted and the cards added and
removed against the previous files (`IPTV_REPORT_MARKDOWN=<file>` also
writes it as Markdown).

The generated files list **every active channel** of the iptv-org database
whose country has a file above, plus every channel of
the matching country playlist (the playlists also list foreign feeds
available in that country). A channel is kept only
when it can actually play inside Onde:

- NSFW channels and closed/defunct channels are excluded;
- non-HLS streams (no `.m3u8`: DASH, FLV, … — the player is HLS-only) are
  excluded, except when the content says otherwise: a candidate whose URL
  has no `.m3u8` is sniffed once (first bytes `#EXTM3U` or an
  `application/vnd.apple.mpegurl` content type), so HLS served from an
  extensionless URL is kept like any other stream (set
  `IPTV_PROBE_CACHE=<file>` to make those probes reproducible);
- every candidate stream is **probed the way the player loads it** from
  the app origin set in `ONDE_APP_ORIGIN` (hls.js: a CORS request with that Origin,
  each redirect CORS-checked, then the first variant playlist and the
  latest segment). A candidate that fails — dead host, 404, invalid TLS,
  not HLS, http media inside an https stream — is dropped, and a channel
  left without a playing candidate is not written. A candidate without an
  `Access-Control-Allow-Origin` admitting the app (every Pluto TV relay on
  `jmp2.uk`, for example) can never play through hls.js (Chrome, Firefox,
  Edge…), but Safari's native HLS player (macOS, every iOS browser) loads
  media without CORS: when the rest of the probe passes over https, it is
  **native only**. Native-only candidates are dropped when the channel has
  a candidate that plays everywhere; a channel left with native-only
  candidates is kept with `nativeHlsOnly: true` (the UI offers it to
  native-HLS browsers only). An http candidate whose https form plays is
  upgraded to it. A 403 counts as geo-blocking from the probing country
  (`IPTV_PROBE_COUNTRY`, default `ca`): a foreign channel that only answers
  403 is kept with `limited: true` (hidden for viewers of other countries,
  see `lib/geo.ts`); one of the probing country is dropped (from another
  country than Canada, only when it is not already in the catalogue). A
  card that was `limited` stays `limited` on later runs (a run from another
  country may not see the restriction), so the runner's geo verdicts never
  remove a card nor clear its flag. Runs from outside Canada also use the
  Canadian checks (below).
  Timeouts, unreachable hosts and 5xx are probed twice before they count.
  `IPTV_PLAYABILITY_CACHE=<file>` stores the verdicts (replayable runs);
  `IPTV_PLAYABILITY_PROBE=off` skips the probe (not for committed data);
- Belgium, Switzerland and Luxembourg keep French-speaking channels only;
  Senegal, Côte d'Ivoire, DR Congo and Haiti keep French- or
  English-speaking ones (French without language data), Cameroon keeps
  every channel (French without French/English data). Languages are the
  database feeds' (`api/feeds.json`);
- one card per channel: every playlist entry and
  database stream of the channel (all its feeds) is merged into a single
  card. The best stream is `stream` (probe verdict first: plays over
  HTTPS, then plays over http only, then 403; inside a verdict https before
  http, then bare IP before domain hosts), and the other playable candidates
  (up to 8), labelled with their feed, are `streamAlts`: the player lists
  them in its source selector and switches automatically to the first one
  that plays. A channel is therefore never listed twice, and a dead host
  never removes it.

Bare-IP hosts and third-party relays of premium channels are kept: those
streams are publicly listed by iptv-org. Any plain `http://` stream —
domain-hosted
or bare IP, relay or not — is **kept** with `insecureStream: true`.
Browsers block http streams on the HTTPS app by default, so the player
shows an explanation panel (in French) with the Chrome setting that allows
insecure content for the site, and a retry button; once the viewer has
allowed it, playback works normally. Safari/iOS has no such setting — those
channels cannot play there, and the panel says so. Two Canada entries
listed over http (Montreal Greek TV, Pamir TV) answer over HTTPS on the
same host and path; the script's `HTTPS_STREAM_UPGRADES` map rewrites those
two stream URLs to their https form, so they carry no flag.

De-duplication, in order: against `base.json` by normalized display name —
a curated entry that already has a stream/embed/resolve wins and the
generated copy is skipped (a link-only base entry never blocks a playable
import) — then by generated id, channel tvg-id, stream URL and normalized
display name across the generated files and the base catalogue. There
is therefore no duplicate card: the same channel appears once, and a
channel already playable in `base.json` is not repeated by the imports. A
second feed of the same channel is not a duplicate: it becomes a variant of
the card (see the coverage rules above).

Imported entries carry `source: "iptv-org"`, the playlist URL in
`directory` (the streams export URL for database-only channels), the
playlist's `tvg-logo` or the database logo verbatim in `logoUrl`, the first
`group-title` token as `category` (`Undefined`/empty becomes `General`; the
first database category for database-only channels), and `limited: true`
plus an explanatory `note` when the playlist flags them `[Geo-blocked]`
(the `[Not 24/7]` flag is likewise moved into the note; both flags are
stripped from display names, as are `(720p)`-style quality suffixes). Region is `Canada` / `France` / `USA` by playlist —
the one exception is Radio-Canada: its Québec ICI Télé stations
(Montréal flagship first-class, Québec, Rimouski, Sherbrooke,
Trois-Rivières, Saguenay) use region `Québec`, every regional variant is
named with its city (e.g. `ICI Télé (Montréal)`), and all of them are
geo-blocked to Canada, i.e. playable in Onde from Canada only. They
coexist with the curated `ici-tele` entry in `base.json`, which stays
official-link-only (ICI TOU.TV) as before.

## Weekly refresh (GitHub Actions)

`.github/workflows/refresh-catalogue.yml` runs the importer every Monday
(and on demand from the Actions tab), then `npm test`, and opens or
updates the pull request `catalogue/iptv-org-refresh` with the regenerated
files; its body is the importer's Markdown report (cards added/removed
per country, held cards, state of the Canadian checks). It never pushes to
`main` (which deploys to production): review the removals, then merge.
The repository setting "Allow GitHub Actions to create and approve pull
requests" must be on.

### Canadian checks (`geo-checks.json`)

Onde's viewers are mostly in Canada, but the runner is in the USA
(`IPTV_PROBE_COUNTRY=us`), where other streams play: ICI RDI answers 200
there and 403 in Québec, and several US-only hosts (Getpublica, Ottera…)
refuse Canadian connections. A US verdict alone would add cards that always
fail in Canada. So:

- a run **from Canada** (`IPTV_PROBE_COUNTRY=ca`, the default) writes every
  verdict, dated (`checkedAt`), to `data/geo-checks.json`;
- a run **from elsewhere** reads the checks younger than
  `IPTV_GEO_CHECK_MAX_AGE_DAYS` (default 60) and merges them per stream
  (`mergeHomeCheck`): a stream that fails from Canada never plays for a
  Canadian card (`home-blocked`, dropped) and makes a foreign card
  `limited` (hidden for Canadian viewers); a stream that plays from Canada
  stays even if the runner cannot reach it; and a card **new** to the
  catalogue is held back until one of its sources has a Canadian check.
  The pull request lists the held cards and warns when checks are stale
  or missing.

To refresh the checks (at least every 60 days, and whenever the pull
request lists held cards), from Québec:

```sh
node scripts/import-iptv-org.mjs
```

then commit `data/geo-checks.json` together with the regenerated
`data/channels/*.json` (about 15 minutes; the network load is bounded).

## Entry schema

One JSON object per channel, in display order within each file:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique across all files, `^[a-z0-9][a-z0-9-]{0,79}$`. Stable: user favourites and lists reference it. |
| `name` | yes | Display name. |
| `brand` | yes | Short text logo fallback, `\n` for line breaks. |
| `region` | yes | `Québec`, `Canada`, `France`, `USA`, `Suède`, `Cameroun`, `Belgique`, `Suisse`, `Luxembourg`, `Sénégal`, `Côte d'Ivoire`, `RD Congo`, `Haïti` or `International`. |
| `category` | yes | Free-form, e.g. `Actualités`, `Découvertes`. |
| `color` | yes | Accent colour, `#rrggbb`. |
| `language` | no | `fr` (default), `en`, `sv` or `zxx` (no speech). |
| `description` | yes | One or two sentences, in the channel's language. |
| `official` | yes | Official broadcaster page (HTTPS). |
| `guide` | yes | Official schedule page (HTTPS); may equal `official`. |
| `stream` | no | Direct HLS URL, only when the broadcaster publishes a free one. |
| `streamAlts` | no | Variant streams of the same channel (other feeds/relays), max 8: `{ "url": "...", "label": "HD" }`. Tried in order when `stream` fails, and listed in the player's source selector. May be plain http. |
| `insecureStream` | no | `true` when `stream` is plain http — any iptv-org import whose best stream is http, bare IP included. Describes `stream` only; a `streamAlts` fallback can be http without it. Browsers block it by default; the player explains the browser setting that unblocks it. |
| `nativeHlsOnly` | no | `true` when the channel's sources play only in a native HLS player (Safari on macOS, every iOS browser): they answer HLS over HTTPS without CORS, so hls.js cannot read them. Requires an https `stream` (no `insecureStream`). The UI offers these channels to native-HLS browsers only. |
| `embed` | no | Official embeddable player URL. |
| `resolve` | no | One of `telequebec`, `cpac`, `france24`, `youtube`, `tfo`, `public-senat`. |
| `youtube` | no | Official YouTube live page, when `resolve` is `youtube`. |
| `directory` | no | Listing the stream was found in (provenance). |
| `limited` | no | `true` when playback may be geo-restricted. |
| `premium` | no | `true` for a paid channel. Official-link-only entries count as premium without the flag (they link to the broadcaster's subscription), which feeds the app's "Chaînes premium" filter. |
| `note` | no | Viewer-facing note shown with the channel. |
| `logoUrl` | no | Logo image URL — see provenance rules below. |
| `source` | yes | Provenance: `core`, `additional` or `expanded` (legacy lists, in `base.json`) or `iptv-org` (generated country files). New hand-curated entries use `core`. |

An entry with none of `stream` / `embed` / `resolve` is an
**official-link-only** entry: the UI shows it with a "Site officiel" tag and
links out instead of playing it in Onde. This is the correct pattern for
paid channels (for example `ici-tele`). Note the asymmetry by design:
hand-curated entries may be link-only, while iptv-org imports are only
kept when they are directly playable — a generated file must never add
cards that cannot play.

## Rules

- **Hand-curated entries never invent a source.** Never invent a
  stream/embed URL: a hand-written entry may attach a playable source only
  when it is a free, official source that has actually been verified. The
  generated country files are an exception by design — they mirror what
  iptv-org publicly lists for the countries above (including
  third-party relays), and are regenerated, never
  hand-edited.
- **Logo URLs are never synthesized.** A `logoUrl` is stored only when it
  was explicitly matched to that channel in iptv-org/database
  (`data/channels.csv` + `data/logos.csv`); the database metadata is public
  domain, while artwork and trademarks remain their owners'. Imported
  entries use the playlist's own `tvg-logo` or the database logo, copied
  verbatim. When `logoUrl` is absent, omit the field entirely — the UI falls
  back to the text `brand`.
- **Ids are unique.** The loader deduplicates defensively (first wins),
  but the data itself must stay duplicate-free; `tests/channels.test.mjs`
  enforces this together with the required-field, URL, stream
  (HTTPS, or http only when flagged `insecureStream`; `streamAlts` may be
  http) and paid-channel rules above.
- **Validation is hand-rolled and dependency-free** (the project has no
  schema-validation dependency): see `validateChannel` in
  `lib/channels.ts`.
