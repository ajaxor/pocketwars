import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ordersFor } from '../helpers/fixtures.js';
import { evaluateVictory } from '../../src/engine/victory.js';

const players3 = [
  { faction: 'red', controller: 'human', funds: 0 }, { faction: 'blue', controller: 'ai', funds: 0 }, { faction: 'green', controller: 'ai', funds: 0 },
];

test('endTurn passes play to the next player; the day advances when play returns to player 0', () => {
  const game = makeGame({ rows: ['a.b'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 2, 0]] });
  assert.deepEqual([game.currentPlayer, game.state.day], [0, 1]);
  game.endTurn();
  assert.deepEqual([game.currentPlayer, game.state.day], [1, 1]);
  game.endTurn();
  assert.deepEqual([game.currentPlayer, game.state.day], [0, 2]);
});

test('starting a turn collects income for that player and reports it', () => {
  const game = makeGame({ rows: ['aHh.b'], unitsOnMap: [['a', 0, 3, 0], ['b', 1, 4, 0]] });
  const before = [...game.state.funds];
  const { events } = game.endTurn();
  assert.equal(events[0].type, 'turnStart');
  assert.equal(events[0].player, 1);
  assert.equal(events[0].income, 2000, 'player 1 owns h and b');
  assert.deepEqual(game.state.funds, [before[0], before[1] + 2000]);
});

test('three players rotate in order', () => {
  const game = makeGame({ rows: ['...'], unitsOnMap: [['a', 0, 0, 0], ['a', 1, 1, 0], ['a', 2, 2, 0]], players: players3 });
  const order = [];
  for (let i = 0; i < 4; i++) { game.endTurn(); order.push(game.currentPlayer); }
  assert.deepEqual(order, [1, 2, 0, 1]);
});

test('defeated players are skipped in the rotation', () => {
  const game = makeGame({ rows: ['...'], unitsOnMap: [['a', 0, 0, 0], ['a', 2, 2, 0]], players: players3 });
  game.endTurn(); // player 1 has no units and cannot build -> defeated, play moves on to 2
  assert.equal(game.state.defeated[1], true);
  assert.equal(game.currentPlayer, 2);
  game.endTurn();
  assert.equal(game.currentPlayer, 0);
  assert.equal(game.state.winner, null, 'two players are still alive');
});

test('last player standing wins by elimination', () => {
  const game = makeGame({ rows: ['..'], unitsOnMap: [['a', 0, 0, 0]] });
  const events = evaluateVictory(game);
  assert.deepEqual(events, [{ type: 'gameOver', winner: 0, reason: 'elimination' }]);
  assert.equal(game.state.winner, 0);
  assert.deepEqual(evaluateVictory(game), [], 'reported once');
});

test('a player with no units survives while they can afford to build something', () => {
  const rich = makeGame({
    units: { a: { cost: 1000 } }, rows: ['.b'], unitsOnMap: [['a', 0, 0, 0]],
    players: [{ faction: 'red', controller: 'human', funds: 0 }, { faction: 'blue', controller: 'human', funds: 1000 }],
  });
  assert.equal(evaluateVictory(rich).length, 0, 'player 1 can afford a 1000-cost unit at their base');
  const poor = makeGame({
    units: { a: { cost: 1000 } }, rows: ['.b'], unitsOnMap: [['a', 0, 0, 0]],
    players: [{ faction: 'red', controller: 'human', funds: 0 }, { faction: 'blue', controller: 'human', funds: 999 }],
  });
  assert.equal(evaluateVictory(poor)[0].winner, 0);
});

test('no property that can build means no way back: zero units is defeat regardless of funds', () => {
  const game = makeGame({
    rows: ['.h'], unitsOnMap: [['a', 0, 0, 0]],
    players: [{ faction: 'red', controller: 'human', funds: 0 }, { faction: 'blue', controller: 'human', funds: 99999 }],
  });
  assert.equal(evaluateVictory(game)[0].winner, 0, 'an HQ cannot build');
});

test('everybody eliminated at once is a draw', () => {
  const game = makeGame({ rows: ['..'], unitsOnMap: [['a', 0, 0, 0], ['a', 1, 1, 0]] });
  game.state.units = [];
  assert.equal(evaluateVictory(game)[0].winner, 'draw');
});

test('killing the last enemy unit ends the game inside act()', () => {
  const game = makeGame({ units: { a: { hits: 100 } }, rows: ['..'], unitsOnMap: [['a', 0, 0, 0], ['a', 1, 1, 0, 1]] });
  const { events } = game.act(ordersFor(game, 0, { x: 0, y: 0 }, { type: 'attack', targetId: game.state.units[1].id }));
  assert.equal(events.at(-1).type, 'gameOver');
  assert.equal(game.isOver, true);
});

test('turnStart lists the income of each property that paid', () => {
  const game = makeGame({ rows: ['a.c', '..H'], unitsOnMap: [['a', 0, 1, 0], ['b', 1, 1, 1]] });
  const ev = game.endTurn().events.find((e) => e.type === 'turnStart');
  const own = game.endTurn().events.find((e) => e.type === 'turnStart');
  assert.equal(ev.player, 1);
  assert.deepEqual(own.incomes.map((i) => [i.x, i.y, i.amount]).sort(), [[0, 0, 1000], [2, 1, 1000]]);
  assert.equal(own.income, own.incomes.reduce((n, i) => n + i.amount, 0));
});
