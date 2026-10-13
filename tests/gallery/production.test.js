// The Production tab: gallery/production.json assigns every unit to exactly one building, and every building can be drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productionProblems, buildingCount } from '../../gallery/production-view.js';
import { BUILDINGS } from '../../src/render/buildings.js';
import { BASES } from '../../gallery/structure-art.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const data = json('gallery/production.json');
const unitIds = Object.keys(json('data/units.json'));
const art = { game: new Set(Object.keys(BUILDINGS)), concept: new Set(Object.keys(BASES)) };

test('every unit is assigned to exactly one building (or laid by another unit), and every building is drawn', () => {
  assert.deepEqual(productionProblems(data, unitIds, art), []);
  assert.ok(buildingCount(data) >= 10);
});

test('the checker catches a unit in two buildings, a missing unit, a missing drawing and an empty building', () => {
  const bad = structuredClone(data);
  bad.buildings[1].units.push('soldier');
  bad.buildings[0].units = bad.buildings[0].units.filter((u) => u !== 'mortar');
  bad.buildings[2].art = 'game';
  bad.buildings.push({ id: 'nothing', art: 'concept', units: [] });
  const text = productionProblems(bad, unitIds, art).join('\n');
  assert.match(text, /"soldier" is in both barracks and agency/);
  assert.match(text, /unit "mortar" is not assigned/);
  assert.match(text, /"bunker" has no game drawing/);
  assert.match(text, /"nothing" has no concept drawing/);
  assert.match(text, /"nothing" produces nothing/);
});

test('the game\'s own four production buildings keep their game art, and the game builds only what its terrain says', () => {
  const terrain = json('data/terrain.json');
  for (const [id, t] of Object.entries(terrain)) {
    if (!t.attributes?.property?.builds?.length) continue;
    const b = data.buildings.find((x) => x.id === id);
    assert.ok(b && b.art === 'game' && b.origin === 'existing', `${id} is listed as an existing game building`);
  }
});
