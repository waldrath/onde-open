import test from 'node:test';
import assert from 'node:assert/strict';
import {isPremiumChannel} from '../lib/channel-utils.ts';

const playable = name => ({id: name.toLowerCase(), name, stream: 'https://example.org/live.m3u8'});

test('pay-TV brands and the free channels they run are premium', () => {
  for (const name of ['HBO (United States)', 'TSN The Ocho', 'beIN SPORTS XTRA', 'CBS Sports HQ', 'CBS Sports Golazo Network', 'NBC Sports NOW', 'NFL Channel', 'MLB', 'NHL Network', 'Tennis Channel', 'Paramount+ Picks', 'Paramount Movie Channel', 'Stories by AMC', 'CNN Originals']) {
    assert.equal(isPremiumChannel(playable(name)), true, name);
  }
});

test('other playable channels are not premium, link-only and flagged ones are', () => {
  for (const name of ['Télé-Québec', 'CNN International', 'Ici RDI', 'TFO', 'France 24', 'Ambiance Cinema']) {
    assert.equal(isPremiumChannel(playable(name)), false, name);
  }
  assert.equal(isPremiumChannel({id: 'rds', name: 'RDS', official: 'https://www.rds.ca/en-direct/'}), true);
  assert.equal(isPremiumChannel({...playable('Some channel'), premium: true}), true);
});
