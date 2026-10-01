// Marine (amphibious infantry that rides a dinghy) and the transport copter (drops soldiers, which it carries as ammo), on the shipped data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { computeReach } from '../../src/engine/movement.js';
import { ammoLevel } from '../../src/engine/ammo.js';
import { canDeploy, dropTiles } from '../../src/engine/deploy.js';
import { chooseOrder, playTurn } from '../../src/engine/ai.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' }, M: { terrain: 'mountain' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, Y: { terrain: 'shipyard', owner: 0 }, A: { terrain: 'airfield', owner: 0 },
};
const players = [{ faction: 'orange_star', controller: 'human', funds: 20000 }, { faction: 'violet_nebula', controller: 'human', funds: 20000 }];
const world = (rows, unitsOnMap) => new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));

test('a marine walks on land, crosses shoals and sea, and captures like a soldier', () => {
  const g = world(['H.o~~h'], [['marine', 0, 1, 0]]);
  const marine = g.state.units[0];
  const reach = computeReach(g, marine);
  assert.ok(reach.has(2, 0) && reach.has(3, 0), 'shoals and sea');
  assert.equal(reach.has(4, 0), false, 'out of range, not out of bounds');
  assert.equal(registry.unit('marine').attributes.capture, true);
});

test('a marine is built at a shipyard and can swim off it', () => {
  const g = world(['H.Y~~h'], [['recon', 1, 5, 0]]);
  assert.ok(g.state.funds[0] >= registry.unit('marine').cost);
  assert.equal(g.build(2, 0, 'marine').ok, true);
  const marine = unitAt(g, 2, 0);
  assert.equal(marine.fresh, true);
  assert.equal(g.act({ unitId: marine.id, to: { x: 4, y: 0 }, action: { type: 'wait' } }).ok, true, 'a free move across the water');
});

test('a transport copter carries soldiers as ammo and drops them next to where it stops', () => {
  const g = world(['H....h', '......'], [['transport_copter', 0, 1, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  assert.equal(copter.ammo, 2);
  assert.equal(ammoLevel(g, copter), 'ok');
  assert.equal(canDeploy(g, copter, 3, 0), true);
  assert.equal(dropTiles(g, copter, 3, 0).length, 3, 'three free neighbours (the map edge takes the fourth)');
  const res = g.act({ unitId: copter.id, to: { x: 3, y: 0 }, action: { type: 'deploy', at: { x: 3, y: 1 } } });
  assert.equal(res.ok, true);
  const soldier = unitAt(g, 3, 1);
  assert.equal(soldier.type, 'soldier');
  assert.equal(soldier.owner, 0);
  assert.equal(soldier.done, false, 'it gets a free move...');
  assert.equal(soldier.fresh, true, '...but no attack');
  assert.equal(copter.ammo, 1);
  assert.equal(copter.done, true);
  assert.deepEqual(res.events.map((e) => e.type).filter((t) => t === 'deploy' || t === 'move'), ['move', 'deploy']);
});

test('a drop needs a free tile the soldier can stand on, and ammo', () => {
  const g = world(['H.~~~h', '..~~~.'], [['transport_copter', 0, 3, 0], ['recon', 1, 5, 1]]);
  const copter = g.state.units[0];
  const bad = (to) => g.act({ unitId: copter.id, to: { x: 3, y: 0 }, action: { type: 'deploy', at: to } }).error;
  assert.equal(bad({ x: 2, y: 0 }), 'invalid-deploy-tile', 'a soldier cannot be put in the sea');
  assert.equal(bad({ x: 5, y: 5 }), 'invalid-deploy-tile', 'not even next to it');
  copter.ammo = 0;
  assert.equal(ammoLevel(g, copter), 'empty');
  assert.equal(g.act({ unitId: copter.id, to: { x: 1, y: 0 }, action: { type: 'deploy', at: { x: 1, y: 1 } } }).error, 'out-of-ammo');
});

test('a transport copter next to an airfield is resupplied and may move on, to drop again', () => {
  const g = world(['H.A....h', '........'], [['transport_copter', 0, 5, 0], ['recon', 1, 7, 1]]);
  const copter = g.state.units[0];
  g.act({ unitId: copter.id, to: { x: 5, y: 0 }, action: { type: 'deploy', at: { x: 5, y: 1 } } });
  assert.equal(copter.done, true);
  copter.done = false; copter.ammo = 0;
  const stop = g.act({ unitId: copter.id, to: { x: 3, y: 0 }, action: { type: 'wait' } });
  assert.equal(stop.ok, true);
  assert.equal(copter.ammo, 2, 'refilled beside the airfield');
  assert.equal(copter.done, false, 'and ready to move again');
  assert.equal(g.act({ unitId: copter.id, to: { x: 6, y: 0 }, action: { type: 'deploy', at: { x: 6, y: 1 } } }).ok, true);
});

test('the AI builds marines at a shipyard, and plays a whole turn with them and the free moves', () => {
  const g = world(['H.Y~~~h', '.......'], [['recon', 1, 6, 1]]);
  g.state.turn = 0;
  const events = playTurn(g);
  assert.ok(events.some((e) => e.type === 'build'), 'it built something');
  for (const u of g.state.units.filter((x) => x.owner === 0)) assert.equal(u.fresh, undefined, `${u.type} used its free move`);
  assert.ok(chooseOrder(g, g.state.units[0]));
});

test('forecastAttack previews the blow and the counter without changing anything', async () => {
  const { forecastAttack } = await import('../../src/engine/combat.js');
  const g = world(['H....h', '......'], [['soldier', 0, 1, 0], ['soldier', 1, 2, 0], ['recon', 1, 5, 1]]);
  const [a, d] = g.state.units;
  const f = forecastAttack(g, a, d);
  assert.ok(f.damage > 0 && f.counter > 0 && !f.destroyed);
  assert.equal(a.hp, 10); assert.equal(d.hp, 10);
  const real = g.act({ unitId: a.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: d.id } });
  const [hit, back] = real.events.filter((e) => e.type === 'strike');
  assert.deepEqual([f.damage, f.counter], [hit.damage, back.damage], 'the preview matches what happens');
  d.hp = 1;
  assert.equal(forecastAttack(g, g.state.units[0], d).destroyed, true);
  assert.equal(forecastAttack(g, g.state.units[0], d).counter, null, 'a dead defender does not answer');
});
