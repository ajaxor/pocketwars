// The camera: fit, scroll, zoom, clamping, reveal and easing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, MIN_TILE, ZOOM_IN_CEIL } from '../../src/render/camera.js';

const cam = (w, h, W = 400, H = 700, top = 50) => { const c = new Camera(w, h); c.setViewport(W, H, top); return c; };

test('a small map is shown whole and centred', () => {
  const c = cam(8, 6);
  assert.equal(c.S, c.fitSize);
  assert.equal(c.scrolls, false);
  assert.deepEqual([c.cx, c.cy], [4, 3]);
  c.panBy(100, 100);
  assert.deepEqual([c.cx, c.cy], [4, 3], 'nothing to pan');
});

test('a big map starts at the minimum tile size and scrolls', () => {
  const c = cam(40, 30);
  assert.equal(c.S, MIN_TILE);
  assert.equal(c.scrolls, true);
  c.panBy(-1000, -1000);
  const v = c.visible(0);
  assert.equal(v.x1, 39);
  assert.equal(v.y1, 29);
  c.panBy(5000, 5000);
  assert.equal(c.visible(0).x0, 0);
  assert.equal(c.visible(0).y0, 0);
});

test('zoom is clamped and keeps the point under the anchor still', () => {
  const c = cam(40, 30);
  c.centerOn(20, 15);
  const before = c.tileAt(200, 300);
  c.zoomTo(60, 200, 300);
  assert.equal(c.S, 60);
  const after = c.tileAt(200, 300);
  assert.deepEqual(after, before);
  c.zoomTo(9999);
  assert.equal(c.S, ZOOM_IN_CEIL);
  c.zoomTo(1);
  assert.equal(c.S, c.minSize);
  assert.ok(c.zoomed);
});

test('a resize keeps the player zoom but re-fits an untouched view', () => {
  const c = cam(40, 30);
  c.setViewport(500, 800, 50);
  assert.equal(c.S, MIN_TILE);
  c.zoomTo(70);
  c.setViewport(500, 800, 50);
  assert.equal(c.S, 70);
});

test('zoomBy always moves at least one step', () => {
  const c = cam(40, 30);
  c.zoomBy(1.001);
  assert.equal(c.S, MIN_TILE + 1);
});

test('reveal glides to off-screen points and leaves visible ones alone', () => {
  const c = cam(40, 30);
  c.centerOn(2, 2);
  c.reveal([[2, 2]]);
  assert.equal(c.glide, null);
  c.reveal([[30, 20]]);
  assert.ok(c.glide);
  let n = 0;
  while (c.step(16) && n++ < 500);
  assert.equal(c.glide, null);
  const v = c.visible(0);
  assert.ok(v.x0 <= 30 && v.x1 >= 30 && v.y0 <= 20 && v.y1 >= 20);
});

test('tileAt inverts origin', () => {
  const c = cam(40, 30);
  const { ox, oy } = c.origin();
  assert.deepEqual(c.tileAt(ox + 3 * c.S + 1, oy + 4 * c.S + 1), { x: 3, y: 4 });
});
