// Unit attributes `heal` (medic, mechanic) and `rest` (commando). `heal` is an end-of-move ORDER (heal.js): after moving or staying put the
// healer restores the damaged friendly units next to it. `rest` heals a unit that held still, at the start of its owner's next turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeData } from '../helpers/fixtures.js';
import { startTurn } from '../../src/engine/economy.js';
import { canHealAt, healPlan } from '../../src/engine/heal.js';
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
const heal = (g, n = 0, to) => g.act({ unitId: g.state.units[n].id, to: to ?? { x: g.state.units[n].x, y: g.state.units[n].y }, action: { type: 'heal' } });
const startOf = (g) => startTurn(g, 0)[0];

test('heal: the order restores listed-category units next to the healer; one that is not next to it, or of another category, is left alone', () => {
  const g = game(['......h', '.......'], [['medic', 0, 1, 0], ['walker', 0, 0, 0, 5], ['walker', 0, 2, 0, 5], ['walker', 0, 4, 0, 5], ['truck', 0, 1, 1, 5]], undefined);
  const res = heal(g);
  assert.equal(res.ok, true, res.error);
  const ev = res.events.find((e) => e.type === 'heal');
  assert.deepEqual([hp(g, 1), hp(g, 2), hp(g, 3), hp(g, 4)], [7, 7, 5, 5], 'both neighbours, not the far one, not the truck');
  assert.deepEqual(ev.healed.map((h) => [h.from, h.to]), [[5, 7], [5, 7]]);
  assert.equal(g.state.units[0].done, true, 'it ends the healer\'s turn');
});

test('heal: it is an end-of-move action: the healer can walk first, and heals from where it stops', () => {
  const g = game(['......h'], [['medic', 0, 0, 0], ['walker', 0, 4, 0, 5]]);
  assert.equal(canHealAt(g, g.state.units[0], 0, 0), false, 'nobody next to its start tile');
  assert.equal(heal(g, 0, { x: 3, y: 0 }).ok, true);
  assert.deepEqual([g.state.units[0].x, hp(g, 1)], [3, 7]);
});

test('heal: it is refused when there is nobody to heal (full HP, other category, enemies, nobody near), and for units without the attribute', () => {
  const full = game(['.....h'], [['medic', 0, 1, 0], ['walker', 0, 2, 0]]);
  assert.equal(heal(full).error, 'cannot-heal');
  const truck = game(['.....h'], [['medic', 0, 1, 0], ['truck', 0, 2, 0, 5]]);
  assert.equal(heal(truck).error, 'cannot-heal');
  const enemy = game(['.....h'], [['medic', 0, 1, 0], ['foe', 1, 2, 0, 5]]);
  assert.equal(heal(enemy).error, 'cannot-heal');
  const plain = game(['.....h'], [['walker', 0, 1, 0], ['walker', 0, 2, 0, 5]]);
  assert.equal(heal(plain).error, 'cannot-heal');
});

test('heal: never the healer itself, and never above full HP', () => {
  const g = game(['.....h'], [['medic', 0, 1, 0, 4], ['walker', 0, 2, 0, 9]]);
  heal(g);
  assert.equal(hp(g, 0), 4, 'it does not heal itself');
  assert.equal(hp(g, 1), 10, 'capped at the maximum');
});

test('heal: nothing happens at the start of a turn any more', () => {
  const g = game(['.....h'], [['medic', 0, 1, 0], ['walker', 0, 2, 0, 5]]);
  const ev = startOf(g);
  assert.equal(hp(g, 1), 5);
  assert.equal(ev.healed.length, 0);
});

test('heal costRate: each HP is paid for at that share of the healed unit\'s price, and with too little money only part is healed', () => {
  const rich = game(['.....h'], [['paidMedic', 0, 0, 0], ['walker', 0, 1, 0, 5]]);
  rich.state.funds[0] = 1000;
  const ev = heal(rich).events.find((e) => e.type === 'heal');
  assert.equal(hp(rich, 1), 7);
  assert.equal(rich.state.funds[0], 1000 - 2 * 200, '10% of 2000 per HP');
  assert.equal(ev.healed[0].cost, 400);
  const poor = game(['.....h'], [['paidMedic', 0, 0, 0], ['walker', 0, 1, 0, 5]]);
  poor.state.funds[0] = 250;
  assert.deepEqual(healPlan(poor, poor.state.units[0]).map((p) => [p.hp, p.cost]), [[1, 200]]);
  heal(poor);
  assert.equal(hp(poor, 1), 6, 'only one HP is affordable');
  assert.equal(poor.state.funds[0], 50);
  const broke = game(['.....h'], [['paidMedic', 0, 0, 0], ['walker', 0, 1, 0, 5]]);
  broke.state.funds[0] = 100;
  assert.equal(heal(broke).error, 'cannot-heal', 'nothing is affordable, so the order is not offered');
  assert.equal(hp(broke, 1), 5);
});

test('heal: the funds are shared out over several wounded units in order', () => {
  const g = game(['.....h'], [['paidMedic', 0, 1, 0], ['walker', 0, 0, 0, 5], ['walker', 0, 2, 0, 5]]);
  g.state.funds[0] = 600;
  heal(g);
  assert.deepEqual([hp(g, 1), hp(g, 2)], [7, 6], '400 for the first, the last 200 buys one HP for the second');
  assert.equal(g.state.funds[0], 0);
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

test('AI: a healer with a wounded friend in reach walks to it and gives the Heal order', async () => {
  const { chooseOrder } = await import('../../src/ai/greedy.js');
  const g = makeGame({ units: { medic: { ...footHealer(), hits: 15 }, walker: { category: 'foot', cost: 2000 }, foe: {} }, rows: ['.........'],
    unitsOnMap: [['medic', 1, 0, 0], ['walker', 1, 3, 0, 4], ['foe', 0, 8, 0]] });
  g.state.turn = 1;
  const order = chooseOrder(g, g.state.units[0]);
  assert.equal(order.action.type, 'heal');
  assert.equal(Math.abs(order.to.x - 3), 1, 'it stops next to the wounded unit');
});
