// The Transfer order in the interface: offered in place of nothing else (next to Wait) when an infantryman stands on a property of its owner
// and has an empty city of theirs to go to; it highlights the cities and the next tap on one sends the unit there.
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
import { Presenter } from '../../src/ui/presenter.js';
import { describeEvents } from '../../src/ui/messages.js';

const registry = await loadRegistry(readData);
const legend = { '.': { terrain: 'plain' }, c: { terrain: 'city', owner: 0 }, d: { terrain: 'city', owner: 0 }, H: { terrain: 'hq', owner: 0 }, h: { terrain: 'hq', owner: 1 } };
const players = [{ faction: 'ashmark', controller: 'human', funds: 0 }, { faction: 'vantor_reach', controller: 'human', funds: 0 }];

function setup(rows, unitsOnMap) {
  const game = new Game(registry, parseMap(rawMap({ rows, unitsOnMap, players, legend }), registry));
  const hud = { acts: null, messages: [], message(t) { this.messages.push(t); }, info() {}, actions(a) { this.acts = a; }, build() {}, focus() {}, clear() { this.acts = null; } };
  const animator = new MoveAnimator();
  const presenter = new Presenter({ effects: new Effects(registry, (o) => registry.faction(game.map.players[o].faction)), animator });
  const controller = new Controller({ game, hud, animator, presenter, colorsOf: () => ({ color: '#f00', dark: '#800' }), onEvents: () => {} });
  return { game, hud, controller, labels: () => hud.acts.items.map((b) => b.label), press: (label) => hud.acts.items.find((b) => b.label === label).onClick() };
}

test('an infantryman on a city with another empty city of its owner is offered Transfer; the next tap on a highlighted city sends it there', () => {
  const t = setup(['Hcd......h', '..........'], [['soldier', 0, 1, 0], ['soldier', 1, 9, 1]]);
  t.controller.tap(1, 0);   // select the soldier
  t.controller.tap(1, 0);   // stay where it is: the order menu
  assert.ok(t.labels().includes('Transfer'), t.labels().join(', '));
  assert.ok(t.labels().includes('Wait'));
  t.press('Transfer');
  assert.equal(t.controller.mode, 'transfer');
  assert.deepEqual(t.controller.view.layTiles, [{ x: 2, y: 0 }], 'the one empty city of its own');
  t.controller.tap(5, 1);   // elsewhere: back to the order menu
  assert.ok(t.labels().includes('Transfer'));
  t.press('Transfer');
  t.controller.tap(2, 0);
  const s = t.game.state.units[0];
  assert.deepEqual([s.x, s.y, s.done], [2, 0, true]);
  assert.equal(t.hud.messages.at(-1), 'Soldier transferred');
});

test('no Transfer on open ground, for a vehicle, or when there is no empty city to go to', () => {
  const open = setup(['Hcd......h', '..........'], [['soldier', 0, 4, 0], ['soldier', 1, 9, 1]]);
  open.controller.tap(4, 0); open.controller.tap(4, 0);
  assert.ok(!open.labels().includes('Transfer'), 'not on a property');
  const tank = setup(['Hcd......h', '..........'], [['tank', 0, 1, 0], ['soldier', 1, 9, 1]]);
  tank.controller.tap(1, 0); tank.controller.tap(1, 0);
  assert.ok(!tank.labels().includes('Transfer'), 'a vehicle');
  const full = setup(['Hcd......h', '..........'], [['soldier', 0, 1, 0], ['soldier', 0, 2, 0], ['soldier', 1, 9, 1]]);
  full.controller.tap(1, 0); full.controller.tap(1, 0);
  assert.ok(!full.labels().includes('Transfer'), 'the only other city is taken');
});

test('describeEvents names a transfer', () => {
  const g = setup(['Hcd......h', '..........'], [['soldier', 0, 1, 0], ['soldier', 1, 9, 1]]).game;
  const res = g.act({ unitId: g.state.units[0].id, to: { x: 1, y: 0 }, action: { type: 'transfer', at: { x: 2, y: 0 } } });
  assert.equal(describeEvents(g, res.events), 'Soldier transferred');
});
