// The terrain art and the merged terrain layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { BOARD_COLOR, DIMMED_ALPHA, backdrop, drawTerrainLayer, faceRect, paintTile } from '../../src/render/terrain-layer.js';
import { TERRAIN_DECOR, rnd } from '../../src/render/terrain-art.js';

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

const NB = { n: null, e: null, s: null, w: null, ne: null, se: null, sw: null, nw: null };
const layer = (S, now) => {
  const { ctx, calls } = recorder();
  const terrainAt = (x, y) => registry.terrainDef(classic.terrain[y][x]);
  drawTerrainLayer(ctx, { width: classic.width, height: classic.height, S, now, terrainAt, ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? '#e8712c' : null) });
  return calls;
};

test('the classic map paints at several sizes and times', () => {
  for (const S of [24, 40, 120]) for (const now of [0, 1234.5]) assert.ok(layer(S, now).length > classic.width * classic.height, `@${S}`);
});

test('rnd is deterministic, in [0, 1) and varies with position and index', () => {
  assert.equal(rnd(3, 4, 5), rnd(3, 4, 5));
  const seen = new Set();
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) { const v = rnd(x, y, 1); assert.ok(v >= 0 && v < 1); seen.add(v); }
  assert.ok(seen.size > 90);
  assert.notEqual(rnd(1, 1, 0), rnd(1, 1, 1));
});

test('the sea twinkles with the clock and the ground does not', () => {
  const ops = (id, now) => { const { ctx, calls } = recorder(); paintTile(ctx, 0, 0, 40, registry.terrainDef(id), null, NB, { x: 2, y: 3, now }); return JSON.stringify(calls); };
  const over = (id) => new Set([0, 500, 1000, 1500, 2000, 2500, 3000].map((t) => ops(id, t))).size;
  assert.ok(over('sea') > 1);
  assert.equal(over('plain'), 1);
});

test('the sea draws the same beside land as in open water (no shoreline effect)', () => {
  const at = { x: 2, y: 3, now: 500 }, sea = registry.terrainDef('sea');
  const ops = (nb) => { const { ctx, calls } = recorder(); TERRAIN_DECOR.sea(ctx, 0, 0, 40, { ...at, nb }); return calls.length; };
  assert.equal(ops({ ...NB, n: '#3d8a3d' }), ops(NB));
  assert.ok(sea);
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
const paint = (nb) => { const { ctx, calls } = recorder(); paintTile(ctx, 0, 0, 40, grass, null, nb, { x: 0, y: 0, now: 0 }); return calls; };
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
  assert.equal(corner({ ...all(G), n: R, w: SEA, nw: '#000000' }), BOARD_COLOR);    // three different neighbours
  assert.equal(backdrop(G, G, G, G), BOARD_COLOR);
  assert.equal(backdrop(G, null, SEA, SEA), BOARD_COLOR);
});

test('merged: the map edge is flat, not rounded', () => {
  const edge = (nb) => radiiOf({ ...all(G), ...nb });
  assert.deepEqual(edge({ n: null, ne: null, nw: null }), [0, 0, 0, 0], 'top edge');
  assert.deepEqual(edge({ s: null, se: null, sw: null }), [0, 0, 0, 0], 'bottom edge');
  assert.deepEqual(edge({ w: null, nw: null, sw: null }), [0, 0, 0, 0], 'left edge');
  assert.deepEqual(edge({ e: null, ne: null, se: null }), [0, 0, 0, 0], 'right edge');
  assert.deepEqual(edge({ n: null, w: null, nw: null, ne: null, sw: null }), [0, 0, 0, 0], 'map corner');
});

test('merged: water against land on the map edge stays flat along the edge', () => {
  // a sea tile in the left edge column with grass above, below and to its right: only its inner corners round
  const sea = { render: { base: SEA } };
  const { ctx, calls } = recorder();
  paintTile(ctx, 0, 0, 40, sea, null, { n: G, ne: G, e: G, se: G, s: G, sw: null, w: null, nw: null }, { x: 0, y: 3, now: 0 });
  const [tl, tr, br, bl] = calls.find((c) => c.op === 'roundRect').args[4];
  assert.equal(tl, 0, 'top-left corner sits on the map edge');
  assert.equal(bl, 0, 'bottom-left corner sits on the map edge');
  assert.ok(tr > 0 && br > 0, 'corners that open onto land inside the map still round');
});

test('a dimmed building is composited once at DIMMED_ALPHA; a normal one is drawn at full strength', () => {
  const city = registry.terrainDef('city');
  const alphas = (dimmed) => {
    const sets = [];
    const ctx = new Proxy({}, { get: (_, p) => (typeof p === 'symbol' ? undefined : () => ({ addColorStop() {} })), set: (_, p, v) => { if (p === 'globalAlpha') sets.push(v); return true; } });
    paintTile(ctx, 0, 0, 40, city, '#e8712c', all(G), { x: 0, y: 0, now: 0, dimmed });
    return sets;
  };
  assert.deepEqual(alphas(false), []);
  assert.ok(alphas(true).includes(DIMMED_ALPHA));
  assert.ok(DIMMED_ALPHA > 0 && DIMMED_ALPHA < 1);
});

test('ground stays square against an inlaid road, but a road still rounds its own outer corners', () => {
  const nb = { ...all(G), n: R, w: '#c9ccd2', nw: R };
  assert.deepEqual(radiiOf(nb), [12, 0, 0, 0], 'rounds against the other ground');
  assert.deepEqual(radiiOf({ ...nb, inlay: { n: false, e: false, s: false, w: true } }), [0, 0, 0, 0], 'square against the road side');
  const road = { render: { base: '#c9ccd2', inlay: true } };
  const { ctx, calls } = recorder();
  paintTile(ctx, 0, 0, 40, road, null, { ...all('#c9ccd2'), n: G, w: G, nw: G, inlay: { n: false, e: true, s: true, w: false } }, { x: 0, y: 0, now: 0 });
  assert.deepEqual(calls.find((c) => c.op === 'roundRect').args[4], [12, 0, 0, 0]);
});

test('terrain without its own colour takes the colour of the ground under it, and ground decor is drawn', () => {
  const dirt = { render: { base: '#b59d6b', decor: 'dirt' } };
  const { ctx, calls } = recorder();
  paintTile(ctx, 0, 0, 40, registry.terrainDef('plain'), null, all('#b59d6b'), { x: 1, y: 1, now: 0, ground: dirt });
  assert.equal(calls.find((c) => c.op === 'roundRect').fill, '#b59d6b');
  assert.ok(calls.some((c) => c.op === 'ellipse'), 'dirt patches are drawn');
  const sea = recorder();
  paintTile(sea.ctx, 0, 0, 40, registry.terrainDef('sea'), null, all('#3d7ec7'), { x: 1, y: 1, now: 0, ground: dirt });
  assert.equal(sea.calls.find((c) => c.op === 'roundRect').fill, registry.terrainDef('sea').render.base, 'sea keeps its own colour');
});

test('mountains and forests vary with the tile position but repeat exactly for the same tile', () => {
  const ops = (id, x, y) => { const { ctx, calls } = recorder(); TERRAIN_DECOR[id](ctx, 0, 0, 80, { x, y, link: NB }); return JSON.stringify(calls); };
  for (const id of ['mountain', 'forest']) {
    assert.equal(ops(id, 3, 4), ops(id, 3, 4));
    const seen = new Set();
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) seen.add(ops(id, x, y));
    assert.ok(seen.size > 30, `${id}: most of 36 tiles differ`);
  }
});

test('a mountain stays (nearly) inside its tile', () => {
  for (let x = 0; x < 8; x++) {
    const { ctx, calls } = recorder(); TERRAIN_DECOR.mountain(ctx, 0, 0, 100, { x, y: 2, link: NB });
    const xs = calls.filter((c) => ['moveTo', 'lineTo', 'quadraticCurveTo'].includes(c.op)).flatMap((c) => c.args.filter((_, i) => i % 2 === 0));
    assert.ok(Math.min(...xs) > -8 && Math.max(...xs) < 108, `x=${x}`);   // curve control points may bulge a little
  }
});

test('shallows and deep sea are one shape: the shore is rounded, the border between them is not', () => {
  const shallows = registry.terrainDef('shallows'), sea = registry.terrainDef('sea');
  assert.equal(shallows.render.group, sea.render.group, 'same group in the data');
  const G = '#86b95c';
  const rounds = (t, nb) => { const { ctx } = recorder(); const at = { x: 0, y: 0, now: 0 }; paintTile(ctx, 0, 0, 40, t, null, nb, at); return at.radii; };
  const allWater = (c) => ({ n: c, e: c, s: c, w: c, ne: c, se: c, sw: c, nw: c });
  // a shallows tile with deep sea to the east and south, land to the north and west: only its outer (land-facing) corner rounds
  const nb = { ...allWater('#3d7ec7'), n: G, w: G, nw: G, ne: G, sw: G };
  nb.group = { n: G, w: G, nw: G, ne: G, sw: G, e: 'water', s: 'water', se: 'water' };
  assert.deepEqual(rounds(shallows, nb), [40 * .3, 0, 0, 0]);
});
