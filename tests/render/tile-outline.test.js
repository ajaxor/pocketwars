// The joined outline helper shared by the movement area and the attack range ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { outlineLoops, tracePath } from '../../src/render/tile-outline.js';

const tiles = (pairs) => pairs.map(([x, y]) => ({ x, y }));

test('a single tile is one square loop, an L is one loop of six corners', () => {
  assert.deepEqual(outlineLoops(tiles([[0, 0]])).map((l) => l.length), [4]);
  assert.deepEqual(outlineLoops(tiles([[0, 0], [1, 0], [0, 1]])).map((l) => l.length), [6]);
});

test('a ring of tiles has an outer loop and a separate loop for its hole', () => {
  const ring = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x !== 1 || y !== 1) ring.push([x, y]);
  assert.deepEqual(outlineLoops(tiles(ring)).map((l) => l.length).sort(), [4, 4]);
});

test('separate areas make separate loops, and every loop closes on itself', () => {
  const loops = outlineLoops(tiles([[0, 0], [5, 5]]));
  assert.equal(loops.length, 2);
  for (const l of loops) assert.ok(l.length >= 4);
});

test('tracePath rounds each corner and pulls the line inside by the inset', () => {
  const calls = [], g = new Proxy({}, { get: (_, p) => (...a) => calls.push([p, ...a]) });
  tracePath(g, outlineLoops(tiles([[0, 0]])), 40, { radius: 6, inset: 2 });
  assert.equal(calls.filter((c) => c[0] === 'arcTo').length, 4);
  assert.deepEqual(calls.find((c) => c[0] === 'arcTo').slice(1, 3), [38, 2], 'the top-right corner sits 2px inside the tile');
});
