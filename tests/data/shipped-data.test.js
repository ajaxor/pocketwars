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
import { ATTACK_FX_NAMES as ATTACK_FX } from '../../src/render/attack-fx.js';

test('shipped data passes validation', async () => {
  const raw = {};
  for (const k of ['rules', 'factions', 'terrain', 'weapons', 'units', 'ai', 'ai-strategies', 'ground', 'loadouts']) raw[k] = await readData(`${k}.json`);
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
  assert.deepEqual(withAttr('capture'), ['commando', 'conscript', 'diver', 'flamethrower', 'marine', 'mech', 'mechanic', 'medic', 'mortar', 'motorcycle', 'royal_guard', 'rpg_trooper', 'shock_trooper', 'sniper', 'soldier', 'spy', 'swordsman']);
  for (const id of registry.unitIds) if (['infantry', 'amphibious'].includes(registry.unit(id).category)) assert.ok(hasAttribute(registry.unit(id), 'capture'), `${id}: all infantry capture`);
  assert.deepEqual(withAttr('terrainDefenseMultiplier'), ['commando', 'conscript']);
  assert.deepEqual(withAttr('indirect'), ['artillery', 'artillery_turret', 'mortar', 'rocket_launcher', 'sniper']);
  assert.deepEqual(withAttr('submerge'), ['diver', 'missile_sub', 'submarine']);
  assert.deepEqual(withAttr('sonar'), ['destroyer', 'hunter_sub', 'radar_plane']);
  assert.deepEqual(withAttr('radar'), ['radar_plane']);
  assert.deepEqual(withAttr('cloak'), ['sniper', 'spy', 'stealth_bomber', 'stealth_copter', 'stealth_fighter']);
  assert.deepEqual(withAttr('heal'), ['mechanic', 'medic']);
  assert.deepEqual(withAttr('rest'), ['commando']);
  assert.deepEqual(withAttr('ignoresTerrainDefense'), ['airship', 'bomber', 'fighter', 'gun_copter', 'hover_tank', 'missile_copter', 'radar_plane', 'stealth_bomber', 'stealth_copter', 'stealth_fighter', 'torpedo_bomber', 'transport_copter', 'vintage_bomber', 'vintage_fighter']);
  // every armed unit carries ammo (turrets excepted), and so do the carriers and the mine layer, whose rounds stand for troops and mines
  const armed = registry.unitIds.filter((id) => registry.unit(id).weapons.length && registry.unit(id).category !== 'structure');
  assert.deepEqual(withAttr('ammo'), [...new Set([...armed, 'apc', 'mine_layer', 'transport_copter', 'troop_transport'])].sort(), 'every armed unit has ammo, and nothing else but the carriers');
  for (const id of armed) for (const w of registry.unit(id).weapons) assert.ok(registry.weapon(w).ammo >= 1, `${id}: ${w} costs a round`);
  for (const id of registry.unitIds.filter((i) => registry.unit(i).category === 'structure')) for (const w of registry.unit(id).weapons) assert.equal(registry.weapon(w).ammo, undefined, `${id}: a turret never runs dry`);
  // every vehicle, ship and aircraft has a tank; infantry, mines and structures have none
  const tanked = registry.unitIds.filter((id) => ['vehicle', 'naval', 'aircraft'].includes(registry.unit(id).category)).sort();
  assert.deepEqual(withAttr('fuel'), tanked, 'every vehicle, ship and aircraft has a fuel tank, and nothing else does');
  for (const id of tanked) assert.equal(registry.unit(id).attributes.fuel.burn, registry.unit(id).moveClass === 'air' ? undefined : 'move', `${id}: aircraft burn every turn, ground units and ships only when they move`);
  const tank = (id) => registry.unit(id).attributes.fuel.max;
  const planes = registry.unitIds.filter((id) => registry.unit(id).moveClass === 'air' && !registry.unit(id).tags?.includes('helicopter') && id !== 'radar_plane');
  for (const id of registry.unitIds.filter((i) => registry.unit(i).tags?.includes('helicopter'))) assert.ok(planes.every((p) => tank(id) > tank(p)), `${id} carries more fuel than any plane`);
  assert.ok(tank('radar_plane') > tank('missile_copter'), 'the radar plane has the longest endurance of any aircraft');
  assert.deepEqual(withAttr('attacksPerTurn'), [], 'the dreadnought no longer attacks twice (the attribute stays available)');
  assert.deepEqual(withAttr('deploy'), ['apc', 'transport_copter', 'troop_transport']);
  assert.deepEqual(withAttr('supply'), ['aircraft_carrier', 'radar_plane', 'supply_truck']);
  assert.deepEqual(withAttr('reloads'), ['sam_launcher']);
  assert.deepEqual(withAttr('layMines'), ['mine_layer']);
  assert.deepEqual(withAttr('mine'), ['sea_mine']);
  assert.deepEqual(withAttr('ignoresMines'), ['hover_tank']);
  assert.deepEqual(withAttr('surfacesToFire'), ['missile_sub']);
  assert.deepEqual(withAttr('structure'), ['artillery_turret', 'cannon_turret', 'cracked_wall', 'jammer', 'sam_turret']);
  assert.deepEqual(withAttr('wallSection'), ['cracked_wall']);
  assert.deepEqual(withAttr('jammer'), ['jammer']);
  for (const id of withAttr('structure')) assert.equal(registry.unit(id).category, 'structure', `${id} is in the structure category`);
});

test('every unit can be built somewhere: a leader\'s roster, an HQ, a lab upgrade, or it is laid by a mine layer or placed by the map', () => {
  const rostered = new Set();
  for (const kit of [registry.loadouts.default, ...registry.leaderIds.map((id) => registry.loadoutFor(id))]) for (const u of [...(kit.roster ?? []), kit.infantry]) rostered.add(u);
  for (const id of registry.unitIds) {
    const def = registry.unit(id);
    if (['mine', 'structure'].includes(def.category)) continue;
    if (def.shelved) { assert.ok(!rostered.has(id) && !registry.upgradedBy[id], `${id} is shelved, so on no roster and no lab upgrade`); continue; }
    assert.ok(rostered.has(id) || registry.upgradedBy[id], `${id} is on some roster or a lab upgrades to it`);
  }
  assert.deepEqual(Object.keys(registry.upgradedBy).sort(), ['dreadnought', 'heavy_tank', 'hover_tank', 'missile_sub', 'missile_tank', 'stealth_bomber', 'stealth_copter', 'stealth_fighter', 'stealth_tank']);
});

test('terrain attributes: properties, income and the HQ victory condition', () => {
  const props = Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'property')).sort();
  assert.deepEqual(props, ['agency', 'airbase', 'airfield', 'artillery_range', 'chemical_plant', 'city', 'factory', 'garage', 'harbor', 'heavy_lab', 'hover_lab', 'hq', 'missile_lab', 'shipyard', 'stealth_lab', 'sub_pen', 'support_factory']);
  assert.deepEqual(Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'submergible')), ['sea']);
  assert.deepEqual(Object.keys(registry.terrain).filter((id) => hasAttribute(registry.terrain[id], 'victoryOnCapture')), ['hq']);
  for (const id of props) assert.equal(registry.terrainDef(id).attributes.property.capturePoints, 20);
});

test('characterisation of the original stats', () => {
  const stat = (id) => { const u = registry.unit(id); return [u.cost, u.move, registry.weapon(u.weapons[0]).range.join('-'), u.layer]; };
  assert.deepEqual(stat('soldier'), [1000, 2, '1-1', 'ground']);
  assert.deepEqual(stat('artillery'), [6000, 3, '2-3', 'ground']);
  assert.deepEqual(stat('bomber'), [17000, 7, '1-1', 'high_air']);
  assert.equal(registry.rules.maxHp, 10);
});

test('the soldier is the softest unit and gets no extra cover', () => {
  const soldier = registry.unit('soldier');
  assert.equal(soldier.toughness, 1, 'toughness 1 is the baseline');
  assert.equal(soldier.armor, 0);
  assert.equal(soldier.attributes.terrainDefenseMultiplier, undefined);
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
  for (const id of ['city', 'hq', 'factory', 'garage', 'airfield', 'agency', 'hover_lab']) assert.equal(height(id), 2, id);
  for (const id of ['shipyard', 'harbor', 'sub_pen']) assert.equal(height(id), 1, `${id}: cranes and slips block less than a hall`);
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
  assert.ok(canTarget(game, at('flak', 0), at('missile_copter', 1)));
  assert.ok(canTarget(game, at('flak', 0), at('bomber', 1)));
  assert.ok(!canTarget(game, at('artillery', 0), at('missile_copter', 1)));
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

test('transports carry each leader\'s basic infantry, and the tuning of the stealth and fuel changes', () => {
  const basic = Object.fromEntries(registry.leaderIds.map((l) => [l, registry.loadoutFor(l).infantry]));
  assert.deepEqual(basic, { harlan: 'soldier', ada: 'commando', vex: 'spy', hiroshi: 'swordsman', ludwig: 'shock_trooper', rex: 'marine', chase: 'soldier', dmitri: 'conscript', lysandra: 'royal_guard' });
  for (const id of ['transport_copter', 'apc', 'troop_transport']) assert.equal(registry.unit(id).attributes.deploy.basic, true, `${id} carries basic infantry`);
  assert.ok(registry.unit('marine').weapons.includes('marine_deck_rifle'), 'marines can fight ships from the water');
  assert.deepEqual(registry.weapon('marine_deck_rifle').fromTerrain, ['sea', 'shoals']);
  assert.ok(registry.weapon('stealth_bombs').ammo >= 1 && registry.unit('stealth_bomber').attributes.ammo.max >= 1, 'the stealth bomber has a limited load');
  assert.equal(registry.rules.ambushMultiplier, 1.5);
  assert.ok(registry.weapon('dreadnought_guns').damage > registry.weapon('main_guns').damage && registry.weapon('dreadnought_guns').armorPiercing > registry.weapon('main_guns').armorPiercing, 'the dreadnought out-hits the battleship');
  assert.ok(registry.weapon('dreadnought_secondary').damage >= registry.weapon('secondary_guns').damage, 'and so does its secondary battery');
  assert.deepEqual(registry.unitIds.filter((id) => registry.unit(id).tags?.includes('helicopter')).sort(), ['gun_copter', 'missile_copter', 'stealth_copter', 'transport_copter']);
  assert.equal(registry.unit('supply_truck').attributes.supply.fuelTags, undefined, 'the supply truck refuels every kind of unit it supplies, not only helicopters');
  assert.deepEqual(registry.unit('radar_plane').attributes.supply, { categories: ['aircraft'], ammo: false }, 'the radar plane refuels aircraft but carries no ammunition');
});

test('every weapon names an attack animation of its own, and a unit uses only known looks', () => {
  for (const [id, w] of Object.entries(registry.weapons)) assert.ok(ATTACK_FX.includes(w.fx), `weapon ${id}: attack animation "${w.fx}"`);
});
