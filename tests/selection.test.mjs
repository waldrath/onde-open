import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selection,curateSelection,momentOf,weekNumber,SHOWN,STEP} from '../lib/selection.ts';

const catalogue = fs.readdirSync('data/channels').filter(name => name.endsWith('.json')).flatMap(name => JSON.parse(fs.readFileSync('data/channels/' + name, 'utf8')));
const byId = new Map(catalogue.map(channel => [channel.id, channel]));
const playable = channel => !!(channel.stream || channel.embed || channel.resolve);

test('the selection has unique themes and no channel picked twice', () => {
  const themeIds = selection.map(theme => theme.id);
  assert.equal(new Set(themeIds).size, themeIds.length, 'duplicate theme id');
  const picks = selection.flatMap(theme => theme.picks.map(pick => pick.channelId));
  assert.equal(new Set(picks).size, picks.length, 'a channel is picked in two themes');
  // A pool larger than what is shown is what lets the selection turn over each week.
  for (const theme of selection) assert.ok(theme.picks.length >= SHOWN + 3, theme.id + ' needs at least ' + (SHOWN + 3) + ' picks');
});

test('every pick exists in the catalogue and can play inside Onde', () => {
  for (const theme of selection) {
    for (const pick of theme.picks) {
      const channel = byId.get(pick.channelId);
      assert.ok(channel, 'unknown channel: ' + pick.channelId);
      assert.ok(channel.name.trim(), pick.channelId + ': empty name');
      assert.ok(playable(channel), pick.channelId + ' cannot play inside Onde');
      assert.notEqual(channel.limited, true, pick.channelId + ' is geo-restricted');
      assert.notEqual(channel.region, 'USA', pick.channelId + ' is a US-only feed');
      assert.notEqual(channel.insecureStream, true, pick.channelId + ' is an insecure http stream');
      assert.notEqual(channel.nativeHlsOnly, true, pick.channelId + ' plays in Safari only');
    }
  }
});

test('every theme and reason is written for a viewer', () => {
  for (const theme of selection) {
    assert.ok(theme.title.trim().length >= 3, theme.id + ': title');
    assert.ok(theme.intro.trim().length >= 15, theme.id + ': intro');
    for (const pick of theme.picks) {
      assert.ok(pick.reason.trim().length >= 25, pick.channelId + ': reason too short');
      assert.ok(pick.reason.length <= 140, pick.channelId + ': reason too long');
    }
  }
});

const pool = (prefix, count) => Array.from({ length: count }, (_, i) => ({ channelId: `${prefix}-${i}`, reason: 'A reason long enough to pass the copy checks.' }));
const themes = [
  { id: 'cinema', title: 'Cinéma', intro: 'Des films et des séries.', picks: pool('film', 8) },
  { id: 'actualites', title: 'Actualités', intro: 'Le monde en direct.', picks: pool('news', 8) },
];
const monday = new Date(2026, 10, 2, 9), sameWeek = new Date(2026, 10, 7, 9), nextWeek = new Date(2026, 10, 9, 9);
const ids = theme => theme.picks.map(pick => pick.channelId);

test('the curated selection is stable within a week and turns over the next one', () => {
  const available = () => true;
  const a = curateSelection(themes, { now: monday, available }), b = curateSelection(themes, { now: sameWeek, available });
  assert.deepEqual(a.map(ids), b.map(ids));
  assert.equal(a[0].picks.length, SHOWN);
  const next = curateSelection(themes, { now: nextWeek, available });
  assert.notDeepEqual(next.map(ids), a.map(ids));
  // Turnover is gradual: most of last week's picks stay.
  for (const [index, theme] of next.entries()) assert.equal(ids(theme).filter(id => ids(a[index]).includes(id)).length, SHOWN - STEP);
  // Every pick of the pool is shown within a few weeks.
  const shown = new Set();
  for (let week = 0; week < 8; week += 1) for (const theme of curateSelection(themes, { now: new Date(2026, 10, 2 + week * 7, 9), available })) ids(theme).forEach(id => shown.add(id));
  assert.equal(shown.size, 16);
});

test('picks new to the viewer come first, and unavailable channels are skipped', () => {
  const base = curateSelection(themes, { now: monday, available: () => true });
  const favorite = base[0].picks[0].channelId, gone = base[0].picks[1].channelId;
  const personal = curateSelection(themes, { now: monday, available: id => id !== gone, favorites: new Set([favorite]) });
  assert.ok(!ids(personal[0]).includes(favorite) && !ids(personal[0]).includes(gone));
  assert.equal(personal[0].picks.length, SHOWN);
});

test('themes follow the moment of the day and new picks are flagged', () => {
  const available = () => true;
  assert.equal(momentOf(8), 'morning'); assert.equal(momentOf(23), 'night'); assert.equal(momentOf(3), 'night');
  assert.deepEqual(curateSelection(themes, { now: new Date(2026, 10, 2, 8), available }).map(theme => theme.id), ['actualites', 'cinema']);
  assert.deepEqual(curateSelection(themes, { now: new Date(2026, 10, 2, 23), available }).map(theme => theme.id), ['cinema', 'actualites']);
  const last = new Set(ids(curateSelection(themes, { now: new Date(2026, 10, 2, 23), available })[0]));
  for (const pick of curateSelection(themes, { now: new Date(2026, 10, 9, 23), available })[0].picks) assert.equal(pick.fresh, !last.has(pick.channelId));
  assert.equal(weekNumber(monday), weekNumber(sameWeek)); assert.equal(weekNumber(nextWeek), weekNumber(monday) + 1);
});

test('every theme, intro and reason has an English translation', async () => {
  const {translate} = await import('../lib/i18n.ts');
  for (const theme of selection) for (const text of [theme.title, theme.intro, ...theme.picks.map(pick => pick.reason)])
    assert.notEqual(translate('en', text), text, 'missing English for: ' + text);
});
