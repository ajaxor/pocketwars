// The flat-style sprite variants (tools/sprite-lab/variants) must stay drop-in compatible with the game: every unit's
// sprite name exists, every sprite and shadow draws for both factions, at every HP-independent animation state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeFlat } from '../../tools/sprite-lab/variants/flat-core.js';

const units = JSON.parse(readFileSync(new URL('../../data/units.json', import.meta.url), 'utf8'));
const factions = JSON.parse(readFileSync(new URL('../../data/factions.json', import.meta.url), 'utf8'));

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push(p); return { addColorStop() {} }; }),
    set: () => true,
  });
  return { ctx, calls };
}

for (const [name, look] of Object.entries({ pure: {}, shaded: { shade: true }, tone: { shade: true, tone: true } })) {
  test(`flat variant "${name}" covers every unit sprite and shadow, and draws without throwing`, () => {
    const { SPRITES, SHADOWS } = makeFlat(look);
    for (const [id, def] of Object.entries(units)) {
      const sprite = def.render.sprite;
      assert.equal(typeof SPRITES[sprite], 'function', `sprite for ${id}`);
      assert.equal(typeof SHADOWS[sprite], 'function', `shadow for ${id}`);
      for (const f of Object.values(factions)) {
        for (const [w, run] of [[0, 0], [.7, 1], [3.3, 1]]) {
          const { ctx, calls } = recorder();
          SHADOWS[sprite](ctx, { s: 48, alt: def.render.altitude || 0, w, ph: 1, run });
          SPRITES[sprite](ctx, { s: 48, c: f.color, dk: f.dark, w, ph: 1, run, b: .5, j: .2 });
          assert.ok(calls.length > 5, `${id} draws something`);
        }
      }
    }
  });
}
