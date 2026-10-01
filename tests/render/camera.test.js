// The camera: fit, scroll, zoom, clamping, reveal and easing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, MIN_TILE, ZOOM_IN_CEIL } from '../../src/render/camera.js';

const cam = (w, h, W = 400, H = 700, top = 50) => { const c = new Camera(w, h); c.setViewport(W, H, top); return c; };

test('a small map is shown whole and centred', () => {
  const c = cam(4, 10);   // as tall as the playfield allows, so the default size also fits it whole
  assert.equal(c.S, c.fitSize);
  assert.equal(c.scrolls, false);
  assert.deepEqual([c.cx, c.cy], [2, 5]);
  c.panBy(100, 100);
  assert.deepEqual([c.cx, c.cy], [2, 5], 'nothing to pan');
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
  const step = c.steps.find((v) => v > c.S);
  c.zoomTo(step, 200, 300);
  assert.equal(c.S, step);
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
  const step = c.steps.find((v) => v > c.S);
  c.zoomTo(step);
  c.setViewport(500, 800, 50);
  assert.equal(c.S, step);
});

test('zoom snaps to steps, and the default size is one of them', () => {
  const c = cam(40, 30);
  assert.ok(c.steps.includes(c.defaultSize));
  assert.ok(c.steps.every((v) => v >= c.minSize && v <= c.maxSize));
  c.zoomTo(c.defaultSize + 3);
  assert.equal(c.S, c.defaultSize, 'a size between steps snaps to the nearest');
  assert.ok(c.steps.includes(c.S));
});

test('zoomBy accumulates small pinches until the next step, and never sticks', () => {
  const c = cam(40, 30);
  const start = c.S;
  c.zoomBy(1.001);
  assert.equal(c.S, start, 'a tiny pinch is not enough to leave the step');
  for (let i = 0; i < 40; i++) c.zoomBy(1.02);
  assert.ok(c.S > start && c.steps.includes(c.S), 'a long pinch lands on a later step');
  for (let i = 0; i < 400; i++) c.zoomBy(.98);
  assert.equal(c.S, c.minSize);
});

test('the default is the more zoomed-in of: the old minimum, the map fitting whole, and the map filling the height', () => {
  const tall = cam(10, 11);                       // 400 x 650 playfield: fits whole at 40, fills the height at 59
  assert.equal(tall.heightFitSize, 59);
  assert.equal(tall.defaultSize, 59);
  const wide = cam(40, 30);                       // a big map: the old minimum wins
  assert.equal(wide.defaultSize, MIN_TILE);
  const tiny = cam(4, 3);                         // fits whole at a bigger size than the height does
  assert.equal(tiny.defaultSize, Math.max(tiny.fitSize, tiny.heightFitSize));
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
