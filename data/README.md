# Channel catalogue data

The JSON files in `channels/` form **one logical catalogue** — the single
source of truth for Onde's base channels — split by origin so each file
stays reviewable and one of them is machine-generated:

| File | Contents | How to change it |
| --- | --- | --- |
| `channels/base.json` | The hand-curated catalogue (507 channels migrated from the former TypeScript lists in phase 1: `core`, `additional`, `expanded` sources). | Edit by hand, following the schema and rules below. |
| `channels/ca.json` | Channels imported from the iptv-org database and Canada playlist. | **Generated** — run `node scripts/import-iptv-org.mjs`; never edit by hand. |
| `channels/fr.json` | Channels imported from the iptv-org database and France playlist. | Generated, same script. |
| `channels/us.json` | Channels imported from the iptv-org database and USA playlist. | Generated, same script. |

`lib/channels.ts` loads the four files in that order, validates every
entry, deduplicates by id and builds the lookup indexes — at runtime
there is exactly one catalogue, and every existing import keeps working.
Catalogue entries stored in Postgres (Neon) are merged on top of this
base list at runtime by `lib/catalogue-store.ts`, unchanged.

## Importing the iptv-org catalogue

`scripts/import-iptv-org.mjs` combines the iptv-org country playlists
(`https://iptv-org.github.io/iptv/countries/{ca,fr,us}.m3u`) with the
iptv-org database exports (`api/channels.json`, `api/streams.json`,
`api/logos.json`) and regenerates `channels/{ca,fr,us}.json`. It prints a
per-country report with every exclusion counted.

Owner decision (2026-10-29): the generated files list **every active
channel** of the iptv-org database whose country is Canada, France or the
USA, plus every channel of the matching country playlist (the playlists
also list foreign feeds available in that country). A channel is kept only
when it can actually play inside Onde:

- NSFW channels and closed/defunct channels are excluded;
- non-HLS streams (no `.m3u8`: DASH, FLV, … — the player is HLS-only) are
  excluded;
- one stream is picked per channel feed (https + domain first, then https
  bare IP, then http domain, then http bare IP), so the same feed is never
  listed twice.

Bare-IP hosts and third-party relays of premium channels are no longer
filtered out: those streams are publicly listed by iptv-org and the owner
asked for full country coverage. Any plain `http://` stream — domain-hosted
or bare IP, relay or not — is **kept** with `insecureStream: true`.
Browsers block http streams on the HTTPS app by default, so the player
shows an explanation panel (in French) with the Chrome setting that allows
insecure content for the site, and a retry button; once the viewer has
allowed it, playback works normally. Safari/iOS has no such setting — those
channels cannot play there, and the panel says so. Two Canada entries
listed over http (Montreal Greek TV, Pamir TV) were verified to answer over
HTTPS on the same host and path; the script's `HTTPS_STREAM_UPGRADES` map
rewrites exactly those two stream URLs to their verified https form, so
they carry no flag.

De-duplication, in order: against `base.json` by normalized display name —
a curated entry that already has a stream/embed/resolve wins and the
generated copy is skipped (a link-only base entry never blocks a playable
import) — then by generated id, full tvg-id, stream URL and normalized
display name across the three generated files and the base catalogue. There
is therefore no duplicate card: the same channel feed appears once, and a
channel already playable in `base.json` is not repeated by the imports.

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

## Entry schema

One JSON object per channel, in display order within each file:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique across all files, `^[a-z0-9][a-z0-9-]{0,79}$`. Stable: user favourites and lists reference it. |
| `name` | yes | Display name. |
| `brand` | yes | Short text logo fallback, `\n` for line breaks. |
| `region` | yes | `Québec`, `Canada`, `France`, `USA` or `International`. |
| `category` | yes | Free-form, e.g. `Actualités`, `Découvertes`. |
| `color` | yes | Accent colour, `#rrggbb`. |
| `language` | no | `fr` (default), `en` or `zxx` (no speech). |
| `description` | yes | One or two sentences, in the channel's language. |
| `official` | yes | Official broadcaster page (HTTPS). |
| `guide` | yes | Official schedule page (HTTPS); may equal `official`. |
| `stream` | no | Direct HLS URL, only when the broadcaster publishes a free one. |
| `insecureStream` | no | `true` when `stream` is plain http — any iptv-org import whose best stream is http, bare IP included. Browsers block it by default; the player explains the browser setting that unblocks it. |
| `embed` | no | Official embeddable player URL. |
| `resolve` | no | One of `telequebec`, `cpac`, `france24`, `youtube`, `tfo`, `public-senat`. |
| `youtube` | no | Official YouTube live page, when `resolve` is `youtube`. |
| `directory` | no | Listing the stream was found in (provenance). |
| `limited` | no | `true` when playback may be geo-restricted. |
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
  iptv-org publicly lists for Canada, France and the USA (including
  third-party relays), by owner decision, and are regenerated, never
  hand-edited.
- **Logo URLs are never synthesized.** `logoUrl` values in `base.json` were
  merged from the former `lib/channel-logos.ts` map, sourced from
  iptv-org/database (`data/channels.csv` + `data/logos.csv`, commit
  `d3815495`). The database metadata is public domain; artwork and
  trademarks remain their owners'. Imported entries use the playlist's
  own `tvg-logo` or the database logo, copied verbatim. Only add a
  `logoUrl` when it was explicitly matched to that channel in such a
  source. When `logoUrl` is absent, omit the field entirely — the UI falls
  back to the text `brand`.
- **Ids are unique.** The loader deduplicates defensively (first wins),
  but the data itself must stay duplicate-free; `tests/channels.test.mjs`
  enforces this together with the required-field, URL, stream
  (HTTPS, or http only when flagged `insecureStream`) and
  paid-channel rules above.
- **Validation is hand-rolled and dependency-free** (the project has no
  schema-validation dependency): see `validateChannel` in
  `lib/channels.ts`.
