// Terrain themes and the merged terrain layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { BOARD_COLOR, backdrop, drawTerrainLayer, faceRect, paintTile } from '../../src/render/terrain-layer.js';
import { DEFAULT_TERRAIN_THEME, TERRAIN_THEMES, rnd, terrainThemeById } from '../../src/render/terrain-themes.js';

const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');

// Recording context: every call with its arguments and the fillStyle in force at the time.
function recorder() {
  const calls = [];
  const state = { fillStyle: null };
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push({ op: p, args: a, fill: state.fillStyle }); return { addColorStop() {} }; }),
    set: (_, p, v) => { if (p === 'fillStyle') state.fillStyle = v; return true; },
  });
  return { ctx, calls };
}

const layer = (theme, S, now) => {
  const { ctx, calls } = recorder();
  const terrainAt = (x, y) => registry.terrainDef(classic.terrain[y][x]);
  drawTerrainLayer(ctx, { width: classic.width, height: classic.height, S, theme, now, terrainAt, ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? '#e8712c' : null) });
  return calls;
};

test('every theme paints the whole classic map at several sizes and times', () => {
  for (const theme of TERRAIN_THEMES) {
    for (const S of [24, 40, 120]) for (const now of [0, 1234.5]) assert.ok(layer(theme, S, now).length > classic.width * classic.height, `${theme.id} @${S}`);
  }
});

test('theme ids are unique, each has a name and note, and the default exists', () => {
  const ids = TERRAIN_THEMES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TERRAIN_THEMES) assert.ok(t.name && t.note, t.id);
  assert.ok(ids.includes(DEFAULT_TERRAIN_THEME));
});

test('an unknown or missing theme id falls back to the default', () => {
  for (const id of ['nope', undefined, null]) assert.equal(terrainThemeById(id).id, DEFAULT_TERRAIN_THEME);
  assert.equal(terrainThemeById('pines').id, 'pines');
});

test('rnd is deterministic, in [0, 1) and varies with position and index', () => {
  assert.equal(rnd(3, 4, 5), rnd(3, 4, 5));
  const seen = new Set();
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) { const v = rnd(x, y, 1); assert.ok(v >= 0 && v < 1); seen.add(v); }
  assert.ok(seen.size > 90);
  assert.notEqual(rnd(1, 1, 0), rnd(1, 1, 1));
});

test('animated themes change with the clock and the others do not', () => {
  const sea = registry.terrainDef('sea'), nb = { n: null, e: null, s: null, w: null, ne: null, se: null, sw: null, nw: null };
  const ops = (theme, now) => { const { ctx, calls } = recorder(); paintTile(ctx, 0, 0, 40, sea, null, nb, theme, { x: 2, y: 3, now }); return JSON.stringify(calls); };
  assert.notEqual(ops(terrainThemeById('pines'), 0), ops(terrainThemeById('pines'), 700));
  assert.equal(ops(terrainThemeById('flat'), 0), ops(terrainThemeById('flat'), 700));
});

test('faceRect keeps outlines inside the tile', () => {
  const [x, y, w, h, r] = faceRect(2, 3, 40);
  assert.deepEqual([x, y, w, h], [80, 120, 40, 40]); assert.ok(r > 0);
  const [mx, , mw, , mr] = faceRect(2, 3, 40, 5);
  assert.ok(mx === 85 && mw === 30 && mr < r);
});

// ---- merged tiles: rounding depends on the neighbours ------------------------------------------------------------------
const G = '#86b95c', R = '#cdbb8f', SEA = '#3d7ec7';
const grass = { render: { base: G } };   // no decor: only the tile shape is under test
const all = (c) => ({ n: c, e: c, s: c, w: c, ne: c, se: c, sw: c, nw: c });
const paint = (nb) => { const { ctx, calls } = recorder(); paintTile(ctx, 0, 0, 40, grass, null, nb, terrainThemeById(), { x: 0, y: 0, now: 0 }); return calls; };
const radiiOf = (nb) => paint(nb).find((c) => c.op === 'roundRect').args[4];

test('merged: a tile inside a shape has square corners', () => assert.deepEqual(radiiOf(all(G)), [0, 0, 0, 0]));

test('merged: an isolated tile is rounded on all four corners', () => assert.ok(radiiOf(all(SEA)).every((v) => v > 0)));

test('merged: only the corner where both edges open outwards is rounded', () => {
  const [tl, tr, br, bl] = radiiOf({ ...all(G), n: SEA, w: SEA, nw: SEA, ne: SEA, sw: SEA });
  assert.ok(tl > 0);
  assert.deepEqual([tr, br, bl], [0, 0, 0]);
});

test('merged: a straight edge stays straight', () => assert.deepEqual(radiiOf({ ...all(G), n: R, ne: R, nw: R }), [0, 0, 0, 0]));

test('merged: a rounded corner is filled with the colour it opens onto, or the board where that is unclear', () => {
  const corner = (nb) => paint(nb).find((c) => c.op === 'fillRect' && c.args[0] === 0 && c.args[1] === 0).fill;
  assert.equal(corner({ ...all(G), n: SEA, w: SEA, nw: SEA }), SEA);               // a grass corner poking into the sea
  assert.equal(corner({ ...all(G), n: R, w: R, nw: SEA }), R);                      // two edges agree: they win over the diagonal
  assert.equal(corner({ ...all(G), n: null, w: null, nw: null }), BOARD_COLOR);     // the map corner
  assert.equal(corner({ ...all(G), n: R, w: SEA, nw: '#000000' }), BOARD_COLOR);    // three different neighbours
  assert.equal(backdrop(G, G, G, G), BOARD_COLOR);
});
