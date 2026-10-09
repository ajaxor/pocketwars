// The main menu's moving background: a random battlefield, drawn with the game's own terrain and unit art, drifting diagonally.
//
// The battlefield is generated on a TORUS (every noise field and road wraps round the edges), so the picture tiles with no seam
// and can scroll for ever. It is one biome, a tileset chosen at random (grass, snow, sand...), with lakes, woods, mountains, a couple
// of roads, scattered buildings and clashes: small groups of two colours' units facing each other. The units are animated.
//
//   generateField(registry, random?, size?)   -> a plain-data field: { size, terrain, tileset, ground, owners, units, teams }
//   paintField(g, field, registry, S, opts)   draw a field with S pixels a tile (terrain first, then the units, back to front);
//                                             opts.units false leaves the units out, opts.now sets the animation clock
//   paintUnits(g, field, registry, S, now)    just the units, for drawing them afresh every frame over a painted terrain
//   new MenuBackdrop(doc, registry, opts)     the canvas that does both and scrolls; .canvas goes on the page, .start() and .stop()
//
// generateField needs no canvas, so tests can check what it makes. The class does nothing where there is no 2D context (tests).

import { drawTerrainLayer } from './terrain-layer.js';
import { drawUnit } from './unit-sprites.js';

/** Tiles along each side of the battlefield. */
export const FIELD_SIZE = 24;
/** How fast the picture drifts, in CSS pixels a second along each axis (so the path is a true diagonal). */
export const DRIFT = 26;
/** The most device pixels per CSS pixel the picture is drawn with: it is dimmed and drifting, so more would only cost memory. */
const MAX_DPR = 1.5;
/** The shortest time between two drawn frames, in ms (about 30 a second). */
const FRAME_MS = 30;

const wrap = (v, n) => ((v % n) + n) % n;
const smooth = (t) => t * t * (3 - 2 * t);
/** Shortest distance between two coordinates on a ring of `n`. */
const ring = (a, b, n) => { const d = Math.abs(a - b) % n; return Math.min(d, n - d); };
const pick = (list, random) => list[Math.floor(random() * list.length)];
const shuffled = (list, random) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** Smooth random values in [0, 1] over a wrapping `size` x `size` grid; `cell` is the size of one blob (it divides `size`). */
function noiseField(size, cell, random) {
  const n = Math.max(1, Math.round(size / cell));
  const lattice = Array.from({ length: n }, () => Array.from({ length: n }, () => random()));
  const at = (i, j) => lattice[wrap(j, n)][wrap(i, n)];
  return (x, y) => {
    const gx = x / (size / n), gy = y / (size / n);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = smooth(gx - x0), fy = smooth(gy - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/** The value that `fraction` of the numbers lie below. */
const quantile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))];

/** The units that can stand in the picture: no structures, mines or submerged ships, nothing that is not drawn as a sprite. */
function unitPool(registry) {
  const pool = { land: [], air: [], sea: [] };
  for (const id of registry.unitIds) {
    const def = registry.unit(id);
    if (!def.render?.sprite || def.render.inWall || def.attributes?.structure) continue;
    if (['structure', 'mine'].includes(def.category) || def.layer === 'underwater' || def.moveClass === 'diver') continue;
    (def.moveClass === 'air' ? pool.air : def.moveClass === 'naval' ? pool.sea : pool.land).push(id);
  }
  return pool;
}

/** A building that can be placed on the field, and how often. */
const BUILDINGS = [['city', 4], ['factory', 2], ['barracks', 2], ['airfield', 1], ['hq', 1]];

/**
 * Make a battlefield.
 * @param {object} registry
 * @param {() => number} [random]  returns [0, 1); pass a seeded one for a repeatable field
 * @param {number} [size]          tiles along each side; at least 16, and a multiple of 8 keeps the noise even
 */
export function generateField(registry, random = Math.random, size = FIELD_SIZE) {
  size = Math.max(16, Math.round(size));
  const has = (id) => !!registry.terrain[id];
  const terrainId = (id) => (has(id) ? id : 'plain');
  const grid = (fill) => Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => fill(x, y)));

  // one biome for the whole picture: a tileset picked at random, and the ground that goes with it
  const biome = registry.tilesetIds?.length ? pick(registry.tilesetIds, random) : null;
  const tileset = grid(() => biome);
  const ground = grid((x, y) => registry.tilesetDef?.(tileset[y][x])?.ground ?? registry.defaultGround ?? null);

  // land and water, woods, mountains and rough ground, each by thresholds on smooth noise so the shares are the same for every seed
  const big = noiseField(size, size / 4, random), mid = noiseField(size, size / 8, random), small = noiseField(size, size / 8, random), rough = noiseField(size, size / 5, random);
  const height = grid((x, y) => 0.65 * big(x, y) + 0.35 * mid(x, y));
  const flat = height.flat();
  const seaLevel = quantile(flat, 0.08 + random() * 0.14), peakLevel = quantile(flat, 0.93 - random() * 0.04);
  const woodLevel = quantile(grid((x, y) => small(x, y)).flat(), 0.78 - random() * 0.12), roughLevel = quantile(grid((x, y) => rough(x, y)).flat(), 0.92);
  const terrain = grid((x, y) => {
    const h = height[y][x];
    if (h < seaLevel) return terrainId('sea');
    if (h > peakLevel) return terrainId('mountain');
    if (small(x, y) > woodLevel) return terrainId('forest');
    if (rough(x, y) > roughLevel) return terrainId('rough');
    return terrainId('plain');
  });
  const isSea = (x, y) => !!registry.terrain[terrain[wrap(y, size)][wrap(x, size)]]?.render?.water;
  if (has('shoals')) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (isSea(x, y) && terrain[y][x] === terrainId('sea') && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isSea(x + dx, y + dy)) && random() < .7) terrain[y][x] = 'shoals';
    }
  }

  // a road or two each way: a sine wave with a whole number of periods, so it joins up where the picture wraps
  if (has('road')) {
    const paint = (across) => {
      const base = Math.floor(random() * size), amp = 1 + Math.floor(random() * 3), turns = 1 + Math.floor(random() * 2), phase = random() * Math.PI * 2;
      let prev = null;
      for (let i = 0; i <= size; i++) {
        const at = wrap(base + Math.round(amp * Math.sin((i / size) * turns * Math.PI * 2 + phase)), size);
        const here = wrap(i, size);
        const cells = [[here, at]];
        if (prev !== null && prev !== at) for (let k = Math.min(prev, at); k <= Math.max(prev, at); k++) cells.push([here, k]);   // fill the step so tiles join side to side
        for (const [a, b] of cells) { const [x, y] = across ? [a, b] : [b, a]; terrain[y][x] = 'road'; }   // over a lake it reads as a causeway
        prev = at;
      }
    };
    for (let i = 0, n = random() < .4 ? 2 : 1; i < n; i++) paint(true);
    for (let i = 0, n = random() < .4 ? 2 : 1; i < n; i++) paint(false);
  }

  // buildings on open ground, spaced out, each held by one of a few colours or by nobody
  const teams = shuffled(registry.factionIds, random).slice(0, Math.min(4, registry.factionIds.length));
  const owners = grid(() => null);
  const properties = [];
  const margin = (v) => v >= 1 && v <= size - 2;
  for (let tries = 0; tries < 400 && properties.length < 7; tries++) {
    const x = Math.floor(random() * size), y = Math.floor(random() * size);
    if (!margin(x) || !margin(y) || terrain[y][x] !== 'plain') continue;
    if (properties.some((p) => ring(p.x, x, size) + ring(p.y, y, size) < 4)) continue;
    const total = BUILDINGS.filter(([id]) => has(id)).reduce((s, [, w]) => s + w, 0);
    let roll = random() * total, kind = 'city';
    for (const [id, w] of BUILDINGS) { if (!has(id)) continue; roll -= w; if (roll <= 0) { kind = id; break; } }
    terrain[y][x] = kind;
    owners[y][x] = kind === 'city' && random() < .4 ? null : pick(teams, random) ?? null;
    properties.push({ x, y });
  }

  // clashes: two colours' units facing each other across a gap, each unit on ground its kind can stand on
  const pool = unitPool(registry);
  const occupied = new Set();
  const canStand = (def, x, y) => {
    if (!margin(x) || !margin(y) || occupied.has(y * size + x)) return false;
    const t = registry.terrain[terrain[y][x]];
    if (t.attributes?.property) return false;
    if (def.moveClass === 'air') return true;
    const cost = t.moveCost?.[def.moveClass];
    return cost !== null && cost !== undefined;
  };
  const units = [];
  const anchors = [];
  for (let tries = 0; tries < 200 && anchors.length < 5; tries++) {
    const a = { x: 3 + Math.floor(random() * (size - 6)), y: 3 + Math.floor(random() * (size - 6)) };
    if (anchors.every((b) => ring(a.x, b.x, size) + ring(a.y, b.y, size) >= 7)) anchors.push(a);
  }
  for (const anchor of anchors) {
    const [a, b] = shuffled(teams, random);
    if (!b) break;
    const [dx, dy] = pick([[1, 0], [1, 0], [0, 1], [1, 1], [1, -1]], random);
    for (const [side, faction] of [[-1, a], [1, b]]) {
      const cx = anchor.x + dx * side * 2, cy = anchor.y + dy * side * 2;
      const want = 3 + Math.floor(random() * 3);
      for (let n = 0; n < want; n++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const roll = random();
          const kind = roll < .72 ? 'land' : roll < .86 ? 'air' : 'sea';
          if (!pool[kind].length) continue;
          const type = pick(pool[kind], random), def = registry.unit(type);
          let spot = null;
          for (let r = 1; r <= 5 && !spot; r++) {
            for (let k = 0; k < 6 && !spot; k++) {
              const x = cx + Math.round((random() * 2 - 1) * r), y = cy + Math.round((random() * 2 - 1) * r);
              if (canStand(def, x, y)) spot = { x, y };
            }
          }
          if (!spot) continue;
          occupied.add(spot.y * size + spot.x);
          units.push({ type, x: spot.x, y: spot.y, faction, face: (dx === 0 ? 1 : dx) * -side });   // each side looks at the other
          break;
        }
      }
    }
  }
  units.sort((p, q) => p.y - q.y || p.x - q.x);   // back to front
  return { size, terrain, tileset, ground, owners, units, teams };
}

/** Draw `field` with `S` pixels a tile: the terrain layer, then each unit, back to front (`units: false` leaves them out; `now` is the animation clock in ms). */
export function paintField(g, field, registry, S, { units = true, now = 0 } = {}) {
  const { size } = field;
  const skinAt = (x, y) => registry.skin(field.tileset[y][x], field.terrain[y][x]);
  const colorOf = (faction) => (faction ? registry.faction(faction).color : registry.rules.neutralColor);
  drawTerrainLayer(g, {
    width: size, height: size, S, now: 0, terrainAt: skinAt,
    ownerColorAt: (x, y) => (skinAt(x, y).attributes.property ? colorOf(field.owners[y][x]) : null),
    groundAt: (x, y) => registry.groundDef(field.ground[y][x]),
  });
  if (units) paintUnits(g, field, registry, S, now);
}

/** Draw the field's units (back to front) at animation time `now` ms, with `S` pixels a tile. */
export function paintUnits(g, field, registry, S, now = 0) {
  for (const u of field.units) {
    const def = registry.unit(u.type), f = registry.faction(u.faction);
    drawUnit(g, { type: u.type, x: u.x, y: u.y, hp: 10 }, {
      def, colors: { color: f.color, dark: f.dark }, px: u.x * S, py: u.y * S, size: S, now, animate: true, moving: false, showHp: false,
      face: def.render.facing === false ? 1 : u.face, onWater: !!registry.terrain[field.terrain[u.y][u.x]]?.render?.water,
    });
  }
}

const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The scrolling picture. `canvas` fills whatever contains it; call start() once the page has it. Everything heavy (making the field,
 * painting it) waits for the next tick so the menu shows first. Nothing happens without a 2D context (a test's fake document).
 * opts: { random, raf, caf, win } (animation-frame functions and the window, replaceable for tests).
 */
export class MenuBackdrop {
  constructor(doc, registry, { random = Math.random, raf, caf, win = globalThis } = {}) {
    this.doc = doc;
    this.registry = registry;
    this.random = random;
    this.win = win;
    this.raf = raf ?? win.requestAnimationFrame?.bind(win) ?? null;
    this.caf = caf ?? win.cancelAnimationFrame?.bind(win) ?? null;
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'title-bg';
    this.g = this.canvas.getContext?.('2d') ?? null;
    this.world = null;       // the painted field
    this.field = null;       // the data it was painted from
    this.pos = 0;            // how far it has drifted, in canvas pixels along each axis
    this.last = null;
    this.frame = null;
    this.timer = null;
    this.stopped = false;
    this.paused = false;
    this.onResize = () => { this.#fit(); this.#draw(this.clock); };
    this.clock = 0;          // the animation clock, ms
  }

  start() {
    if (!this.g || this.stopped) return this;
    this.timer = (this.win.setTimeout ?? setTimeout)(() => { this.timer = null; this.#build(); }, 0);
    return this;
  }

  /** Stop the drifting while something covers the menu (and carry on when it is uncovered). */
  pause(on = true) {
    this.paused = on;
    if (on) { if (this.frame != null) this.caf?.(this.frame); this.frame = null; return; }
    this.last = null;
    if (this.world && !this.stopped && this.frame == null && !reducedMotion() && this.raf) this.frame = this.raf((t) => this.#tick(t));
  }

  stop() {
    this.stopped = true;
    if (this.timer != null) (this.win.clearTimeout ?? clearTimeout)(this.timer);
    if (this.frame != null) this.caf?.(this.frame);
    this.win.removeEventListener?.('resize', this.onResize);
    this.timer = this.frame = null;
    if (this.world) this.world.width = this.world.height = 0;   // give the picture's memory back at once rather than when the garbage collector gets to it
    this.world = null;
    this.canvas.width = this.canvas.height = 0;
    this.canvas.remove();
  }

  #build() {
    if (this.stopped) return;
    const { win, registry } = this;
    const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR);
    const long = Math.max(win.innerWidth || 800, win.innerHeight || 600);
    const tileCss = Math.max(64, Math.min(120, Math.round(long / 9)));          // how big a tile looks: zoomed right in, about nine tiles along the long side
    const tile = Math.max(24, Math.min(112, Math.round(tileCss * dpr)));         // how many pixels it is painted with (capped, so the picture stays small)
    this.scale = tileCss * dpr / tile;                                           // painted pixels -> canvas pixels
    this.field = generateField(registry, this.random);
    const world = this.doc.createElement('canvas');
    const wg = world.getContext?.('2d');
    if (!wg) return;
    world.width = world.height = this.field.size * tile;
    paintField(wg, this.field, registry, tile, { units: false });   // the terrain is painted once; the units are drawn afresh every frame so they can move
    this.tile = tile;
    this.world = world;
    this.#fit();
    this.canvas.classList.add('is-on');
    this.win.addEventListener?.('resize', this.onResize);
    this.#draw(0);
    if (!reducedMotion() && this.raf && !this.paused) this.frame = this.raf((t) => this.#tick(t));
  }

  #fit() {
    const dpr = Math.min(this.win.devicePixelRatio || 1, MAX_DPR);
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round((this.win.innerWidth || 800) * dpr));
    this.canvas.height = Math.max(1, Math.round((this.win.innerHeight || 600) * dpr));
  }

  #tick(now) {
    if (this.stopped || this.paused) return;
    if (this.last != null && now - this.last < FRAME_MS) { this.frame = this.raf((t) => this.#tick(t)); return; }   // no more than about 30 frames a second: it is only a backdrop, and the animated units cost more than the terrain
    const dt = this.last == null ? 0 : Math.min(.1, (now - this.last) / 1000);
    this.last = now;
    this.pos += DRIFT * this.dpr * dt;
    this.clock += dt * 1000;   // the units' animation runs on the time the menu has been showing, not the page's clock, so it carries on smoothly after a pause
    this.#draw(this.clock);
    this.frame = this.raf((t) => this.#tick(t));
  }

  /** Lay the picture over the canvas, copies side by side, shifted by how far it has drifted, and the animated units over each copy. */
  #draw(now = 0) {
    const { g, world, canvas, field } = this;
    if (!g || !world) return;
    const side = Math.max(1, Math.round(world.width * this.scale));
    const shift = Math.floor(this.pos) % side;
    const k = side / world.width, cell = this.tile * k;
    for (let y = -shift; y < canvas.height; y += side) {
      for (let x = -shift; x < canvas.width; x += side) {
        g.drawImage(world, x, y, side, side);
        g.save();
        g.translate(x, y);
        g.scale(k, k);
        this.#units(now, x, y, cell);
        g.restore();
      }
    }
  }

  /** The units of one copy of the picture (placed at x, y on the canvas), leaving out any that are off screen. */
  #units(now, ox, oy, cell) {
    const { g, canvas, field, registry, tile } = this;
    const live = field.units.filter((u) => ox + (u.x + 1) * cell > 0 && ox + u.x * cell < canvas.width && oy + (u.y + 1) * cell > 0 && oy + u.y * cell < canvas.height);
    if (live.length) paintUnits(g, { ...field, units: live }, registry, tile, now);
  }
}
