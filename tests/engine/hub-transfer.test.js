// Infantry production in the October 2026 redesign: the HQ and every city build the infantry that the garage, factory and airfield UNLOCK
// (the motorcycle and the diver are exceptions, built at the garage and the sub pen), and an infantryman can be transferred from any of its
// owner's properties to another empty city of theirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { menuFor, unlockedFor } from '../../src/engine/economy.js';
import { canTransferFrom, transferProblem, transferTargets } from '../../src/engine/transfer.js';

const registry = await loadRegistry(readData);
const legend = {
  '.': { terrain: 'plain' }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 },
  g: { terrain: 'garage', owner: 0 }, G: { terrain: 'garage', owner: 1 }, f: { terrain: 'factory', owner: 0 }, a: { terrain: 'airfield', owner: 0 },
  c: { terrain: 'city', owner: 0 }, d: { terrain: 'city', owner: 0 }, e: { terrain: 'city', owner: 1 }, n: { terrain: 'city' },
  s: { terrain: 'sub_pen', owner: 0 }, y: { terrain: 'shipyard', owner: 0 }, p: { terrain: 'chemical_plant', owner: 0 },
};
const players = (leader = null) => [{ faction: 'ashmark', controller: 'human', funds: 50000, ...(leader && { leader }) }, { faction: 'vantor_reach', controller: 'human', funds: 50000 }];
const world = (row, unitsOnMap = [], leader = null) => new Game(registry, parseMap(rawMap({ rows: [row, '.'.repeat(row.length)], unitsOnMap, players: players(leader), legend }), registry));
const ids = (g, x, y) => menuFor(g, 0, x, y).map((d) => d.id).sort();

// ---- what the HQ and the cities build ---------------------------------------------------------------------------------------------------
test('the HQ and the cities build the faction infantry and what the garage, factory and airfield unlock', () => {
  const g = world('Hgfacd..h');
  assert.deepEqual(ids(g, 0, 0), ['mech', 'mechanic', 'rpg_trooper', 'soldier'], 'the HQ: the soldier and the three unlocked infantry');
  assert.deepEqual(ids(g, 4, 0), ['mech', 'mechanic', 'rpg_trooper', 'soldier'], 'a city: the same');
  assert.deepEqual([...unlockedFor(g, 0, registry.loadoutFor(null))].sort(), ['mech', 'mechanic', 'rpg_trooper']);
});

test('with no garage, factory or airfield a city builds only the faction infantry, and an unlocking building must be yours: an enemy\'s or a neutral one does not count', () => {
  const g = world('H.cd...h');
  assert.deepEqual(ids(g, 2, 0), ['soldier'], 'nothing unlocked');
  assert.deepEqual(ids(g, 0, 0), ['soldier'], 'the HQ still builds the soldier');
  const h = world('HGc.....h');   // an enemy garage
  assert.deepEqual(ids(h, 2, 0), ['soldier']);
  const k = world('Hgc.....h');
  assert.deepEqual(ids(k, 2, 0), ['mechanic', 'soldier']);
  k.edit((st) => { st.owners[0][1] = 1; });   // the garage is captured
  assert.deepEqual(ids(k, 2, 0), ['soldier'], 'losing the garage takes the mechanic away');
  k.edit((st) => { st.owners[0][1] = null; });
  assert.deepEqual(ids(k, 2, 0), ['soldier'], 'a neutral garage unlocks nothing for anyone');
});

test('a leader unlocks only the infantry on their roster: Vex has the AT infantry, Chase the RPG trooper, Lysandra the mechanic', () => {
  const g = world('Hgfacd..h', [], 'vex');
  assert.deepEqual(ids(g, 4, 0), ['mech', 'spy'], 'a city: her own spy and the AT infantry');
  assert.deepEqual(ids(g, 0, 0), ['mech', 'spy'], 'the same at the HQ');
  assert.deepEqual(ids(world('Hgfacd..h', [], 'chase'), 4, 0), ['rpg_trooper', 'soldier']);
  assert.deepEqual(ids(world('Hgfacd..h', [], 'lysandra'), 4, 0), ['mechanic', 'royal_guard']);
});

test('the motorcycle is built at the garage and the diver at the sub pen, never at the HQ or a city', () => {
  const chase = world('Hgcsh', [], 'chase');
  assert.ok(ids(chase, 1, 0).includes('motorcycle'), 'the garage builds the motorcycle');
  assert.ok(!ids(chase, 0, 0).includes('motorcycle') && !ids(chase, 2, 0).includes('motorcycle'), 'not the HQ or a city');
  const vex = world('Hsycpgh', [], 'vex');
  assert.ok(ids(vex, 1, 0).includes('diver'), 'the sub pen builds the diver');
  assert.ok(!ids(vex, 2, 0).includes('diver') && !ids(vex, 0, 0).includes('diver'), 'not the shipyard, the HQ or a city');
  assert.deepEqual(ids(vex, 4, 0), [], 'a shelved building (the chemical plant) builds nothing');
});

test('a city builds one unit a turn and charges for it; the HQ may build again once the new unit has moved off', () => {
  const g = world('Hgc.....h');
  assert.equal(g.build(2, 0, 'mechanic').ok, true);
  assert.equal(g.state.funds[0], 48000);
  assert.equal(g.state.units[0].fresh, true);
  g.state.units[0].x = 3;   // (it has moved off)
  assert.equal(g.build(2, 0, 'mechanic').error, 'already-built', 'one a turn');
  assert.equal(g.build(0, 0, 'soldier').ok, true);
  g.state.units.at(-1).x = 4;
  assert.equal(g.build(0, 0, 'soldier').ok, true, 'the HQ builds as often as it can pay');
  assert.equal(g.build(2, 0, 'tank').error, 'cannot-build-here', 'a city builds infantry only');
});

// ---- transfer ---------------------------------------------------------------------------------------------------------------------------
const order = (g, unit, to, at) => g.act({ unitId: unit.id, to, action: { type: 'transfer', at } });

test('an infantryman on one of its owner\'s properties can be sent to any other empty city of theirs, anywhere on the map', () => {
  const g = world('Hcdfe.n.h', [['soldier', 0, 1, 0]]);
  const [s] = g.state.units;
  assert.deepEqual(transferTargets(g, s).map((t) => t.x), [2], 'the only other empty city it owns (not the enemy\'s, not the neutral one, not the HQ)');
  assert.equal(canTransferFrom(g, s, 1, 0), true);
  s.capture = 7;
  const res = order(g, s, { x: 1, y: 0 }, { x: 2, y: 0 });
  assert.equal(res.ok, true);
  assert.deepEqual([s.x, s.y, s.done, s.capture], [2, 0, true, 0], 'it arrives with its turn spent and no capture progress');
  const ev = res.events.find((e) => e.type === 'transfer');
  assert.deepEqual([ev.from, ev.to], [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  assert.equal(g.undo(), true, 'a human can take it back');
  assert.deepEqual([g.state.units[0].x, g.state.units[0].done], [1, false]);
});

test('it may walk to a property first and be transferred from there; the HQ and a factory count as properties too', () => {
  const g = world('Hcdfe.n.h', [['soldier', 0, 0, 1], ['soldier', 0, 3, 1]]);
  const [a, b] = g.state.units;
  assert.equal(order(g, a, { x: 0, y: 0 }, { x: 2, y: 0 }).ok, true, 'from the HQ, after a step onto it');
  assert.deepEqual([a.x, a.y], [2, 0]);
  assert.equal(order(g, b, { x: 3, y: 0 }, { x: 1, y: 0 }).ok, true, 'from the factory');
  assert.deepEqual([b.x, b.y], [1, 0]);
});

test('it cannot be sent to a tile that is occupied, an enemy or neutral city, the HQ, or the city it stands on; nor from open ground', () => {
  const g = world('Hcdfe.n.h', [['soldier', 0, 1, 0], ['soldier', 0, 2, 0], ['soldier', 0, 5, 1]]);
  const [s, blocker, ground] = g.state.units;
  assert.equal(order(g, s, { x: 1, y: 0 }, { x: 2, y: 0 }).error, 'bad-destination', 'occupied');
  assert.equal(order(g, s, { x: 1, y: 0 }, { x: 4, y: 0 }).error, 'bad-destination', 'enemy city');
  assert.equal(order(g, s, { x: 1, y: 0 }, { x: 6, y: 0 }).error, 'bad-destination', 'neutral city');
  assert.equal(order(g, s, { x: 1, y: 0 }, { x: 0, y: 0 }).error, 'bad-destination', 'the HQ');
  assert.equal(order(g, s, { x: 1, y: 0 }, { x: 1, y: 0 }).error, 'bad-destination', 'where it already is');
  assert.equal(order(g, ground, { x: 5, y: 1 }, { x: 2, y: 0 }).error, 'not-your-property', 'from open ground');
  assert.equal(transferProblem(g, blocker, { x: 2, y: 0 }, { x: 1, y: 0 }), 'bad-destination');
});

test('only the infantry built at cities can be transferred: not vehicles, the motorcycle or the diver; and not on the turn it was built', () => {
  const g = world('Hcdgfe.n.h', [['tank', 0, 1, 0], ['motorcycle', 0, 2, 0], ['diver', 0, 3, 0]]);
  const [tank, bike, diver] = g.state.units;
  for (const [u, x] of [[tank, 1], [bike, 2], [diver, 3]]) assert.equal(order(g, u, { x, y: 0 }, { x: 0, y: 1 }).error, 'cannot-transfer', u.type);
  const h = world('Hgc.....h');
  assert.equal(h.build(2, 0, 'mechanic').ok, true);
  const fresh = h.state.units[0];
  assert.equal(order(h, fresh, { x: 2, y: 0 }, { x: 1, y: 0 }).error, 'just-built', 'a just-built unit has only its free move');
  assert.equal(canTransferFrom(h, fresh, 2, 0), false);
});
