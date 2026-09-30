// Movement and range geometry. All costs come from terrain.moveCost[unit.moveClass]; a null cost means
// impassable. Enemy units block movement, friendly units can be passed through but not stopped on.
//
// Only enemies the mover can SEE block the search. A hidden enemy (a submerged submarine nobody has noticed) is treated as open
// water, so planning a move, or previewing one, never gives it away; it is found out when the move is carried out (game.js act).
// A unit whose move was interrupted (`unit.halted`) has used its move: it can only act where it stands.

import { DIRS, distance, inBounds, tileIndex, unitAt, unitDef, terrainAt } from './queries.js';
import { hasAttribute } from './attributes.js';
import { canAttackFrom, weaponsOf } from './combat.js';
import { canSee } from './detection.js';

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
export function computeReach(game, unit) {
  const { map } = game;
  const def = unitDef(game, unit);
  const cost = new Map();
  const prev = new Map();
  const start = tileIndex(map, unit.x, unit.y);
  cost.set(start, 0);
  if (unit.halted) return new ReachMap(map.width, [unit.x, unit.y], cost, prev);   // stopped by a hidden unit: no more moving this turn
  const queue = [[unit.x, unit.y, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = queue.shift();
    if (c > cost.get(tileIndex(map, x, y))) continue; // stale queue entry
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const occupant = unitAt(game, nx, ny);
      if (occupant && occupant.owner !== unit.owner && canSee(game, unit.owner, occupant)) continue;   // a hidden enemy does not block the plan
      const step = moveCostAt(game, def.moveClass, nx, ny);
      if (step === null) continue;
      const nc = c + step;
      if (nc > def.move) continue;
      const k = tileIndex(map, nx, ny);
      if (!cost.has(k) || nc < cost.get(k)) {
        cost.set(k, nc);
        prev.set(k, tileIndex(map, x, y));
        queue.push([nx, ny, nc]);
      }
    }
  }
  // Can pass through friends but not end the move on them. (A hidden enemy is not known to be there, so its tile stays on offer.)
  for (const k of [...cost.keys()]) {
    const occupant = unitAt(game, k % map.width, Math.floor(k / map.width));
    if (occupant && occupant !== unit && occupant.owner === unit.owner) cost.delete(k);
  }
  return new ReachMap(map.width, [unit.x, unit.y], cost, prev);
}

/**
 * Cheapest-path cost from any goal to every tile a move class can enter, ignoring units.
 * Used by the AI as a "how far is the objective" gradient. Map<tileIndex, cost>.
 */
export function distanceField(game, moveClass, goals) {
  const { map } = game;
  const field = new Map();
  const queue = goals.map(([x, y]) => { field.set(tileIndex(map, x, y), 0); return [x, y, 0]; });
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = queue.shift();
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
        queue.push([nx, ny, nc]);
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
  for (const { range: [lo, hi] } of weaponsOf(game, unit)) {
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

/** Can this unit attack after moving? Indirect-fire units must fire from where they started. */
export const canFireAfterMoving = (game, unit) => !hasAttribute(unitDef(game, unit), 'indirect');

/** Has this unit already moved this turn (only known for a unit whose move was interrupted; a fresh order says so itself)? */
export const hasMovedAlready = (unit) => !!unit.halted && unit.halted.moved;

/**
 * Best tile to attack `target` from: prefers staying put, then high-defense terrain, then short moves.
 * Indirect units only consider their current tile. Returns [x, y] or null when no tile works.
 */
export function bestAttackTile(game, unit, target, reach) {
  const def = unitDef(game, unit);
  const candidates = hasAttribute(def, 'indirect') ? [{ x: unit.x, y: unit.y, cost: reach.costAt(unit.x, unit.y) ?? 0 }] : [...reach.tiles()];
  let best = null;
  for (const { x, y, cost } of candidates) {
    if (!canAttackFrom(game, unit, target, x, y)) continue;
    const score = (x === unit.x && y === unit.y ? 100 : 0) + terrainAt(game, x, y).defense * 3 - cost;
    if (!best || score > best.score) best = { x, y, score };
  }
  return best && [best.x, best.y];
}
