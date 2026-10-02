// Hidden units in the interface: the board does not draw them, taps do not find them, an interrupted move hands the unit back
// to the player for an action, and the order buttons offer Submerge / Surface.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { rawMap } from '../helpers/fixtures.js';
import { Game } from '../../src/engine/game.js';
import { Controller } from '../../src/ui/controller.js';
import { Effects } from '../../src/render/effects.js';
import { MoveAnimator } from '../../src/render/animator.js';
import { Renderer } from '../../src/render/renderer.js';
import { Presenter } from '../../src/ui/presenter.js';
import { describeEvents } from '../../src/ui/messages.js';

const registry = await loadRegistry(readData);
const legend = { '~': { terrain: 'sea' }, o: { terrain: 'shoals' }, '.': { terrain: 'plain' } };
const players = [{ faction: 'ashmark', controller: 'human', funds: 0 }, { faction: 'vantor_reach', controller: 'human', funds: 0 }];

function setup(rows, unitsOnMap) {
  const game = new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));
  const hud = {
    messages: [], acts: null, shown: null,
    message(t) { this.messages.push(t); }, info(o) { this.shown = o; }, actions(a) { this.acts = a; },
    build() {}, focus() {}, clear() { this.acts = null; this.shown = null; },
  };
  const animator = new MoveAnimator();
  const effects = new Effects(registry, (o) => registry.faction(game.map.players[o].faction));
  const presenter = new Presenter({ effects, animator });
  const controller = new Controller({ game, hud, animator, presenter, colorsOf: () => ({ color: '#f00', dark: '#800' }), onEvents: () => {} });
  const finishMove = () => { const c = animator.current; animator.current = null; c.onDone(); };
  const labels = () => hud.acts.items.map((b) => b.label);
  const press = (label) => hud.acts.items.find((b) => b.label === label).onClick();
  return { game, hud, controller, animator, effects, finishMove, labels, press };
}

test('tapping the tile of a hidden enemy submarine finds nothing', () => {
  const t = setup(['~~~~~~', '~~~~~~'], [['cruiser', 0, 0, 0], ['submarine', 1, 4, 0]]);
  t.game.state.units[1].submerged = true;
  t.controller.tap(4, 0);
  assert.equal(t.hud.shown.unit, null, 'no unit card');
  assert.equal(t.controller.mode, 'idle');
});

test('the order window offers Submerge on deep water only, and Surface once down', () => {
  const t = setup(['~~o~~', '~~~~~'], [['submarine', 0, 0, 0], ['cruiser', 1, 4, 1]]);
  t.controller.tap(0, 0);
  t.controller.tap(0, 0);   // confirm "stay here"
  assert.ok(t.labels().includes('Submerge'));
  t.press('Submerge');
  assert.equal(t.game.state.units[0].submerged, true);
  t.game.endTurn(); t.game.endTurn();
  t.controller.tap(0, 0);
  t.controller.tap(0, 0);
  assert.ok(t.labels().includes('Surface') && !t.labels().includes('Submerge'));
});

test('a destroyer is offered no dive', () => {
  const t = setup(['~~~~~', '~~~~~'], [['destroyer', 0, 0, 0], ['cruiser', 1, 4, 1]]);
  t.controller.tap(0, 0);
  t.controller.tap(0, 0);
  assert.ok(!t.labels().includes('Submerge'));
});

test('an interrupted move plays out and leaves the unit selected in its act menu', () => {
  const t = setup(['~~~~~~~~', '~~~~~~~~'], [['destroyer', 0, 0, 1], ['cruiser', 0, 0, 0], ['submarine', 1, 4, 0], ['cruiser', 1, 7, 1]]);
  t.game.state.units[2].submerged = true;
  const cruiser = t.game.state.units[1];
  t.controller.tap(0, 0);
  t.controller.tap(5, 0);            // preview: the plan knows nothing about the sub
  t.finishMove();
  assert.equal(t.controller.mode, 'act');
  t.press('Wait');                   // commit -> interrupted
  assert.equal(t.controller.mode, 'anim');
  assert.match(t.hud.messages.at(-1), /interrupted: hidden Submarine/);
  assert.equal(t.game.canUndo, false);
  t.finishMove();                    // the partial slide ends
  assert.equal(t.controller.mode, 'act');
  assert.equal(t.controller.sel.id, cruiser.id);
  assert.ok(t.labels().includes('Wait'));
  assert.match(t.hud.messages.at(-1), /interrupted/, 'the message survives the menu opening');
  t.press('Wait');
  assert.equal(cruiser.done, true);
});

test('interrupt, dive and surface events have messages', () => {
  const t = setup(['~~~~~~~~'], [['cruiser', 0, 0, 0], ['submarine', 1, 4, 0]]);
  const sub = t.game.state.units[1];
  assert.match(describeEvents(t.game, [{ type: 'dive', unit: { type: 'submarine' } }]), /submerges/);
  assert.match(describeEvents(t.game, [{ type: 'surface', unit: { type: 'submarine' }, forced: true }]), /forced to surface/);
  assert.ok(sub);
});

test('the renderer leaves out units hidden from its viewer, and draws everything without one', () => {
  const t = setup(['~~~~~~', '~~~~~~'], [['cruiser', 0, 0, 0], ['submarine', 1, 4, 0]]);
  t.game.state.units[1].submerged = true;
  const calls = [];
  const ctx = new Proxy({}, { get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push([p, ...a]); return { addColorStop() {} }; }), set: () => true });
  const r = new Renderer({ getContext: () => ctx, style: {}, width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }) }, t.game, t.effects, t.animator);
  assert.equal(r.isShown(t.game.state.units[1]), true, 'no viewer: everything shows');
  r.viewer = 0;
  assert.equal(r.isShown(t.game.state.units[1]), false);
  assert.equal(r.isShown(t.game.state.units[0]), true);
  r.viewer = 1;
  assert.equal(r.isShown(t.game.state.units[1]), true, 'its owner sees it');
  r.viewer = 0;
  r.draw({ selectedId: null, dest: null, reach: null, attackTiles: null, targets: [t.game.state.units[1]], showTargets: true, pendingTargetId: null }, 0);
});

test('a unit that turns hidden finishes diving and then fades out; one that becomes visible fades in', () => {
  const t = setup(['~~~~~~', '~~~~~~'], [['cruiser', 0, 0, 0], ['submarine', 1, 4, 0]]);
  const sub = t.game.state.units[1];
  const ctx = new Proxy({}, { get: (_, p) => (typeof p === 'symbol' ? undefined : () => ({ addColorStop() {} })), set: () => true });
  const r = new Renderer({ getContext: () => ctx, style: {}, width: 0, height: 0, getBoundingClientRect: () => ({ left: 0, top: 0 }) }, t.game, t.effects, t.animator);
  r.viewer = 0;
  const view = { selectedId: null, dest: null, reach: null, attackTiles: null, targets: [], showTargets: false, pendingTargetId: null };
  r.draw(view, 0);
  assert.deepEqual([r.motionOf(sub, 0).dive, r.motionOf(sub, 0).alpha], [0, 1], 'seen on the surface');
  sub.submerged = true;                                  // the enemy dives in view
  r.draw(view, 100);
  const early = r.motionOf(sub, 100);
  assert.ok(early.dive > 0 && early.dive < 1 && early.alpha === 1, 'sinking, still fully drawn');
  for (let now = 200; now <= 1000; now += 100) r.draw(view, now);
  const mid = r.motionOf(sub, 1000);
  assert.equal(mid.dive, 1);
  assert.ok(mid.alpha < 1, 'then fading');
  for (let now = 1100; now <= 2200; now += 100) r.draw(view, now);
  assert.equal(r.motionOf(sub, 2200).alpha, 0, 'gone');
  sub.submerged = false;                                 // it comes back up in view
  for (let now = 2300; now <= 2800; now += 100) r.draw(view, now);
  assert.equal(r.motionOf(sub, 2800).alpha, 1);
});

test('a ship built at a shipyard is selected for its free move off the yard, and cannot attack', () => {
  const legend2 = { ...legend, '.': { terrain: 'plain' }, Y: { terrain: 'shipyard', owner: 0 }, h: { terrain: 'hq', owner: 1 } };
  const game = new Game(registry, parseMap(rawMap({ rows: ['.Y~', '.~~'], unitsOnMap: [], players, legend: legend2 }), registry));
  game.state.funds[0] = 50000;
  const hud = { messages: [], acts: null, built: null, message(t) { this.messages.push(t); }, info() {}, actions(a) { this.acts = a; }, build(m, o) { this.built = m ? { m, ...o } : null; }, focus() {}, clear() { this.acts = null; this.built = null; } };
  const animator = new MoveAnimator();
  const presenter = new Presenter({ effects: new Effects(registry, () => ({ color: '#f00' })), animator });
  const controller = new Controller({ game, hud, animator, presenter, colorsOf: () => ({ color: '#f00', dark: '#800' }), onEvents: () => {} });
  controller.tap(1, 0);
  hud.built.onBuild('destroyer');
  const ship = game.state.units[0];
  assert.deepEqual([ship.x, ship.y], [1, 0], 'built on the shipyard');
  assert.equal(controller.mode, 'move');
  assert.equal(controller.view.selectedId, ship.id);
  assert.ok(controller.view.reach.has(2, 0), 'it can sail off');
  assert.equal(controller.view.attackTiles, null);
});

test('a transport copter offers Deploy before it moves; the soldier is placed on it and moved with the normal interface', () => {
  const t = setup(['..~..', '.....'], [['transport_copter', 0, 1, 0], ['recon', 1, 4, 1]]);
  t.controller.tap(1, 0);
  assert.ok(t.labels().includes('Deploy Soldier'), 'in the first window, before any move');
  t.press('Deploy Soldier');
  const soldier = t.game.state.units.find((u) => u.type === 'soldier');
  assert.deepEqual([soldier.x, soldier.y], [1, 0], 'placed on the copter');
  assert.equal(t.controller.mode, 'move', 'selected for an ordinary move');
  assert.equal(t.controller.view.selectedId, soldier.id);
  t.controller.tap(1, 1);
  t.finishMove();
  assert.equal(t.controller.mode, 'act');
  t.press('Wait');
  assert.equal(soldier.y, 1);
  assert.equal(soldier.done, true);
  assert.equal(t.game.state.units[0].done, false, 'the copter keeps its own order');
});

test('cancelling a freshly deployed soldier puts it back into the copter', () => {
  const t = setup(['.....', '.....'], [['transport_copter', 0, 1, 0], ['recon', 1, 4, 1]]);
  t.controller.tap(1, 0);
  t.press('Deploy Soldier');
  assert.equal(t.game.state.units.length, 3);
  t.press('Cancel');
  assert.equal(t.game.state.units.length, 2);
  assert.equal(t.game.state.units[0].ammo, 2);
  // also after a previewed move
  t.controller.tap(1, 0);
  t.press('Deploy Soldier');
  t.controller.tap(2, 1);
  t.finishMove();
  t.press('Cancel');
  assert.equal(t.game.state.units.length, 2);
});

test('after the copter has moved and waited it can still be tapped to deploy', () => {
  const t = setup(['.....', '.....'], [['transport_copter', 0, 1, 0], ['recon', 1, 4, 1]]);
  t.game.act({ unitId: t.game.state.units[0].id, to: { x: 1, y: 0 }, action: { type: 'wait' } });
  t.controller.tap(1, 0);
  assert.equal(t.controller.mode, 'idle');
  assert.ok(t.labels().includes('Deploy Soldier'));
  t.press('Deploy Soldier');
  assert.equal(t.controller.mode, 'move');
  assert.equal(t.game.state.units.length, 3);
});

test('a copter that is out of ammo is not offered Deploy', () => {
  const t = setup(['.....', '.....'], [['transport_copter', 0, 1, 0], ['recon', 1, 4, 1]]);
  t.game.state.units[0].ammo = 0;
  t.controller.tap(1, 0);
  assert.ok(!t.labels().some((l) => l.startsWith('Deploy')));
});

test('Wait is replaced by a priced Resupply next to an airfield; without the money it says so and waits', () => {
  const rows = ['A....', '.....'];
  const make = (ammo, funds) => {
    const g = new Game(registry, parseMap(rawMap({ rows, unitsOnMap: [['transport_copter', 0, 2, 0], ['recon', 1, 4, 1]], players: players.map((p, i) => (i === 0 ? { ...p, funds } : p)), legend: { ...legend, A: { terrain: 'airfield', owner: 0 } } }), registry));
    g.state.units[0].ammo = ammo;
    return g;
  };
  for (const [ammo, funds, label] of [[0, 5000, 'Resupply 2,000'], [2, 5000, 'Wait'], [0, 500, 'Resupply 2,000']]) {
    const game = make(ammo, funds);
    const hud = { messages: [], acts: null, shown: null, message(t) { this.messages.push(t); }, info(o) { this.shown = o; }, actions(a) { this.acts = a; }, build() {}, focus() {}, clear() { this.acts = null; } };
    const animator = new MoveAnimator();
    const c = new Controller({ game, hud, animator, presenter: new Presenter({ effects: new Effects(registry, () => ({ color: '#f00' })), animator }), colorsOf: () => ({ color: '#f00', dark: '#800' }), onEvents: () => {} });
    c.tap(2, 0); c.tap(1, 0);   // preview a move to the tile next to the airfield
    const cur = animator.current; animator.current = null; cur.onDone();
    const labels = hud.acts.items.map((b) => b.label);
    assert.ok(labels.includes(label) && !(label !== 'Wait' && labels.includes('Wait')), `${ammo} ammo offers ${label}`);
    if (label !== 'Wait') {
      hud.acts.items.find((b) => b.label === label).onClick();
      assert.equal(c.mode, 'idle', 'it ends the turn');
      assert.equal(game.state.units[0].done, true);
      if (funds >= 2000) { assert.equal(game.state.units[0].ammo, 2); assert.equal(game.state.funds[0], funds - 2000); }
      else { assert.equal(game.state.units[0].ammo, 0); assert.equal(hud.messages.at(-1), 'Not enough credits'); }
    }
  }
});
