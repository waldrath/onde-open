import test from 'node:test';
import assert from 'node:assert/strict';
import {isTheme,themes} from '../lib/themes.ts';

test('the theme ids are unique and complete', () => {
  const ids = themes.map(theme => theme.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('dark') && ids.includes('light'));
  assert.equal(themes.length, 12);
});

test('only known theme ids are accepted', () => {
  for (const theme of themes) assert.equal(isTheme(theme.id), true);
  assert.equal(isTheme('neon'), false);
  assert.equal(isTheme(null), false);
  assert.equal(isTheme(42), false);
});
