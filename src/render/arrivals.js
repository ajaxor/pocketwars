// Arrivals: units sliding in from off screen (reinforcements), several at once, each on its own path with its own delay.
// Purely visual: the units already exist in the game, this only decides where they are DRAWN until they have arrived. The opening
// of a battle uses it for the player's starting units; a campaign script can use it any time (spawn the units, then enter them).
//
//   const arrivals = new Arrivals()
//   arrivals.enter([{ unitId, path: [[x, y], ...], delay?, msPerTile? }], now, onDone)   path is in tiles, may start off the map
//   arrivals.positionOf(unitId, now, S)   [px, py] while on its way (waiting its turn: at the start of its path), else null
//   arrivals.facingOf(unitId, now)        1 / -1 from its last sideways step so far, or null
//   arrivals.has(unitId)                  true from enter() until the unit has arrived
//   arrivals.update(now)                  once a frame: retires arrived units, calls onDone when the whole batch is in
//   arrivals.finish()                     skip: everyone is there now (onDone is called)
//
//   entryPath(target, bounds, { facing, margin, from })   the path for one unit: in a straight line from outside `bounds` (the tiles on
//       screen, {left, top, right, bottom}) to its tile. Unless `from` names an edge ('left'|'right'|'top'|'bottom') it comes from the
//       nearest edge it can drive in from without turning round, so a unit facing right enters from the left.
//   planEntrances(units, bounds, { from, gap, msPerTile, maxSpread })   entries for enter(): nearest to its edge first, one every `gap` ms

export const MS_PER_TILE_IN = 95;

export class Arrivals {
  constructor() { this.items = new Map(); this.batches = new Set(); }

  get active() { return this.items.size > 0; }
  has(unitId) { return this.items.has(unitId); }

  enter(entries, now, onDone) {
    const batch = { left: 0, onDone };
    for (const e of entries) {
      const path = e.path;
      if (!path || path.length < 2) continue;
      const lens = [0];
      for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const ms = e.msPerTile ?? MS_PER_TILE_IN;
      this.items.set(e.unitId, { path, lens, t: now + (e.delay ?? 0), d: Math.max(1, lens[lens.length - 1] * ms), batch });
      batch.left++;
    }
    if (!batch.left) { onDone?.(); return; }
    this.batches.add(batch);
  }

  /** Where `a` is, in tiles, at `now` (clamped to its path). */
  #at(a, now) {
    const total = a.lens[a.lens.length - 1];
    const f = Math.min(1, Math.max(0, (now - a.t) / a.d)) * total;
    let i = 1;
    while (i < a.lens.length - 1 && a.lens[i] < f) i++;
    const seg = a.lens[i] - a.lens[i - 1] || 1, r = Math.min(1, (f - a.lens[i - 1]) / seg);
    const [ax, ay] = a.path[i - 1], [bx, by] = a.path[i];
    return { x: ax + (bx - ax) * r, y: ay + (by - ay) * r, i };
  }

  positionOf(unitId, now, S) {
    const a = this.items.get(unitId);
    if (!a) return null;
    const p = this.#at(a, now);
    return [p.x * S, p.y * S];
  }

  facingOf(unitId, now) {
    const a = this.items.get(unitId);
    if (!a) return null;
    for (let k = this.#at(a, now).i; k >= 1; k--) { const dx = a.path[k][0] - a.path[k - 1][0]; if (Math.abs(dx) > 1e-6) return dx > 0 ? 1 : -1; }
    return null;
  }

  /** The time (ms) at which the last unit will have arrived, or 0. */
  get endsAt() { let t = 0; for (const a of this.items.values()) t = Math.max(t, a.t + a.d); return t; }

  update(now) {
    for (const [id, a] of this.items) if (now >= a.t + a.d) this.#retire(id, a);
  }

  finish() { for (const [id, a] of [...this.items]) this.#retire(id, a); }

  #retire(id, a) {
    this.items.delete(id);
    if (--a.batch.left <= 0 && this.batches.delete(a.batch)) a.batch.onDone?.();
  }
}

/** Where one unit comes in from. `target` is its tile {x, y}. */
export function entryPath(target, bounds, { facing = 1, margin = 1.5, from = null } = {}) {
  const { x, y } = target;
  const edges = {
    left: { d: x - bounds.left, start: [Math.floor(bounds.left) - margin, y], dir: 1 },
    right: { d: bounds.right - (x + 1), start: [Math.ceil(bounds.right) + margin - 1, y], dir: -1 },
    top: { d: y - bounds.top, start: [x, Math.floor(bounds.top) - margin], dir: 0 },
    bottom: { d: bounds.bottom - (y + 1), start: [x, Math.ceil(bounds.bottom) + margin - 1], dir: 0 },
  };
  let pick = from && edges[from] ? edges[from] : null;
  if (!pick) {
    const ok = Object.values(edges).filter((e) => e.dir === 0 || e.dir === (facing < 0 ? -1 : 1));
    pick = ok.reduce((best, e) => (e.d < best.d ? e : best), ok[0]);
  }
  return [pick.start, [x, y]];
}

/** Entries for Arrivals.enter(): `units` are game units; the whole sequence is spread over at most `maxSpread` ms. */
export function planEntrances(units, bounds, { from = null, gap = 170, msPerTile = MS_PER_TILE_IN, maxSpread = 1600 } = {}) {
  const planned = units.map((u) => {
    const path = typeof from === 'function' ? from(u) : entryPath(u, bounds, { facing: u.facing ?? 1, from });
    const len = path.length > 1 ? Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]) : 0;
    return { unitId: u.id, path, len };
  });
  planned.sort((a, b) => a.len - b.len);
  const step = planned.length > 1 ? Math.min(gap, maxSpread / (planned.length - 1)) : 0;
  return planned.map((p, i) => ({ unitId: p.unitId, path: p.path, delay: i * step, msPerTile }));
}
