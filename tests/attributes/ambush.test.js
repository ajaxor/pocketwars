// A unit that BEGINS its turn hidden (cloaked or submerged) hits 50% harder on that turn (rules.ambushMultiplier). Counterattacks never get it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { calcDamage } from '../../src/engine/combat.js';

const units = { stalker: { hits: 40, attributes: { cloak: true } }, plain: { hits: 40 }, victim: { hits: 40 } };
const rules = { maxHp: 10, ambushMultiplier: 1.5, neutralColor: '#999999', moveClasses: ['foot', 'wheel', 'air'], layers: { ground: { label: null }, sky: { label: 'sky', airborne: true } }, targetModes: { direct_ground: { layer: 'ground', lineOfSight: true }, indirect_ground: { layer: 'ground' }, sky: { layer: 'sky' } } };
const game = (type) => makeGame({ units, rules, rows: ['H....h'], unitsOnMap: [[type, 0, 1, 0], ['victim', 1, 2, 0]] });
const myTurn = (g) => { g.endTurn(); g.endTurn(); };

test('ambush: a cloaked unit that starts its turn hidden does +50% damage that turn; an ordinary unit does not', () => {
  const s = game('stalker'), p = game('plain');
  myTurn(s); myTurn(p);
  assert.equal(s.state.units[0].ambush, true);
  assert.equal(p.state.units[0].ambush, undefined);
  const hit = calcDamage(s, s.state.units[0], s.state.units[1]), base = calcDamage(p, p.state.units[0], p.state.units[1]);
  assert.equal(base, 4);
  assert.equal(hit, 5, '3.6 x 1.5 = 5.4');
  assert.ok(hit > base);
});

test('ambush: it is a bonus of the owner\'s own turn, so the same unit\'s counterattack is not boosted', () => {
  const g = game('stalker');
  myTurn(g);
  const [u, foe] = g.state.units;
  assert.equal(calcDamage(g, u, foe), 5);
  g.endTurn();   // the enemy's turn
  assert.equal(calcDamage(g, u, foe), 4, 'a counterattack on the enemy\'s turn is plain');
});

test('ambush: a terrain-cloaked unit (the sniper) only gets it when it starts the turn on its cover', () => {
  const sniper = { ...units, stalker: { hits: 40, attributes: { cloak: { terrain: ['forest'] } } } };
  const mk = (row) => makeGame({ units: sniper, rules, rows: [row], unitsOnMap: [['stalker', 0, 1, 0], ['victim', 1, 2, 0]] });
  const open = mk('H....h'), wood = mk('HF...h');
  myTurn(open); myTurn(wood);
  assert.equal(open.state.units[0].ambush, undefined, 'in the open it is not hidden');
  assert.equal(wood.state.units[0].ambush, true, 'in the forest it is');
});
