// The flat sprite set (src/render/unit-art.js) must stay drop-in compatible with the game, and the live
// gallery page must be able to draw every unit in every animation state. Recording context: catches crashes and
// missing sprites, not pixels (see tools/sprite-lab for pixel-level review).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPRITES, SHADOWS } from '../../src/render/unit-art.js';
import { drawFrame } from '../../src/render/unit-frame.js';
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
      assert.equal(sets.globalAlpha, STATES[state].alpha, `alpha for ${state}`);
    }
  }
  assert.ok(STATES.done.alpha < 1 && STATES.idle.alpha === 1);
});
