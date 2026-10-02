// Naval play on the shipped data: hidden submarines, sonar, interrupted moves, best-weapon choice, diving rules.
import { buildOptions } from '../../src/engine/economy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';
import { rawMap } from '../helpers/fixtures.js';
import { canSee, hiddenFrom, isExposed } from '../../src/engine/detection.js';
import { computeReach, targetsFrom } from '../../src/engine/movement.js';
import { calcDamage, weaponFor } from '../../src/engine/combat.js';
import { chooseOrder } from '../../src/engine/ai.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const legend = {
  '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' },
  H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 }, Y: { terrain: 'shipyard', owner: 0 },
};
const players = [{ faction: 'ashmark', controller: 'human', funds: 10000 }, { faction: 'vantor_reach', controller: 'human', funds: 10000 }];
function sea(rows, unitsOnMap) {
  return new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend: legend }), registry));
}
const at = (g, x, y) => unitAt(g, x, y);

test('a submarine can only dive on deep water, and diving hides it', () => {
  const g = sea(['H.~~~~~h', '........'], [['submarine', 0, 3, 0], ['recon', 1, 7, 1]]);
  const sub = g.state.units[0];
  assert.equal(g.act({ unitId: sub.id, to: { x: 3, y: 0 }, action: { type: 'submerge' } }).ok, true);
  assert.equal(sub.submerged, true);
  assert.equal(canSee(g, 1, sub), false, 'the enemy cannot see it');
  assert.equal(canSee(g, 0, sub), true, 'its owner can');
  assert.deepEqual(hiddenFrom(g, 1), [sub.id]);
});

test('shoals are impassable to ships, and a ship cannot dive or stop on them', () => {
  const g = sea(['~~o~~~~h', '........'], [['destroyer', 0, 1, 0], ['submarine', 0, 0, 0]]);
  for (const u of g.state.units) assert.ok(!computeReach(g, u).has(2, 0), `${u.type} stays out of the shoals`);
  assert.equal(g.act({ unitId: g.state.units[0].id, to: { x: 1, y: 0 }, action: { type: 'submerge' } }).error, 'cannot-submerge', 'a destroyer has no dive');
  assert.ok(registry.terrainDef('shoals').defense > 0, 'but they give cover');
});

test('a submerged unit is noticed when adjacent, and by sonar within its range', () => {
  const g = sea(['~~~~~~~~~', '.........'], [['submarine', 1, 4, 0], ['destroyer', 0, 0, 0], ['recon', 0, 4, 1]]);
  const sub = g.state.units[0];
  sub.submerged = true;
  assert.equal(canSee(g, 0, sub), true, 'the recon is next to it');
  g.state.units[2].y = 1; g.state.units[2].x = 8;
  assert.equal(canSee(g, 0, sub), false, 'destroyer at 4 tiles: out of sonar range');
  g.state.units[1].x = 1;
  assert.equal(canSee(g, 0, sub), true, 'destroyer sonar 3 reaches it');
});

test('hidden units cannot be targeted, and reach planning ignores them', () => {
  const g = sea(['~~~~~~~~', '........'], [['cruiser', 0, 0, 0], ['submarine', 1, 3, 0]]);
  const cruiser = g.state.units[0];
  g.state.units[1].submerged = true;
  assert.deepEqual(targetsFrom(g, cruiser, 0, 0).map((u) => u.id), []);
  assert.ok(computeReach(g, cruiser).has(3, 0), 'the planner is not told about the sub: its tile still looks reachable');
  const direct = g.act({ unitId: cruiser.id, to: { x: 0, y: 0 }, action: { type: 'attack', targetId: g.state.units[1].id } });
  assert.equal(direct.ok, false);
});

test('a move into a hidden unit is interrupted, reveals it, and allows an attack', () => {
  const g = sea(['~~~~~~~~', '........'], [['cruiser', 0, 0, 0], ['submarine', 1, 4, 0]]);
  const cruiser = g.state.units[0];
  const sub = g.state.units[1];
  sub.submerged = true;
  g.endTurn(); g.endTurn();   // a fresh turn for player 0
  const res = g.act({ unitId: cruiser.id, to: { x: 5, y: 0 }, action: { type: 'wait' } });
  assert.equal(res.ok, true);
  assert.ok(res.interrupted, 'flagged as interrupted');
  assert.deepEqual([cruiser.x, cruiser.y], [3, 0], 'stopped one tile short');
  assert.equal(cruiser.done, false, 'the unit still has its action');
  assert.deepEqual(res.events.map((e) => e.type), ['move', 'interrupt']);
  assert.equal(g.canUndo, false, 'no taking it back once something was found');
  assert.equal(canSee(g, 0, sub), true, 'adjacent now');
  const reach = computeReach(g, cruiser);
  assert.deepEqual([...reach.tiles()].map((t) => [t.x, t.y]), [[3, 0]], 'it cannot move again');
  assert.equal(g.act({ unitId: cruiser.id, to: { x: 3, y: 0 }, action: { type: 'attack', targetId: sub.id } }).ok, false, 'a cruiser has nothing that hits a submerged sub');
  assert.equal(g.act({ unitId: cruiser.id, to: { x: 3, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(cruiser.done, true);
});

test('an interrupted unit that could fire can do so, and the sub answers', () => {
  const g = sea(['~~~~~~~~', '........'], [['destroyer', 0, 0, 0], ['submarine', 1, 4, 0]]);
  const d = g.state.units[0], sub = g.state.units[1];
  sub.submerged = true;
  const res = g.act({ unitId: d.id, to: { x: 5, y: 0 }, action: { type: 'wait' } });
  assert.ok(res.interrupted);
  const hit = g.act({ unitId: d.id, to: { x: d.x, y: d.y }, action: { type: 'attack', targetId: sub.id } });
  assert.equal(hit.ok, true);
  const strike = hit.events.find((e) => e.type === 'strike' && !e.counter);
  assert.equal(strike.weapon, 'depth_charges');
  assert.ok(sub.hp < 10);
  assert.ok(hit.events.some((e) => e.type === 'strike' && e.counter), 'the torpedoes answer');
});

test('an interrupted battleship cannot fire after the tile it did move, but waiting is fine', () => {
  const g = sea(['~~~~~~~~', '~~~~~~~~'], [['battleship', 0, 0, 0], ['submarine', 1, 3, 0], ['cruiser', 1, 4, 1]]);
  g.state.units[1].submerged = true;
  const res = g.act({ unitId: g.state.units[0].id, to: { x: 4, y: 0 }, action: { type: 'wait' } });
  assert.ok(res.interrupted);
  assert.equal(g.state.units[0].x, 2);
  const shot = g.act({ unitId: g.state.units[0].id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: g.state.units[2].id } });
  assert.equal(shot.error, 'cannot-move-and-fire');
  assert.equal(g.act({ unitId: g.state.units[0].id, to: { x: 2, y: 0 }, action: { type: 'wait' } }).ok, true);
});

test('a ship the planner sends over a hidden unit never passes through it', () => {
  const g = sea(['~~~~~~~~', '........'], [['cruiser', 0, 0, 0], ['submarine', 1, 3, 0]]);
  g.state.units[1].submerged = true;
  const res = g.act({ unitId: g.state.units[0].id, to: { x: 5, y: 0 }, action: { type: 'wait' } });
  assert.ok(res.interrupted);
  assert.equal(at(g, 3, 0).type, 'submarine');
  assert.equal(g.state.units[0].x, 2);
});

test('a submerged submarine stays down while it moves through deep water, and can surface by order', () => {
  const g = sea(['~~~oo~~~', '........'], [['submarine', 0, 2, 0], ['recon', 1, 7, 1]]);
  const sub = g.state.units[0];
  sub.submerged = true;
  assert.equal(g.act({ unitId: sub.id, to: { x: 1, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(sub.submerged, true, 'still deep: stays down');
  g.endTurn(); g.endTurn();
  const up = g.act({ unitId: sub.id, to: { x: 1, y: 0 }, action: { type: 'surface' } });
  assert.deepEqual(up.events.map((e) => e.type), ['surface']);
  assert.equal(sub.submerged, false);
  assert.equal(g.act({ unitId: sub.id, to: { x: 1, y: 0 }, action: { type: 'surface' } }).error, 'unit-already-acted');
});

test('the best weapon is chosen automatically: depth charges on a sub, deck gun on a ship', () => {
  const g = sea(['~~~~~~', '~~~~~~'], [['destroyer', 0, 0, 0], ['submarine', 1, 1, 0], ['cruiser', 1, 0, 1]]);
  const d = g.state.units[0];
  g.state.units[1].submerged = true;
  assert.equal(weaponFor(g, d, g.state.units[1]).name, registry.weapon('depth_charges').name, 'only the charges reach a dived sub');
  const onShip = weaponFor(g, d, g.state.units[2]);
  assert.equal(onShip.name, registry.weapon('deck_gun').name, 'the gun does more to a surface ship than charges do');
  assert.ok(calcDamage(g, d, g.state.units[1]) > 0);
  g.state.units[1].submerged = false;
  assert.equal(weaponFor(g, g.state.units[1], d).name, registry.weapon('torpedoes').name);
});

test('a cruiser shoots flak at aircraft and cannon at ships: it picks whichever hurts more', () => {
  const g = sea(['~~~~', '....'], [['cruiser', 0, 0, 0], ['copter', 1, 1, 0]]);
  assert.equal(weaponFor(g, g.state.units[0], g.state.units[1]).name, registry.weapon('aa_battery').name);
});

test('sonar is a destroyer trait: the AI does not chase what it cannot see', () => {
  const g = sea(['~~~~~~~~', '........'], [['destroyer', 0, 0, 0], ['submarine', 1, 7, 0]]);
  g.state.units[1].submerged = true;
  const order = chooseOrder(g, g.state.units[0]);
  assert.ok(order.to, 'still gives an order');
  assert.notEqual(order.action.type, 'attack');
});

test('the AI dives a submarine when it has nothing better to do', () => {
  const g = sea(['~~~~~~~~', '........'], [['submarine', 1, 7, 0], ['recon', 0, 0, 1]]);
  g.state.turn = 1;
  const order = chooseOrder(g, g.state.units[0]);
  assert.ok(['submerge', 'wait'].includes(order.action.type));
});


// ---- shipyards: ships are built on the yard itself and sail off with a free move ---------------------------------------------
const yardGame = (rows, unitsOnMap = []) => sea(rows, unitsOnMap);

test('a ship built at a shipyard appears on the yard and gets a free move, but cannot attack', () => {
  const g = yardGame(['.Y~', '.~~', '...'], [['destroyer', 1, 1, 1]]);
  g.state.funds[0] = 20000;
  const res = g.build(1, 0, 'cruiser');
  assert.equal(res.ok, true);
  assert.deepEqual([res.events[0].unit.x, res.events[0].unit.y], [1, 0], 'on the shipyard tile');
  const ship = g.state.units.find((u) => u.type === 'cruiser');
  assert.equal(ship.fresh, true);
  assert.equal(g.act({ unitId: ship.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: g.state.units[0].id } }).error, 'just-built');
  assert.equal(g.act({ unitId: ship.id, to: { x: 2, y: 1 }, action: { type: 'wait' } }).ok, true, 'it sails off the yard');
  assert.equal(ship.done, true);
  assert.equal(ship.fresh, undefined);
});

test('a shipyard builds once a turn, and not while a unit is still on it', () => {
  const g = yardGame(['.Y~', '...'], [['recon', 1, 0, 1]]);
  g.state.funds[0] = 40000;
  assert.equal(g.build(1, 0, 'destroyer').ok, true);
  assert.equal(g.build(1, 0, 'destroyer').error, 'tile-occupied');
  const ship = g.state.units.find((u) => u.type === 'destroyer');
  g.act({ unitId: ship.id, to: { x: 2, y: 0 }, action: { type: 'wait' } });
  assert.equal(g.build(1, 0, 'destroyer').error, 'already-built', 'one unit per property per turn');
});

test('the shipyard builds ships and marines, not soldiers', () => {
  const g = yardGame(['.Y~']);
  const ids = buildOptions(g, 1, 0).map((u) => u.id);
  assert.ok(ids.includes('marine') && ids.includes('destroyer'));
  assert.ok(!ids.includes('soldier'));
});

test('destroyer and cruiser anti-air weapons are melee range, like the submarine torpedoes', () => {
  for (const id of ['deck_gun', 'depth_charges', 'aa_battery', 'torpedoes']) assert.deepEqual(registry.weapon(id).range, [1, 1], id);
  const g = sea(['~~~~~', '.....'], [['cruiser', 0, 0, 0], ['copter', 1, 2, 0]]);
  assert.equal(weaponFor(g, g.state.units[0], g.state.units[1]), null, 'a copter two tiles away is out of the AA battery range');
});

test('a cruiser moves and fires its naval cannon', () => {
  const g = sea(['~~~~~~~', '.......'], [['cruiser', 0, 0, 0], ['destroyer', 1, 5, 0]]);
  const [cruiser, foe] = g.state.units;
  assert.equal(g.act({ unitId: cruiser.id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: foe.id } }).ok, true);
});

test('a battleship: long guns need a standing start, the secondary guns work after moving', () => {
  const rows = ['~~~~~~~~', '........'];
  // far target: only the main guns reach it
  let g = sea(rows, [['battleship', 0, 0, 0], ['destroyer', 1, 4, 0]]);
  let [bb, foe] = g.state.units;
  assert.equal(weaponFor(g, bb, foe).name, registry.weapon('main_guns').name);
  assert.equal(g.act({ unitId: bb.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: foe.id } }).error, 'cannot-move-and-fire');
  assert.equal(g.act({ unitId: bb.id, to: { x: 0, y: 0 }, action: { type: 'attack', targetId: foe.id } }).ok, true);
  // adjacent target after a move: the secondary guns fire, and the target answers
  g = sea(rows, [['battleship', 0, 0, 0], ['destroyer', 1, 4, 0]]);
  [bb, foe] = g.state.units;
  const res = g.act({ unitId: bb.id, to: { x: 3, y: 0 }, action: { type: 'attack', targetId: foe.id } });
  assert.equal(res.ok, true);
  const strikes = res.events.filter((e) => e.type === 'strike');
  assert.equal(strikes[0].weapon, 'secondary_guns');
  assert.ok(strikes.some((e) => e.counter), 'a melee strike is answered');
});

test('a battleship firing its main guns is not counterattacked, and does not counter with them', () => {
  const g = sea(['~~~~~~~~', '........'], [['battleship', 0, 0, 0], ['battleship', 1, 3, 0]]);
  const [a, b] = g.state.units;
  const res = g.act({ unitId: a.id, to: { x: 0, y: 0 }, action: { type: 'attack', targetId: b.id } });
  assert.equal(res.events.filter((e) => e.counter).length, 0);
  const g2 = sea(['~~~~~~~~', '........'], [['battleship', 0, 0, 0], ['battleship', 1, 1, 0]]);
  const [c, d] = g2.state.units;
  assert.equal(weaponFor(g2, d, c, d, { counter: true }).name, registry.weapon('secondary_guns').name, 'adjacent, the secondary guns answer');
});

test('a dived sub is exposed only when an enemy notices it (adjacent, or in sonar range)', () => {
  const g = sea(['~~~~~~~~', '~~~~~~~~'], [['submarine', 0, 3, 0], ['destroyer', 1, 7, 0], ['submarine', 1, 3, 1]]);
  const [mine, destroyer, theirSub] = g.state.units;
  mine.submerged = true; theirSub.submerged = true;
  assert.equal(isExposed(g, mine, 0), true, 'their sub is adjacent: it notices mine');
  theirSub.y = 1; theirSub.x = 5;
  assert.equal(isExposed(g, mine, 0), false, 'destroyer 4 tiles off is out of sonar range; the far sub is not adjacent');
  destroyer.x = 6;
  assert.equal(isExposed(g, mine, 0), true, 'sonar range 3 reaches it');
  assert.equal(isExposed(g, theirSub, 0), false, 'nothing of mine is near the enemy sub');
});
