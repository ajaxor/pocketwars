// Unit attribute `cloak` and `radar`: a cloaked unit is hidden from other players unless one of their units is adjacent or has radar in
// range. It keeps its own layer, so what can shoot it does not change. Sonar (submerged units) does not find it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { canSee, hiddenFrom, isExposed, isHidden } from '../../src/engine/detection.js';
import { computeReach, targetsFrom } from '../../src/engine/movement.js';
import { canCounter } from '../../src/engine/combat.js';
import { validateData } from '../../src/data/validate.js';
import { makeData } from '../helpers/fixtures.js';

const units = {
  ghost: { attributes: { cloak: true }, range: [1, 2] },
  plain: { range: [1, 2] },
  watcher: { attributes: { radar: 3 }, range: [1, 2] },
  listener: { attributes: { sonar: 3 }, range: [1, 2] },
};
const game = (rows, unitsOnMap) => makeGame({ units, rows, unitsOnMap });

test('cloak: the enemy cannot see a cloaked unit, but can see the same unit without the attribute; its owner always can', () => {
  const g = game(['H.......h'], [['ghost', 0, 2, 0], ['plain', 0, 3, 0], ['plain', 1, 8, 0]]);
  const [ghost, plain] = g.state.units;
  assert.equal(isHidden(g, ghost), true);
  assert.equal(isHidden(g, plain), false);
  assert.equal(canSee(g, 1, ghost), false);
  assert.equal(canSee(g, 1, plain), true);
  assert.equal(canSee(g, 0, ghost), true, 'its owner sees it');
  assert.deepEqual(hiddenFrom(g, 1), [ghost.id]);
});

test('cloak: an adjacent enemy notices it; one two tiles away does not', () => {
  const near = game(['.....'], [['ghost', 0, 2, 0], ['plain', 1, 3, 0]]);
  assert.equal(canSee(near, 1, near.state.units[0]), true);
  const far = game(['.....'], [['ghost', 0, 2, 0], ['plain', 1, 4, 0]]);
  assert.equal(canSee(far, 1, far.state.units[0]), false);
});

test('radar: finds a cloaked unit within its range, and not beyond; sonar does not find it', () => {
  const inRange = game(['......'], [['ghost', 0, 0, 0], ['watcher', 1, 3, 0]]);
  assert.equal(canSee(inRange, 1, inRange.state.units[0]), true, 'radar 3 reaches 3 tiles');
  const tooFar = game(['......'], [['ghost', 0, 0, 0], ['watcher', 1, 4, 0]]);
  assert.equal(canSee(tooFar, 1, tooFar.state.units[0]), false);
  const sonar = game(['......'], [['ghost', 0, 0, 0], ['listener', 1, 3, 0]]);
  assert.equal(canSee(sonar, 1, sonar.state.units[0]), false, 'sonar is for submerged units');
  assert.equal(isExposed(inRange, inRange.state.units[0], 1), true);
  assert.equal(isExposed(tooFar, tooFar.state.units[0], 1), false);
});

test('cloak: a hidden unit cannot be picked as a target, while the same unit uncloaked can', () => {
  const g = game(['.....'], [['plain', 0, 0, 0], ['ghost', 1, 2, 0]]);
  assert.deepEqual(targetsFrom(g, g.state.units[0]), [], 'cannot aim at what it cannot see');
  const h = game(['.....'], [['plain', 0, 0, 0], ['plain', 1, 2, 0]]);
  assert.equal(targetsFrom(h, h.state.units[0]).length, 1);
});

test('cloak: a move that runs into a hidden unit is interrupted, as with a submarine', () => {
  const g = game(['.....'], [['plain', 0, 0, 0], ['ghost', 1, 2, 0]]);
  const res = g.act({ unitId: g.state.units[0].id, to: { x: 3, y: 0 }, action: { type: 'wait' } });
  assert.equal(res.ok, true, res.error);
  assert.ok(res.interrupted, 'the walker found it');
  assert.deepEqual({ x: g.state.units[0].x, y: g.state.units[0].y }, { x: 1, y: 0 });
  assert.equal(computeReach(g, g.state.units[1]).has(2, 0), true);
});

test('cloak: a cloaked attacker is not answered when the defender cannot see it, but an uncloaked one is', () => {
  const shoot = (type) => {
    const g = game(['.....'], [[type, 0, 0, 0], ['plain', 1, 2, 0]]);
    g.state.units[1].hp = 10;
    const res = g.act({ unitId: g.state.units[0].id, to: { x: 0, y: 0 }, action: { type: 'attack', targetId: g.state.units[1].id } });
    assert.equal(res.ok, true, type);
    return { counters: res.events.filter((e) => e.type === 'strike' && e.counter).length, g };
  };
  assert.equal(shoot('plain').counters, 1, 'the defender answers an attacker it can see');
  const ghost = shoot('ghost');
  assert.equal(ghost.counters, 0, 'but not one it cannot see');
  assert.equal(canCounter(ghost.g, ghost.g.state.units[1], ghost.g.state.units[0]), false);
});

test('cloak and radar: the config must be right', () => {
  const problems = (attributes) => validateData(makeData({ units: { x: { attributes } } })).join('\n');
  assert.equal(problems({ cloak: true, radar: 3 }), '');
  assert.match(problems({ cloak: 'yes' }), /attribute "cloak" must be true/);
  assert.match(problems({ radar: 1 }), /attribute "radar" must be a whole number of tiles, at least 2/);
});

// ---- terrain-bound cloak (the sniper) ----------------------------------------------------------------------------------------
const woods = { cloak: { terrain: ['forest'], revealedByFiring: true } };
const wunits = { ...units, sniper: { attributes: { ...woods, indirect: true }, range: [2, 3] }, watcher2: { attributes: {} } };
const wgame = (rows, unitsOnMap) => makeGame({ units: wunits, rows, unitsOnMap });

test('cloak with terrain: hidden in the listed terrain, in plain sight elsewhere', () => {
  const g = wgame(['.F....'], [['sniper', 0, 1, 0], ['sniper', 0, 0, 0], ['plain', 1, 5, 0]]);
  const [inWoods, onPlain] = g.state.units;
  assert.equal(canSee(g, 1, inWoods), false);
  assert.equal(canSee(g, 1, onPlain), true);
  assert.equal(canSee(g, 0, inWoods), true, 'its owner always sees it');
});

test('cloak with terrain: an adjacent enemy still notices it', () => {
  const g = wgame(['.F....'], [['sniper', 0, 1, 0], ['plain', 1, 2, 0]]);
  assert.equal(canSee(g, 1, g.state.units[0]), true);
});

test('cloak revealedByFiring: firing reveals it through the enemy turn, and it is hidden again once its owner\'s next turn starts', () => {
  const g = wgame(['.F...h'], [['sniper', 0, 1, 0], ['plain', 1, 4, 0]]);
  const sniper = g.state.units[0], foe = g.state.units[1];
  assert.equal(canSee(g, 1, sniper), false);
  const res = g.act({ unitId: sniper.id, to: { x: 1, y: 0 }, action: { type: 'attack', targetId: foe.id } });
  assert.equal(res.ok, true, res.error);
  assert.equal(canSee(g, 1, sniper), true, 'revealed after firing');
  g.endTurn();
  assert.equal(canSee(g, 1, sniper), true, 'still revealed during the enemy turn');
  g.endTurn();
  assert.equal(canSee(g, 1, sniper), false, 'hidden again at the start of its owner\'s next turn');
});

test('cloak without revealedByFiring: firing does not reveal it', () => {
  const g = makeGame({ units: { ...units, shooter: { attributes: { cloak: true, indirect: true }, range: [2, 3] } }, rows: ['.....h'], unitsOnMap: [['shooter', 0, 0, 0], ['plain', 1, 3, 0]] });
  g.act({ unitId: g.state.units[0].id, to: { x: 0, y: 0 }, action: { type: 'attack', targetId: g.state.units[1].id } });
  assert.equal(canSee(g, 1, g.state.units[0]), false);
});

test('cloak config: true, or terrain ids with an optional revealedByFiring flag', () => {
  const problems = (cloak) => validateData(makeData({ units: { x: { attributes: { cloak } } } })).join('\n');
  assert.equal(problems({ terrain: ['forest'], revealedByFiring: true }), '');
  assert.match(problems({ terrain: [] }), /terrain must be a non-empty array/);
  assert.match(problems({ terrain: ['forest'], revealedByFiring: 1 }), /revealedByFiring must be true or false/);
  assert.match(problems(5), /cloak/);
});
