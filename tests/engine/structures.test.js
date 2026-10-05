// Walls, cracked walls and the static defences (turrets, jammer): structures.js, the wall terrain and how the rest of the engine treats them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap, serializeMap, MapError } from '../../src/data/map-format.js';
import { withLeaders } from '../../src/data/formation.js';
import { Game } from '../../src/engine/game.js';
import { computeReach } from '../../src/engine/movement.js';
import { forecastAttack, canAttackFrom } from '../../src/engine/combat.js';
import { hasLineOfSight } from '../../src/engine/sight.js';
import { isDefeated } from '../../src/engine/victory.js';
import { playTurn, wantsOrder, chooseOrder } from '../../src/engine/ai.js';
import { unitAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);

const LEGEND = { '.': { terrain: 'plain' }, W: { terrain: 'wall' }, X: { terrain: 'wall_breach' }, F: { terrain: 'forest' },
  A: { terrain: 'hq', owner: 0 }, B: { terrain: 'hq', owner: 1 }, f: { terrain: 'factory', owner: 0 }, g: { terrain: 'factory', owner: 1 } };
const raw = (tiles, units = [], extra = {}) => ({
  format: 'pocketwars-map', version: 1, id: 'test', name: 'Test',
  players: [{ faction: 'ashmark', controller: 'human', funds: 0 }, { faction: 'vantor_reach', controller: 'ai', funds: 0 }],
  legend: LEGEND, tiles, units, ...extra,
});
const game = (tiles, units, extra) => new Game(registry, parseMap(raw(tiles, units, extra), registry));
const u = (type, owner, x, y, hp) => ({ type, owner, x, y, ...(hp && { hp }) });

test('a breakable wall tile gets a neutral cracked wall when the game starts (unless the map put a unit there)', () => {
  const g = game(['A..XW..B'], [u('soldier', 0, 1, 0)]);
  const cw = unitAt(g, 3, 0);
  assert.equal(cw.type, 'cracked_wall');
  assert.equal(cw.owner, null);
  assert.equal(g.state.units.filter((x) => x.type === 'cracked_wall').length, 1);
});

test('walls stop every unit, aircraft too; a cracked wall blocks its tile until it is broken, then the rubble is open', () => {
  const g = game(['A.....', '..W...', '..X...', '.....B'], [u('soldier', 0, 1, 1), u('copter', 0, 0, 2), u('tank', 0, 3, 1)]);
  const [inf, copter] = g.state.units;
  for (const unit of [inf, copter]) {
    const reach = computeReach(g, unit);
    assert.ok(!reach.has(2, 1), `${unit.type} cannot enter the wall`);
    assert.ok(!reach.has(2, 2), `${unit.type} cannot enter the cracked wall's tile`);
  }
  const tank = g.state.units[2];
  const cw = unitAt(g, 2, 2);
  assert.equal(forecastAttack(g, inf, cw, { x: 1, y: 2 }).destroyed, true, 'a rifle breaks it: any hit does');
  const res = g.act({ unitId: inf.id, to: { x: 1, y: 2 }, action: { type: 'attack', targetId: cw.id } });
  assert.ok(res.ok, res.error);
  assert.ok(res.events.some((e) => e.type === 'strike' && e.destroyed), 'destroyed by one shot');
  assert.equal(unitAt(g, 2, 2), undefined);
  assert.ok(computeReach(g, tank).has(2, 2), 'the rubble can be crossed now');
});

test('walls and standing cracked walls block line of sight; a wall that is broken does not', () => {
  const g = game(['A.W..', '.....', '..X..', '....B'], []);
  assert.equal(hasLineOfSight(g, { x: 0, y: 0 }, { x: 4, y: 0 }), false, 'a wall in between');
  assert.equal(hasLineOfSight(g, { x: 0, y: 2 }, { x: 4, y: 2 }), false, 'a cracked wall in between');
  g.state.units = g.state.units.filter((x) => x.type !== 'cracked_wall');
  assert.equal(hasLineOfSight(g, { x: 0, y: 2 }, { x: 4, y: 2 }), true, 'rubble');
});

test('a player-owned turret takes no orders: it fires by itself at the enemy it hurts most when its owner ends the turn', () => {
  const g = game(['A......B'], [u('cannon_turret', 0, 2, 0), u('tank', 1, 5, 0), u('soldier', 1, 4, 0)]);
  const [turret, tank, soldier] = g.state.units;
  assert.equal(computeReach(g, turret).size, 1, 'only its own tile');
  assert.equal(g.act({ unitId: turret.id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: tank.id } }).error, 'fires-by-itself');
  const res = g.endTurn();
  const shots = res.events.filter((e) => e.type === 'strike' && e.auto && !e.counter);
  assert.equal(shots.length, 1);
  assert.equal(shots[0].defender.id, tank.id, 'the tank is worth more than the soldier');
  assert.ok(!shots[0].neutral);
  assert.ok(tank.hp < 10);
  assert.equal(soldier.hp, 10);
  const res2 = g.endTurn();   // player 1's turn ends: player 0's turret does not fire then
  assert.equal(res2.events.filter((e) => e.auto).length, 0);
});

test('an owned turret never shoots a neutral cracked wall', () => {
  const g = game(['A.X.W..B'], [u('cannon_turret', 0, 1, 0), u('soldier', 1, 7, 0)]);
  assert.equal(g.endTurn().events.filter((e) => e.auto).length, 0);
});

test('neutral turrets fire at the end of each player\'s turn at that player\'s units in reach, picking the one they hurt most', () => {
  const g = game(['A.......B'], [u('cannon_turret', null, 4, 0), u('soldier', 0, 2, 0), u('tank', 0, 3, 0), u('recon', 1, 8, 0)]);
  const tank = g.state.units.find((x) => x.type === 'tank');
  const soldier = g.state.units.find((x) => x.type === 'soldier');
  const res = g.endTurn();
  const shots = res.events.filter((e) => e.type === 'strike' && e.neutral && !e.counter);
  assert.equal(shots.length, 1, 'one shot per turret');
  assert.equal(shots[0].defender.id, tank.id, 'the tank is worth more than the soldier');
  assert.equal(soldier.hp, 10);
  assert.ok(res.events.some((e) => e.type === 'strike' && e.counter), 'the tank answers back');
  // player 1's turn ends: its recon is out of reach, nothing fires
  const res2 = g.endTurn();
  assert.equal(res2.events.filter((e) => e.neutral).length, 0);
});

test('an armed neutral structure is an enemy of everyone; the AI does not march on it but will shoot it', () => {
  const g = game(['A.......B'], [u('cannon_turret', null, 4, 0), u('tank', 1, 6, 0)]);
  const turret = unitAt(g, 4, 0);
  assert.ok(canAttackFrom(g, g.state.units[1], turret, 5, 0));
  g.state.turn = 1;
  const order = chooseOrder(g, g.state.units[1]);
  assert.equal(order.action.type, 'attack', 'a turret in reach is a target');
});

test('structures do not keep a player in the game, and turn neutral when their owner is knocked out', () => {
  const g = game(['A.......B'], [u('cannon_turret', 1, 6, 0), u('jammer', 1, 5, 0), u('soldier', 0, 1, 0)]);
  assert.equal(isDefeated(g, 1), true, 'only structures and no money: defeated');
  const res = g.endTurn();
  assert.equal(g.state.winner, 0);
  assert.ok(res.events.some((e) => e.type === 'gameOver'));
  assert.ok(g.state.units.filter((x) => x.type !== 'soldier').every((x) => x.owner === null), 'the turret and the jammer are neutral now');
});

test('the AI leaves an idle turret and a jammer alone, and plays a turn with structures on the board', () => {
  const g = game(['A..X....B', '..W.W....'], [u('cannon_turret', 1, 7, 0), u('jammer', 1, 7, 1), u('tank', 1, 6, 1), u('soldier', 0, 1, 0)]);
  g.state.turn = 1;
  assert.equal(wantsOrder(g, unitAt(g, 7, 1)), false, 'the jammer never acts');
  assert.equal(wantsOrder(g, unitAt(g, 7, 0)), false, 'nothing in the turret\'s reach');
  for (let i = 0; i < 6 && !g.isOver; i++) { if (g.controllerOf(g.state.turn) === 'ai') playTurn(g); g.endTurn(); }
});

test('map files: only a structure may have no owner; structures round-trip through serializeMap', () => {
  assert.throws(() => parseMap(raw(['A..B'], [u('soldier', null, 1, 0)]), registry), (e) => e instanceof MapError && e.problems.some((p) => /only a structure/.test(p)));
  const m = parseMap(raw(['A.WXB'], [u('sam_turret', null, 1, 0)]), registry);
  const back = parseMap(serializeMap(m), registry);
  assert.deepEqual(back.units, m.units);
  assert.deepEqual(back.terrain, m.terrain);
});

test('leader formations keep the structures a map places for that player', () => {
  const m = parseMap(raw(['A.f.....B', '.........', '.......g.'], [u('cannon_turret', 0, 4, 2), u('soldier', 0, 1, 1)]), registry);
  const led = withLeaders(m, registry, [registry.leaderIds[0], null]);
  assert.ok(led.units.some((x) => x.type === 'cannon_turret' && x.owner === 0 && x.x === 4), 'the turret stays');
});
