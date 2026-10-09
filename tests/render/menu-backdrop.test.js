// The main menu's battlefield: the generator (plain data, so checked in full), painting against a recording context, and the scrolling canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { FakeDoc } from '../helpers/fake-dom.js';
import { loadRegistry } from '../../src/data/loader.js';
import { DRIFT, FIELD_SIZE, MenuBackdrop, generateField, paintField, paintUnits } from '../../src/render/menu-backdrop.js';

const registry = await loadRegistry(readData);

/** A small repeatable random generator (mulberry32). */
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test('a field is a square grid of known terrain, tilesets and ground', () => {
  for (const seed of SEEDS) {
    const f = generateField(registry, seeded(seed));
    assert.equal(f.size, FIELD_SIZE);
    for (const grid of [f.terrain, f.tileset, f.ground, f.owners]) {
      assert.equal(grid.length, f.size);
      assert.ok(grid.every((row) => row.length === f.size));
    }
    for (const id of new Set(f.terrain.flat())) assert.ok(registry.terrain[id], `terrain ${id}`);
    for (const id of new Set(f.tileset.flat())) assert.ok(registry.tilesetIds.includes(id), `tileset ${id}`);
    for (const id of new Set(f.ground.flat())) assert.ok(registry.ground[id], `ground ${id}`);
  }
});

test('the whole field is one biome, and different seeds pick different ones', () => {
  const chosen = new Set();
  for (const seed of SEEDS) {
    const f = generateField(registry, seeded(seed));
    const sets = new Set(f.tileset.flat());
    assert.equal(sets.size, 1, `seed ${seed}: one tileset, not ${[...sets]}`);
    assert.equal(new Set(f.ground.flat()).size, 1, 'and one ground');
    chosen.add([...sets][0]);
  }
  assert.ok(chosen.size >= 3, `several biomes come up: ${[...chosen]}`);
});

test('the same seed gives the same field, and different seeds give different ones', () => {
  assert.deepEqual(generateField(registry, seeded(3)), generateField(registry, seeded(3)));
  assert.notDeepEqual(generateField(registry, seeded(3)).terrain, generateField(registry, seeded(4)).terrain);
});

test('there is a real battlefield: water and land, woods or mountains, roads, buildings and units of several colours', () => {
  for (const seed of SEEDS) {
    const f = generateField(registry, seeded(seed));
    const kinds = new Set(f.terrain.flat());
    assert.ok(kinds.has('plain') && kinds.has('road'), `seed ${seed}: land and roads`);
    assert.ok(kinds.has('sea') || kinds.has('shoals'), `seed ${seed}: some water`);
    assert.ok(kinds.has('forest') || kinds.has('mountain'), `seed ${seed}: woods or mountains`);
    assert.ok([...kinds].some((k) => registry.terrain[k].attributes.property), `seed ${seed}: buildings`);
    assert.ok(f.units.length >= 12, `seed ${seed}: ${f.units.length} units`);
    assert.ok(new Set(f.units.map((u) => u.faction)).size >= 2, `seed ${seed}: two sides at least`);
  }
});

test('every unit stands on ground its kind can use, on its own tile, away from the edge where the picture wraps', () => {
  for (const seed of SEEDS) {
    const f = generateField(registry, seeded(seed));
    const seen = new Set();
    for (const u of f.units) {
      const def = registry.unit(u.type), t = registry.terrain[f.terrain[u.y][u.x]];
      assert.ok(u.x >= 1 && u.x <= f.size - 2 && u.y >= 1 && u.y <= f.size - 2, `${u.type} at ${u.x},${u.y} is inside the margin`);
      assert.ok(!seen.has(u.y * f.size + u.x), 'one unit to a tile');
      seen.add(u.y * f.size + u.x);
      assert.ok(!t.attributes.property, `${u.type} is not on a building`);
      if (def.moveClass !== 'air') assert.notEqual(t.moveCost[def.moveClass] ?? null, null, `${u.type} (${def.moveClass}) cannot stand on ${f.terrain[u.y][u.x]}`);
      assert.ok(registry.factionIds.includes(u.faction));
      assert.ok(u.face === 1 || u.face === -1);
    }
  }
});

test('no structures, mines or submerged ships are drawn as units', () => {
  const types = new Set(SEEDS.flatMap((seed) => generateField(registry, seeded(seed)).units.map((u) => u.type)));
  for (const type of types) {
    const def = registry.unit(type);
    assert.ok(!def.attributes?.structure && !['structure', 'mine'].includes(def.category) && def.layer !== 'underwater', type);
  }
  assert.ok(types.size > 12, 'a good mix of units');
});

test('buildings belong to a colour in play or to nobody, and only buildings have owners', () => {
  const f = generateField(registry, seeded(5));
  for (let y = 0; y < f.size; y++) for (let x = 0; x < f.size; x++) {
    const owner = f.owners[y][x];
    if (owner === null) continue;
    assert.ok(registry.terrain[f.terrain[y][x]].attributes.property, 'an owned tile is a building');
    assert.ok(f.teams.includes(owner));
  }
});

test('the field wraps: tiles across the seam match about as often as tiles side by side anywhere else', () => {
  // all the noise and the roads wrap, so the edge is not special; a field that did not wrap would match far less across it
  let seam = 0, inside = 0, seamN = 0, insideN = 0;
  for (const seed of SEEDS) {
    const { terrain, size } = generateField(registry, seeded(seed));
    for (let a = 0; a < size; a++) {
      for (let k = 0; k < size; k++) {
        const across = [[terrain[k][size - 1], terrain[k][0]], [terrain[size - 1][k], terrain[0][k]]];
        for (const [p, q] of across) { seamN++; if (p === q) seam++; }
      }
      if (a < size - 1) {
        for (let k = 0; k < size; k++) for (const [p, q] of [[terrain[k][a], terrain[k][a + 1]], [terrain[a][k], terrain[a + 1][k]]]) { insideN++; if (p === q) inside++; }
      }
    }
  }
  // each seam is counted once per column of `a`, so compare rates
  assert.ok(seam / seamN > inside / insideN - .06, `seam ${(seam / seamN).toFixed(3)} against ${(inside / insideN).toFixed(3)} inside`);
});

test('a smaller field and a registry with no tilesets still work', () => {
  const f = generateField(registry, seeded(1), 24);
  assert.equal(f.size, 24);
  const bare = { ...registry, tilesetIds: [], tilesetDef: () => null };
  const g = generateField(bare, seeded(1));
  assert.ok(g.tileset.flat().every((t) => t === null));
});

// ---- painting ----------------------------------------------------------------------------------------------------------------------------
function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push(p); return { addColorStop() {} }; }),
    set: (_, p) => { calls.push('=' + String(p)); return true; },
  });
  return { ctx, calls };
}

test('paintField draws the terrain layer and then every unit without crashing', () => {
  const f = generateField(registry, seeded(2));
  const { ctx, calls } = recorder();
  paintField(ctx, f, registry, 32);
  assert.ok(calls.length > f.size * f.size, 'something was drawn for every tile');
  assert.ok(calls.includes('fillRect') && calls.includes('roundRect'));
  assert.ok(calls.includes('drawImage') || calls.includes('save'), 'the units were drawn');
});

test('paintField can leave the units out, and paintUnits draws just them', () => {
  const f = generateField(registry, seeded(2));
  const all = recorder(), bare = recorder(), only = recorder();
  paintField(all.ctx, f, registry, 32);
  paintField(bare.ctx, f, registry, 32, { units: false });
  paintUnits(only.ctx, f, registry, 32, 500);
  assert.ok(bare.calls.length < all.calls.length, 'the units add drawing');
  assert.ok(only.calls.length > 0 && only.calls.length < all.calls.length);
});

// ---- the scrolling canvas ------------------------------------------------------------------------------------------------------------------
/** A document whose canvases have a recording 2D context, and a window with a manual animation clock. */
function stage() {
  const doc = new FakeDoc();
  const made = [];
  doc.createElement = ((make) => (tag) => {
    const el = make.call(doc, tag);
    if (tag === 'canvas') { const rec = recorder(); el.getContext = () => rec.ctx; el.calls = rec.calls; made.push(el); }
    return el;
  })(doc.createElement);
  let frames = [], id = 0;
  const timers = [];
  const win = {
    innerWidth: 400, innerHeight: 700, devicePixelRatio: 1,
    requestAnimationFrame: (fn) => { frames.push([++id, fn]); return id; }, cancelAnimationFrame: (n) => { frames = frames.filter(([i]) => i !== n); },
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    addEventListener() {}, removeEventListener() {},
  };
  const tick = (ms) => { const due = frames; frames = []; for (const [, fn] of due) fn(ms); };
  return { doc, win, made, timers, tick, frames: () => frames.length };
}

test('without a 2D context the backdrop does nothing and stops cleanly', () => {
  const b = new MenuBackdrop(new FakeDoc(), registry);
  assert.equal(b.start(), b);
  b.stop();
  assert.equal(b.stopped, true);
});

test('the field is made on the next tick, not while the menu is first shown, then it drifts diagonally', () => {
  const { doc, win, made, timers, tick, frames } = stage();
  const b = new MenuBackdrop(doc, registry, { random: seeded(8), win });
  b.start();
  assert.equal(made.length, 1, 'only the visible canvas so far');
  assert.equal(b.world, null);
  timers.shift()();
  assert.ok(b.world, 'now the battlefield exists');
  assert.ok(b.canvas.classList.contains('is-on'), 'and fades in');
  assert.equal(frames(), 1);
  tick(1000); tick(1100);   // a tenth of a second (a longer gap, such as a hidden tab, is cut to that)
  assert.ok(Math.abs(b.pos - DRIFT * .1) < 1e-6, `a tenth of a second at ${DRIFT}px a second, got ${b.pos}`);
  tick(5000);
  assert.ok(Math.abs(b.pos - DRIFT * .2) < 1e-6, 'a long gap between frames counts as a tenth of a second at most');
  const draws = made[0].calls.filter((c) => c === 'drawImage').length;
  assert.ok(draws >= 4, 'copies of the picture side by side cover the window');
  assert.ok(made[0].calls.length > 0);
});

test('the picture is zoomed in: a tile is at least 64 CSS pixels, so a phone sees only a handful of tiles', () => {
  const { doc, win, timers } = stage();
  const b = new MenuBackdrop(doc, registry, { random: seeded(8), win }).start();
  timers.shift()();
  const tileCss = b.world.width * b.scale / b.field.size;
  assert.ok(tileCss >= 64, `a tile is ${tileCss}px`);
  assert.ok(win.innerHeight / tileCss < 12, 'under a dozen tiles from top to bottom');
  assert.ok(b.world.width <= 24 * 112, 'and the painted picture stays small');
});

test('the units are drawn afresh on every frame, so they animate, and the terrain picture is not touched', () => {
  const { doc, win, made, timers, tick } = stage();
  const b = new MenuBackdrop(doc, registry, { random: seeded(8), win }).start();
  timers.shift()();
  tick(0); tick(100);
  const calls = made[0].calls;
  const before = calls.length;
  tick(200);
  const frame = calls.slice(before);
  assert.ok(frame.includes('drawImage'), 'the terrain is copied over');
  assert.ok(frame.filter((c) => c === 'save').length > 1, 'and the units are drawn on top of it');
  assert.ok(b.clock > 0, 'the animation clock runs');
});

test('pause stops the drift and resume carries on without a jump', () => {
  const { doc, win, timers, tick, frames } = stage();
  const b = new MenuBackdrop(doc, registry, { random: seeded(8), win }).start();
  timers.shift()(); tick(0); tick(500);
  const at = b.pos;
  b.pause(true);
  assert.equal(frames(), 0);
  tick(9000);
  assert.equal(b.pos, at);
  b.pause(false);
  assert.equal(frames(), 1);
  tick(20000); tick(20500);
  assert.ok(b.pos - at <= DRIFT * .5 + 1e-6, 'the time spent covered does not count');
  assert.ok(b.pos > at, 'and it moves on again');
});

test('stop cancels the animation and takes the canvas away', () => {
  const { doc, win, timers, frames } = stage();
  const slot = doc.createElement('div');
  const b = new MenuBackdrop(doc, registry, { random: seeded(8), win }).start();
  slot.append(b.canvas);
  timers.shift()();
  const world = b.world;
  b.stop();
  assert.equal(frames(), 0);
  assert.equal(slot.children.length, 0);
  assert.equal(b.world, null, 'the painted picture is let go');
  assert.equal(world.width, 0, 'and its pixels are freed at once');
  b.start();
  assert.equal(timers.length, 0, 'a stopped backdrop does not start again');
});

test('with reduced motion it paints once and does not animate', () => {
  const { doc, win, timers, frames } = stage();
  const was = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const b = new MenuBackdrop(doc, registry, { random: seeded(8), win }).start();
    timers.shift()();
    assert.ok(b.world);
    assert.equal(frames(), 0);
  } finally { globalThis.matchMedia = was; }
});
