import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, ordersFor } from '../helpers/fixtures.js';
import { calcDamage, canTarget, resolveAttack } from '../../src/engine/combat.js';

const duel = ({ atk = {}, def = {}, rows = ['..'], atkHp, defHp } = {}) => {
  const game = makeGame({ units: { atk: { hits: 60, ...atk }, def: { hits: 60, ...def } }, rows, unitsOnMap: [['atk', 0, 0, 0, atkHp], ['def', 1, 1, 0, defHp]] });
  return { game, atk: game.state.units[0], def: game.state.units[1] };
};

test('damage = base x attackerHP/10 x (1 - stars x defenderHP/100) / 10, rounded to whole HP', () => {
  const { game, atk, def } = duel();
  assert.equal(calcDamage(game, atk, def), 5, '60*(1-0.1)/10 = 5.4');
  atk.hp = 5;
  assert.equal(calcDamage(game, atk, def), 3, '60*0.5*0.9/10 = 2.7');
  atk.hp = 10;
  def.hp = 5;
  assert.equal(calcDamage(game, atk, def), 6, '60*(1-0.05)/10 = 5.7');
});

test('damage below 1 HP keeps one decimal instead of rounding to 0', () => {
  const { game, atk, def } = duel({ atk: { hits: 4 }, def: {} });
  assert.equal(calcDamage(game, atk, def), 0.4, '4*0.9/10 = 0.36 -> 0.4');
});

test('an attack the layers forbid does no damage', () => {
  const game = makeGame({
    units: { hitter: { targetLayers: ['ground'] }, jet: { layer: 'sky', moveClass: 'air', targetLayers: ['ground', 'sky'] } },
    rows: ['..'], unitsOnMap: [['hitter', 0, 0, 0], ['jet', 1, 1, 0]],
  });
  const [hitter, jet] = game.state.units;
  assert.equal(canTarget(game, hitter, jet), false);
  assert.equal(calcDamage(game, hitter, jet), 0);
  assert.equal(canTarget(game, jet, hitter), true);
});

test('resolveAttack: defender loses HP, survivor counterattacks with its REDUCED HP, HP kept to one decimal', () => {
  const { game, atk, def } = duel({ atk: { hits: 55 }, def: { hits: 55 } });
  const events = resolveAttack(game, atk, def);
  assert.deepEqual(events.map((e) => [e.counter, e.damage, e.destroyed]), [[false, 5, false], [true, 2, false]]);
  assert.equal(def.hp, 5);
  assert.equal(atk.hp, 8, 'counter = 55 * (5/10) * 0.9 / 10 = 2.475 -> 2 (uses the defender\'s reduced HP)');
});

test('resolveAttack: a destroyed defender is removed and cannot counter', () => {
  const { game, atk, def } = duel({ defHp: 2 });
  const events = resolveAttack(game, atk, def);
  assert.equal(events.length, 1);
  assert.equal(events[0].destroyed, true);
  assert.equal(game.state.units.includes(def), false);
  assert.equal(atk.hp, 10);
});

test('resolveAttack: a counterattack can destroy the attacker', () => {
  const { game, atk, def } = duel({ atk: { hits: 20 }, def: { hits: 100 }, atkHp: 2 });
  const events = resolveAttack(game, atk, def);
  assert.equal(events.at(-1).counter, true);
  assert.equal(events.at(-1).destroyed, true);
  assert.equal(game.state.units.includes(atk), false);
  assert.equal(game.state.units.includes(def), true);
});

test('strike events carry snapshots taken at that moment (safe to animate after the units change)', () => {
  const { game, atk, def } = duel();
  const [strike] = resolveAttack(game, atk, def);
  atk.x = 9;
  assert.equal(strike.attacker.x, 0);
  assert.equal(strike.defender.hp, def.hp);
  assert.equal(strike.attacker.id, atk.id);
});

test('an attack through Game.act ends the attacker\'s action and reports events in order', () => {
  const { game, atk, def } = duel({ rows: ['...'] });
  const result = game.act(ordersFor(game, 0, { x: 0, y: 0 }, { type: 'attack', targetId: def.id }));
  assert.equal(result.ok, true);
  assert.equal(atk.done, true);
  assert.deepEqual(result.events.map((e) => e.type), ['strike', 'strike']);
});

// ---- toughness, armor and armor piercing -----------------------------------------------------------------------------
// damage = weapon.damage x (attackerHP/10) x (1 - armor x (1 - armorPiercing)) / toughness x (1 - stars x defenderHP/100) / 10
// (the fixtures' plain has 1 star, so a full-HP defender on it takes 0.9 of the rest)
const hit = (atk, def) => { const { game, atk: a, def: d } = duel({ atk, def }); return calcDamage(game, a, d); };

test('toughness divides all incoming damage; 1 is the baseline', () => {
  assert.equal(hit({}, {}), 5, '60 * 0.9 / 10 = 5.4');
  assert.equal(hit({}, { toughness: 1 }), 5);
  assert.equal(hit({}, { toughness: 2 }), 3, '60 / 2 * 0.9 / 10 = 2.7');
  assert.equal(hit({}, { toughness: 4 }), 1, '1.35 -> 1');
  assert.equal(hit({}, { toughness: 0.5 }), 11, 'a soft unit takes more than the weapon\'s nominal damage: 10.8');
});

test('targetMultipliers scale damage for the target mode that reaches the defender', () => {
  // weapon 60, plain 1 star: 60 * 0.9 / 10 = 5.4 -> 5; with x1.5 -> 8.1 -> 8
  assert.equal(hit({ targets: ['direct_ground', 'sky'], targetLayers: undefined, targetMultipliers: { direct_ground: 1.5 } }, {}), 8);
  assert.equal(hit({ targets: ['direct_ground', 'sky'], targetMultipliers: { sky: 3 } }, {}), 5, 'a multiplier for another mode is ignored');
  assert.equal(hit({ targets: ['direct_ground'], targetMultipliers: { direct_ground: 0.5 } }, {}), 3, 'can also reduce: 2.7');
});

test('armor cuts incoming damage by that fraction', () => {
  assert.equal(hit({}, { armor: 0 }), 5);
  assert.equal(hit({}, { armor: 0.5 }), 3, '60 * 0.5 * 0.9 / 10 = 2.7');
  assert.equal(hit({}, { armor: 0.9 }), 0.5, '60 * 0.1 * 0.9 / 10 = 0.54: under 1 HP keeps one decimal');
});

test('armorPiercing removes that fraction of the defender\'s armor', () => {
  assert.equal(hit({ armorPiercing: 0 }, { armor: 0.5 }), 3, 'armor fully applies: 2.7');
  assert.equal(hit({ armorPiercing: 0.5 }, { armor: 0.5 }), 4, 'half the armor is ignored: 60 * 0.75 * 0.9 / 10 = 4.05');
  assert.equal(hit({ armorPiercing: 1 }, { armor: 0.5 }), 5, 'all of it is ignored');
  assert.equal(hit({ armorPiercing: 1 }, { armor: 1 }), 5, 'even total armor');
  assert.equal(hit({ armorPiercing: 0 }, { armor: 1 }), 0, 'total armor stops a non-piercing weapon');
});

test('piercing only matters against armor, toughness always applies', () => {
  assert.equal(hit({ armorPiercing: 1 }, { armor: 0, toughness: 2 }), 3);
  assert.equal(hit({ armorPiercing: 0 }, { armor: 0, toughness: 2 }), 3);
  assert.equal(hit({ armorPiercing: 1 }, { armor: 0.5, toughness: 2 }), 3);
  assert.equal(hit({ armorPiercing: 0 }, { armor: 0.5, toughness: 2 }), 1, '60 / 2 * 0.5 * 0.9 / 10 = 1.35');
});

test('toughness, armor and terrain stack, and the attacker\'s HP still scales the damage', () => {
  const { game, atk, def } = duel({ def: { toughness: 2, armor: 0.5 }, atkHp: 5 });
  assert.equal(calcDamage(game, atk, def), 0.7, '60 * 0.5 * (0.5 / 2) * 0.9 / 10 = 0.675');
});

test('a unit with no toughness or armor in the data defaults to 1 and 0', () => {
  const { game } = duel();
  const u = game.registry.unit('atk');
  assert.deepEqual([u.toughness, u.armor], [1, 0]);
  assert.equal(game.registry.weapon('atk').armorPiercing, 0, 'and a weapon pierces nothing by default');
});
