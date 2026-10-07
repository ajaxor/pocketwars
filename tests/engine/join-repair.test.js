// Joining damaged units, paid repair by building type, and carriers repairing aircraft next to them (October 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { startTurn } from '../../src/engine/economy.js';
import { computeReach } from '../../src/engine/movement.js';

const registry = await loadRegistry(readData);
const legend = {
  '.': { terrain: 'plain' }, '~': { terrain: 'sea' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 },
  c: { terrain: 'city', owner: 0 }, F: { terrain: 'factory', owner: 0 }, B: { terrain: 'barracks', owner: 0 }, A: { terrain: 'airfield', owner: 0 }, Y: { terrain: 'shipyard', owner: 0 },
};
const players = (funds = 20000) => [{ faction: 'ashmark', controller: 'human', funds }, { faction: 'vantor_reach', controller: 'human', funds: 20000 }];
const world = (rows, unitsOnMap, funds) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players: players(funds), legend }), registry));
const turnOf = (g) => { g.endTurn(); g.endTurn(); };   // the other player passes, then player 0's turn starts again

test('join: a damaged unit moves onto a damaged friend of its own kind and their HP adds up (the surplus is lost)', () => {
  const g = world(['H.....h', '.......'], [['tank', 0, 1, 1, 4], ['tank', 0, 2, 1, 5], ['tank', 0, 0, 0, 10], ['soldier', 1, 6, 1]]);
  const [a, b] = g.state.units;
  assert.equal(computeReach(g, a).has(2, 1), false, 'the planner does not offer it');
  assert.equal(g.act({ unitId: a.id, to: { x: 2, y: 1 }, action: { type: 'wait' } }).error, 'tile-occupied');
  const res = g.act({ unitId: a.id, to: { x: 2, y: 1 }, action: { type: 'join' } });
  assert.equal(res.ok, true);
  assert.ok(!g.state.units.includes(a), 'the mover is used up');
  assert.equal(b.hp, 9);
  assert.equal(b.done, true);
  const ev = res.events.find((e) => e.type === 'join');
  assert.deepEqual([ev.from, ev.to, ev.lost], [5, 9, 0]);
  const c = world(['H.....h', '.......'], [['tank', 0, 1, 1, 8], ['tank', 0, 2, 1, 7], ['tank', 0, 0, 0, 10], ['soldier', 1, 6, 1]]);
  c.act({ unitId: c.state.units[0].id, to: { x: 2, y: 1 }, action: { type: 'join' } });
  assert.equal(c.state.units.find((u) => u.x === 2 && u.y === 1).hp, 10, 'capped at the maximum');
});

test('join: not with a full-HP friend, another kind of unit, or when the mover itself is undamaged', () => {
  const g = world(['H.....h', '.......'], [['tank', 0, 1, 1, 4], ['tank', 0, 2, 1, 10], ['recon', 0, 3, 1, 5], ['soldier', 1, 6, 1]]);
  const [a] = g.state.units;
  assert.equal(g.act({ unitId: a.id, to: { x: 2, y: 1 }, action: { type: 'join' } }).ok, false, 'partner at full HP');
  assert.equal(g.act({ unitId: a.id, to: { x: 3, y: 1 }, action: { type: 'join' } }).ok, false, 'a recon is not a tank');
});

test('repair: a unit on a friendly building that serves its kind is repaired at the start of the turn, and it costs a tenth of its price per HP', () => {
  const g = world(['HcF.B.h', '.......'], [['tank', 0, 2, 0, 5], ['soldier', 0, 1, 0, 5], ['soldier', 1, 6, 1]], 20000);
  const [tank, soldier] = g.state.units;
  const funds = g.state.funds[0];
  g.endTurn();
  const ev = startTurn(g, 0)[0];
  const perHp = registry.unit('tank').cost / 10;
  assert.equal(tank.hp, 7);
  assert.equal(soldier.hp, 7);
  assert.ok(ev.repaired.length === 2 && ev.repaired.every((r) => r.cost > 0));
  const spent = 2 * perHp + 2 * (registry.unit('soldier').cost / 10);
  assert.equal(g.state.funds[0], funds + ev.income - spent);
});

test('repair: ground buildings never repair aircraft, and a building only repairs the kinds it serves', () => {
  const g = world(['HcF.B.h', '.......'], [['copter', 0, 2, 0, 5], ['tank', 0, 4, 0, 5], ['soldier', 0, 2, 1, 5], ['soldier', 1, 6, 1]]);
  const [copter, tank] = g.state.units;
  g.endTurn(); startTurn(g, 0);
  assert.equal(copter.hp, 5, 'a copter on a factory is not repaired');
  assert.equal(tank.hp, 5, 'a tank on a barracks is not either');
  const a = world(['HA.....h', '........'], [['copter', 0, 1, 0, 5], ['soldier', 1, 6, 1]]);
  a.endTurn(); startTurn(a, 0);
  assert.equal(a.state.units[0].hp, 7, 'an airfield repairs aircraft');
});

test('repair: ships are repaired beside their shipyard, and repairs stop when the money runs out', () => {
  const g = world(['HY~....h', '.......~'], [['destroyer', 0, 2, 0, 5], ['soldier', 1, 6, 1]], 0);
  g.endTurn(); g.state.funds[0] = -100000; startTurn(g, 0);
  assert.equal(g.state.units[0].hp, 5, 'no money, no repair');
  const h = world(['HY~....h', '.......~'], [['destroyer', 0, 2, 0, 5], ['soldier', 1, 6, 1]], 0);
  h.endTurn(); h.endTurn(); // player 0's turn begins with the income of their HQ and shipyard
  assert.ok(h.state.units[0].hp > 5, 'with income to pay for it');
});

test('repair: aircraft next to an aircraft carrier are repaired at the start of the turn', () => {
  const g = world(['H~~~~~h', '~~~~~~~'], [['aircraft_carrier', 0, 2, 0], ['copter', 0, 3, 0, 4], ['fighter', 0, 2, 1, 4], ['fighter', 0, 5, 1, 4], ['soldier', 1, 6, 0]]);
  const [, copter, near, far] = g.state.units;
  g.endTurn(); startTurn(g, 0);
  assert.equal(copter.hp, 6);
  assert.equal(near.hp, 6);
  assert.equal(far.hp, 4, 'not adjacent');
});
