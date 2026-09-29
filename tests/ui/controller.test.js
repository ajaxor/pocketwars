// Drives the input controller with a fake HUD: taps in, orders / messages / buttons out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from '../helpers/fixtures.js';
import { Controller } from '../../src/ui/controller.js';
import { MoveAnimator } from '../../src/render/animator.js';

function setup(opts) {
  const game = makeGame(opts);
  const hud = { messages: [], last: [], message(t) { this.messages.push(t); }, buttons(b) { this.last = b; } };
  const presented = [];
  const events = [];
  const animator = new MoveAnimator();
  const controller = new Controller({
    game, hud, animator, presenter: { present: (ev) => presented.push(...ev) },
    colorsOf: () => ({ color: '#f00', dark: '#800' }), onEvents: (ev) => events.push(...ev),
  });
  const finishMove = () => { const c = animator.current; animator.current = null; c.onDone(); };
  const press = (label) => hud.last.find((b) => b.label === label || b.label.startsWith(label)).onClick();
  return { game, hud, controller, animator, events, presented, finishMove, press, lastMsg: () => hud.messages.at(-1) };
}

const duelMap = { rows: ['.....'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 4, 0]] };

test('tapping a ready unit selects it and highlights its reach', () => {
  const t = setup(duelMap);
  t.controller.tap(0, 0);
  assert.equal(t.controller.mode, 'move');
  assert.equal(t.controller.view.selectedId, t.game.state.units[0].id);
  assert.ok(t.controller.view.reach.has(2, 0));
  assert.ok(!t.controller.view.reach.has(4, 0));
});

test('move preview leaves game state untouched until the order is committed', () => {
  const t = setup(duelMap);
  t.controller.tap(0, 0); t.controller.tap(2, 0);
  assert.equal(t.controller.mode, 'anim');
  assert.deepEqual(t.game.state.units[0].x, 0, 'engine has not moved the unit');
  t.finishMove();
  assert.equal(t.controller.mode, 'act');
  assert.deepEqual(t.controller.view.dest, { x: 2, y: 0 });
  t.press('Wait');
  assert.equal(t.game.state.units[0].x, 2);
  assert.equal(t.controller.mode, 'idle');
  assert.ok(t.game.state.units[0].done);
});

test('Cancel abandons the preview without touching the game', () => {
  const t = setup(duelMap);
  t.controller.tap(0, 0); t.controller.tap(2, 0); t.finishMove();
  t.press('Cancel');
  assert.equal(t.controller.mode, 'idle');
  assert.equal(t.game.state.units[0].x, 0);
  assert.deepEqual(t.hud.last, []);
});

test('taps are ignored while the unit is sliding', () => {
  const t = setup(duelMap);
  t.controller.tap(0, 0); t.controller.tap(2, 0);
  t.controller.tap(1, 0);
  assert.equal(t.controller.mode, 'anim');
});

test('attacking takes two taps: preview the target, then confirm', () => {
  const t = setup({ rows: ['...'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 2, 0]] });
  t.controller.tap(0, 0);
  t.controller.tap(2, 0); // enemy in reach -> walks to the best attack tile
  t.finishMove();
  assert.equal(t.controller.view.pendingTargetId, t.game.state.units[1].id);
  assert.match(t.lastMsg(), /Tap it again to confirm/);
  assert.equal(t.game.state.units[1].hp, 10);
  t.controller.tap(2, 0); // confirm
  assert.ok(t.game.state.units[1].hp < 10);
  assert.ok(t.events.some((e) => e.type === 'strike'));
  assert.equal(t.controller.mode, 'idle');
});

test('a capturer standing on an enemy property is captured with one tap on itself', () => {
  const t = setup({
    units: { a: { attributes: { capture: true } }, b: {} }, rows: ['c..b'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 3, 0]],
  });
  t.controller.tap(0, 0);
  t.controller.tap(0, 0);
  assert.ok(t.events.some((e) => e.type === 'capture'));
  assert.equal(t.game.state.units[0].capture, 10);
});

test('enemy or exhausted units only show info', () => {
  const t = setup(duelMap);
  t.controller.tap(4, 0);
  assert.equal(t.controller.mode, 'idle');
  assert.match(t.lastMsg(), /HP 10/);
});

test('tapping an owned factory opens the build menu; buying spends funds and closes it', () => {
  const t = setup({ units: { a: { cost: 1000 }, b: {} }, rows: ['a..b'], unitsOnMap: [['b', 1, 3, 0]], terrain: {}, ai: undefined });
  t.game.state.funds[0] = 3000;
  t.controller.tap(0, 0);
  assert.equal(t.controller.mode, 'build');
  t.press('Unit'); // first button
  assert.equal(t.game.state.units.filter((u) => u.owner === 0).length, 1);
  assert.equal(t.game.state.funds[0], 2000);
  assert.equal(t.controller.mode, 'idle');
});

test('the build menu dims units the player cannot afford and refuses them', () => {
  const t = setup({ rows: ['a..b'], unitsOnMap: [['b', 1, 3, 0]] });
  t.game.state.funds[0] = 0;
  t.controller.tap(0, 0);
  assert.ok(t.hud.last.filter((b) => b.dim).length >= 1);
  t.hud.last[0].onClick();
  assert.match(t.lastMsg(), /Not enough funds/);
  assert.equal(t.game.state.units.length, 1);
});

test('taps outside the board are ignored', () => {
  const t = setup(duelMap);
  t.controller.tap(-1, 0); t.controller.tap(0, 99);
  assert.equal(t.controller.mode, 'idle');
});
