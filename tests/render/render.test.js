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
import { drawBubble } from '../../src/render/bubble.js';
import { AMMO_BLINK_MS, drawUnit } from '../../src/render/unit-sprites.js';
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
  assert.ok(calls.filter((c) => c === 'fill').length >= game.map.width * game.map.height);
});

test('a building is drawn faintly only while a unit of its owner stands on it', () => {
  const { renderer, game } = rig();
  const props = [];
  game.map.terrain.forEach((row, y) => row.forEach((t, x) => { if (game.registry.terrainDef(t).attributes.property) props.push({ x, y, owner: game.state.owners[y][x] }); }));
  const key = (q) => q.y * game.map.width + q.x;
  const ownProps = props.filter((q) => q.owner === 0);
  const theirs = props.find((q) => q.owner === 1), neutral = props.find((q) => q.owner === null);
  const [a, b, c] = game.state.units.filter((u) => u.owner === 0);
  const enemy = game.state.units.find((u) => u.owner === 1);
  const put = (u, q) => { u.x = q.x; u.y = q.y; };
  put(a, ownProps[0]); put(b, neutral); put(c, theirs); put(enemy, ownProps[1]);
  const dim = renderer.dimmedTiles(emptyView);
  assert.deepEqual([...dim], [key(ownProps[0])], 'only the own unit on its own property');
  // a previewed move counts at its destination, not at the tile the unit is leaving
  const view = { ...emptyView, selectedId: a.id, dest: { x: ownProps[2].x, y: ownProps[2].y } };
  assert.deepEqual([...renderer.dimmedTiles(view)], [key(ownProps[2])]);
});

test('a unit that is sliding does not dim the property it is heading for until it arrives', () => {
  const { renderer, game, animator } = rig();
  const mine = []; game.map.terrain.forEach((row, y) => row.forEach((t, x) => { if (game.registry.terrainDef(t).attributes.property && game.state.owners[y][x] === 0) mine.push({ x, y }); }));
  const u = game.state.units.find((q) => q.owner === 0);
  u.x = mine[0].x; u.y = mine[0].y;
  assert.ok(renderer.dimmedTiles(emptyView).has(mine[0].y * game.map.width + mine[0].x));
  animator.start(u.id, [[0, 0], [u.x, u.y]], 0);
  assert.ok(!renderer.dimmedTiles(emptyView).has(mine[0].y * game.map.width + mine[0].x));
});

test('selection overlays draw (reach, attack outline, targets, pending target)', () => {
  const { renderer, game } = rig();
  const unit = game.state.units.find((u) => u.owner === 0);
  const enemy = game.state.units.find((u) => u.owner === 1);
  const attack = new Set([0, 1, 2, 12]);
  renderer.draw({ ...emptyView, selectedId: unit.id, attackTiles: attack, targets: [enemy], showTargets: true, pendingTargetId: enemy.id }, 1000);
});

test('the board and its selection overlays draw', () => {
  const game = new Game(registry, classic);
  const { ctx } = recorder();
  const effects = new Effects(registry, (o) => registry.faction(game.map.players[o].faction));
  const renderer = new Renderer(canvasWith(ctx), game, effects, new MoveAnimator());
  const unit = game.state.units.find((u) => u.owner === 0);
  const enemy = game.state.units.find((u) => u.owner === 1);
  const reach = { tiles: () => [{ x: 1, y: 1 }, { x: 2, y: 1 }] };
  renderer.draw({ ...emptyView, selectedId: unit.id, reach, attackTiles: new Set([0, 1]), targets: [enemy], showTargets: true, pendingTargetId: enemy.id }, 1000);
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
  for (const [type, kind] of [['soldier', 'lunge'], ['tank', 'shot'], ['artillery', 'shot']]) {
    effects.clear();
    effects.strike({ attacker: at(type), defender: def, damage: 3, destroyed: false }, 0);
    assert.ok(effects.list.some((f) => f.k === kind), `${type} -> ${kind}`);
  }
  assert.ok(effects.list.find((f) => f.k === 'shot').arc, 'artillery shells arc');
  effects.clear();
  effects.strike({ attacker: at('bomber'), defender: def, damage: 3, destroyed: false }, 0);
  assert.ok(effects.list.some((f) => f.k === 'bomb'), 'bombers drop bombs');
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
  assert.equal(describeEvents(game, [{ type: 'strike', attacker: u('tank'), defender: u('soldier'), damage: 7, destroyed: false }]), 'Tank hits Soldier -7');
  assert.match(describeEvents(game, [
    { type: 'strike', attacker: u('tank'), defender: u('soldier'), damage: 10, destroyed: true },
    { type: 'strike', counter: true, attacker: u('soldier'), defender: u('tank'), damage: 1, destroyed: false },
  ]), /destroyed!, counter -1/);
  assert.equal(describeEvents(game, [{ type: 'capture', completed: false, progress: 10, needed: 20 }]), 'Capturing 10/20');
  assert.equal(describeEvents(game, [{ type: 'capture', completed: true }]), 'Captured!');
  assert.equal(describeEvents(game, [{ type: 'build', unit: u('tank') }]), 'Built Tank');
  assert.equal(describeEvents(game, [{ type: 'gameOver', winner: 'draw' }]), 'Draw!');
  assert.match(describeEvents(game, [{ type: 'gameOver', winner: 0 }]), /wins!$/);
  assert.equal(describeEvents(game, []), null);
});

// ---- layout: the canvas covers the window, the map is centred below the status bar ------------------------------------------
function withWindow(w, h, dpr, fn) {
  const keep = { innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight, devicePixelRatio: globalThis.devicePixelRatio };
  Object.assign(globalThis, { innerWidth: w, innerHeight: h, devicePixelRatio: dpr });
  try { fn(); } finally {
    for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
}

test('on a phone the map is as wide as the window and sits centred below the status bar', () => {
  withWindow(400, 800, 2, () => {
    const { renderer } = rig();
    renderer.fit({ top: 50 });          // the classic map is 10 x 11
    assert.equal(renderer.tileSize, 40);
    assert.deepEqual(renderer.tileRect(0, 0), { left: 0, top: 205, size: 40 });
    assert.deepEqual(renderer.layout, { W: 400, H: 800, ox: 0, oy: 205, d: 2 });
    assert.deepEqual([renderer.cv.width, renderer.cv.height], [800, 1600], 'the canvas is the whole window, in device pixels');
  });
});

test('on a wide window the height decides the tile size and the map is centred sideways', () => {
  withWindow(1200, 800, 1, () => {
    const { renderer } = rig();
    renderer.fit({ top: 50 });
    assert.equal(renderer.tileSize, 68);            // 750 px of height for 11 rows
    assert.equal(renderer.layout.ox, 260);          // (1200 - 680) / 2
    assert.equal(renderer.layout.oy, 50 + Math.floor((750 - 11 * 68) / 2));
  });
});

test('taps are turned into map tiles through the offset; taps beside the map land outside it', () => {
  withWindow(400, 800, 1, () => {
    const { renderer, game } = rig();
    renderer.fit({ top: 50 });
    const r = renderer.tileRect(3, 4);
    assert.deepEqual(renderer.tileAt(r.left + 5, r.top + 5), { x: 3, y: 4 });
    assert.deepEqual(renderer.tileAt(r.left + 39, r.top + 39), { x: 3, y: 4 });
    assert.ok(renderer.tileAt(10, 10).y < 0, 'above the map');
    assert.ok(renderer.tileAt(10, 790).y >= game.map.height, 'below the map');
  });
});

test('each frame clears the whole window and then draws in map coordinates', () => {
  withWindow(400, 800, 1, () => {
    const { renderer, calls } = rig();
    renderer.fit({ top: 50 });
    renderer.draw(emptyView, 0);
    assert.ok(calls.indexOf('clearRect') >= 0 && calls.indexOf('clearRect') < calls.indexOf('fill'));
    assert.equal(calls.filter((c) => c === 'setTransform').length, 2);
  });
});

test('the tapped-tile cursor draws only while nothing is selected', () => {
  const { renderer, calls, game } = rig();
  renderer.draw({ ...emptyView, cursor: { x: 1, y: 1 } }, 0);
  const withCursor = calls.filter((c) => c === 'stroke').length;
  calls.length = 0;
  renderer.draw({ ...emptyView, cursor: { x: 1, y: 1 }, selectedId: game.state.units[0].id }, 0);
  const selected = calls.filter((c) => c === 'stroke').length;
  calls.length = 0;
  renderer.draw(emptyView, 0);
  assert.equal(withCursor, calls.filter((c) => c === 'stroke').length + 1, 'one outline for the cursor');
  assert.ok(selected >= 1);
});

test('income floats up from every property that paid, one after another, without locking input', () => {
  const { effects, presenter } = rig();
  presenter.present([{ type: 'turnStart', player: 0, day: 2, income: 2000, incomes: [{ x: 1, y: 2, amount: 1000 }, { x: 4, y: 5, amount: 1000 }], repaired: [] }], { now: 100 });
  const floats = effects.list.filter((f) => f.k === 'txt');
  assert.deepEqual(floats.map((f) => [f.s, f.x, f.t0]), [['+1000', 1.5, 100], ['+1000', 4.5, 240]]);
  assert.ok(!effects.isLocked(150));
});

test('the ammo bullet flashes when low (every other beat), stays on when empty, and draws nothing for plenty', () => {
  const draws = (level, now) => {
    const { ctx, calls } = recorder();
    drawUnit(ctx, { type: 'transport_copter', x: 1, y: 1, hp: 10 }, { def: registry.unit('transport_copter'), colors: registry.faction(classic.players[0].faction), px: 40, py: 40, size: 40, now, animate: true, moving: false, alpha: 1, showHp: true, ammo: level });
    return calls.filter((c) => c === 'quadraticCurveTo').length;
  };
  const none = draws(null, 0);
  assert.ok(draws('empty', 0) > none && draws('empty', AMMO_BLINK_MS) > none, 'steady');
  assert.ok(draws('low', 0) > none, 'on');
  assert.equal(draws('low', AMMO_BLINK_MS), none, 'off');
});

test('a marine is drawn as a dinghy on water', () => {
  const { ctx } = recorder();
  const o = { def: registry.unit('marine'), colors: registry.faction(classic.players[0].faction), px: 40, py: 40, size: 40, now: 500, animate: true, moving: false, alpha: 1, showHp: true };
  drawUnit(ctx, { type: 'marine', x: 1, y: 1, hp: 10 }, { ...o, onWater: true });
  assert.ok(registry.unit('marine').render.waterSprite, 'the data names the water sprite');
});

test('an attacker keeps its old HP digit until the counterattack has landed, and the target until the first blow lands', () => {
  const { effects } = rig();
  const a = { id: 1, type: 'soldier', owner: 0, x: 1, y: 1, hp: 6 };   // snapshots are taken as the engine goes: the attacker before the counter...
  const d = { id: 2, type: 'soldier', owner: 1, x: 2, y: 1, hp: 4 };
  const t = effects.strike({ type: 'strike', attacker: a, defender: d, damage: 5, counter: false, destroyed: false, weapon: null }, 1000);
  effects.strike({ type: 'strike', attacker: d, defender: { ...a, hp: 3 }, damage: 3, counter: true, destroyed: false, weapon: null }, t);   // ...and after it
  const attacker = { id: 1, hp: 3 };   // the game already holds the final HP
  const target = { id: 2, hp: 4 };
  assert.equal(effects.displayHp(attacker, 1100), 6, 'still the old HP while the first blow flies');
  assert.equal(effects.displayHp(target, 1100), 9, 'the target has not been hit yet');
  assert.equal(effects.displayHp(target, 1300), 4, 'it has, once the blow lands');
  assert.equal(effects.displayHp(attacker, 1300), 6, 'but the attacker waits for the counter');
  assert.equal(effects.displayHp(attacker, t + 1000), 3, 'and drops once the counter has landed');
});

test('a damage bubble draws on a tile', () => {
  const { ctx, calls } = recorder();
  drawBubble(ctx, 80, 40, 40, '-4', '#d62828');
  assert.ok(calls.includes('fill') && calls.includes('stroke'));
});
