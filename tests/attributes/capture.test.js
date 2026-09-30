// Attribute: unit `capture`  +  terrain `property.capturePoints` / `victoryOnCapture`
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ordersFor } from '../helpers/fixtures.js';
import { canCapture } from '../../src/engine/capture.js';

const capture = (game, n, to) => game.act(ordersFor(game, n, to, { type: 'capture' }));

test('capture: a unit WITH the attribute can capture, an otherwise identical unit WITHOUT it cannot', () => {
  const game = makeGame({
    units: { taker: { attributes: { capture: true } }, plain: {} },
    rows: ['c.c.'],
    unitsOnMap: [['taker', 0, 0, 0], ['plain', 0, 2, 0], ['plain', 1, 3, 0]],
  });
  const [taker, plain] = game.state.units;
  assert.equal(canCapture(game, taker), true);
  assert.equal(canCapture(game, plain), false);
  assert.equal(capture(game, 1, { x: 2, y: 0 }).error, 'cannot-capture');
  assert.equal(capture(game, 0, { x: 0, y: 0 }).ok, true);
});

test('capture: progress per action equals HP rounded up, and the tile flips at capturePoints', () => {
  const game = makeGame({ units: { taker: { attributes: { capture: true } } }, rows: ['c...'], unitsOnMap: [['taker', 0, 0, 0, 7], ['taker', 1, 3, 0]] });
  const unit = game.state.units[0];
  const first = capture(game, 0, { x: 0, y: 0 });
  assert.equal(unit.capture, 7);
  assert.equal(first.events[0].completed, false);
  assert.equal(game.state.owners[0][0], null, 'not yet captured');
  unit.done = false;
  capture(game, 0, { x: 0, y: 0 });
  assert.equal(unit.capture, 14);
  unit.done = false;
  const last = capture(game, 0, { x: 0, y: 0 });
  assert.equal(last.events[0].completed, true);
  assert.equal(game.state.owners[0][0], 0, 'owner flipped to the capturing player');
  assert.equal(unit.capture, 0, 'progress resets after capture');
});

test('capture: fractional HP rounds up (6.5 HP adds 7)', () => {
  const game = makeGame({ units: { taker: { attributes: { capture: true } } }, rows: ['c.'], unitsOnMap: [['taker', 0, 0, 0], ['taker', 1, 1, 0]] });
  game.state.units[0].hp = 6.5;
  capture(game, 0, { x: 0, y: 0 });
  assert.equal(game.state.units[0].capture, 7);
});

test('capture: property.capturePoints is honoured (a 5-point property falls in one action)', () => {
  const game = makeGame({
    units: { taker: { attributes: { capture: true } } },
    terrain: { city: { name: 'Hamlet', defense: 1, moveCost: { foot: 1, wheel: 1, air: 1 }, attributes: { property: { income: 0, capturePoints: 5, repair: 0, builds: [] } }, render: { base: '#000000' } } },
    rows: ['c.'], unitsOnMap: [['taker', 0, 0, 0], ['taker', 1, 1, 0]],
  });
  capture(game, 0, { x: 0, y: 0 });
  assert.equal(game.state.owners[0][0], 0);
});

test('capture: moving to another tile abandons progress; waiting in place keeps it', () => {
  const game = makeGame({ units: { taker: { attributes: { capture: true } } }, rows: ['cc..'], unitsOnMap: [['taker', 0, 0, 0], ['taker', 1, 3, 0]] });
  const unit = game.state.units[0];
  capture(game, 0, { x: 0, y: 0 });
  assert.equal(unit.capture, 10);
  unit.done = false;
  game.act(ordersFor(game, 0, { x: 0, y: 0 })); // wait in place
  assert.equal(unit.capture, 10, 'progress kept when not moving');
  unit.done = false;
  game.act(ordersFor(game, 0, { x: 1, y: 0 }, { type: 'capture' })); // move to the next city and capture there
  assert.equal(unit.capture, 10, 'fresh capture of the new tile (0 + 10 HP), not 20');
  assert.equal(game.state.owners[0][0], null, 'first city was never finished');
});

test('capture: cannot capture a property you already own, or a tile that is not a property', () => {
  const game = makeGame({ units: { taker: { attributes: { capture: true } } }, rows: ['a...'], unitsOnMap: [['taker', 0, 0, 0], ['taker', 1, 3, 0]] });
  assert.equal(canCapture(game, game.state.units[0], 0, 0), false, 'own base');
  assert.equal(canCapture(game, game.state.units[0], 1, 0), false, 'plain tile');
  assert.equal(capture(game, 0, { x: 0, y: 0 }).error, 'cannot-capture');
});

test('victoryOnCapture: capturing an HQ knocks its owner out (the last player left wins); capturing an ordinary city does not', () => {
  const game = makeGame({
    units: { taker: { attributes: { capture: true } } },
    rows: ['ch..'], unitsOnMap: [['taker', 0, 0, 0], ['taker', 0, 1, 0], ['taker', 1, 3, 0]],
  });
  game.state.units[0].hp = 10;
  game.state.units[0].capture = 15; // 15 + 10 >= 20
  const city = capture(game, 0, { x: 0, y: 0 });
  assert.equal(city.events.some((e) => e.type === 'gameOver'), false);
  assert.equal(game.state.winner, null);
  game.state.units[1].capture = 15;
  const hq = capture(game, 1, { x: 1, y: 0 });
  assert.deepEqual(hq.events.find((e) => e.type === 'gameOver'), { type: 'gameOver', winner: 0, reason: 'hq' });
  assert.equal(game.state.winner, 0);
});
