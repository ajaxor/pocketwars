// The lay of the land, worked out once per map: which tiles each kind of movement can get between (its "landmasses": an island is a
// landmass of its own for anything that walks; the sea is one for ships), and how far every tile is from each landmass. This is how the
// strategist knows that a tank built on an island can never reach the enemy, that a ship can shell a coastal city, or where troops
// can be put ashore.
//
//   areas(game, moveClass)           { label: Int32Array (landmass id per tile, -1 where it cannot go), sizes: number[] }
//   areaAt(game, moveClass, x, y)    the landmass id there, or -1
//   gapTo(game, moveClass, id)       Int16Array: for every tile, the distance (tiles, as the crow walks) to the nearest tile of that landmass
//
// Walls and the like (impassable terrain) split landmasses; units never do (they move). Results are cached per map.

import { DIRS } from '../../engine/queries.js';

const cache = new WeakMap();   // map -> { areas: Map<moveClass, ...>, gaps: Map<'mc:id', Int16Array> }

function entry(game) {
  let e = cache.get(game.map);
  if (!e) cache.set(game.map, (e = { areas: new Map(), gaps: new Map() }));
  return e;
}

export function areas(game, moveClass) {
  const e = entry(game);
  let a = e.areas.get(moveClass);
  if (a) return a;
  const { map, registry } = game;
  const n = map.width * map.height;
  const label = new Int32Array(n).fill(-1);
  const sizes = [];
  const passable = (k) => registry.terrainDef(map.terrain[Math.floor(k / map.width)][k % map.width]).moveCost[moveClass] != null;
  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || !passable(start)) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const k = stack.pop();
      size++;
      const x = k % map.width;
      const y = Math.floor(k / map.width);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const nk = ny * map.width + nx;
        if (label[nk] !== -1 || !passable(nk)) continue;
        label[nk] = id;
        stack.push(nk);
      }
    }
    sizes.push(size);
  }
  a = { label, sizes };
  e.areas.set(moveClass, a);
  return a;
}

export const areaAt = (game, moveClass, x, y) => areas(game, moveClass).label[y * game.map.width + x];

export function gapTo(game, moveClass, id) {
  const e = entry(game);
  const key = `${moveClass}:${id}`;
  let g = e.gaps.get(key);
  if (g) return g;
  const { map } = game;
  const { label } = areas(game, moveClass);
  g = new Int16Array(map.width * map.height).fill(-1);
  const queue = [];
  for (let k = 0; k < label.length; k++) if (label[k] === id) { g[k] = 0; queue.push(k); }
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i];
    const x = k % map.width;
    const y = Math.floor(k / map.width);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const nk = ny * map.width + nx;
      if (g[nk] !== -1) continue;
      g[nk] = g[k] + 1;
      queue.push(nk);
    }
  }
  e.gaps.set(key, g);
  return g;
}

/**
 * Can a unit of `moveClass` standing anywhere on landmass `id` get within `range` tiles of (x, y) (0: onto it)? (A ship can shell a coastal city from
 * the sea; a tank cannot reach an island at all.)
 */
export const inRangeOf = (game, moveClass, id, x, y, range) => id >= 0 && gapTo(game, moveClass, id)[y * game.map.width + x] <= range;
