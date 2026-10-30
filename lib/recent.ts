// Recently watched channels, kept on the device only: a small, private
// viewing history used by the "Reprendre" row and the "Récemment vues" sort.
export type RecentChannel = { id: string; at: string };

export function rememberChannel(history: RecentChannel[], id: string, at: string, limit = 12): RecentChannel[] {
  if (!id) return history;
  const next = [{ id, at }, ...history.filter(entry => entry.id !== id)];
  return next.slice(0, limit);
}

export function recentIds(history: RecentChannel[], limit = 12): string[] {
  return history.slice(0, limit).map(entry => entry.id);
}
