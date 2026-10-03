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
const ATTACK_FX = ['lunge', 'shot', 'arc', 'drop', 'torpedo'];

test('shipped data passes validation', async () => {
  const raw = {};
  for (const k of ['rules', 'factions', 'terrain', 'weapons', 'units', 'ai', 'ground']) raw[k] = await readData(`${k}.json`);
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
  assert.deepEqual(withAttr('capture'), ['marine', 'mech', 'rpg_trooper', 'soldier', 'spy']);
  assert.deepEqual(withAttr('terrainDefenseMultiplier'), ['commando', 'soldier']);
  assert.deepEqual(withAttr('indirect'), ['artillery', 'mortar', 'rocket_launcher', 'rpg_trooper', 'sniper']);
  assert.deepEqual(withAttr('submerge'), ['submarine']);
  assert.deepEqual(withAttr('sonar'), ['destroyer', 'radar_plane']);
  assert.deepEqual(withAttr('radar'), ['radar_plane']);
  assert.deepEqual(withAttr('cloak'), ['spy', 'stealth_bomber', 'stealth_copter', 'stealth_fighter']);
  assert.deepEqual(withAttr('heal'), ['mechanic', 'medic']);
  assert.deepEqual(withAttr('rest'), ['commando']);
  assert.deepEqual(withAttr('ignoresTerrainDefense'), ['bomber', 'copter', 'fighter', 'radar_plane', 'stealth_bomber', 'stealth_copter', 'stealth_fighter', 'torpedo_bomber', 'transport_copter', 'vintage_bomber', 'vintage_fighter']);
  assert.deepEqual(withAttr('ammo'), ['mortar', 'rocket_launcher', 'rpg_trooper', 'stealth_fighter', 'torpedo_bomber', 'transport_copter']);
  assert.deepEqual(withAttr('deploy'), ['transport_copter']);
});

test('exclusive units are on no standard menu, and every one of them is on some leader\'s menu', () => {
  const exclusive = registry.unitIds.filter((id) => registry.unit(id).exclusive).sort();
  assert.equal(exclusive.length, 14, 'the fourteen drafted units');
  const standard = new Set(Object.values(registry.loadouts.default.build).flat());
  for (const id of exclusive) {
    assert.ok(!standard.has(id), `${id} is not on the standard menu`);
    const owners = registry.leaderIds.filter((l) => Object.values(registry.loadoutFor(l).build).flat().includes(id));
    assert.ok(owners.length >= 1, `${id} is on at least one leader's menu`);
  }
});

test('terrain attributes: properties, income and the HQ victory condition', () => {
  const props = Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'property')).sort();
  assert.deepEqual(props, ['airfield', 'barracks', 'city', 'factory', 'hq', 'shipyard']);
  assert.deepEqual(Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'submergible')), ['sea']);
  assert.deepEqual(Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'victoryOnCapture')), ['hq']);
  for (const id of props) assert.equal(registry.terrainDef(id).attributes.property.capturePoints, 20);
});

test('characterisation of the original stats', () => {
  const stat = (id) => { const u = registry.unit(id); return [u.cost, u.move, registry.weapon(u.weapons[0]).range.join('-'), u.layer]; };
  assert.deepEqual(stat('soldier'), [1000, 2, '1-1', 'ground']);
  assert.deepEqual(stat('artillery'), [6000, 3, '2-3', 'ground']);
  assert.deepEqual(stat('bomber'), [12000, 7, '1-1', 'high_air']);
  assert.equal(registry.rules.maxHp, 10);
});

test('the soldier is the softest unit and doubles the terrain defense it gets', () => {
  const soldier = registry.unit('soldier');
  assert.equal(soldier.toughness, 1, 'toughness 1 is the baseline');
  assert.equal(soldier.armor, 0);
  assert.equal(soldier.attributes.terrainDefenseMultiplier, 2);
  for (const id of registry.unitIds.filter((u) => u !== 'soldier')) {
    const u = registry.unit(id);
    assert.ok(u.toughness >= soldier.toughness && u.armor >= soldier.armor, `${id} is at least as tough as a soldier`);
  }
  assert.equal(soldier.category, 'infantry', 'the infantry category is unchanged (barracks still build it)');
  assert.equal(soldier.name, 'Soldier');
  assert.ok(!registry.units.infantry, 'no unit is still called infantry');
});

test('every unit only uses weapons that exist, and every weapon is used', () => {
  const used = new Set();
  for (const id of registry.unitIds) for (const w of registry.unit(id).weapons) { assert.ok(registry.weapons[w], `${id}: weapon ${w}`); used.add(w); }
  assert.deepEqual([...used].sort(), Object.keys(registry.weapons).sort());
});

test('targeting roles: who shoots over obstacles, who needs a clear line, who can hit air', () => {
  const modes = (unit) => new Set(registry.unit(unit).weapons.flatMap((w) => registry.weapon(w).targets));
  assert.ok(modes('artillery').has('indirect_ground') && !modes('artillery').has('direct_ground'));
  assert.ok(modes('sniper').has('direct_ground'), 'snipers need a clear line');
  assert.ok(modes('bomber').has('indirect_ground'));
  assert.ok(modes('flak').has('high_air') && modes('flak').has('low_air'));
  assert.ok(modes('fighter').has('high_air') && !modes('fighter').has('direct_ground'));
  assert.ok(!modes('soldier').has('high_air'));
  for (const mode of Object.values(registry.rules.targetModes)) assert.ok(registry.rules.layers[mode.layer], `${mode.layer} is a layer`);
  assert.deepEqual(Object.keys(registry.rules.targetModes).sort(), ['direct_ground', 'high_air', 'indirect_ground', 'low_air', 'structure', 'surface', 'underwater']);
});

test('obstacles: forests, mountains and buildings block direct fire; only mountains give a vantage', () => {
  const height = (id) => registry.terrainDef(id).attributes.blocksLineOfSight;
  assert.equal(height('forest'), 1);
  assert.equal(height('mountain'), 2);
  for (const id of ['city', 'hq', 'factory', 'barracks', 'airfield']) assert.equal(height(id), 2, id);
  assert.equal(height('shipyard'), 1, 'cranes and slips block less than a hall');
  for (const id of ['plain', 'road', 'sea']) assert.equal(height(id), undefined, id);
  assert.deepEqual(Object.keys(registry.terrain).filter((id) => registry.terrainDef(id).attributes.vantage), ['mountain']);
  assert.ok(registry.terrainDef('mountain').attributes.vantage > height('forest'), 'a mountain sees over forests');
  assert.ok(!(registry.terrainDef('mountain').attributes.vantage > height('mountain')), 'but not over other mountains');
});

test('plains give no defense, like roads', () => {
  assert.equal(registry.terrainDef('plain').defense, 0);
  assert.equal(registry.terrainDef('road').defense, 0);
});

test('anti-air and anti-ground roles: flak hits air, artillery cannot hit low-air copters', async () => {
  const game = new Game(registry, await loadMap(readData, registry, 'classic'));
  const at = (type, owner) => ({ id: 900 + owner, type, owner, x: 0, y: 0, hp: 10, done: false, capture: 0 });
  assert.ok(canTarget(game, at('flak', 0), at('copter', 1)));
  assert.ok(canTarget(game, at('flak', 0), at('bomber', 1)));
  assert.ok(!canTarget(game, at('artillery', 0), at('copter', 1)));
  assert.ok(!canTarget(game, at('soldier', 0), at('bomber', 1)));
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
