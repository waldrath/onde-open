// Programme reminders, kept on this device. A reminder fires when its
// programme starts; one missed while Onde was closed is still offered while
// the programme is on air (up to LATE_MS after its start), then dropped.
export type Reminder = { channelId: string; start: string; title: string };

export const REMINDERS_KEY = 'onde-reminders';
export const MAX_REMINDERS = 50;
export const LATE_MS = 30 * 60 * 1000;
const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export const reminderKey = (reminder: Pick<Reminder, 'channelId' | 'start'>) => reminder.channelId + '@' + reminder.start;

/** Stored data comes back through here: anything malformed or expired is dropped. */
export function parseReminders(raw: unknown, now: number): Reminder[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>(), result: Reminder[] = [];
  for (const item of raw) {
    const value = item as Partial<Reminder> | null;
    if (!value || typeof value.channelId !== 'string' || !CHANNEL_ID.test(value.channelId) || typeof value.start !== 'string' || typeof value.title !== 'string') continue;
    const time = Date.parse(value.start);
    if (!Number.isFinite(time) || time + LATE_MS < now) continue;
    const reminder = { channelId: value.channelId, start: new Date(time).toISOString(), title: value.title.trim().slice(0, 200) };
    if (!reminder.title || seen.has(reminderKey(reminder))) continue;
    seen.add(reminderKey(reminder));
    result.push(reminder);
  }
  return result.sort((a, b) => a.start.localeCompare(b.start)).slice(0, MAX_REMINDERS);
}

export function toggleReminder(list: Reminder[], reminder: Reminder, now: number): Reminder[] {
  const key = reminderKey(reminder);
  if (list.some(item => reminderKey(item) === key)) return list.filter(item => reminderKey(item) !== key);
  return parseReminders([...list, reminder], now);
}

/** Reminders whose programme has started and is still worth announcing. */
export function dueReminders(list: Reminder[], now: number): Reminder[] {
  return list.filter(item => { const time = Date.parse(item.start); return time <= now && time + LATE_MS >= now; });
}

/** Milliseconds until the next reminder starts, or null when none is pending. */
export function nextReminderDelay(list: Reminder[], now: number): number | null {
  const upcoming = list.map(item => Date.parse(item.start) - now).filter(delay => delay > 0);
  return upcoming.length ? Math.min(...upcoming) : null;
}
