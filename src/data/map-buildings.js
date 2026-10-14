// Which unit-producing buildings each starting player owns on a map. Maps decide what a side can build: one or two production buildings
// near each HQ, the rest contested in the middle, so a side may well lack some kinds. `PRODUCERS` lists every kind of building that builds units
// (the HQ builds infantry for everyone); `buildingGaps` reports which kinds a player does not start with. Balance runs ask only that every
// player starts with at least one producer besides the HQ (see `hasNoProducer`).
export const PRODUCERS = ['garage', 'chemical_plant', 'factory', 'support_factory', 'artillery_range', 'agency', 'shipyard', 'harbor', 'sub_pen', 'airfield', 'airbase'];

/** `[{ owner, missing: ['airfield', ...] }]` for each player, listing the producing buildings they do not start with. */
export function buildingGaps(map) {
  const owned = map.players.map(() => new Set());
  map.terrain.forEach((row, y) => row.forEach((t, x) => {
    const o = map.owners[y][x];
    if (o != null && owned[o] && PRODUCERS.includes(t)) owned[o].add(t);
  }));
  return owned.map((set, owner) => ({ owner, missing: PRODUCERS.filter((p) => !set.has(p)) }));
}

/** Players who start with no producing building besides their HQ. */
export const playersWithoutProducer = (map) => buildingGaps(map).filter((g) => g.missing.length === PRODUCERS.length).map((g) => g.owner);
