import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { Effects } from '../../src/render/effects.js';
import { MoveAnimator } from '../../src/render/animator.js';
import { Renderer } from '../../src/render/renderer.js';
import { Arrivals, entryPath, planEntrances } from '../../src/render/arrivals.js';

const bounds = { left: -2, top: -1, right: 12, bottom: 9 };

test('entryPath: from the nearest edge the unit can drive in from without turning round', () => {
  assert.deepEqual(entryPath({ x: 1, y: 4 }, bounds, { facing: 1 }), [[-3.5, 4], [1, 4]], 'facing right near the left edge: enters from the left');
  assert.deepEqual(entryPath({ x: 1, y: 4 }, bounds, { facing: -1 }), [[1, 9.5], [1, 4]], 'facing left it would have to turn round to use the left edge: the bottom is nearer than the right');
  assert.deepEqual(entryPath({ x: 8, y: 4 }, bounds, { facing: -1 }), [[12.5, 4], [8, 4]], 'facing left and nearest the right edge: from the right');
  assert.deepEqual(entryPath({ x: 5, y: 0 }, bounds, { facing: 1 }), [[5, -2.5], [5, 0]], 'near the top edge, vertical entry never turns anyone');
  assert.deepEqual(entryPath({ x: 5, y: 4 }, bounds, { from: 'bottom' }), [[5, 9.5], [5, 4]], 'an edge can be named');
});

test('the path starts outside the window, whatever the edge', () => {
  for (const from of ['left', 'right', 'top', 'bottom']) {
    const [[sx, sy]] = entryPath({ x: 4, y: 3 }, bounds, { from });
    assert.ok(sx + 1 <= bounds.left || sx >= bounds.right || sy + 1 <= bounds.top || sy >= bounds.bottom, from);
  }
});

test('planEntrances: nearest first, one gap apart, the whole thing never longer than maxSpread', () => {
  const units = [{ id: 1, x: 8, y: 2, facing: 1 }, { id: 2, x: 1, y: 2, facing: 1 }, { id: 3, x: 3, y: 5, facing: 1 }];
  const plan = planEntrances(units, bounds, { gap: 200, from: 'left' });
  assert.deepEqual(plan.map((e) => e.unitId), [2, 3, 1]);
  assert.deepEqual(plan.map((e) => e.delay), [0, 200, 400]);
  const many = planEntrances(Array.from({ length: 21 }, (_, i) => ({ id: i, x: 1 + (i % 5), y: i, facing: 1 })), bounds, { gap: 200, maxSpread: 1000 });
  assert.equal(many.at(-1).delay, 1000);
  assert.deepEqual(planEntrances([{ id: 9, x: 2, y: 2 }], bounds, { from: () => [[-5, 2], [-1, 2], [2, 2]] })[0].path.length, 3, 'a path of your own, with waypoints');
});

test('a unit waits at the start of its path, slides along it, and is retired on arrival', () => {
  const a = new Arrivals(); let done = 0;
  a.enter([{ unitId: 7, path: [[-4, 2], [2, 2]], delay: 100, msPerTile: 100 }], 1000, () => done++);
  assert.equal(a.has(7), true);
  assert.deepEqual(a.positionOf(7, 1000, 10), [-40, 20], 'still waiting off screen');
  assert.deepEqual(a.positionOf(7, 1100 + 300, 10), [-10, 20], 'half way (six tiles at 100 ms)');
  assert.equal(a.facingOf(7, 1500), 1);
  a.update(1699); assert.equal(a.has(7), true); assert.equal(done, 0);
  a.update(1700); assert.equal(a.has(7), false); assert.equal(done, 1);
  assert.equal(a.positionOf(7, 1800, 10), null);
  assert.equal(a.active, false);
});

test('waypoints: the unit follows each leg and faces the way it last went sideways', () => {
  const a = new Arrivals();
  a.enter([{ unitId: 1, path: [[0, -5], [0, 0], [-3, 0]], msPerTile: 100 }], 0);
  assert.equal(a.facingOf(1, 100), null, 'straight down: no sideways step yet');
  assert.deepEqual(a.positionOf(1, 650, 1), [-1.5, 0]);
  assert.equal(a.facingOf(1, 650), -1);
});

test('onDone fires once, when the last unit of the batch is in; finish() skips to the end; an empty batch is done at once', () => {
  const a = new Arrivals(); let done = 0;
  a.enter([{ unitId: 1, path: [[-3, 0], [0, 0]] }, { unitId: 2, path: [[-3, 1], [0, 1]], delay: 500 }], 0, () => done++);
  a.update(400); assert.equal(done, 0); assert.equal(a.has(1), false); assert.equal(a.has(2), true);
  a.finish(); assert.equal(done, 1); assert.equal(a.active, false);
  a.finish(); assert.equal(done, 1);
  let empty = 0; a.enter([], 0, () => empty++); assert.equal(empty, 1);
});

test('the renderer draws an arriving unit where it is on its way, and not on its tile', async () => {
  const registry = await loadRegistry(readData);
  const game = new Game(registry, await loadMap(readData, registry, 'classic'));
  const seen = [];
  const calls = [];
  const ctx = new Proxy({}, { get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push([p, ...a]); return { addColorStop() {} }; }), set: () => true });
  const r = new Renderer({ getContext: () => ctx, style: {}, width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }) }, game, new Effects(registry, (o) => registry.faction(game.map.players[o].faction)), new MoveAnimator());
  r.arrivals = new Arrivals();
  const u = game.state.units[0];
  r.arrivals.enter([{ unitId: u.id, path: [[-6, u.y], [u.x, u.y]], msPerTile: 100 }], 0);
  assert.equal(r.facingOf(u, {}, 0), 1);
  const b = r.viewBounds();
  assert.ok(b.right > b.left && b.bottom > b.top);
  assert.ok(r.dimmedTiles({ selectedId: null }) instanceof Set);
  r.draw({ selectedId: null, dest: null, reach: null, attackTiles: null, targets: [], showTargets: false, pendingTargetId: null }, 50);
  void seen;
  const mapRect = (c) => c[0] === 'rect' && c[1] === 0 && c[2] === 0 && c[3] === game.map.width * r.S && c[4] === game.map.height * r.S;
  const at = calls.findIndex((c, k) => c[0] === 'clip' && mapRect(calls[k - 1]));
  assert.ok(at > 0, 'an arriving unit is drawn inside a clip to the map');
  assert.ok(calls.slice(at).some((c) => c[0] === 'restore'));
});
