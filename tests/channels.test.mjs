import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Data-level checks for the JSON channel catalogue (the files under
// data/channels/, the single logical catalogue loaded by
// lib/channels.ts). These tests read the JSON directly so they run
// under plain `node --test`, like the other suites, without a bundler
// resolving the JSON imports.
// Generated country files, in the order lib/channels.ts loads them.
const COUNTRY_FILES = ['ca', 'fr', 'us', 'se', 'cm', 'be', 'ch', 'lu', 'sn', 'ci', 'cd', 'ht'];
const CATALOGUE_FILES = ['data/channels/base.json', ...COUNTRY_FILES.map((code) => `data/channels/${code}.json`)];
const channels = CATALOGUE_FILES.flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const imported = channels.filter((channel) => channel.source === 'iptv-org');

const REQUIRED = ['id', 'name', 'brand', 'region', 'category', 'color', 'description', 'official', 'guide'];
const REGIONS = ['Québec', 'Canada', 'France', 'USA', 'Suède', 'Cameroun', 'Belgique', 'Suisse', 'Luxembourg', 'Sénégal', "Côte d'Ivoire", 'RD Congo', 'Haïti', 'International'];
const RESOLVERS = ['telequebec', 'cpac', 'france24', 'youtube', 'tfo', 'public-senat'];
const PLAYLISTS = COUNTRY_FILES.map((code) => `https://iptv-org.github.io/iptv/countries/${code}.m3u`);
// Provenance of an imported stream: a country playlist or the streams
// export of the iptv-org database (database-only channels).
const SOURCES = [...PLAYLISTS, 'https://iptv-org.github.io/api/streams.json'];
// Paid channels that must stay official-link-only: no playable source may
// ever be attached to them (no pirated or unofficial streams).
const OFFICIAL_LINK_ONLY = ['ici-tele'];

test('catalogue is a non-empty array with unique, well-formed ids', () => {
  assert.ok(Array.isArray(channels) && channels.length > 0);
  const ids = channels.map((channel) => channel.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate channel ids');
  for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]{0,79}$/);
});

test('every channel has the required fields and valid metadata', () => {
  for (const channel of channels) {
    for (const field of REQUIRED) {
      assert.equal(typeof channel[field], 'string', `${channel.id}: ${field}`);
      assert.ok(channel[field].trim(), `${channel.id}: ${field} is empty`);
    }
    assert.ok(REGIONS.includes(channel.region), `${channel.id}: region`);
    assert.match(channel.color, /^#[0-9a-f]{6}$/i, `${channel.id}: color`);
    if (channel.language) assert.ok(['fr', 'en', 'sv', 'zxx'].includes(channel.language), `${channel.id}: language`);
    if (channel.premium !== undefined) assert.equal(typeof channel.premium, 'boolean', `${channel.id}: premium`);
    if (channel.resolve) assert.ok(RESOLVERS.includes(channel.resolve), `${channel.id}: resolve`);
    if (channel.source) assert.ok(['core', 'additional', 'expanded', 'iptv-org'].includes(channel.source), `${channel.id}: source`);
  }
});

test('all URLs are public HTTPS, except flagged insecure streams', () => {
  for (const channel of channels) {
    for (const field of ['official', 'guide', 'stream', 'embed', 'youtube', 'directory', 'logoUrl']) {
      const value = channel[field];
      if (value === undefined) continue;
      const url = new URL(value);
      // Sole exception: an http `stream` explicitly flagged
      // `insecureStream` (any iptv-org import whose best stream is http).
      // An http URL anywhere else — or an http stream without the flag —
      // fails.
      const flaggedInsecureStream = field === 'stream' && channel.insecureStream === true;
      assert.equal(url.protocol, flaggedInsecureStream ? 'http:' : 'https:', `${channel.id}: ${field}`);
      assert.ok(!url.username && !url.password, `${channel.id}: ${field}`);
    }
    // The flag itself is only ever valid on an http stream.
    if (channel.insecureStream !== undefined) {
      assert.equal(channel.insecureStream, true, `${channel.id}: insecureStream must be true when present`);
      assert.ok(channel.stream?.startsWith('http://'), `${channel.id}: insecureStream requires an http stream`);
    }
  }
});

test('one card per channel: variants are labelled public HTTP(S) HLS URLs', () => {
  let withVariants = 0;
  for (const channel of channels) {
    if (channel.streamAlts === undefined) continue;
    withVariants++;
    const alternates = channel.streamAlts;
    assert.ok(Array.isArray(alternates), `${channel.id}: streamAlts must be an array`);
    assert.ok(alternates.length > 0 && alternates.length <= 8, `${channel.id}: 1..8 variants`);
    assert.ok(channel.stream, `${channel.id}: variants require a primary stream`);
    assert.equal(
      new Set(alternates.map((alternate) => alternate.url)).size,
      alternates.length,
      `${channel.id}: duplicate variant URLs`,
    );
    for (const alternate of alternates) {
      assert.equal(typeof alternate.url, 'string', `${channel.id}: variant url`);
      assert.notEqual(alternate.url, channel.stream, `${channel.id}: variant duplicates the primary`);
      if (alternate.label !== undefined) {
        assert.equal(typeof alternate.label, 'string', `${channel.id}: variant label`);
        assert.ok(alternate.label.trim() && alternate.label.length <= 40, `${channel.id}: variant label length`);
      }
      const url = new URL(alternate.url);
      assert.ok(['https:', 'http:'].includes(url.protocol), `${channel.id}: variant protocol`);
      assert.ok(!url.username && !url.password, `${channel.id}: variant credentials`);
      const host = url.hostname;
      assert.ok(!['localhost', 'localhost.localdomain'].includes(host), `${channel.id}: variant local host`);
      assert.ok(!host.includes(':'), `${channel.id}: variant IPv6 host`);
      assert.ok(
        !/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host),
        `${channel.id}: variant private host`,
      );
    }
  }
  assert.ok(withVariants > 0, 'expected imported channels with variant streams');
});

test('insecure streams are explicit iptv-org imports, never local', () => {
  const insecure = channels.filter((channel) => channel.insecureStream === true);
  assert.ok(insecure.length > 0, 'expected the kept http imports');
  for (const channel of insecure) {
    assert.equal(channel.source, 'iptv-org', `${channel.id}: only imports may be insecure`);
    assert.ok(channel.stream?.startsWith('http://'), `${channel.id}: insecureStream requires an http stream`);
    const host = new URL(channel.stream).hostname;
    assert.ok(!['localhost', 'localhost.localdomain'].includes(host), `${channel.id}: local host`);
    assert.ok(
      !/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host),
      `${channel.id}: private host`,
    );
  }
});

test('no stream is served from a local or private host', () => {
  for (const channel of channels) {
    if (!channel.stream) continue;
    const host = new URL(channel.stream).hostname;
    assert.ok(!['localhost', 'localhost.localdomain'].includes(host), `${channel.id}: local host`);
    assert.ok(!host.includes(':'), `${channel.id}: IPv6 host`);
    assert.ok(
      !/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host),
      `${channel.id}: private host`,
    );
  }
});

test('iptv-org imports are playable HLS streams with a known provenance', () => {
  assert.ok(imported.length > 0, 'expected iptv-org imported channels');
  const streams = imported.map((channel) => channel.stream);
  assert.equal(new Set(streams).size, streams.length, 'duplicate imported stream URLs');
  for (const channel of imported) {
    assert.ok(channel.stream, `${channel.id}: imported entries must be playable (stream required)`);
    // HLS is confirmed by content for URLs without `.m3u8` (the importer
    // sniffs those candidates), so the extension is not a reliable rule.
    assert.ok(channel.stream.startsWith('http'), `${channel.id}: stream URL`);
    assert.ok(SOURCES.includes(channel.directory), `${channel.id}: unknown provenance`);
    assert.ok(REGIONS.includes(channel.region), `${channel.id}: imported region`);
    assert.equal(channel.embed, undefined, `${channel.id}: imports never carry embeds`);
    assert.equal(channel.resolve, undefined, `${channel.id}: imports never carry resolvers`);
  }
});

test('Radio-Canada imports coexist with the curated ici-tele entry', () => {
  // ICI RDI is imported only while its official stream plays from Canada
  // (the importer's playability probe); when present it is French and HTTPS.
  const rdi = channels.find((channel) => channel.id === 'ici-rdi');
  if (rdi) {
    assert.ok(rdi.stream?.startsWith('https://'), 'ici-rdi must use its official HLS stream');
    assert.equal(rdi.language, 'fr', 'ici-rdi is French');
  }
  const tele = channels.find((channel) => channel.id === 'ici-radio-canada-tele');
  assert.ok(tele, 'the ICI Télé import is missing from the catalogue');
  assert.equal(tele.name, 'ICI Télé', 'one card for every ICI Télé station');
  assert.equal(tele.limited, true, 'ICI Télé variants are geo-blocked (Canada only)');
  const labels = (tele.streamAlts ?? []).map((alternate) => alternate.label);
  assert.ok(labels.includes('Montréal'), 'the Montréal station is a variant of the single card');
});

test('Cameroon imports are French or English cards of the Cameroun region', () => {
  const cameroon = JSON.parse(fs.readFileSync('data/channels/cm.json', 'utf8'));
  assert.ok(cameroon.length > 0, 'expected Cameroonian channels');
  for (const channel of cameroon) {
    assert.equal(channel.region, 'Cameroun', `${channel.id}: region`);
    assert.ok(['fr', 'en'].includes(channel.language), `${channel.id}: language`);
    assert.ok(
      ['https://iptv-org.github.io/iptv/countries/cm.m3u', 'https://iptv-org.github.io/api/streams.json'].includes(channel.directory),
      `${channel.id}: provenance`,
    );
  }
});

test('francophone country files carry their region and a French (or English) language', () => {
  const expected = {
    be: ['Belgique', ['fr']], ch: ['Suisse', ['fr']], lu: ['Luxembourg', ['fr']],
    sn: ['Sénégal', ['fr', 'en']], ci: ["Côte d'Ivoire", ['fr', 'en']], cd: ['RD Congo', ['fr', 'en']], ht: ['Haïti', ['fr', 'en']],
  };
  for (const [code, [region, languages]] of Object.entries(expected)) {
    for (const channel of JSON.parse(fs.readFileSync(`data/channels/${code}.json`, 'utf8'))) {
      assert.equal(channel.region, region, `${channel.id}: region`);
      assert.ok(languages.includes(channel.language), `${channel.id}: language`);
    }
  }
});

test('native-HLS-only channels play over HTTPS only', () => {
  const native = channels.filter((channel) => channel.nativeHlsOnly !== undefined);
  assert.ok(native.length > 0, 'expected native-HLS-only channels (Pluto TV relays)');
  for (const channel of native) {
    assert.equal(channel.nativeHlsOnly, true, `${channel.id}: nativeHlsOnly must be true when present`);
    assert.ok(channel.stream?.startsWith('https://'), `${channel.id}: https stream`);
    assert.equal(channel.insecureStream, undefined, `${channel.id}: never insecure`);
    for (const alternate of channel.streamAlts ?? []) assert.ok(alternate.url.startsWith('https://'), `${channel.id}: https variants`);
  }
});

test('paid channels stay official-link-only (no stream, embed or resolver)', () => {
  for (const id of OFFICIAL_LINK_ONLY) {
    const channel = channels.find((entry) => entry.id === id);
    assert.ok(channel, `${id} is missing from the catalogue`);
    assert.equal(channel.stream, undefined, `${id}: stream`);
    assert.equal(channel.embed, undefined, `${id}: embed`);
    assert.equal(channel.resolve, undefined, `${id}: resolve`);
    assert.ok(channel.note?.length > 0, `${id}: note explaining the subscription`);
  }
});
