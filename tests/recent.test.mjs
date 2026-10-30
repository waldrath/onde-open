import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberChannel,recentIds} from '../lib/recent.ts';

test('a channel moves to the front instead of being duplicated', () => {
  let history = [];
  history = rememberChannel(history, 'arte', '2026-10-29T12:00:00Z');
  history = rememberChannel(history, 'savoir', '2026-10-29T12:05:00Z');
  history = rememberChannel(history, 'arte', '2026-10-29T12:10:00Z');
  assert.deepEqual(recentIds(history), ['arte','savoir']);
  assert.equal(history[0].at, '2026-10-29T12:10:00Z');
});

test('the history is capped and keeps the most recent entries', () => {
  let history = [];
  for (let i = 0; i < 20; i += 1) history = rememberChannel(history, 'chaîne-' + i, '2026-10-29T12:' + String(i).padStart(2, '0') + ':00Z');
  assert.equal(history.length, 12);
  assert.equal(history[0].id, 'chaîne-19');
  assert.equal(history[11].id, 'chaîne-8');
});
