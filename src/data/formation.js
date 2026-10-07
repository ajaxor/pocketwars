// Leaders on a map: giving a player a leader and placing that leader's starting units around the player's HQ.
//
//   hqOf(map, registry, owner)                    the player's HQ tile { x, y } (else any property they own, else null)
//   frontOf(map, registry, owner, hq)             which way is "forward": [dx, dy], one of the four directions, toward the enemy
//   placeFormation(map, registry, owner, list, taken, origin)   where one formation (a list of { unit, at }) goes around `origin`
//                                                 (default: the HQ): { units, hq, front, moved, skipped } or null
//   placeStart(map, registry, owner, start, taken)   all of a kit's `start`: the HQ set, then a set around every production building
//                                                 the player owns whose type the kit lists: { units, sites, moved, skipped } or null
//   withLeaders(map, registry, leaders)           a copy of the map in which player i fights with leaders[i] (an id or null)
//
// THE START. A kit's `start` (data/loadouts.json) is { hq: [...], barracks: [...], factory: [...], ... }: one formation around the
// HQ, and one around EACH production building of that type the player owns (two factories get two copies of the factory set).
// Sets are placed in this order: the HQ's, then buildings in reading order. A set is a list of units with an offset [side, forward]
// from its building. "Forward" is the
// direction of the enemy (the average of the other players' HQs, snapped to north, south, east or west) and "side" is toward the
// right hand of a player facing that way, so the same formation works for a player at the top, bottom, left or right of a map. The
// order of the list is the order the units are placed in: the first one gets its spot first.
//
// WHEN A SPOT IS NOT FREE. A unit cannot be placed on a tile that is off the map, that its movement class cannot enter, that
// another unit already has, or that is a property (it would sit on a factory and stop it building, or on a city and block its
// capture). It also has to be a tile the unit could walk (swim, fly) to from the HQ, so nobody is stranded on another island.
// Such a unit goes to the closest tile that is fine: nearest to its own spot, then nearest the HQ, then nearest the HQ's centre line, then the
// tile that comes first in reading order. A unit that has nowhere at all to stand (a ship on a map with no sea) is skipped.
//
// Players without a leader keep the units the map file gives them; so does a player with a leader but no HQ (nothing to build around).

import { hasAttribute } from '../engine/attributes.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
};

const key = (x, y) => `${x},${y}`;
/** Is score list `a` smaller than `b`, comparing from the first entry on? */
const before = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
const tileDef = (map, registry, x, y) => registry.terrain[map.terrain[y][x]];
const isProperty = (map, registry, x, y) => !!tileDef(map, registry, x, y).attributes.property;

export function hqOf(map, registry, owner) {
  let any = null;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.owners[y][x] !== owner) continue;
      if (hasAttribute(tileDef(map, registry, x, y), 'victoryOnCapture')) return { x, y };
      any ??= { x, y };
    }
  }
  return any;
}

export function frontOf(map, registry, owner, hq) {
  const enemies = map.players.map((_, i) => (i === owner ? null : hqOf(map, registry, i))).filter(Boolean);
  const to = enemies.length
    ? { x: enemies.reduce((s, e) => s + e.x, 0) / enemies.length, y: enemies.reduce((s, e) => s + e.y, 0) / enemies.length }
    : { x: (map.width - 1) / 2, y: (map.height - 1) / 2 };
  const dx = to.x - hq.x, dy = to.y - hq.y;
  if (Math.abs(dx) > Math.abs(dy)) return [Math.sign(dx), 0];
  return [0, dy < 0 ? -1 : 1];
}

/** Every tile a unit of `moveClass` could walk to from the HQ (or from the closest tile it can stand on, for a ship), ignoring units. */
function regionOf(map, registry, hq, moveClass) {
  const open = (x, y) => tileDef(map, registry, x, y).moveCost[moveClass] != null;
  let seeds = [];
  if (open(hq.x, hq.y)) seeds = [[hq.x, hq.y]];
  else {
    let best = Infinity;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (!open(x, y)) continue;
      const d = Math.abs(x - hq.x) + Math.abs(y - hq.y);
      if (d < best) { best = d; seeds = []; }
      if (d === best) seeds.push([x, y]);
    }
  }
  const seen = new Set(seeds.map(([x, y]) => key(x, y)));
  const queue = [...seeds];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key(nx, ny)) || !open(nx, ny)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/**
 * Place a kit's formation around `owner`'s HQ. `taken` is the set of "x,y" tiles that already have a unit; it is added to as
 * units are placed. Returns null when the player has no HQ (and no property) to build around.
 * @returns {{units:{type:string, owner:number, x:number, y:number}[], hq:{x:number,y:number}, front:number[], moved:number, skipped:string[]} | null}
 */
export function placeFormation(map, registry, owner, list, taken = new Set(), origin = hqOf(map, registry, owner)) {
  const hq = origin;
  if (!hq) return null;
  const [fx, fy] = frontOf(map, registry, owner, hq);
  const [rx, ry] = [-fy, fx];   // the right hand of someone facing forward (y grows downward)
  const regions = new Map();
  const units = [], skipped = [];
  let moved = 0;
  for (const { unit, at: [side, ahead] } of list) {
    const { moveClass } = registry.unit(unit);
    if (!regions.has(moveClass)) regions.set(moveClass, regionOf(map, registry, hq, moveClass));
    const region = regions.get(moveClass);
    const ideal = { x: hq.x + side * rx + ahead * fx, y: hq.y + side * ry + ahead * fy };
    let best = null;
    for (const k of region) {
      const [x, y] = k.split(',').map(Number);
      if (taken.has(k) || isProperty(map, registry, x, y)) continue;
      const score = [
        Math.abs(x - ideal.x) + Math.abs(y - ideal.y),               // nearest to the spot it was meant for
        Math.abs(((x - ideal.x) * fx) + ((y - ideal.y) * fy)),       // then the one that keeps its row (a unit meant for behind the HQ stays behind it)
        Math.abs(x - hq.x) + Math.abs(y - hq.y),                     // then nearest the HQ
        Math.abs((x - hq.x) * rx + (y - hq.y) * ry),                 // then nearest the centre line in front of it
        y, x,                                                        // then reading order, so the result never depends on the set's order
      ];
      if (!best || before(score, best.score)) best = { x, y, score };
    }
    if (!best) { skipped.push(unit); continue; }
    taken.add(key(best.x, best.y));
    units.push({ type: unit, owner, x: best.x, y: best.y });
    if (best.x !== ideal.x || best.y !== ideal.y) moved++;
  }
  return { units, hq, front: [fx, fy], moved, skipped };
}

/**
 * Place all of a kit's starting units for `owner`: the `hq` set around their HQ, and each other set around every building the
 * player owns of that terrain type. Returns null when the player has no HQ (and no property) to build around.
 * @returns {{units:object[], sites:{site:string, x:number, y:number, placed:number}[], moved:number, skipped:string[]} | null}
 */
export function placeStart(map, registry, owner, start, taken = new Set()) {
  const hq = hqOf(map, registry, owner);
  if (!hq) return null;
  const sites = [];
  if (start.hq?.length) sites.push({ site: 'hq', ...hq, list: start.hq });
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const list = map.owners[y][x] === owner ? start[map.terrain[y][x]] : null;
      if (list?.length && !(x === hq.x && y === hq.y)) sites.push({ site: map.terrain[y][x], x, y, list });
    }
  }
  const out = { units: [], sites: [], moved: 0, skipped: [] };
  for (const { site, x, y, list } of sites) {
    const r = placeFormation(map, registry, owner, list, taken, { x, y });
    out.units.push(...r.units);
    out.moved += r.moved;
    out.skipped.push(...r.skipped);
    out.sites.push({ site, x, y, placed: r.units.length });
  }
  return out;
}

/**
 * A copy of `map` (frozen) in which player i fights with the leader leaders[i] (an id from the registry, or null for none). Their
 * build menus follow the leader's loadout, and their starting units are the loadout's sets around their HQ and factories instead
 * of the units the map file gives them. With `startUnits: false` they get the menus only and begin with no units (structures stay).
 */
export function withLeaders(map, registry, leaders, { startUnits = true } = {}) {
  const placeable = leaders.map((id, owner) => (id && hqOf(map, registry, owner) ? id : null));
  const kept = map.units.filter((u) => u.owner === null || !placeable[u.owner] || registry.unit(u.type).attributes?.structure).map((u) => ({ ...u }));   // structures (turrets, jammers) stay where the map put them
  const taken = new Set(kept.map((u) => key(u.x, u.y)));
  map.terrain.forEach((row, y) => row.forEach((t, x) => { if (registry.terrainDef(t).attributes?.wall?.structure) taken.add(key(x, y)); }));   // a cracked wall goes there
  const units = [...kept];
  placeable.forEach((id, owner) => {
    if (id && startUnits) units.push(...placeStart(map, registry, owner, registry.loadoutFor(id).start, taken).units);
  });
  const players = map.players.map((p, i) => (leaders[i] ? { ...p, leader: leaders[i] } : { ...p }));
  return deepFreeze({ ...map, players, units });
}
