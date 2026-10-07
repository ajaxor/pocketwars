// Which of the four unit-producing buildings every starting player owns on a map. Leaders' kits assume all four (barracks, factory,
// airfield, shipyard), so a map that lacks one hands an edge to whoever needs it least. It is a guideline, not a rule of the format:
// balance runs only use maps with no gaps (see `buildingGaps`).
export const PRODUCERS = ['barracks', 'factory', 'airfield', 'shipyard'];

/** `[{ owner, missing: ['airfield', ...] }]` for each player that lacks a producing building; empty when the map is complete. */
export function buildingGaps(map) {
  const owned = map.players.map(() => new Set());
  map.terrain.forEach((row, y) => row.forEach((t, x) => {
    const o = map.owners[y][x];
    if (o != null && owned[o] && PRODUCERS.includes(t)) owned[o].add(t);
  }));
  return owned.map((set, owner) => ({ owner, missing: PRODUCERS.filter((p) => !set.has(p)) })).filter((g) => g.missing.length);
}
