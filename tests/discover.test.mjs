import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverChannels,seededShuffle} from '../lib/discover.ts';

const catalogue = ['Québec','Canada','France','USA','International'].flatMap((region, r) =>
  Array.from({length: 20}, (_, i) => ({id: region + '-' + i, region})),
);

test('the same seed always yields the same selection', () => {
  const first = discoverChannels(catalogue, '2026-10-29:0').map(c => c.id);
  const second = discoverChannels(catalogue, '2026-10-29:0').map(c => c.id);
  assert.deepEqual(first, second);
});

test('a new seed or a new day changes the selection', () => {
  const today = discoverChannels(catalogue, '2026-10-29:0').map(c => c.id);
  const tomorrow = discoverChannels(catalogue, '2026-10-30:0').map(c => c.id);
  const again = discoverChannels(catalogue, '2026-10-29:1').map(c => c.id);
  assert.notDeepEqual(today, tomorrow);
  assert.notDeepEqual(today, again);
});

test('the row stays balanced across regions and never repeats a channel', () => {
  const picked = discoverChannels(catalogue, '2026-10-29:0', 12);
  assert.equal(picked.length, 12);
  assert.equal(new Set(picked.map(c => c.id)).size, 12);
  const counts = picked.reduce((all, c) => ({...all, [c.region]: (all[c.region] || 0) + 1}), {});
  assert.equal(Object.keys(counts).length, 5, 'every region present');
  for (const count of Object.values(counts)) assert.ok(count <= 3, 'no region fills the row');
});

test('shuffling keeps every item exactly once', () => {
  const shuffled = seededShuffle(catalogue, 'seed').map(c => c.id).sort();
  assert.deepEqual(shuffled, catalogue.map(c => c.id).sort());
});
