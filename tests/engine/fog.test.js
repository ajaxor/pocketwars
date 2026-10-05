// Fog of war (fog.js): switched on by jammers, for human players only, with line of sight, memory of explored tiles, and the undo rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';
import { canSee } from '../../src/engine/detection.js';
import { fogActive, isFogged, tileExplored, tileVisible, visionOf } from '../../src/engine/fog.js';
import { computeReach } from '../../src/engine/movement.js';
import { chooseOrder } from '../../src/engine/ai.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const LEGEND = { '.': { terrain: 'plain' }, F: { terrain: 'forest' }, M: { terrain: 'mountain' }, W: { terrain: 'wall' }, X: { terrain: 'wall_breach' },
  A: { terrain: 'hq', owner: 0 }, B: { terrain: 'hq', owner: 1 } };
const game = (tiles, units, controllers = ['human', 'ai']) => new Game(registry, parseMap({
  format: 'pocketwars-map', version: 1, id: 'fog', name: 'Fog',
  players: [{ faction: 'ashmark', controller: controllers[0], funds: 0 }, { faction: 'vantor_reach', controller: controllers[1], funds: 0 }],
  legend: LEGEND, tiles, units,
}, registry));
const u = (type, owner, x, y) => ({ type, owner, x, y });
const ROW = (n) => '.'.repeat(n);

test('no jammer, no fog; any jammer (whoever owns it) fogs the human players and never the computer', () => {
  const clear = game(['A' + ROW(10) + 'B'], [u('soldier', 0, 1, 0), u('soldier', 1, 10, 0)]);
  assert.equal(fogActive(clear), false);
  assert.equal(canSee(clear, 0, clear.state.units[1]), true);
  for (const owner of [0, 1, null]) {
    const g = game(['A' + ROW(10) + 'B', ROW(12)], [u('soldier', 0, 1, 0), u('soldier', 1, 10, 0), u('jammer', owner, 6, 1)]);
    assert.equal(fogActive(g), true);
    assert.equal(isFogged(g, 0), true, 'the human is in fog');
    assert.equal(isFogged(g, 1), false, 'the computer is not');
    assert.equal(canSee(g, 0, g.state.units[1]), false, 'a soldier 9 tiles off is out of sight');
    assert.equal(canSee(g, 1, g.state.units[0]), true, 'the computer sees everything');
  }
});

test('sight: vision range by unit, a mountain adds to it, aircraft see further and over everything', () => {
  const g = game(['A....M.......B'], [u('soldier', 0, 1, 0), u('recon', 0, 2, 0), u('soldier', 0, 5, 0), u('copter', 0, 3, 0), u('jammer', null, 12, 0)]);
  const [inf, recon, onMountain, copter] = g.state.units;
  assert.equal(visionOf(g, inf), 2);
  assert.equal(visionOf(g, recon), 5, 'the recon\'s own vision');
  assert.equal(visionOf(g, onMountain), 4, 'mountain +2');
  assert.equal(visionOf(g, copter), 3);
  assert.equal(tileVisible(g, 0, 9, 0), true, 'mountain soldier sees 4 tiles');
  assert.equal(tileVisible(g, 0, 10, 0), false);
});

test('sight follows line of sight: a forest or a wall hides what is behind it, but the forest tile itself is seen', () => {
  const g = game(['A.F...B', '.......', '.......', '.......', '.......', '..W....', '.......'], [u('recon', 0, 1, 0), u('recon', 0, 1, 5), u('jammer', null, 6, 6)]);
  assert.equal(tileVisible(g, 0, 2, 0), true, 'the forest itself');
  assert.equal(tileVisible(g, 0, 3, 0), false, 'behind the forest');
  assert.equal(tileVisible(g, 0, 4, 5), false, 'behind the wall');
  assert.equal(tileVisible(g, 0, 1, 2), true, 'the open side');
});

test('explored tiles are remembered; a structure stays known there, a unit does not', () => {
  const g = game(['A..........B'], [u('recon', 0, 1, 0), u('cannon_turret', 1, 6, 0), u('tank', 1, 5, 0), u('jammer', null, 11, 0)]);
  const [recon, turret, tank] = g.state.units;
  assert.equal(canSee(g, 0, turret), true);
  assert.equal(canSee(g, 0, tank), true);
  g.state.units = g.state.units.filter((x) => x !== recon);   // the scout is gone
  g.touch();
  assert.equal(tileVisible(g, 0, 6, 0), false);
  assert.equal(tileExplored(g, 0, 6, 0), true, 'still explored');
  assert.equal(canSee(g, 0, turret), true, 'a turret does not move: it is still drawn');
  assert.equal(canSee(g, 0, tank), false, 'a tank could be anywhere');
  assert.equal(tileExplored(g, 0, 10, 0), false, 'never seen');
});

test('destroying the last jammer lifts the fog', () => {
  const g = game(['A.......B'], [u('tank', 0, 1, 0), u('jammer', null, 2, 0), u('soldier', 1, 7, 0)]);
  const [tank, jammer, soldier] = g.state.units;
  assert.equal(canSee(g, 0, soldier), false);
  const res = g.act({ unitId: tank.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: jammer.id } });
  assert.ok(res.ok, res.error);
  if (g.state.units.includes(jammer)) { jammer.hp = 0; g.state.units = g.state.units.filter((x) => x !== jammer); g.touch(); }
  assert.equal(fogActive(g), false);
  assert.equal(canSee(g, 0, soldier), true);
});

test('in fog an unseen enemy does not block a planned move, and running into it interrupts the move', () => {
  const g = game(['A.......B', '.........'], [u('recon', 0, 0, 1), u('soldier', 1, 6, 1), u('jammer', null, 8, 0)]);
  const [recon, foe] = g.state.units;
  assert.equal(canSee(g, 0, foe), false);
  assert.ok(computeReach(g, recon).has(6, 1), 'the hidden soldier\'s tile is on offer');
  const res = g.act({ unitId: recon.id, to: { x: 6, y: 1 }, action: { type: 'wait' } });
  assert.ok(res.interrupted, 'stopped short');
  assert.equal(recon.x, 5);
});

test('undo: an order that brings a new tile into sight cannot be undone; one that shows nothing new can', () => {
  const g = game(['A..........B', '............'], [u('soldier', 0, 1, 0), u('soldier', 0, 1, 1), u('jammer', null, 11, 1), u('soldier', 1, 10, 0)]);
  const [a, b] = g.state.units;
  g.act({ unitId: a.id, to: { x: 1, y: 0 }, action: { type: 'wait' } });
  assert.equal(g.canUndo, true, 'standing still shows nothing new');
  g.act({ unitId: b.id, to: { x: 3, y: 1 }, action: { type: 'wait' } });
  assert.equal(g.canUndo, false, 'walking forward does');
});

test('the AI plans around enemies it would not see in fog: it is never fogged', () => {
  const g = game(['A..........B'], [u('soldier', 0, 1, 0), u('artillery', 1, 4, 0), u('jammer', 0, 0, 0)]);
  g.state.turn = 1;
  const order = chooseOrder(g, unitAt(g, 4, 0));
  assert.equal(order.action.type, 'attack');
});
