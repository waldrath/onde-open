// Channel reliability measured from real playback. Every start the player
// either confirms (the video advanced) or gives up on is one anonymous
// outcome; the API keeps one per viewer, channel and hour, and a channel only
// earns a label once enough starts were seen over the last RELIABILITY_DAYS.
export type PlaybackOutcome = { channelId: string; ok: boolean };
export type ReliabilityCounts = { ok: number; failed: number };
export type Reliability = 'reliable' | 'unstable';

const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const RELIABILITY_DAYS = 30;
export const MIN_TRIES = 4;

export function parseOutcome(raw: unknown): PlaybackOutcome | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as { channelId?: unknown; ok?: unknown };
  if (typeof body.channelId !== 'string' || !CHANNEL_ID.test(body.channelId) || typeof body.ok !== 'boolean') return null;
  return { channelId: body.channelId, ok: body.ok };
}

/** The hour an outcome belongs to: a viewer retrying the same channel within it counts once (the last result wins). */
export function outcomeBucket(date: Date): string {
  return date.toISOString().slice(0, 13);
}

export function reliabilityOf(counts: ReliabilityCounts | undefined): Reliability | null {
  if (!counts) return null;
  const total = counts.ok + counts.failed;
  if (total < MIN_TRIES) return null;
  const rate = counts.ok / total;
  if (rate >= 0.85) return 'reliable';
  if (rate <= 0.5) return 'unstable';
  return null;
}

/** Validates the API payload on the client: unknown shapes are dropped, never trusted. */
export function parseReliability(payload: unknown): Record<string, ReliabilityCounts> {
  const result: Record<string, ReliabilityCounts> = {};
  const channels = (payload as { channels?: unknown })?.channels;
  if (!channels || typeof channels !== 'object' || Array.isArray(channels)) return result;
  for (const [id, value] of Object.entries(channels as Record<string, unknown>)) {
    if (!CHANNEL_ID.test(id) || !Array.isArray(value) || value.length !== 2) continue;
    const [ok, failed] = value;
    if (Number.isInteger(ok) && Number.isInteger(failed) && ok >= 0 && failed >= 0) result[id] = { ok, failed };
  }
  return result;
}
