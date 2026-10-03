// Unit attribute `sabotage` (the spy) and the sabotaged state of a property (sabotage.js, economy.js): half income and no building until
// the owner's next turn is over.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData } from '../helpers/fixtures.js';
import { canSabotage, isSabotaged } from '../../src/engine/sabotage.js';
import { buildProblem, incomeFor } from '../../src/engine/economy.js';
import { validateData } from '../../src/data/validate.js';

const units = { spy: { attributes: { sabotage: true } }, grunt: { attributes: { capture: true } }, a: {} };
// 'b' is a player-1 base, 'c' a neutral city, 'a' a player-0 base
const game = (rows, unitsOnMap) => makeGame({ units, rows, unitsOnMap });
const sabotage = (g, n, to) => g.act({ unitId: g.state.units[n].id, to, action: { type: 'sabotage' } });

test('sabotage: a unit WITH the attribute can sabotage an enemy property it stands on; an otherwise identical unit WITHOUT it cannot', () => {
  const g = game(['Hb..h', '.....'], [['spy', 0, 1, 1], ['grunt', 0, 2, 1], ['a', 1, 4, 1]]);
  const [spy, grunt] = g.state.units;
  assert.equal(canSabotage(g, spy, 1, 0), true);
  assert.equal(canSabotage(g, grunt, 1, 0), false);
  assert.equal(g.act({ unitId: grunt.id, to: { x: 1, y: 0 }, action: { type: 'sabotage' } }).error, 'cannot-sabotage');
  const res = sabotage(g, 0, { x: 1, y: 0 });
  assert.equal(res.ok, true);
  assert.ok(res.events.some((e) => e.type === 'sabotage'));
  assert.equal(isSabotaged(g, 1, 0), true);
});

test('sabotage: it needs a property that another player owns (not your own, not neutral, not open ground)', () => {
  const g = game(['Hac.h'], [['spy', 0, 0, 0], ['a', 1, 4, 0]]);
  const spy = g.state.units[0];
  assert.equal(canSabotage(g, spy, 0, 0), false, 'its own HQ');
  assert.equal(canSabotage(g, spy, 1, 0), false, 'its own base');
  assert.equal(canSabotage(g, spy, 2, 0), false, 'a neutral city');
  assert.equal(canSabotage(g, spy, 3, 0), false, 'plain ground');
  assert.equal(canSabotage(g, spy, 4, 0), true, 'the enemy HQ');
});

test('sabotage: the property pays half its income, rounded down, at its owner\'s next turn start', () => {
  const g = game(['Hb..h'], [['spy', 0, 1, 0], ['a', 1, 4, 0]]);
  assert.equal(incomeFor(g, 1), 2000, 'a base and an HQ at 1000 each');
  sabotage(g, 0, { x: 1, y: 0 });
  assert.equal(incomeFor(g, 1), 1500);
  const funds = g.state.funds[1];
  const ev = g.endTurn().events.find((e) => e.type === 'turnStart');
  assert.equal(ev.income, 1500);
  assert.equal(g.state.funds[1], funds + 1500);
  assert.deepEqual(ev.incomes.map((i) => [i.amount, i.sabotaged]).sort(), [[1000, false], [500, true]]);
});

test('sabotage: the property cannot build during its owner\'s turn, and can again once that turn is over', () => {
  const g = game(['Hb..h'], [['spy', 0, 1, 0], ['a', 1, 4, 0]]);
  sabotage(g, 0, { x: 1, y: 0 });
  g.endTurn();   // player 1's turn
  assert.equal(buildProblem(g, 1, 1, 0, 'a'), 'sabotaged');
  assert.equal(g.build(1, 0, 'a').error, 'sabotaged');
  g.endTurn();   // back to player 0: player 1's turn is over, the sabotage with it
  assert.equal(isSabotaged(g, 1, 0), false);
  g.endTurn();
  g.state.units = g.state.units.filter((u) => u.type !== 'spy');   // the spy has left the base tile
  assert.equal(buildProblem(g, 1, 1, 0, 'a'), null, 'the next turn it builds again');
  assert.equal(incomeFor(g, 1), 2000);
});

test('sabotage: a property that is already sabotaged cannot be sabotaged again, and capturing it lifts the sabotage', () => {
  const g = game(['Hb..h'], [['spy', 0, 1, 0], ['grunt', 0, 0, 0], ['a', 1, 4, 0]]);
  sabotage(g, 0, { x: 1, y: 0 });
  assert.equal(canSabotage(g, g.state.units[0], 1, 0), false);
  g.state.units[0].done = false;
  assert.equal(sabotage(g, 0, { x: 1, y: 0 }).error, 'cannot-sabotage');
  // the enemy base is taken: it is no longer sabotaged
  g.state.units[1].x = 1; g.state.units[1].y = 0; g.state.units[0].x = 2;
  g.act({ unitId: g.state.units[1].id, to: { x: 1, y: 0 }, action: { type: 'capture' } });
  g.state.units[1].done = false; g.state.units[1].capture = 10;
  g.act({ unitId: g.state.units[1].id, to: { x: 1, y: 0 }, action: { type: 'capture' } });
  assert.equal(g.state.owners[0][1], 0, 'captured');
  assert.equal(isSabotaged(g, 1, 0), false);
});

test('sabotage: undo takes it back', () => {
  const g = game(['Hb..h'], [['spy', 0, 1, 0], ['a', 1, 4, 0]]);
  sabotage(g, 0, { x: 1, y: 0 });
  assert.equal(isSabotaged(g, 1, 0), true);
  assert.equal(g.undo(), true);
  assert.equal(isSabotaged(g, 1, 0), false);
});

test('sabotage: the config must be a flag', () => {
  const problems = (attributes) => validateData(makeData({ units: { x: { attributes } } })).join('\n');
  assert.equal(problems({ sabotage: true }), '');
  assert.match(problems({ sabotage: 1 }), /attribute "sabotage" must be true/);
});
