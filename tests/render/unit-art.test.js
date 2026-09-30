// The flat sprite set (src/render/unit-art.js) must stay drop-in compatible with the game, and the live
// gallery page must be able to draw every unit in every animation state. Recording context: catches crashes and
// missing sprites, not pixels (see tools/sprite-lab for pixel-level review).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPRITES, SHADOWS } from '../../src/render/unit-art.js';
import { drawFrame, drawFrameAlpha, DISABLED_TINT } from '../../src/render/unit-frame.js';
import { paintTile, STATES } from '../../gallery/preview.js';

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
// game units plus the planned ones that are drawn but not yet in the game
const units = { ...readJson('../../data/units.json'), ...readJson('../../tools/sprite-lab/planned-units.json') };
const factions = Object.values(JSON.parse(readFileSync(new URL('../../data/factions.json', import.meta.url), 'utf8')));

function recorder() {
  const calls = [], sets = {};
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push(p); return { addColorStop() {} }; }),
    set: (_, p, v) => { sets[p] = v; return true; },
  });
  return { ctx, calls, sets };
}

test('every unit has a flat sprite and a shadow, and both draw for every faction and animation state', () => {
  for (const [id, def] of Object.entries(units)) {
    const sprite = def.render.sprite;
    assert.equal(typeof SPRITES[sprite], 'function', `sprite for ${id}`);
    assert.equal(typeof SHADOWS[sprite], 'function', `shadow for ${id}`);
    for (const f of factions) {
      for (const [w, run] of [[0, 0], [.7, 1], [3.3, 1]]) {
        const { ctx, calls } = recorder();
        drawFrame(ctx, { SPRITES, SHADOWS }, sprite, { s: 48, c: f.color, dk: f.dark, alt: def.render.altitude || 0, w, ph: 1, run });
        assert.ok(calls.length > 8, `${id} draws something`);
      }
    }
  }
});

test('the gallery draws every unit in every state; a unit that has acted is faded', () => {
  const unitList = Object.values(units).map((u) => ({ sprite: u.render.sprite, altitude: u.render.altitude || 0 }));
  for (const state of Object.keys(STATES)) {
    for (const unit of unitList) {
      const { ctx, calls, sets } = recorder();
      paintTile(ctx, { unit, faction: factions[0], size: 96, t: 1.7, state, phase: .4, bg: '#86b95c' });
      assert.ok(calls.length > 8, `${unit.sprite} in ${state}`);
      assert.equal(sets.globalAlpha, undefined, `${state} draws at full opacity`);
    }
  }
  assert.equal(STATES.done.tint, DISABLED_TINT);
  assert.ok(!STATES.idle.tint && !STATES.moving.tint);
  assert.ok(STATES.done.alpha === 1, 'a unit that has acted is tinted, not see-through');
});

test('a faded unit is drawn opaque into a scratch canvas and composited once, not blended part by part', () => {
  const main = recorder(), layer = recorder();
  const canvas = { width: 0, height: 0, getContext: () => layer.ctx };
  const make = (w, h) => Object.assign(canvas, { width: w, height: h });
  const o = { s: 48, c: '#e8712c', dk: '#8f3f10', alt: .13, w: 1, ph: 0, run: 0, make };
  drawFrameAlpha(main.ctx, { SPRITES, SHADOWS }, 'bomber', o, .55);
  assert.ok(layer.calls.length > 8, 'the whole unit was drawn into the scratch canvas');
  assert.equal(layer.sets.globalAlpha, undefined, 'parts inside the scratch canvas are opaque');
  assert.equal(main.calls.filter((c) => c === 'drawImage').length, 1, 'composited to the map exactly once');
  assert.equal(main.sets.globalAlpha, .55);
  assert.equal(main.calls.filter((c) => c === 'fill').length, 0, 'no unit parts are drawn straight onto the map');
});

test('a tinted unit is blended toward dark grey inside the scratch canvas, then composited opaque', () => {
  const main = recorder(), layer = recorder();
  const canvas = { width: 0, height: 0, getContext: () => layer.ctx };
  const make = (w, h) => Object.assign(canvas, { width: w, height: h });
  const o = { s: 48, c: '#e8712c', dk: '#8f3f10', alt: 0, w: 1, ph: 0, run: 0, make };
  drawFrameAlpha(main.ctx, { SPRITES, SHADOWS }, 'tank', o, 1, DISABLED_TINT);
  assert.equal(layer.sets.globalCompositeOperation, 'source-atop', 'the wash only lands on pixels the unit covers');
  assert.equal(layer.sets.fillStyle, DISABLED_TINT.color);
  assert.equal(layer.sets.globalAlpha, DISABLED_TINT.amount);
  assert.equal(main.calls.filter((c) => c === 'drawImage').length, 1, 'composited to the map exactly once');
  assert.equal(main.sets.globalAlpha, 1, 'the unit is opaque on the map: it is dark, not see-through');
  assert.ok(DISABLED_TINT.amount > 0 && DISABLED_TINT.amount < 1);
});
