import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReminders,toggleReminder,dueReminders,nextReminderDelay,reminderKey,LATE_MS,MAX_REMINDERS} from '../lib/reminders.ts';

const now = Date.parse('2026-11-01T18:00:00Z');
const at = minutes => new Date(now + minutes * 60000).toISOString();
const reminder = (minutes, channelId = 'telequebec') => ({channelId, start: at(minutes), title: 'Émission ' + minutes});

test('stored reminders are validated, de-duplicated, sorted and expired ones dropped', () => {
  const raw = [reminder(30), reminder(-5), reminder(-31), reminder(30), {channelId: '../bad', start: at(10), title: 'x'}, {channelId: 'savoir', start: 'not a date', title: 'x'}, {channelId: 'savoir', start: at(10), title: '  '}, null, reminder(10, 'savoir')];
  assert.deepEqual(parseReminders(raw, now).map(reminderKey), [reminderKey(reminder(-5)), reminderKey(reminder(10, 'savoir')), reminderKey(reminder(30))]);
  assert.deepEqual(parseReminders('nope', now), []);
  assert.equal(parseReminders(Array.from({length: 80}, (_, i) => reminder(i + 1)), now).length, MAX_REMINDERS);
});

test('toggling adds a reminder once and removes it the second time', () => {
  const once = toggleReminder([], reminder(30), now);
  assert.equal(once.length, 1);
  assert.deepEqual(toggleReminder(once, reminder(30), now), []);
  // A programme already over is never added.
  assert.deepEqual(toggleReminder([], reminder(-LATE_MS / 60000 - 1), now), []);
});

test('a reminder is due from its start until it is too late, and the next delay is the earliest one', () => {
  const list = [reminder(-10), reminder(5), reminder(20)];
  assert.deepEqual(dueReminders(list, now).map(reminderKey), [reminderKey(reminder(-10))]);
  assert.equal(nextReminderDelay(list, now), 5 * 60000);
  assert.equal(nextReminderDelay([reminder(-10)], now), null);
});
