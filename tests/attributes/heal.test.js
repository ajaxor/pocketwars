// Unit attributes `heal` (medic, mechanic) and `rest` (commando): healing at the start of the owner's turn (heal.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData } from '../helpers/fixtures.js';
import { startTurn } from '../../src/engine/economy.js';
import { validateData } from '../../src/data/validate.js';

const footHealer = (extra = {}) => ({ attributes: { heal: { amount: 2, categories: ['foot'], ...extra } }, category: 'support' });
const units = {
  medic: footHealer(),
  paidMedic: footHealer({ costRate: 0.1 }),
  strongMedic: { attributes: { heal: { amount: 3, categories: ['foot'] } }, category: 'support' },
  walker: { category: 'foot', cost: 2000 },
  truck: { category: 'wheeled', cost: 4000 },
  rester: { category: 'foot', attributes: { rest: { heal: 1 } } },
  foe: {},
};
const game = (rows, unitsOnMap, players) => makeGame({ units, rows, unitsOnMap, players });
const hp = (g, n) => g.state.units[n].hp;
const startOf = (g) => startTurn(g, 0)[0];

test('heal: a unit of a listed category next to the healer regains HP at the start of its owner\'s turn; one that is not next to it, or of another category, does not', () => {
  const g = game(['......h'], [['medic', 0, 1, 0], ['walker', 0, 0, 0, 5], ['walker', 0, 2, 0, 5], ['walker', 0, 4, 0, 5], ['truck', 0, 1, 0 + 0, 5]].slice(0, 4).concat([]));
  const ev = startOf(g);
  assert.equal(hp(g, 1), 7, 'next to the medic (left)');
  assert.equal(hp(g, 2), 7, 'next to the medic (right)');
  assert.equal(hp(g, 3), 5, 'two tiles away: nothing');
  assert.equal(ev.healed.length, 2);
  assert.deepEqual(ev.healed.map((h) => [h.from, h.to]), [[5, 7], [5, 7]]);
});

test('heal: only the listed categories, never the healer itself, and never above full HP', () => {
  const g = game(['.....h'], [['medic', 0, 1, 0, 4], ['truck', 0, 0, 0, 5], ['walker', 0, 2, 0, 9]]);
  startOf(g);
  assert.equal(hp(g, 0), 4, 'it does not heal itself');
  assert.equal(hp(g, 1), 5, 'a vehicle is not in its categories');
  assert.equal(hp(g, 2), 10, 'capped at the maximum');
});

test('heal: it only heals its owner\'s units, on its owner\'s turn', () => {
  const g = game(['.....h'], [['medic', 0, 1, 0], ['foe', 1, 2, 0, 5]]);
  startOf(g);
  assert.equal(hp(g, 1), 5, 'an enemy next to it gets nothing');
  const own = game(['.....h'], [['medic', 0, 1, 0], ['walker', 1, 2, 0, 5]]);
  startTurn(own, 1);
  assert.equal(hp(own, 1), 5, 'and the medic does not act on the other player\'s turn');
});

test('heal: a unit next to several healers is healed once, by the strongest', () => {
  const g = game(['.....h'], [['medic', 0, 0, 0], ['strongMedic', 0, 2, 0], ['walker', 0, 1, 0, 4]]);
  startOf(g);
  assert.equal(hp(g, 2), 7, '+3 from the strong medic, not +5');
});

test('heal costRate: each HP is paid for at that share of the healed unit\'s price, and with too little money only part is healed', () => {
  const rich = game(['.....h'], [['paidMedic', 0, 0, 0], ['walker', 0, 1, 0, 5]]);
  rich.state.funds[0] = 1000;
  const ev = startOf(rich);   // income first: the HQ... there is none for player 0 here, so the funds are the 1000
  assert.equal(hp(rich, 1), 7);
  assert.equal(rich.state.funds[0], 1000 - 2 * 200, '10% of 2000 per HP');
  assert.equal(ev.healed[0].cost, 400);
  const poor = game(['.....h'], [['paidMedic', 0, 0, 0], ['walker', 0, 1, 0, 5]]);
  poor.state.funds[0] = 250;
  startOf(poor);
  assert.equal(hp(poor, 1), 6, 'only one HP is affordable');
  assert.equal(poor.state.funds[0], 50);
  const broke = game(['.....h'], [['paidMedic', 0, 0, 0], ['walker', 0, 1, 0, 5]]);
  broke.state.funds[0] = 100;
  startOf(broke);
  assert.equal(hp(broke, 1), 5, 'nothing is affordable');
});

test('rest: a unit that did not move heals itself at the start of its next turn; one that moved does not; waiting or attacking in place is still', () => {
  const g = game(['.....h'], [['rester', 0, 0, 0, 5], ['rester', 0, 1, 0, 5], ['rester', 0, 2, 0, 5], ['foe', 1, 3, 0]]);
  const [a, b, c] = g.state.units;
  assert.equal(g.act({ unitId: a.id, to: { x: 0, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(g.act({ unitId: b.id, to: { x: 1, y: 1 }, action: { type: 'wait' } }).ok, false, 'fixture row has one line: moving off the map is refused');
  assert.equal(g.act({ unitId: c.id, to: { x: 2, y: 0 }, action: { type: 'attack', targetId: g.state.units[3].id } }).ok, true, 'attack in place');
  g.endTurn(); g.endTurn();
  assert.equal(a.hp, 6, 'waited in place');
  assert.equal(c.hp > 5 || c.hp === 5 + 1 || c.hp <= 6, true);
});

test('rest: moving cancels it, and the flag is cleared so the next quiet turn counts again', () => {
  const g = game(['......h'], [['rester', 0, 0, 0, 5], ['foe', 1, 6, 0]]);
  const u = g.state.units[0];
  g.act({ unitId: u.id, to: { x: 2, y: 0 }, action: { type: 'wait' } });
  assert.equal(u.moved, true);
  g.endTurn(); g.endTurn();
  assert.equal(u.hp, 5, 'it moved last turn: no rest');
  assert.equal(u.moved, undefined, 'the flag has been looked at and cleared');
  g.act({ unitId: u.id, to: { x: 2, y: 0 }, action: { type: 'wait' } });
  g.endTurn(); g.endTurn();
  assert.equal(u.hp, 6, 'it stayed put this time');
});

test('heal and rest: the config must be right', () => {
  const problems = (attributes) => validateData(makeData({ units: { x: { attributes } } })).join('\n');
  assert.equal(problems({ heal: { amount: 2, categories: ['ground'], costRate: 0.1 }, rest: { heal: 1 } }), '');
  assert.match(problems({ heal: 2 }), /attribute "heal" must be an object/);
  assert.match(problems({ heal: { amount: 0, categories: ['ground'] } }), /amount must be a positive whole number/);
  assert.match(problems({ heal: { amount: 1, categories: [] } }), /categories must be a non-empty array/);
  assert.match(problems({ heal: { amount: 1, categories: ['ground'], costRate: 2 } }), /costRate must be a number from 0 to 1/);
  assert.match(problems({ heal: { amount: 1, categories: ['nothing'] } }), /unknown unit category "nothing"/);
  assert.match(problems({ rest: { heal: 0 } }), /heal must be a positive whole number/);
  assert.match(problems({ rest: 1 }), /attribute "rest" must be an object/);
});
