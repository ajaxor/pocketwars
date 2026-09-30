// Gestures: tap vs drag vs pinch vs wheel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Gestures } from '../../src/ui/gestures.js';

const make = () => {
  const log = [];
  const g = new Gestures({ onTap: (...a) => log.push(['tap', ...a]), onPan: (...a) => log.push(['pan', ...a]), onZoom: (...a) => log.push(['zoom', ...a]) });
  return { g, log };
};
const ev = (pointerId, clientX, clientY) => ({ pointerId, clientX, clientY });

test('a press that barely moves is a tap', () => {
  const { g, log } = make();
  g.down(ev(1, 10, 10)); g.move(ev(1, 13, 12)); g.up(ev(1, 13, 12));
  assert.deepEqual(log, [['tap', 13, 12]]);
});

test('a longer move is a drag: it pans (catching up first) and never taps', () => {
  const { g, log } = make();
  g.down(ev(1, 0, 0)); g.move(ev(1, 20, 0)); g.move(ev(1, 25, 0)); g.up(ev(1, 25, 0));
  assert.deepEqual(log, [['pan', 20, 0], ['pan', 5, 0]]);
});

test('two fingers pinch-zoom and never tap afterwards', () => {
  const { g, log } = make();
  g.down(ev(1, 0, 0)); g.down(ev(2, 100, 0));
  g.move(ev(2, 200, 0));
  g.up(ev(2, 200, 0)); g.up(ev(1, 0, 0));
  assert.equal(log.filter((l) => l[0] === 'tap').length, 0);
  const z = log.find((l) => l[0] === 'zoom');
  assert.ok(z && z[1] > 1);
});

test('wheel pans, ctrl+wheel zooms', () => {
  const { g, log } = make();
  g.wheel({ deltaX: 3, deltaY: 5, ctrlKey: false, clientX: 1, clientY: 2 });
  g.wheel({ deltaX: 0, deltaY: -100, ctrlKey: true, clientX: 7, clientY: 8 });
  assert.deepEqual(log[0], ['pan', -3, -5]);
  assert.equal(log[1][0], 'zoom');
  assert.ok(log[1][1] > 1);
  assert.deepEqual(log[1].slice(2), [7, 8]);
});

test('cancel clears the gesture', () => {
  const { g, log } = make();
  g.down(ev(1, 0, 0)); g.cancel(ev(1, 0, 0));
  g.down(ev(2, 5, 5)); g.up(ev(2, 5, 5));
  assert.deepEqual(log, [['tap', 5, 5]]);
});
