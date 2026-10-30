// Deterministic rotation for the home "À découvrir" row. The selection is
// stable for a given seed (the day, plus a counter when the viewer asks for
// other ideas) and balanced across regions, so the row changes without
// becoming random on every render.
export function hashSeed(value: string) {
  let state = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    state ^= value.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = hashSeed(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Round-robin over the regions of a shuffled catalogue: a single country can
// never fill the whole row, and every region present gets its turn.
export function discoverChannels<T extends { region: string }>(items: T[], seed: string, total = 12): T[] {
  const byRegion = new Map<string, T[]>();
  for (const item of seededShuffle(items, seed)) {
    const bucket = byRegion.get(item.region);
    if (bucket) bucket.push(item);
    else byRegion.set(item.region, [item]);
  }
  const buckets = [...byRegion.values()];
  const picked: T[] = [];
  for (let round = 0; picked.length < total; round += 1) {
    let added = false;
    for (const bucket of buckets) {
      if (picked.length >= total) break;
      const candidate = bucket[round];
      if (candidate) {
        picked.push(candidate);
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
}
