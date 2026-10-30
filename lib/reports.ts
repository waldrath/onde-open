// Validation for viewer reports about a channel. The API stores one row per
// report so the maintenance run can prioritise channels that keep failing.
export type ChannelReport = { channelId: string; reason: string };

const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseReport(raw: unknown): ChannelReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as { channelId?: unknown; reason?: unknown };
  if (typeof body.channelId !== 'string' || !CHANNEL_ID.test(body.channelId)) return null;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : '';
  return { channelId: body.channelId, reason: reason || 'flux indisponible' };
}
