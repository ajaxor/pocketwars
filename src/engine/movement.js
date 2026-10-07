// Movement and range geometry. All costs come from terrain.moveCost[unit.moveClass]; a null cost means
// impassable. Enemy units block movement, friendly units can be passed through but not stopped on.
//
// Only enemies the mover can SEE block the search. A hidden enemy (a submerged submarine nobody has noticed) is treated as open
// water, so planning a move, or previewing one, never gives it away; it is found out when the move is carried out (game.js act).
// In fog, a unit cannot enter a tile its player has never seen (the black part of the board; fog.js).
// A unit whose move was interrupted (`unit.halted`) has used its move: it can only act where it stands.

import { DIRS, distance, inBounds, tileIndex, unitAt, unitDef, terrainAt } from './queries.js';
import { hasAmmoFor } from './ammo.js';
import { hasAttribute } from './attributes.js';
import { canAttackFrom, isIndirect, weaponsOf } from './combat.js';
import { canSee } from './detection.js';
import { tileExplored } from './fog.js';
import { passesOverMines } from './mines.js';
import { moveOf } from './submerge.js';
import { PathHeap } from './heap.js';
import { canJoin } from './join.js';

/** Cost for a move class to enter (x, y), or null when impassable. */
export const moveCostAt = (game, moveClass, x, y) => terrainAt(game, x, y).moveCost[moveClass];

/**
 * Result of a reachability search. `cost` holds the tiles the unit can END its move on (in discovery order);
 * `prev` covers every tile the search crossed, so paths can pass through friendly units.
 */
export class ReachMap {
  constructor(width, origin, cost, prev) {
    this.width = width;
    this.origin = origin; // [x, y]
    this.cost = cost; // Map<tileIndex, movePointsSpent>
    this.prev = prev; // Map<tileIndex, tileIndex>
  }

  has(x, y) { return this.cost.has(y * this.width + x); }
  costAt(x, y) { return this.cost.get(y * this.width + x); }
  get size() { return this.cost.size; }

  *tiles() {
    for (const [k, cost] of this.cost) yield { x: k % this.width, y: Math.floor(k / this.width), cost };
  }

  /** Path from the origin to (x, y) as [[x, y], ...] including both ends, or null when unreachable. */
  pathTo(x, y) {
    let k = y * this.width + x;
    if (!this.prev.has(k) && !(x === this.origin[0] && y === this.origin[1])) return null;
    const out = [[x, y]];
    while (this.prev.has(k)) {
      k = this.prev.get(k);
      out.unshift([k % this.width, Math.floor(k / this.width)]);
    }
    return out;
  }
}

/** Every tile `unit` can move to this turn (including its own tile), as a ReachMap. */
export function computeReach(game, unit, { join = false } = {}) {   // `join`: a damaged friend of the same kind counts as a place to end the move (for the Join order; the AI does not join)
  const { map } = game;
  const def = unitDef(game, unit);
  const allowance = moveOf(game, unit);
  const cost = new Map();
  const prev = new Map();
  const start = tileIndex(map, unit.x, unit.y);
  cost.set(start, 0);
  if (unit.halted) return new ReachMap(map.width, [unit.x, unit.y], cost, prev);   // stopped by a hidden unit: no more moving this turn
  // who stands where, looked up once (the first unit listed on a tile, as unitAt finds it)
  const occupants = new Map();
  for (const u of game.state.units) { const k = tileIndex(map, u.x, u.y); if (!occupants.has(k)) occupants.set(k, u); }
  const queue = new PathHeap();
  queue.push(unit.x, unit.y, 0);
  while (queue.length) {
    const [x, y, c] = queue.pop();
    if (c > cost.get(tileIndex(map, x, y))) continue; // stale queue entry
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      if (!tileExplored(game, unit.owner, nx, ny)) continue;   // fog: a player cannot move a unit into (or through) a tile they have never seen
      const occupant = occupants.get(tileIndex(map, nx, ny));
      if (occupant && occupant.owner !== unit.owner && canSee(game, unit.owner, occupant) && !passesOverMines(game, unit, occupant)) continue;   // a hidden enemy does not block the plan (nor does a mine for a unit that floats or flies over it)
      const step = moveCostAt(game, def.moveClass, nx, ny);
      if (step === null) continue;
      const nc = c + step;
      if (nc > allowance) continue;
      const k = tileIndex(map, nx, ny);
      if (!cost.has(k) || nc < cost.get(k)) {
        cost.set(k, nc);
        prev.set(k, tileIndex(map, x, y));
        queue.push(nx, ny, nc);
      }
    }
  }
  // Can pass through friends (and over a mine it can see) but not end the move on them. (A hidden enemy is not known to be there, so its tile stays on offer.)
  for (const k of [...cost.keys()]) {
    const occupant = occupants.get(k);
    if (occupant && occupant !== unit && !(join && canJoin(game, unit, occupant)) && (occupant.owner === unit.owner || canSee(game, unit.owner, occupant))) cost.delete(k);   // a damaged friend of the same kind stays on offer: the unit may join it
  }
  return new ReachMap(map.width, [unit.x, unit.y], cost, prev);
}

/**
 * Cheapest-path cost from any goal to every tile a move class can enter, ignoring units.
 * Used by the AI as a "how far is the objective" gradient. Map<tileIndex, cost>. A goal is [x, y] or [x, y, startCost].
 */
export function distanceField(game, moveClass, goals) {
  const { map } = game;
  const field = new Map();
  const queue = new PathHeap();
  for (const [x, y, start = 0] of goals) {   // a goal may carry a head start (a cost of its own): the AI uses it to prefer some goals
    const k = tileIndex(map, x, y);
    if (field.has(k) && field.get(k) <= start) continue;
    field.set(k, start);
    queue.push(x, y, start);
  }
  while (queue.length) {
    const [x, y, c] = queue.pop();
    if (c > field.get(tileIndex(map, x, y))) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const step = moveCostAt(game, moveClass, nx, ny);
      if (step === null) continue;
      const nc = c + step;
      const k = tileIndex(map, nx, ny);
      if (!field.has(k) || nc < field.get(k)) {
        field.set(k, nc);
        queue.push(nx, ny, nc);
      }
    }
  }
  return field;
}

/**
 * Tiles within reach of any of the unit's weapons from (x, y), as a Set of tile indexes (obstacles are not considered: see
 * targetsFrom for what can actually be hit). Direct-fire units include their own tile so the drawn outline is a clean plus
 * shape; weapons with a minimum range above 1 exclude the inner tiles.
 */
export function attackTiles(game, unit, x = unit.x, y = unit.y) {
  const { map } = game;
  const out = new Set();
  const moved = x !== unit.x || y !== unit.y || hasMovedAlready(unit);
  for (const w of weaponsOf(game, unit)) {
    if (moved && isIndirect(game, unit, w)) continue;   // an indirect weapon cannot follow a move
    if (!hasAmmoFor(game, unit, w)) continue;            // and one with no rounds left cannot fire at all
    const [lo, hi] = w.range;
    for (let dy = -hi; dy <= hi; dy++) {
      for (let dx = -hi; dx <= hi; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        const nx = x + dx;
        const ny = y + dy;
        if (d > hi || (d < lo && lo > 1) || !inBounds(map, nx, ny)) continue;
        out.add(tileIndex(map, nx, ny));
      }
    }
  }
  return out;
}

/** Enemy units the unit could hit from (x, y) right now (visible ones, with a weapon of the right target mode, range and line of sight). */
export function targetsFrom(game, unit, x = unit.x, y = unit.y) {
  return game.state.units.filter((e) => e.owner !== unit.owner && canSee(game, unit.owner, e) && canAttackFrom(game, unit, e, x, y));
}

/** Can this unit attack after moving? Not when every weapon is indirect fire (those fire from where the unit started). */
export const canFireAfterMoving = (game, unit) => weaponsOf(game, unit).some((w) => !isIndirect(game, unit, w));

/** Has this unit already moved this turn (only known for a unit whose move was interrupted; a fresh order says so itself)? */
export const hasMovedAlready = (unit) => !!unit.halted && unit.halted.moved;

/**
 * Best tile to attack `target` from: prefers staying put, then high-defense terrain, then short moves.
 * Indirect units only consider their current tile. Returns [x, y] or null when no tile works.
 */
export function bestAttackTile(game, unit, target, reach) {
  const candidates = canFireAfterMoving(game, unit) ? [...reach.tiles()] : [{ x: unit.x, y: unit.y, cost: reach.costAt(unit.x, unit.y) ?? 0 }];
  let best = null;
  for (const { x, y, cost } of candidates) {
    if (unitAt(game, x, y) && unitAt(game, x, y) !== unit) continue;   // a friend to join stands there: no place to fire from
    if (!canAttackFrom(game, unit, target, x, y)) continue;
    const score = (x === unit.x && y === unit.y ? 100 : 0) + terrainAt(game, x, y).defense * 3 - cost;
    if (!best || score > best.score) best = { x, y, score };
  }
  return best && [best.x, best.y];
}
