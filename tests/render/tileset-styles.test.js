// A tileset's render.style may only name options its drawing knows (the defaults in the drawing's code). A misspelt key used to be
// silently ignored, so every style in tilesets.json is drawn here and its keys checked against the drawing's own defaults.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { TERRAIN_DECOR } from '../../src/render/terrain-art.js';
import { styleAudit } from '../../src/render/terrain-kit.js';

const registry = await loadRegistry(readData);
const recorder = () => new Proxy({}, {
  get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => ({ addColorStop() {} })),
  set: () => true,
});

test('every tileset style key is an option its drawing knows', () => {
  const problems = [];
  let checked = 0;
  for (const tilesetId of Object.keys(registry.tilesets ?? {})) {
    for (const terrainId of Object.keys(registry.terrain)) {
      const skin = registry.skin(tilesetId, terrainId).render;
      if (!skin.style || !skin.decor || !TERRAIN_DECOR[skin.decor]) continue;
      checked++;
      styleAudit.onStyle = (defaults, style) => {
        for (const k of Object.keys(style)) if (!(k in defaults)) problems.push(`${tilesetId}/${terrainId} (${skin.decor}): unknown style option "${k}"`);
      };
      try { TERRAIN_DECOR[skin.decor](recorder(), 0, 0, 48, { x: 1, y: 1, now: 0, link: {}, radii: [0, 0, 0, 0], style: skin.style }); } finally { styleAudit.onStyle = null; }
    }
  }
  assert.ok(checked > 10, `looked at ${checked} styled terrains`);
  assert.deepEqual(problems, []);
});
