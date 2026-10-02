// The facts the info boxes and the build menu show, computed from the shipped data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { attributeLabel, UNIT_ATTRIBUTES } from '../../src/engine/attributes.js';
import { allProperties } from '../../src/engine/queries.js';
import { fmtMoney, terrainInfo, unitInfo, unitStats } from '../../src/ui/info.js';

const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');
const fresh = () => new Game(registry, classic);
const tileOf = (game, terrainId) => { for (let y = 0; y < game.map.height; y++) for (let x = 0; x < game.map.width; x++) if (game.map.terrain[y][x] === terrainId) return { x, y }; throw new Error(terrainId); };

test('money is written with thousands separators', () => assert.equal(fmtMoney(12000), '12,000'));

test('terrain info: defense, move cost per move class (a dash-less null means impassable) and notes', () => {
  const game = fresh();
  const m = tileOf(game, 'mountain');
  const t = terrainInfo(game, m.x, m.y);
  assert.equal(t.name, 'Mountain');
  assert.equal(t.defense, 4);
  assert.deepEqual(t.moves.map((c) => [c.label, c.cost]), [['Foot', 2], ['Wheels', null], ['Treads', null], ['Air', 1], ['Naval', null], ['Amphibious', 2]]);
  assert.deepEqual(t.notes.map((n) => n.label), ['Blocks line of sight', 'High ground']);
  assert.ok(t.notes.every((n) => n.help), 'each note explains itself');
  assert.equal(t.property, null);
});

test('property info: owner, income, repair, capture points and what it builds', () => {
  const game = fresh();
  const mine = allProperties(game).find((p) => p.owner === 0 && p.terrain.id === 'factory');
  const t = terrainInfo(game, mine.x, mine.y);
  assert.equal(t.property.owner.name, 'Ashmark');
  assert.deepEqual([t.property.income, t.property.repair, t.property.capturePoints], [1000, 2, 20]);
  assert.deepEqual(t.property.builds, ['Vehicles']);
  const city = allProperties(game).find((p) => p.owner === null);
  assert.equal(terrainInfo(game, city.x, city.y).property.owner, null, 'an unowned city is neutral');
  const barracks = allProperties(game).find((p) => p.terrain.id === 'barracks');
  assert.deepEqual(terrainInfo(game, barracks.x, barracks.y).property.builds, ['Infantry']);
});

test('unit stats read the weapon, armor and attribute labels from the data', () => {
  const game = fresh();
  const tank = unitStats(game, registry.unit('tank'));
  assert.deepEqual([tank.name, tank.cost, tank.move, tank.armor, tank.toughness], ['Tank', 7000, 4, 85, 1.3]);
  assert.deepEqual(tank.weapons, [{ name: 'Tank cannon', damage: 80, min: 1, max: 1, hits: ['Ground', 'Low air'] }]);
  assert.deepEqual(tank.tags, []);

  assert.deepEqual(unitStats(game, registry.unit('soldier')).tags.map((t) => t.label), ['Captures', 'Cover x2']);
  assert.match(unitStats(game, registry.unit('soldier')).tags[1].help, /2 times the defense/);
  const sniper = unitStats(game, registry.unit('sniper'));
  assert.deepEqual(sniper.tags.map((t) => t.label), ['Indirect fire']);
  assert.deepEqual([sniper.weapons[0].min, sniper.weapons[0].max], [2, 2]);
  assert.deepEqual(unitStats(game, registry.unit('artillery')).weapons[0].hits, ['Ground']);
  assert.deepEqual(unitStats(game, registry.unit('fighter')).weapons[0].hits, ['Low air', 'High air']);
  assert.deepEqual(unitStats(game, registry.unit('flak')).weapons[0].hits, ['Ground', 'Low air', 'High air']);
  assert.equal(unitStats(game, registry.unit('copter')).layer, 'Low air');
  assert.equal(unitStats(game, registry.unit('tank')).layer, null);
});

test('an attribute without a label falls back to its own name', () => {
  assert.equal(attributeLabel(UNIT_ATTRIBUTES, 'capture'), 'Captures');
  assert.equal(attributeLabel(UNIT_ATTRIBUTES, 'terrainDefenseMultiplier', 3), 'Cover x3');
  assert.equal(attributeLabel(UNIT_ATTRIBUTES, 'somethingNew'), 'somethingNew');
});

test('unit info: HP rounded up, owner, and whether it has acted this turn', () => {
  const game = fresh();
  const mine = game.state.units.find((u) => u.owner === 0);
  const theirs = game.state.units.find((u) => u.owner === 1);
  mine.hp = 6.4;
  let u = unitInfo(game, mine);
  assert.deepEqual([u.hp, u.maxHp, u.faction.name, u.acted, u.forecast], [7, 10, 'Ashmark', false, null]);
  mine.done = true; theirs.done = true;
  assert.equal(unitInfo(game, mine).acted, true);
  assert.equal(unitInfo(game, theirs).acted, false, 'only the side whose turn it is can have acted');
  mine.capture = 10;
  u = unitInfo(game, mine);
  assert.equal(u.capture, null, 'capture progress only shows while standing on a property');
});

test('cover follows the tile the unit is going to, and the forecast is the damage it would take', () => {
  const game = fresh();
  const soldier = game.state.units.find((u) => u.owner === 0 && u.type === 'soldier');
  const mountain = tileOf(game, 'mountain');
  assert.equal(unitInfo(game, soldier, { at: mountain }).cover, 8, 'soldiers double the mountain\'s 4 stars');
  const tank = { ...game.state.units.find((u) => u.owner === 1), type: 'tank' };
  const target = { ...soldier, x: tank.x, y: tank.y + 1 };
  const u = unitInfo(game, target, { attacker: { ...tank, hp: 10 } });
  assert.ok(u.forecast > 0 && Number.isInteger(u.forecast));
});
