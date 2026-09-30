// Terrain tile styles: every style paints every shipped terrain, and the merged style rounds only outer corners.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { DEFAULT_TILE_STYLE, TILE_STYLES, drawTerrainLayer, faceRect, shade, tileStyleById } from '../../src/render/terrain-styles.js';

const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');

// Recording context: keeps every call with its arguments and the fillStyle in force at the time.
function recorder() {
  const calls = [];
  const state = { fillStyle: null };
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push({ op: p, args: a, fill: state.fillStyle }); return { addColorStop() {} }; }),
    set: (_, p, v) => { if (p === 'fillStyle') state.fillStyle = v; return true; },
  });
  return { ctx, calls };
}

const layerOf = (style, S = 40) => {
  const { ctx, calls } = recorder();
  const terrainAt = (x, y) => registry.terrainDef(classic.terrain[y][x]);
  drawTerrainLayer(ctx, { width: classic.width, height: classic.height, S, style, terrainAt, ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? '#e8712c' : null) });
  return calls;
};

test('every style paints the whole classic map without throwing', () => {
  for (const style of TILE_STYLES) assert.ok(layerOf(style).length > classic.width * classic.height, style.id);
});

test('every style paints each terrain type on its own, at several sizes', () => {
  for (const style of TILE_STYLES) {
    for (const id of registry.terrainIds) {
      for (const S of [24, 40, 120]) {
        const { ctx } = recorder();
        const nb = { n: null, e: null, s: null, w: null, ne: null, se: null, sw: null, nw: null };
        style.paint(ctx, 0, 0, S, registry.terrainDef(id), '#e8712c', nb);
      }
    }
  }
});

test('style ids are unique, each has a name, note and board colour, and the default exists', () => {
  const ids = TILE_STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of TILE_STYLES) assert.ok(s.name && s.note && /^#[0-9a-f]{6}$/i.test(s.board), s.id);
  assert.ok(ids.includes(DEFAULT_TILE_STYLE));
});

test('an unknown or missing style id falls back to the default', () => {
  assert.equal(tileStyleById('nope').id, DEFAULT_TILE_STYLE);
  assert.equal(tileStyleById(undefined).id, DEFAULT_TILE_STYLE);
  assert.equal(tileStyleById(null).id, DEFAULT_TILE_STYLE);
  assert.equal(tileStyleById('merged').id, 'merged');
});

test('faceRect follows the style inset and keeps outlines inside the face', () => {
  const soft = tileStyleById('soft');
  const [x, y, w, h, r] = faceRect(soft, 2, 3, 40);
  assert.ok(x > 80 && y > 120 && w < 40 && w === h && r > 0);
  const [mx, , mw, , mr] = faceRect(soft, 2, 3, 40, 5);
  assert.ok(mx > x && mw < w && mr < r);
  assert.deepEqual(faceRect(tileStyleById('square'), 1, 1, 40), [40, 40, 40, 40, 0]);
});

test('shade lightens and darkens, and understands short hex', () => {
  assert.equal(shade('#808080', 0), '#808080');
  assert.equal(shade('#000000', 1), '#ffffff');
  assert.equal(shade('#ffffff', -1), '#000000');
  assert.equal(shade('#fff', -1), '#000000');
  assert.ok(shade('#86b95c', -.3) < '#86b95c');
});

// ---- merged: rounding depends on the neighbours -----------------------------------------------------------------------
const merged = tileStyleById('merged');
const G = '#86b95c';
const R = '#cdbb8f';
const SEA = '#3d7ec7';
const grass = { render: { base: G } };
const radiiOf = (nb, terrain = grass) => {
  const { ctx, calls } = recorder();
  merged.paint(ctx, 0, 0, 40, terrain, null, nb);
  return calls.find((c) => c.op === 'roundRect').args[4];
};
const all = (c) => ({ n: c, e: c, s: c, w: c, ne: c, se: c, sw: c, nw: c });

test('merged: a tile inside a shape has square corners', () => assert.deepEqual(radiiOf(all(G)), [0, 0, 0, 0]));

test('merged: an isolated tile is rounded on all four corners', () => {
  const r = radiiOf(all(SEA));
  assert.ok(r.every((v) => v > 0));
});

test('merged: only the corner where both edges open outwards is rounded', () => {
  // grass with grass to the south and east but sea to the north and west: the top-left corner is the only outer one
  const [tl, tr, br, bl] = radiiOf({ ...all(G), n: SEA, w: SEA, nw: SEA, ne: SEA, sw: SEA });
  assert.ok(tl > 0);
  assert.deepEqual([tr, br, bl], [0, 0, 0]);
});

test('merged: a straight edge stays straight', () => {
  // north is different, west and east are the same: no corner is rounded
  assert.deepEqual(radiiOf({ ...all(G), n: R, ne: R, nw: R }), [0, 0, 0, 0]);
});

test('merged: a rounded corner is filled with the colour it opens onto, or the board at the map edge', () => {
  const corner = (nb) => {
    const { ctx, calls } = recorder();
    merged.paint(ctx, 0, 0, 40, grass, null, nb);
    return calls.find((c) => c.op === 'fillRect' && c.args[0] === 0 && c.args[1] === 0).fill;
  };
  assert.equal(corner({ ...all(G), n: SEA, w: SEA, nw: SEA }), SEA);      // a grass corner poking into the sea
  assert.equal(corner({ ...all(G), n: R, w: R, nw: SEA }), R);             // two edges agree: they win over the diagonal
  assert.equal(corner({ ...all(G), n: null, w: null, nw: null }), merged.board);   // the map corner
  assert.equal(corner({ ...all(G), n: R, w: SEA, nw: '#000000' }), merged.board);   // three different neighbours: no clear answer
});
