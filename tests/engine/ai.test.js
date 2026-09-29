import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { chooseOrder, planBuild, buildPhase, playTurn } from '../../src/engine/ai.js';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';

const aiTurnGame = (opts) => { const g = makeGame(opts); g.state.turn = 1; return g; };

test('a capturer standing next to an unowned property takes it in preference to walking on', () => {
  const game = aiTurnGame({
    units: { grunt: { attributes: { capture: true } }, other: {} },
    rows: ['c........', '.........'], unitsOnMap: [['grunt', 1, 1, 0], ['other', 0, 8, 1]],
  });
  const order = chooseOrder(game, game.state.units[0]);
  assert.deepEqual(order.to, { x: 0, y: 0 });
  assert.equal(order.action.type, 'capture');
});

test('the AI prefers attacking over waiting when a target is reachable', () => {
  const game = aiTurnGame({ rows: ['...'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 2, 0]] });
  const order = chooseOrder(game, game.state.units[1]);
  assert.equal(order.action.type, 'attack');
  assert.equal(order.action.targetId, game.state.units[0].id);
});

test('it picks the more valuable target (damage x cost)', () => {
  const game = aiTurnGame({
    units: { hitter: {}, cheap: { cost: 1000 }, pricey: { cost: 9000 } },
    rows: ['.h.'], unitsOnMap: [['cheap', 0, 0, 0], ['hitter', 1, 1, 0], ['pricey', 0, 2, 0]],
  });
  const order = chooseOrder(game, game.state.units[1]);
  assert.equal(order.action.targetId, game.state.units[2].id);
});

test('indirect units only fire without moving; the AI never orders move+fire for them', () => {
  const game = aiTurnGame({
    units: { gun: { range: [2, 2], move: 3, attributes: { indirect: true } }, target: {} },
    rows: ['......'], unitsOnMap: [['target', 0, 0, 0], ['gun', 1, 5, 0]],
  });
  const order = chooseOrder(game, game.state.units[1]);
  assert.notEqual(order.action.type, 'attack', 'target is 5 tiles away: must walk, not fire');
  assert.ok(game.act(order).ok);
});

const buildAi = (build) => ({
  weights: { distanceToGoal: 2, unreachableDistance: 60, terrainDefense: 0.4, attackBase: 60, killBonus: 4, captureBase: 50, victoryCaptureBonus: 100, costUnit: 1000 },
  build,
});
const factoryGame = (build, extra = {}) => aiTurnGame({
  units: { grunt: { cost: 1000 }, tank: { cost: 4000 }, sky: { layer: 'sky', moveClass: 'air', category: 'air', targetLayers: ['ground', 'sky'], cost: 500 }, ...extra.units },
  rows: ['b...'], unitsOnMap: [['grunt', 0, 3, 0]], ai: buildAi(build), players: extra.players,
});

test('planBuild follows the profile order and respects max', () => {
  const game = factoryGame({ ground: [{ unit: 'tank', max: 1 }, { unit: 'grunt', max: 9 }] });
  assert.equal(planBuild(game, 0, 0), 'tank');
  game.state.units.push({ id: 99, type: 'tank', owner: 1, x: 2, y: 0, hp: 10, done: false, capture: 0 });
  assert.equal(planBuild(game, 0, 0), 'grunt', 'tank cap reached, falls through to the next rule');
});

test('planBuild skips rules the player cannot afford', () => {
  const game = factoryGame({ ground: [{ unit: 'tank', max: 5 }, { unit: 'grunt', max: 5 }] });
  game.state.funds[1] = 2000;
  assert.equal(planBuild(game, 0, 0), 'grunt');
  game.state.funds[1] = 10;
  assert.equal(planBuild(game, 0, 0), null);
});

test('planBuild honours "when" conditions', () => {
  const game = factoryGame({ ground: [{ unit: 'tank', max: 5, when: 'enemyHasAirborne' }, { unit: 'grunt', max: 5 }] });
  assert.equal(planBuild(game, 0, 0), 'grunt', 'no airborne enemy yet');
  game.state.units.push({ id: 99, type: 'sky', owner: 0, x: 3, y: 0, hp: 10, done: false, capture: 0 });
  assert.equal(planBuild(game, 0, 0), 'tank');
});

test('planBuild returns null on a non-property tile and on an occupied property', () => {
  const game = factoryGame({ ground: [{ unit: 'grunt', max: 5 }] });
  assert.equal(planBuild(game, 2, 0), null);
  game.state.units.push({ id: 99, type: 'grunt', owner: 1, x: 0, y: 0, hp: 10, done: false, capture: 0 });
  assert.equal(planBuild(game, 0, 0), null);
});

test('buildPhase builds on every free owned factory until funds run out', () => {
  const game = aiTurnGame({
    rows: ['bb.b'], unitsOnMap: [['a', 0, 2, 0]], ai: buildAi({ ground: [{ unit: 'b', max: 9 }] }),
    units: { a: {}, b: { cost: 2000 } },
  });
  game.state.funds[1] = 4000;
  const events = buildPhase(game);
  assert.equal(events.filter((e) => e.type === 'build').length, 2);
  assert.equal(game.state.funds[1], 0);
});

// ---- whole-game behaviour on the shipped map ----
const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');

function simulate(days) {
  const game = new Game(registry, classic);
  const seen = [];
  for (let i = 0; i < days * 2 && !game.isOver; i++) {
    playTurn(game);
    if (!game.isOver) game.endTurn();
    seen.push(JSON.stringify([game.state.units.map((u) => [u.type, u.owner, u.x, u.y, u.hp]), game.state.funds]));
  }
  return { game, seen };
}

test('AI vs AI on the classic map plays legally and keeps the state consistent', () => {
  const { game } = simulate(25);
  const tiles = new Set();
  for (const u of game.state.units) {
    const key = `${u.x},${u.y}`;
    assert.ok(!tiles.has(key), `two units on ${key}`);
    tiles.add(key);
    assert.ok(u.hp > 0 && u.hp <= registry.rules.maxHp);
    assert.ok(game.state.funds.every((f) => f >= 0));
  }
  assert.ok(game.state.day > 1, 'time advanced');
});

test('AI play is deterministic', () => {
  assert.deepEqual(simulate(12).seen, simulate(12).seen);
});

test('a capturer that can reach an enemy HQ prefers it to a plain city (victoryCaptureBonus)', () => {
  const game = aiTurnGame({
    units: { grunt: { attributes: { capture: true } }, other: {} },
    rows: ['c..H.....', '.........'], unitsOnMap: [['grunt', 1, 1, 0], ['other', 0, 8, 1]],
  });
  const order = chooseOrder(game, game.state.units[0]);
  assert.deepEqual(order.to, { x: 3, y: 0 });
  assert.equal(order.action.type, 'capture');
});
