import test from 'node:test';
import assert from 'node:assert/strict';
import {zapTarget} from '../lib/zap.ts';

const pool = ['a', 'b', 'c'].map(id => ({id}));
test('zapping goes round the list in both directions', () => {
  assert.deepEqual(zapTarget(pool, 'a', 1), {item: {id: 'b'}, position: 2});
  assert.deepEqual(zapTarget(pool, 'c', 1), {item: {id: 'a'}, position: 1});
  assert.deepEqual(zapTarget(pool, 'a', -1), {item: {id: 'c'}, position: 3});
});
test('a channel outside the list starts at the top, and a list of one does not zap', () => {
  assert.deepEqual(zapTarget(pool, 'zzz', -1), {item: {id: 'a'}, position: 1});
  assert.equal(zapTarget([{id: 'a'}], 'a', 1), null);
  assert.equal(zapTarget([], 'a', 1), null);
});
