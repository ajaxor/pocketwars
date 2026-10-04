// The diver, the motorcycle and the conscript on the shipped data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';
import { rawMap } from '../helpers/fixtures.js';
import { canSee } from '../../src/engine/detection.js';
import { computeReach } from '../../src/engine/movement.js';
import { calcDamage, forecastAttack } from '../../src/engine/combat.js';
import { canSubmergeAt, canSurface } from '../../src/engine/submerge.js';
import { chooseOrder } from '../../src/engine/ai.js';

const registry = await loadRegistry(readData);
const legend = { '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' }, F: { terrain: 'forest' }, R: { terrain: 'rough' }, M: { terrain: 'mountain' }, r: { terrain: 'road' }, c: { terrain: 'city' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 } };
const players = [{ faction: 'ashmark', controller: 'human', funds: 10000 }, { faction: 'vantor_reach', controller: 'human', funds: 10000 }];
const game = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));
const order = (g, n, to, action = { type: 'wait' }) => g.act({ unitId: g.state.units[n].id, to, action });

// ---- diver ---------------------------------------------------------------------------------------------------------------------
test('diver: one tile on land, two in water', () => {
  const g = game(['.....~~~~h', '..........'], [['diver', 0, 5, 0], ['soldier', 1, 9, 1]]);
  const reach = computeReach(g, g.state.units[0]);
  assert.equal(reach.has(6, 0) && reach.has(7, 0), true, 'two tiles through the sea');
  assert.equal(reach.has(8, 0), false);
  assert.equal(reach.has(4, 0), true, 'one tile of land');
  assert.equal(reach.has(3, 0), false, 'a second land tile is too far');
});

test('diver: it goes under by itself on deep water and comes up on land; there are no dive orders', () => {
  const g = game(['H.....~~~h', '..........'], [['diver', 0, 5, 0], ['soldier', 1, 9, 1]]);
  const diver = g.state.units[0];
  assert.equal(diver.submerged, false);
  assert.equal(canSubmergeAt(g, diver, 6, 0), false, 'no Submerge order');
  assert.equal(order(g, 0, { x: 7, y: 0 }).ok, true);
  assert.equal(diver.submerged, true, 'under after moving into the sea');
  assert.equal(canSee(g, 1, diver), false);
  assert.equal(canSurface(g, diver), false, 'no Surface order either');
  g.endTurn(); g.endTurn();
  assert.equal(order(g, 0, { x: 6, y: 0 }).ok, true);
  assert.equal(order(g, 0, { x: 6, y: 0 }, { type: 'surface' }).ok, false);
});

test('diver: it surfaces when it leaves deep water, and shoals are not deep', () => {
  const g = game(['~~~o....h', '.........'], [['diver', 0, 1, 0], ['soldier', 1, 8, 1]]);
  const diver = g.state.units[0];
  diver.submerged = true;
  assert.equal(order(g, 0, { x: 3, y: 0 }).ok, true);
  assert.equal(diver.submerged, false, 'on the shoals it is up');
});

test('diver: a diver placed on deep water starts submerged', () => {
  const g = game(['~~~~h', '.....'], [['diver', 0, 1, 0], ['soldier', 1, 4, 1]]);
  assert.equal(g.state.units[0].submerged, true);
});

test('diver: its harpoon reaches ships and other submerged units; a destroyer is hit hard, and a plain gun cannot touch a submerged diver', () => {
  const g = game(['~~~~~~~~h', '.........'], [['diver', 0, 1, 0], ['destroyer', 1, 2, 0], ['diver', 1, 5, 0], ['soldier', 0, 5, 1]]);
  const [diver, destroyer, enemyDiver, soldier] = g.state.units;
  assert.ok(calcDamage(g, diver, destroyer) >= 3, 'strong against hulls');
  assert.ok(calcDamage(g, diver, destroyer) > calcDamage(g, soldier, destroyer));
  assert.equal(calcDamage(g, soldier, enemyDiver), 0, 'a rifle cannot hit what is submerged');
  const near = game(['~~~~~~~~h', '.........'], [['diver', 0, 1, 0], ['diver', 1, 2, 0]]);
  assert.ok(calcDamage(near, near.state.units[0], near.state.units[1]) > 0, 'diver against diver');
});

// ---- motorcycle ----------------------------------------------------------------------------------------------------------------
test('motorcycle: fast on open ground and roads, nearly stuck in forest and rough ground, and no mountains', () => {
  const g = game(['H.F..', '.....', 'M....', '.R...', '....h'], [['motorcycle', 0, 0, 3], ['soldier', 1, 4, 0]]);
  const reach = computeReach(g, g.state.units[0]);
  assert.equal(reach.has(4, 4), true, 'five tiles of plain');
  assert.equal(reach.costAt(1, 3), 4, 'a rough tile eats most of the move');
  assert.equal(reach.has(0, 2), false, 'mountains are closed');
  const cost = (t) => registry.terrainDef(t).moveCost.bike;
  assert.ok(cost('forest') >= 3 && cost('rough') >= 3, 'a severe penalty');
  assert.ok(cost('road') < cost('plain'));
  assert.equal(cost('mountain'), null);
});

const strikeOf = (g, to, targetN = 1) => g.act({ unitId: g.state.units[0].id, to, action: { type: 'attack', targetId: g.state.units[targetN].id } }).events.find((e) => e.type === 'strike' && !e.counter).damage;

test('motorcycle: no penalty for moving first, and a harder hit than a rifle', () => {
  const still = strikeOf(game(['.....', '.....', 'H...h'], [['motorcycle', 0, 2, 0], ['soldier', 1, 3, 0]]), { x: 2, y: 0 });
  const moved = strikeOf(game(['.....', '.....', 'H...h'], [['motorcycle', 0, 1, 0], ['soldier', 1, 3, 0]]), { x: 2, y: 0 });
  assert.equal(moved, still);
  const rifle = strikeOf(game(['.....', '.....', 'H...h'], [['soldier', 0, 2, 0], ['soldier', 1, 3, 0]]), { x: 2, y: 0 });
  assert.ok(still > rifle, `${still} against a soldier's ${rifle}`);
});

test('motorcycle: the forecast agrees, and a counterattack is the same either way', () => {
  const g = game(['.....', '.....', 'H...h'], [['motorcycle', 0, 1, 0], ['soldier', 1, 3, 0]]);
  const [bike, soldier] = g.state.units;
  assert.equal(forecastAttack(g, bike, soldier, { x: 2, y: 0 }).damage, calcDamage(g, bike, soldier, { x: 2, y: 0 }));
  const h = game(['.....', '.....', 'H...h'], [['soldier', 0, 2, 0], ['motorcycle', 1, 3, 0]]);
  const counter = () => forecastAttack(h, h.state.units[0], h.state.units[1]).counter;
  const fresh = counter();
  h.state.units[1].moved = true;   // it drove here earlier
  assert.equal(counter(), fresh);
  assert.ok(fresh > 0);
});

test('motorcycle: it captures', () => {
  assert.ok(registry.unit('motorcycle').attributes.capture);
});

// ---- conscript -----------------------------------------------------------------------------------------------------------------
test('conscript: cheaper and weaker than the soldier, gets cover, captures', () => {
  const c = registry.unit('conscript'), s = registry.unit('soldier');
  assert.ok(c.cost < s.cost);
  assert.ok(registry.weapon(c.weapons[0]).damage < registry.weapon(s.weapons[0]).damage);
  assert.equal(c.attributes.terrainDefenseMultiplier, 2);
  assert.ok(c.attributes.capture);
});

// ---- the AI uses them --------------------------------------------------------------------------------------------------------------
test('AI: a conscript next to a property captures it', () => {
  const g = game(['H....', '.....', 'c...h'], [['motorcycle', 1, 4, 0], ['conscript', 1, 0, 2], ['soldier', 0, 4, 1]]);
  g.state.turn = 1;
  const conscript = g.state.units[1];
  assert.equal(chooseOrder(g, conscript).action.type, 'capture');
});
