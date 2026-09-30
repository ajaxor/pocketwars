// Checks on the data files the game actually ships (data/*.json and every map in data/maps/index.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { validateData } from '../../src/data/validate.js';
import { hasAttribute } from '../../src/engine/attributes.js';
import { UNIT_SPRITES } from '../../src/render/unit-sprites.js';
import { BUILDINGS } from '../../src/render/buildings.js';
import { TERRAIN_DECOR } from '../../src/render/terrain-art.js';
import { Game } from '../../src/engine/game.js';
import { canTarget } from '../../src/engine/combat.js';

const registry = await loadRegistry(readData);
const ATTACK_FX = ['lunge', 'shot', 'arc'];

test('shipped data passes validation', async () => {
  const raw = {};
  for (const k of ['rules', 'factions', 'terrain', 'units', 'ai']) raw[k] = await readData(`${k}.json`);
  assert.deepEqual(validateData(raw), []);
});

test('every unit has a sprite and a known attack effect', () => {
  for (const id of registry.unitIds) {
    const r = registry.unit(id).render;
    assert.ok(UNIT_SPRITES[r.sprite], `${id}: no sprite "${r.sprite}" in unit-sprites.js`);
    assert.ok(ATTACK_FX.includes(r.attackFx), `${id}: unknown attackFx "${r.attackFx}"`);
  }
});

test('every property terrain has a building drawing; decor names exist', () => {
  for (const [id, t] of Object.entries(registry.terrain)) {
    if (hasAttribute(t, 'property')) assert.ok(BUILDINGS[t.render.building], `${id}: render.building "${t.render.building}" has no drawing`);
    if (t.render.decor) assert.equal(typeof TERRAIN_DECOR[t.render.decor], 'function', `${id}: no drawing for decor "${t.render.decor}"`);
  }
});

test('attributes are assigned to the intended units', () => {
  const withAttr = (a) => registry.unitIds.filter((id) => hasAttribute(registry.unit(id), a)).sort();
  assert.deepEqual(withAttr('capture'), ['infantry', 'mech']);
  assert.deepEqual(withAttr('indirect'), ['artillery', 'sniper']);
  assert.deepEqual(withAttr('ignoresTerrainDefense'), ['bomber', 'copter', 'fighter']);
});

test('terrain attributes: properties, income and the HQ victory condition', () => {
  const props = Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'property')).sort();
  assert.deepEqual(props, ['airfield', 'barracks', 'city', 'factory', 'hq']);
  assert.deepEqual(Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'victoryOnCapture')), ['hq']);
  for (const id of props) assert.equal(registry.terrainDef(id).attributes.property.capturePoints, 20);
});

test('characterisation of the original stats', () => {
  const stat = (id) => { const u = registry.unit(id); return [u.cost, u.move, u.range.join('-'), u.layer]; };
  assert.deepEqual(stat('infantry'), [1000, 2, '1-1', 'ground']);
  assert.deepEqual(stat('artillery'), [6000, 5, '2-3', 'ground']);
  assert.deepEqual(stat('bomber'), [12000, 7, '1-1', 'high_air']);
  assert.equal(registry.rules.maxHp, 10);
});

test('anti-air and anti-ground roles: flak hits air, artillery cannot hit low-air copters', async () => {
  const game = new Game(registry, await loadMap(readData, registry, 'classic'));
  const at = (type, owner) => ({ id: 900 + owner, type, owner, x: 0, y: 0, hp: 10, done: false, capture: 0 });
  assert.ok(canTarget(game, at('flak', 0), at('copter', 1)));
  assert.ok(canTarget(game, at('flak', 0), at('bomber', 1)));
  assert.ok(!canTarget(game, at('artillery', 0), at('copter', 1)));
  assert.ok(!canTarget(game, at('infantry', 0), at('bomber', 1)));
  assert.ok(canTarget(game, at('bomber', 0), at('tank', 1)));
});

test('every map in the index loads, and its default exists', async () => {
  const index = await loadMapIndex(readData);
  assert.ok(index.maps[index.default], 'default map is listed');
  for (const id of Object.keys(index.maps)) {
    const map = await loadMap(readData, registry, id);
    assert.equal(map.id, id, `${id}: file id must match its index key`);
    new Game(registry, map); // constructing runs createState
  }
});

test('classic map: size, players, HQs', async () => {
  const map = await loadMap(readData, registry, 'classic');
  assert.equal(`${map.width}x${map.height}`, '10x11');
  assert.deepEqual(map.players.map((p) => p.controller), ['human', 'ai']);
  const hqs = [];
  map.terrain.forEach((row, y) => row.forEach((t, x) => { if (t === 'hq') hqs.push(map.owners[y][x]); }));
  assert.deepEqual(hqs.sort(), [0, 1]);
});
