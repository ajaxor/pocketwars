// The attack range ring (Renderer#drawAttackRing): a bright red line just inside the band's edge with a dark border on one side of it (outside the
// outer line, in the hole for the inner line). The ring is drawn over the movement overlay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer } from '../../src/render/renderer.js';
import { faceRect } from '../../src/render/terrain-layer.js';

const S = 40;
const W = 7;
const stub = { game: { map: { width: W, height: 7 } }, face: (x, y, m = 0) => faceRect(x, y, S, m) };
stub.strokeRing = Renderer.prototype.strokeRing;
Object.defineProperty(stub, 'S', { get: () => S });

/** A 2D context that records, for every stroke, its colour, width and the starting point of each loop it traced. */
function recorder() {
  const strokes = [];
  let starts = [], style = null, width = 0;
  const g = new Proxy({}, {
    get: (_, p) => {
      if (p === 'strokes') return strokes;
      if (p === 'beginPath') return () => { starts = []; };
      if (p === 'moveTo') return (x, y) => { starts.push([x, y]); };
      if (p === 'stroke') return () => { strokes.push({ style, width, starts: [...starts] }); };
      return () => {};
    },
    set: (_, p, v) => { if (p === 'strokeStyle') style = v; if (p === 'lineWidth') width = v; return true; },
  });
  return g;
}

// a band of tiles two wide round a hole: tiles 1..5 x 1..5 without tiles 2..4 x 2..4 (a unit with range 2-3 would draw something like it)
const band = new Set();
for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) if (x < 2 || x > 4 || y < 2 || y > 4) band.add(y * W + x);
const centre = [3.5 * S, 3.5 * S];
const dist = ([x, y]) => Math.hypot(x - centre[0], y - centre[1]);
const draw = () => { const g = recorder(); Renderer.prototype.drawAttackRing.call(stub, g, band); return g.strokes; };
const byStyle = (strokes, re) => strokes.filter((s) => re.test(s.style));

test('the ring is a bright red line with a dark border stroke, drawn first', () => {
  const strokes = draw();
  assert.equal(byStyle(strokes, /^#ff3b3b$/).length, 1, 'one bright line round the whole band');
  assert.equal(byStyle(strokes, /^rgba\(70,0,0/).length, 1, 'one dark border');
  const bright = byStyle(strokes, /^#ff3b3b$/)[0], dark = byStyle(strokes, /^rgba\(70,0,0/)[0];
  assert.ok(strokes.indexOf(dark) < strokes.indexOf(bright), 'the border is drawn first, so the bright line sits on top');
  assert.equal(bright.starts.length, 2, 'two loops: the outer edge (maximum range) and the hole (minimum range)');
});

test('the dark border is on one side of each line: outside the outer line, on the hole side of the inner line', () => {
  const strokes = draw();
  const bright = byStyle(strokes, /^#ff3b3b$/)[0], dark = byStyle(strokes, /^rgba\(70,0,0/)[0];
  const outerOf = (st) => st.starts.find((p) => dist(p) > S * 2), innerOf = (st) => st.starts.find((p) => dist(p) <= S * 2);
  assert.ok(dist(outerOf(dark)) > dist(outerOf(bright)), 'outer line: the dark side is further from the centre than the bright line');
  assert.ok(dist(innerOf(dark)) < dist(innerOf(bright)), 'inner line: the dark side is nearer the centre (in the hole) than the bright line');
  assert.ok(dark.width > bright.width, 'the border is wider than the line, so it shows on that side');
  assert.ok(dist(outerOf(bright)) < 2.5 * S && dist(innerOf(bright)) > 1.5 * S, 'the bright lines themselves stay inside the band');
});

test('the fog is drawn first, then the movement overlay, then the ring: both overlays show over the fog of war', () => {
  const src = readFileSync(new URL('../../src/render/renderer.js', import.meta.url), 'utf8');
  const ring = src.indexOf('this.drawAttackRing(g, atk)'), reach = src.indexOf('this.drawReach(g, [...view.reach.tiles()]');
  const fog = src.indexOf('this.drawFog(seen, now)');
  assert.ok(fog > 0 && reach > fog, 'the movement overlay is drawn over the fog');
  assert.ok(reach > 0 && ring > reach, 'the ring is drawn over the movement overlay');
  assert.equal(src.split('this.drawAttackRing(').length - 1, 1, 'drawn in one place only');
});

test('a soft fringe is still drawn inside the band, clipped to it', () => {
  const g = recorder();
  const calls = [];
  const spy = new Proxy(g, { get: (t, p) => (p === 'clip' ? (...a) => { calls.push(p); } : t[p]) });
  Renderer.prototype.drawAttackRing.call(stub, spy, band);
  assert.deepEqual(calls, ['clip'], 'the fringe is clipped to the band');
  assert.equal(g.strokes.filter((s) => /^rgba\(255,59,59/.test(s.style)).length, 3, 'three fringe passes');
});
