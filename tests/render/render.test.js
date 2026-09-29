// Rendering smoke tests: draw against a recording canvas context. They catch crashes and gross regressions
// (e.g. a data-driven sprite lookup failing), not pixel output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { Effects } from '../../src/render/effects.js';
import { MoveAnimator } from '../../src/render/animator.js';
import { Renderer } from '../../src/render/renderer.js';
import { Presenter } from '../../src/ui/presenter.js';
import { describeEvents } from '../../src/ui/messages.js';
import { drawUnit } from '../../src/render/unit-sprites.js';
import { playTurn } from '../../src/engine/ai.js';

const registry = await loadRegistry(readData);
const classic = await loadMap(readData, registry, 'classic');

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push(p); return { addColorStop() {} }; }),
    set: (_, p) => { calls.push('=' + String(p)); return true; },
  });
  return { ctx, calls };
}
const canvasWith = (ctx) => ({ getContext: () => ctx, style: {}, width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }) });
const emptyView = { selectedId: null, dest: null, reach: null, attackTiles: null, targets: [], showTargets: false, pendingTargetId: null };

function rig() {
  const game = new Game(registry, classic);
  const { ctx, calls } = recorder();
  const colorsOf = (o) => registry.faction(game.map.players[o].faction);
  const effects = new Effects(registry, colorsOf);
  const animator = new MoveAnimator();
  const renderer = new Renderer(canvasWith(ctx), game, effects, animator);
  return { game, calls, effects, animator, renderer, presenter: new Presenter({ effects, animator }) };
}

test('every unit sprite draws without throwing, for both factions and every HP', () => {
  const { ctx } = recorder();
  for (const id of registry.unitIds) {
    for (const owner of [0, 1]) {
      for (const hp of [10, 5, 1]) {
        drawUnit(ctx, { type: id, x: 1, y: 1, hp }, { def: registry.unit(id), colors: registry.faction(classic.players[owner].faction), px: 40, py: 40, size: 40, now: 500, animate: true, moving: false, alpha: 1, showHp: true });
      }
    }
  }
});

test('the board draws every tile and every unit', () => {
  const { renderer, calls, game } = rig();
  renderer.draw(emptyView, 1000);
  assert.ok(calls.filter((c) => c === 'fillRect').length >= game.map.width * game.map.height);
});

test('selection overlays draw (reach, attack outline, targets, pending target)', () => {
  const { renderer, game } = rig();
  const unit = game.state.units.find((u) => u.owner === 0);
  const enemy = game.state.units.find((u) => u.owner === 1);
  const attack = new Set([0, 1, 2, 12]);
  renderer.draw({ ...emptyView, selectedId: unit.id, attackTiles: attack, targets: [enemy], showTargets: true, pendingTargetId: enemy.id }, 1000);
});

test('effects run their whole lifecycle from real combat events', () => {
  const { game, effects, renderer, presenter } = rig();
  const events = playTurn(game); // player 0 is "human" but the engine does not care who calls it
  const before = effects.list.length;
  presenter.present(events, { now: 0 });
  assert.ok(effects.list.length >= before);
  for (let t = 0; t < 6000; t += 100) renderer.draw(emptyView, t);
  assert.equal(effects.list.length, 0, 'effects expire');
});

test('effects.strike schedules the right animation for each attackFx', () => {
  const { effects } = rig();
  const at = (type) => ({ id: 1, type, owner: 0, x: 0, y: 0 });
  const def = { id: 2, type: 'tank', owner: 1, x: 1, y: 0 };
  for (const [type, kind] of [['infantry', 'lunge'], ['tank', 'shot'], ['artillery', 'shot']]) {
    effects.clear();
    effects.strike({ attacker: at(type), defender: def, damage: 3, destroyed: false }, 0);
    assert.ok(effects.list.some((f) => f.k === kind), `${type} -> ${kind}`);
  }
  assert.ok(effects.list.find((f) => f.k === 'shot').arc, 'artillery shells arc');
  effects.clear();
  effects.strike({ attacker: at('tank'), defender: def, damage: 10, destroyed: true }, 0);
  assert.ok(effects.list.some((f) => f.k === 'die'));
});

test('effects lock input while playing and release afterwards', () => {
  const { effects } = rig();
  effects.strike({ attacker: { id: 1, type: 'tank', owner: 0, x: 0, y: 0 }, defender: { id: 2, type: 'tank', owner: 1, x: 1, y: 0 }, damage: 1, destroyed: false }, 100);
  assert.ok(effects.isLocked(200));
  assert.ok(!effects.isLocked(5000));
  effects.clear();
  assert.ok(!effects.isLocked(200));
});

test('the animator interpolates along a path', () => {
  const a = new MoveAnimator();
  a.start(7, [[0, 0], [2, 0]], 0);
  assert.equal(a.positionOf(7, 0, 40)[0], 0);
  assert.equal(a.positionOf(7, 1e6, 40)[0], 80);
  assert.equal(a.positionOf(8, 0, 40), null);
});

test('describeEvents summarises strikes, captures, builds and game over', () => {
  const game = new Game(registry, classic);
  const u = (type) => ({ type });
  assert.equal(describeEvents(game, [{ type: 'strike', attacker: u('tank'), defender: u('infantry'), damage: 7, destroyed: false }]), 'Tank hits Infantry -7');
  assert.match(describeEvents(game, [
    { type: 'strike', attacker: u('tank'), defender: u('infantry'), damage: 10, destroyed: true },
    { type: 'strike', counter: true, attacker: u('infantry'), defender: u('tank'), damage: 1, destroyed: false },
  ]), /destroyed!, counter -1/);
  assert.equal(describeEvents(game, [{ type: 'capture', completed: false, progress: 10, needed: 20 }]), 'Capturing 10/20');
  assert.equal(describeEvents(game, [{ type: 'capture', completed: true }]), 'Captured!');
  assert.equal(describeEvents(game, [{ type: 'build', unit: u('tank') }]), 'Built Tank');
  assert.equal(describeEvents(game, [{ type: 'gameOver', winner: 'draw' }]), 'Draw!');
  assert.match(describeEvents(game, [{ type: 'gameOver', winner: 0 }]), /wins!$/);
  assert.equal(describeEvents(game, []), null);
});
