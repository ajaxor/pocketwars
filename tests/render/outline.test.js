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

test('drawOutlined with skipBlack stamps the outline from a mask whose near-black pixels are transparent', () => {
  const stamps = [], puts = [];
  const make = (w, h) => {
    const r = recorder(stamps); r.g.width = w; r.g.height = h; r.g.getContext = () => r.g;
    r.g.getImageData = () => ({ data: new Uint8ClampedArray([10, 12, 14, 255, 200, 60, 50, 255, 30, 30, 30, 120]) });
    r.g.putImageData = (im) => { puts.push(Array.from(im.data)); };
    return r.g;
  };
  const mod = { SPRITES: { x: () => {} }, SHADOWS: { x: () => {} } };
  const { g } = recorder();
  drawOutlined(g, mod, 'x', { s: 40 }, { r: 2, color: '#123456', skipBlack: true, make });
  assert.equal(puts.length, 1, 'the mask is written back once');
  assert.deepEqual(puts[0], [10, 12, 14, 0, 200, 60, 50, 255, 30, 30, 30, 0], 'black pixels lose their alpha, coloured ones keep it');
  assert.ok(stamps.filter((c) => c[0] === 'drawImage').length >= 24, `the silhouette is still stamped round the rings (${stamps.filter((c) => c[0] === 'drawImage').length})`);
});
