// The reach overlay (Renderer#drawReach): a blue shimmer over the tiles the selected unit can reach, readable on any terrain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../../src/render/renderer.js';
import { faceRect } from '../../src/render/terrain-layer.js';

const S = 40;
const stub = { game: { map: { width: 10, height: 8 } }, face: (x, y, m = 0) => faceRect(x, y, S, m) };
stub.strokeRing = Renderer.prototype.strokeRing;
Object.defineProperty(stub, 'S', { get: () => S });

/** A 2D context that records every call and every colour set on it. */
function recorder() {
  const calls = [], fills = [], strokes = [];
  const g = new Proxy({}, {
    get: (_, p) => (p === 'calls' ? calls : p === 'fills' ? fills : p === 'strokes' ? strokes : (...a) => { calls.push([p, ...a]); }),
    set: (_, p, v) => { if (p === 'fillStyle') fills.push(v); if (p === 'strokeStyle') strokes.push(v); return true; },
  });
  return g;
}
const area = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }];
const run = (now) => { const g = recorder(); Renderer.prototype.drawReach.call(stub, g, area, now); return g; };

test('the reach overlay is blue, not the old white wash, and is clipped so the shimmer stays inside the area', () => {
  const g = run(0);
  assert.ok(g.fills.some((f) => /^rgba\(36,118,255/.test(f)), 'a blue tint');
  assert.ok(!g.fills.some((f) => f === 'rgba(255,255,255,.38)'), 'no flat white wash');
  assert.ok(g.calls.some((c) => c[0] === 'clip'), 'bands are clipped to the area');
  assert.equal(g.calls.filter((c) => c[0] === 'save').length, g.calls.filter((c) => c[0] === 'restore').length, 'every save is restored');
});

test('the area has a dark and a light outline, so it shows on pale ground and on water', () => {
  const g = run(0);
  assert.ok(g.strokes.some((c) => /^rgba\(8,40,120/.test(c)), 'a dark edge');
  assert.ok(g.strokes.some((c) => /^rgba\(170,222,255/.test(c)), 'a light edge');
});

test('the outline is one joined line round the whole area, and there are no flashing diamonds', () => {
  const g = run(0);
  assert.ok(!g.fills.some((f) => /^rgba\(255,255,255/.test(f)), 'no white twinkles');
  const arcs = g.calls.filter((c) => c[0] === 'arcTo').length, strokes = g.calls.filter((c) => c[0] === 'stroke').length;
  assert.equal(strokes, 2, 'dark under light: two strokes for the whole area');
  assert.equal(arcs, 6 * 3, 'the L-shaped area is one closed loop of six corners: traced for the tint and once for each outline layer');
  const loopStarts = g.calls.filter((c) => c[0] === 'closePath').length;
  assert.ok(loopStarts >= 2, 'closed loops, so no loose ends or gaps');
});

test('the shimmer moves with the clock', () => {
  const bands = (now) => run(now).calls.filter((c) => c[0] === 'moveTo').map((c) => c[1]).join(',');
  assert.notEqual(bands(0), bands(500), 'the bands have drifted');
  assert.equal(bands(0), bands(0), 'and the same moment draws the same picture');
});

test('no tiles, nothing drawn', () => {
  const g = recorder();
  Renderer.prototype.drawReach.call(stub, g, [], 0);
  assert.equal(g.calls.length, 0);
});
