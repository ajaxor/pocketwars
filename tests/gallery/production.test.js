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
  bad.buildings[1].units.push('soldier');                                    // garage also lists the soldier (the HQ has it)
  bad.buildings[0].units = bad.buildings[0].units.filter((u) => u !== 'spy');
  bad.buildings[2].art = 'concept';                                          // factory has no concept drawing
  bad.buildings.push({ id: 'bunker', art: 'game', units: ['sniper2'] });
  bad.buildings.push({ id: 'nothing', art: 'concept', units: [] });
  const text = productionProblems(bad, unitIds, art).join('\n');
  assert.match(text, /"soldier" is in both hq and garage/);
  assert.match(text, /unit "spy" is not assigned/);
  assert.match(text, /"factory" has no concept drawing/);
  assert.match(text, /"bunker" has no game drawing/);
  assert.match(text, /"nothing" has no concept drawing/);
  assert.match(text, /"nothing" produces nothing/);
});

test('every production building and lab of the game is listed with its game art, and the labs list the units they upgrade to', () => {
  const terrain = json('data/terrain.json');
  for (const [id, t] of Object.entries(terrain)) {
    const p = t.attributes?.property;
    if ((!p?.builds?.length && !p?.upgrades) || p?.shelved || p?.hub) continue;
    const b = data.buildings.find((x) => x.id === id);
    assert.ok(b && b.art === 'game' && b.origin === 'existing', `${id} is listed as a game building`);
    if (p.upgrades) assert.deepEqual([...b.units].sort(), [...new Set(Object.values(p.upgrades))].sort(), `${id} lists what it upgrades to`);
  }
});
