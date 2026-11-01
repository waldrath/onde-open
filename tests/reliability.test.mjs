import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOutcome,outcomeBucket,reliabilityOf,parseReliability,MIN_TRIES} from '../lib/reliability.ts';

test('an outcome needs a well-formed channel id and a boolean result', () => {
  assert.deepEqual(parseOutcome({channelId:'france24',ok:true}), {channelId:'france24',ok:true});
  for (const raw of [null, {}, {channelId:'france24'}, {channelId:'france24',ok:'yes'}, {channelId:'../bad',ok:true}, {channelId:'x'.repeat(81),ok:false}])
    assert.equal(parseOutcome(raw), null);
});

test('outcomes of the same hour share a bucket', () => {
  assert.equal(outcomeBucket(new Date('2026-11-01T10:05:00Z')), outcomeBucket(new Date('2026-11-01T10:59:59Z')));
  assert.notEqual(outcomeBucket(new Date('2026-11-01T10:59:59Z')), outcomeBucket(new Date('2026-11-01T11:00:00Z')));
});

test('a label needs enough starts, then follows the success rate', () => {
  assert.equal(reliabilityOf(undefined), null);
  assert.equal(reliabilityOf({ok:MIN_TRIES-1,failed:0}), null);
  assert.equal(reliabilityOf({ok:MIN_TRIES,failed:0}), 'reliable');
  assert.equal(reliabilityOf({ok:17,failed:3}), 'reliable');
  assert.equal(reliabilityOf({ok:7,failed:3}), null);
  assert.equal(reliabilityOf({ok:2,failed:2}), 'unstable');
  assert.equal(reliabilityOf({ok:0,failed:9}), 'unstable');
});

test('the client keeps only well-formed counts from the API', () => {
  assert.deepEqual(parseReliability({channels:{france24:[9,1],'Bad Id':[1,1],savoir:[1],tfo:[-1,2],cpac:[1.5,0],tvr:['1',0]}}), {france24:{ok:9,failed:1}});
  for (const payload of [null, {}, {channels:[]}, {channels:'x'}]) assert.deepEqual(parseReliability(payload), {});
});
