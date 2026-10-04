// Unit attribute `attacksPerTurn`: the unit's order does not end its turn until it has made that many attacks, and it cannot move between them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';

const units = { twice: { hits: 20, attributes: { attacksPerTurn: 2 } }, once: { hits: 20 }, victim: { hits: 1, toughness: 3 } };
const game = (type) => makeGame({ units, rows: ['H...h'], unitsOnMap: [[type, 0, 1, 0], ['victim', 1, 2, 0]] });
const attack = (g, u, target, to = { x: 1, y: 0 }) => g.act({ unitId: u.id, to, action: { type: 'attack', targetId: target.id } });

test('attacksPerTurn: the unit can attack twice, standing still, and then its turn is over', () => {
  const g = game('twice');
  const [u, foe] = g.state.units;
  assert.equal(attack(g, u, foe).ok, true);
  assert.equal(u.done, false, 'one attack left');
  assert.deepEqual(u.halted, { moved: false });
  const hp = foe.hp;
  assert.equal(attack(g, u, foe).ok, true);
  assert.ok(foe.hp < hp, 'the second attack did damage too');
  assert.equal(u.done, true);
  assert.equal(attack(g, u, foe).error, 'unit-already-acted');
});

test('attacksPerTurn: it cannot move between its attacks, but may Wait instead of the second', () => {
  const g = game('twice');
  const [u, foe] = g.state.units;
  attack(g, u, foe);
  assert.equal(g.act({ unitId: u.id, to: { x: 0, y: 0 }, action: { type: 'wait' } }).ok, false, 'no moving after the first attack');
  assert.equal(g.act({ unitId: u.id, to: { x: 1, y: 0 }, action: { type: 'wait' } }).ok, true);
  assert.equal(u.done, true);
});

test('attacksPerTurn: a unit without it is done after one attack, and the count starts again each turn', () => {
  const g = game('once');
  const [u, foe] = g.state.units;
  attack(g, u, foe);
  assert.equal(u.done, true);
  const g2 = game('twice');
  const [t, foe2] = g2.state.units;
  attack(g2, t, foe2);
  g2.endTurn(); g2.endTurn();
  assert.equal(t.attacks, undefined);
  assert.equal(t.done, false);
  assert.equal(attack(g2, t, foe2).ok, true);
  assert.equal(t.done, false, 'a fresh pair of attacks');
});
