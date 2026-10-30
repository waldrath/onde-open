import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selection} from '../lib/selection.ts';

const catalogue = ['base','ca','fr','us'].flatMap(name => JSON.parse(fs.readFileSync('data/channels/' + name + '.json', 'utf8')));
const byId = new Map(catalogue.map(channel => [channel.id, channel]));
const playable = channel => !!(channel.stream || channel.embed || channel.resolve);

test('the selection has unique themes and no channel picked twice', () => {
  const themeIds = selection.map(theme => theme.id);
  assert.equal(new Set(themeIds).size, themeIds.length, 'duplicate theme id');
  const picks = selection.flatMap(theme => theme.picks.map(pick => pick.channelId));
  assert.equal(new Set(picks).size, picks.length, 'a channel is picked in two themes');
  for (const theme of selection) assert.ok(theme.picks.length >= 3, theme.id + ' needs at least three picks');
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
