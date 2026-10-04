import test from 'node:test';
import assert from 'node:assert/strict';
import { drawOutlined } from '../../src/render/outline.js';

function recorder(calls = []) {
  const g = new Proxy({ canvas: null }, { get: (t, p) => (p in t ? t[p] : p === 'getTransform' ? () => ({ a: 1, b: 0 }) : (...a) => { calls.push([p, ...a]); return undefined; }), set: (t, p, v) => { t[p] = v; return true; } });
  return { g, calls };
}

test('drawOutlined stamps the body round a ring, floods it dark, and draws edge then body then nothing else over it', () => {
  const stamps = [];
  const make = (w, h) => { const r = recorder(stamps); r.g.width = w; r.g.height = h; r.g.getContext = () => r.g; return r.g; };
  const mod = { SPRITES: { x: () => {} }, SHADOWS: { x: () => {} } };
  const { g, calls } = recorder();
  drawOutlined(g, mod, 'x', { s: 40 }, { r: 2, color: '#123456', make });
  assert.ok(stamps.filter((c) => c[0] === 'drawImage').length >= 24, 'the silhouette is stamped round two rings');
  const draws = calls.filter((c) => c[0] === 'drawImage');
  assert.equal(draws.length, 2, 'the edge, then the body');
});

test('drawOutlined falls back to the plain drawing when no scratch canvas can be made', () => {
  let drew = 0;
  const mod = { SPRITES: { x: () => { drew++; } }, SHADOWS: { x: () => {} } };
  const { g } = recorder();
  drawOutlined(g, mod, 'x', { s: 40 }, { make: () => null });
  assert.equal(drew, 1);
});

test('drawOutlined with skipBlack redraws the body into a mask that ignores near-black fills and strokes, and stamps from it', () => {
  const stamps = [], filled = [];
  const make = (w, h) => {
    const r = recorder(stamps); r.g.width = w; r.g.height = h; r.g.getContext = () => r.g;
    r.g.fill = () => { filled.push(r.g.fillStyle); }; r.g.fillRect = () => { filled.push('rect ' + r.g.fillStyle); };
    return r.g;
  };
  const sprite = (g) => {
    g.fillStyle = '#e8742a'; g.fill(); g.fillStyle = '#15161c'; g.fillRect(0, 0, 1, 1); g.fillStyle = 'rgba(20, 22, 30, 1)'; g.fill(); g.fillStyle = 'rgba(200, 60, 50, 0.5)'; g.fill();
  };
  const mod = { SPRITES: { x: sprite }, SHADOWS: { x: () => {} } };
  const { g } = recorder();
  drawOutlined(g, mod, 'x', { s: 40 }, { r: 2, color: '#123456', skipBlack: true, make });
  // the body canvas and the mask canvas are different recorders sharing `filled` through their own fill hooks: count by colour
  assert.equal(filled.filter((c) => c === '#e8742a').length, 2, 'the coloured fill is drawn in the body and in the mask');
  assert.equal(filled.filter((c) => c === 'rect #15161c' || c === '#15161c').length, 1, 'the black fill is drawn in the body but skipped in the mask');
  assert.equal(filled.filter((c) => c === 'rgba(200, 60, 50, 0.5)').length, 2, 'a see-through red is not black');
  assert.ok(stamps.filter((c) => c[0] === 'drawImage').length >= 24, 'the silhouette is stamped round the rings');
});

test("the game's units are drawn with black parts left out of the outline (skipBlack is the default render mode)", async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../src/render/unit-sprites.js', import.meta.url), 'utf8');
  assert.match(src, /drawOutlined\([\s\S]*skipBlack: true/);
});
