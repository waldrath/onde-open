import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReport} from '../lib/reports.ts';

test('a report needs a well-formed channel id', () => {
  assert.equal(parseReport(null), null);
  assert.equal(parseReport({}), null);
  assert.equal(parseReport({channelId:'Pas Valide'}), null);
  assert.equal(parseReport({channelId:'x'.repeat(81)}), null);
});

test('a report keeps a bounded reason and a default one', () => {
  assert.deepEqual(parseReport({channelId:'france24',reason:'  le flux coupe  '}), {channelId:'france24',reason:'le flux coupe'});
  assert.deepEqual(parseReport({channelId:'france24'}), {channelId:'france24',reason:'flux indisponible'});
  assert.equal(parseReport({channelId:'france24',reason:'x'.repeat(400)}).reason.length, 120);
});
