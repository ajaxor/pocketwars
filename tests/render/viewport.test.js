// The game fills the real window, not innerHeight (which can leave out the home-indicator strip in an installed iPhone app).
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportSize, watchViewport } from '../../src/render/viewport.js';

function fakeWindow({ inner = [390, 780], probe = [390, 844], withObserver = true } = {}) {
  const body = { kids: [], appendChild(k) { this.kids.push(k); k.isConnected = true; return k; } };
  const listeners = {};
  const observed = [];
  const doc = {
    body,
    createElement: () => ({ style: {}, attrs: {}, remove() {}, setAttribute(k, v) { this.attrs[k] = v; }, getBoundingClientRect: () => ({ width: win.probe[0], height: win.probe[1] }) }),
  };
  const win = {
    document: doc, innerWidth: inner[0], innerHeight: inner[1], probe: [...probe], listeners, observed,
    addEventListener: (t, f) => (listeners[t] ||= []).push(f),
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
  };
  if (withObserver) win.ResizeObserver = class { constructor(cb) { this.cb = cb; observed.push(this); } observe(el) { this.el = el; } disconnect() { this.gone = true; } };
  return win;
}

test('the size comes from an invisible fixed box that covers the window, not from innerHeight', () => {
  const win = fakeWindow({ inner: [390, 780], probe: [390, 844] });
  assert.deepEqual(viewportSize(win), { w: 390, h: 844 });
  assert.equal(win.document.body.kids.length, 1);
  assert.match(win.document.body.kids[0].style.cssText, /position:fixed;inset:0;visibility:hidden;pointer-events:none/);
});

test('the box is made once and measured afresh each time', () => {
  const win = fakeWindow();
  viewportSize(win);
  win.probe = [844, 390];
  assert.deepEqual(viewportSize(win), { w: 844, h: 390 }, 'after a rotation');
  assert.equal(win.document.body.kids.length, 1);
});

test('without a DOM, or with an empty box, it falls back to innerWidth and innerHeight', () => {
  assert.deepEqual(viewportSize({ innerWidth: 700, innerHeight: 800 }), { w: 700, h: 800 });
  assert.deepEqual(viewportSize(fakeWindow({ inner: [320, 480], probe: [0, 0] })), { w: 320, h: 480 });
  assert.deepEqual(viewportSize({}), { w: 0, h: 0 });
});

test('watching reports resizes, rotations, returning to the app and the box changing size, and stops cleanly', () => {
  const win = fakeWindow();
  let n = 0;
  const stop = watchViewport(() => { n++; }, win);
  for (const e of ['resize', 'orientationchange', 'pageshow']) win.listeners[e].forEach((f) => f());
  win.observed[0].cb();
  assert.equal(n, 4);
  stop();
  assert.deepEqual([win.listeners.resize, win.listeners.orientationchange, win.listeners.pageshow], [[], [], []]);
  assert.equal(win.observed[0].gone, true);
});

test('watching works without a ResizeObserver', () => {
  const win = fakeWindow({ withObserver: false });
  let n = 0;
  const stop = watchViewport(() => { n++; }, win);
  win.listeners.resize[0]();
  assert.equal(n, 1);
  stop();
});

test('describeViewport lists every idea of the window size, for diagnosing an installed app', async () => {
  const { describeViewport } = await import('../../src/render/viewport.js');
  const win = fakeWindow({ inner: [440, 922], probe: [440, 956] });
  win.screen = { width: 440, height: 956 };
  win.visualViewport = { width: 440, height: 922 };
  win.getComputedStyle = () => ({ paddingTop: '62px', paddingBottom: '34px' });
  assert.equal(describeViewport(win), 'layer 440x956 - page 440x956 - inner 440x922 - visual 440x922 - screen 440x956 - safe 62/34');
  assert.match(describeViewport({ innerWidth: 300, innerHeight: 500, screen: { width: 300, height: 600 } }), /^layer 300x500 - inner 300x500 - screen 300x600$/);
});
