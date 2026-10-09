import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ordersFor } from '../helpers/fixtures.js';

const scene = () => makeGame({
  units: { walker: { move: 3 }, gun: { range: [2, 2], attributes: { indirect: true } } },
  rows: ['......'],
  unitsOnMap: [['walker', 0, 0, 0], ['gun', 0, 1, 0], ['walker', 1, 5, 0]],
});
const errorOf = (game, order) => game.act(order).error;

test('orders are validated: turn, ownership, unit state, bounds, reach', () => {
  const game = scene();
  const [walker, gun, enemy] = game.state.units;
  assert.equal(errorOf(game, { unitId: 999, to: { x: 0, y: 0 } }), 'no-such-unit');
  assert.equal(errorOf(game, { unitId: enemy.id, to: { x: 5, y: 0 } }), 'not-your-turn');
  assert.equal(errorOf(game, ordersFor(game, 0, { x: -1, y: 0 })), 'out-of-bounds');
  assert.equal(errorOf(game, ordersFor(game, 0, { x: 5, y: 0 })), 'unreachable');
  assert.equal(errorOf(game, ordersFor(game, 0, { x: 1, y: 0 })), 'unreachable', 'occupied by a friend');
  assert.equal(game.act(ordersFor(game, 0, { x: 2, y: 0 })).ok, true);
  assert.equal(errorOf(game, ordersFor(game, 0, { x: 2, y: 0 })), 'unit-already-acted');
  assert.equal(walker.x, 2);
  assert.equal(gun.done, false);
});

test('attack orders are validated: target must be a live enemy in range', () => {
  const game = scene();
  const attack = (n, to, targetId) => game.act(ordersFor(game, n, to, { type: 'attack', targetId }));
  const [, gun, enemy] = game.state.units;
  assert.equal(attack(0, { x: 0, y: 0 }, game.state.units[1].id).error, 'invalid-target', 'cannot attack your own unit');
  assert.equal(attack(0, { x: 0, y: 0 }, 999).error, 'invalid-target');
  assert.equal(attack(0, { x: 0, y: 0 }, enemy.id).error, 'out-of-range');
  assert.equal(attack(1, { x: 1, y: 0 }, enemy.id).error, 'out-of-range', 'gun range is exactly 2, the enemy is 4 away');
  assert.equal(attack(1, { x: 2, y: 0 }, enemy.id).error, 'cannot-move-and-fire');
  assert.equal(gun.done, false, 'a rejected order changes nothing');
});

test('a move action with no explicit action defaults to wait', () => {
  const game = scene();
  const result = game.act({ unitId: game.state.units[0].id, to: { x: 1 - 1, y: 0 } });
  assert.equal(result.ok, true);
  assert.equal(game.state.units[0].done, true);
});

test('move events carry the walked path', () => {
  const game = scene();
  const { events } = game.act(ordersFor(game, 0, { x: 0, y: 0 }));
  assert.equal(events.some((e) => e.type === 'move'), false, 'no move event when the unit stays');
  const game2 = makeGame({ units: { walker: {} }, rows: ['...'], unitsOnMap: [['walker', 0, 0, 0], ['walker', 1, 2, 0]] });
  const moved = game2.act(ordersFor(game2, 0, { x: 1, y: 0 }));
  assert.deepEqual(moved.events[0], { type: 'move', unitId: game2.state.units[0].id, path: [[0, 0], [1, 0]] });
});

test('undo restores the state before the last human order, once, and is cleared by end turn', () => {
  const game = makeGame({
    units: { walker: { move: 3 } }, rows: ['a....'], unitsOnMap: [['walker', 0, 1, 0], ['walker', 1, 4, 0]],
    players: [{ faction: 'red', controller: 'human', funds: 5000 }, { faction: 'blue', controller: 'ai', funds: 0 }],
  });
  assert.equal(game.canUndo, false);
  game.act(ordersFor(game, 0, { x: 3, y: 0 }));
  assert.equal(game.state.units[0].x, 3);
  assert.equal(game.canUndo, true);
  assert.equal(game.undo(), true);
  assert.deepEqual([game.state.units[0].x, game.state.units[0].done], [1, false]);
  assert.equal(game.undo(), false, 'single level');

  game.act(ordersFor(game, 0, { x: 3, y: 0 }));
  game.state.units[0].done = false;
  assert.equal(game.build(0, 0, 'walker').ok, true);
  assert.equal(game.canUndo, true, 'a build can be taken back');

  game.act(ordersFor(game, 0, { x: 2, y: 0 }));
  assert.equal(game.canUndo, true);
  game.endTurn();
  assert.equal(game.canUndo, false, 'ending the turn clears undo');
});

test('a build can be taken back: the unit goes, the price comes back and the property can build again', () => {
  const players = [{ faction: 'red', controller: 'human', funds: 5000 }, { faction: 'blue', controller: 'ai', funds: 0 }];
  const game = makeGame({ units: { walker: { move: 3 } }, rows: ['a....'], unitsOnMap: [['walker', 1, 4, 0]], players });
  const before = JSON.stringify(game.state);
  assert.equal(game.build(0, 0, 'walker').ok, true);
  assert.ok(game.state.funds[0] < 5000, 'the price was paid');
  assert.equal(game.canUndo, true);
  assert.equal(game.undo(), true);
  assert.equal(JSON.stringify(game.state), before, 'the unit, the funds and the one-build-a-turn mark are all back');
  assert.equal(game.build(0, 0, 'walker').ok, true, 'the property builds again');
  game.endTurn();
  assert.equal(game.canUndo, false, 'ending the turn makes it final');
});

test('a build by the computer is never undoable', () => {
  const players = [{ faction: 'red', controller: 'ai', funds: 5000 }, { faction: 'blue', controller: 'ai', funds: 0 }];
  const game = makeGame({ units: { walker: { move: 3 } }, rows: ['a....'], unitsOnMap: [['walker', 1, 4, 0]], players });
  assert.equal(game.build(0, 0, 'walker').ok, true);
  assert.equal(game.canUndo, false);
});

test('undo also reverts captures, kills and funds', () => {
  const game = makeGame({
    units: { taker: { attributes: { capture: true }, hits: 100 } }, rows: ['c...'],
    unitsOnMap: [['taker', 0, 0, 0], ['taker', 1, 1, 0, 1], ['taker', 1, 3, 0]],
  });
  const before = JSON.stringify(game.state);
  game.act(ordersFor(game, 0, { x: 0, y: 0 }, { type: 'attack', targetId: game.state.units[1].id }));
  assert.equal(game.state.units.length, 2, 'the weak enemy died');
  game.undo();
  assert.equal(JSON.stringify(game.state), before);
});

test('AI orders are never undoable (no snapshot for computer players)', () => {
  const game = makeGame({
    units: { walker: {} }, rows: ['....'], unitsOnMap: [['walker', 0, 0, 0], ['walker', 1, 3, 0]],
    players: [{ faction: 'red', controller: 'ai', funds: 0 }, { faction: 'blue', controller: 'ai', funds: 0 }],
  });
  game.act(ordersFor(game, 0, { x: 1, y: 0 }));
  assert.equal(game.canUndo, false);
});

test('nothing is accepted after the game is over', () => {
  const game = scene();
  game.state.winner = 0;
  assert.equal(errorOf(game, ordersFor(game, 0, { x: 0, y: 0 })), 'game-over');
  assert.equal(game.build(0, 0, 'walker').error, 'game-over');
  assert.equal(game.endTurn().error, 'game-over');
  assert.equal(game.canUndo, false);
});
