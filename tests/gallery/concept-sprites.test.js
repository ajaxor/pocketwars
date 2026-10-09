// Every concept sprite in the gallery must draw without throwing (catches a missing import in the shared parts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPRITES, SHADOWS } from '../../gallery/concept-art.js';
import { drawFrame } from '../../src/render/unit-frame.js';

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push(p); return { addColorStop() {} }; }),
    set: () => true,
  });
  return { ctx, calls };
}

test('every gallery concept sprite and shadow draws', () => {
  const ids = Object.keys(SPRITES);
  assert.ok(ids.length > 20);
  for (const id of ids) {
    for (const [w, run] of [[0, 0], [1.3, 1]]) {
      const { ctx, calls } = recorder();
      drawFrame(ctx, { SPRITES, SHADOWS }, id, { s: 48, c: '#c33', dk: '#611', alt: 0, w, ph: 1, run });
      assert.ok(calls.length > 4, `${id} draws something`);
    }
  }
});
