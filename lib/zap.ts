// Zapping goes round the list like a TV: past the last channel comes the
// first. A channel outside the list (picked elsewhere) starts it at the top.
export function zapTarget<T extends { id: string }>(pool: readonly T[], currentId: string, direction: 1 | -1): { item: T; position: number } | null {
  if (pool.length < 2) return null;
  const index = pool.findIndex(item => item.id === currentId);
  const next = index < 0 ? 0 : (index + direction + pool.length) % pool.length;
  return { item: pool[next], position: next + 1 };
}
