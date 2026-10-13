// The attack range ring (Renderer#drawAttackRing): a bright red line just inside the band's edge with a thin dark border round it, kept inside the
// band so it does not run over the movement range lines. The band between the outer (maximum range) and inner (minimum range) lines is the area a unit can hit.
import test from 'node:test';
import assert from 'node:assert/strict';
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

test('the ring is a bright red line with a darker border under it', () => {
  const strokes = draw();
  assert.equal(byStyle(strokes, /^#ff3b3b$/).length, 1, 'one bright line round the whole band');
  assert.equal(byStyle(strokes, /^rgba\(70,0,0/).length, 1, 'one dark border');
  const bright = byStyle(strokes, /^#ff3b3b$/)[0], dark = byStyle(strokes, /^rgba\(70,0,0/)[0];
  assert.ok(dark.width > bright.width, 'the border is wider than the line, so it shows beside it');
  assert.ok(strokes.indexOf(dark) < strokes.indexOf(bright), 'and it is drawn first, so the bright line sits on top');
  assert.equal(bright.starts.length, 2, 'two loops: the outer edge (maximum range) and the hole (minimum range)');
});

test('the dark border is thin and centred on the line, so it stays inside the band\'s edge and never spills onto the movement range lines', () => {
  const strokes = draw();
  const bright = byStyle(strokes, /^#ff3b3b$/)[0], dark = byStyle(strokes, /^rgba\(70,0,0/)[0];
  assert.deepEqual(dark.starts, bright.starts, 'same path as the bright line: no shift outward or into the hole');
  assert.ok(dark.width - bright.width <= S * .04, 'only a thin dark rim shows beside the line');
  const outer = bright.starts.find((p) => dist(p) > S * 2), inner = bright.starts.find((p) => dist(p) <= S * 2);
  assert.ok(dist(outer) + dark.width / 2 <= 2.5 * S + 1e-6, 'the outer border ends inside the band\'s outer edge (2.5 tiles from the centre)');
  assert.ok(dist(inner) - dark.width / 2 >= 1.5 * S - 1e-6, 'the inner border ends inside the band, beyond the hole\'s edge (1.5 tiles from the centre)');
});

test('a soft fringe is still drawn inside the band, clipped to it', () => {
  const g = recorder();
  const calls = [];
  const spy = new Proxy(g, { get: (t, p) => (p === 'clip' ? (...a) => { calls.push(p); } : t[p]) });
  Renderer.prototype.drawAttackRing.call(stub, spy, band);
  assert.deepEqual(calls, ['clip'], 'the fringe is clipped to the band');
  assert.equal(g.strokes.filter((s) => /^rgba\(255,59,59/.test(s.style)).length, 3, 'three fringe passes');
});
