// What the human sees of the computer's turn (src/ui/ai-visibility.js): nothing that happens in the fog or under the water.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { Game } from '../../src/engine/game.js';
import { seesTile, visibleEvents } from '../../src/ui/ai-visibility.js';

const registry = await loadRegistry(readData);
const LEGEND = { '.': { terrain: 'plain' }, '~': { terrain: 'sea' }, A: { terrain: 'hq', owner: 0 }, B: { terrain: 'hq', owner: 1 } };
const game = (tiles, units) => new Game(registry, parseMap({
  format: 'pocketwars-map', version: 1, id: 'vis', name: 'Vis',
  players: [{ faction: 'ashmark', controller: 'human', funds: 0 }, { faction: 'vantor_reach', controller: 'ai', funds: 0 }],
  legend: LEGEND, tiles, units,
}, registry));
const u = (type, owner, x, y) => ({ type, owner, x, y });
const snap = (g, x, y) => { const v = g.state.units.find((w) => w.x === x && w.y === y); return { id: v.id, x: v.x, y: v.y }; };

// the human's soldier is at (1,0): it sees 2 tiles. The computer's units are at (3,0) (in sight) and (11,0) (deep in the fog); a jammer turns fog on.
const world = () => game(['A' + '.'.repeat(11) + 'B', '.'.repeat(13)], [u('soldier', 0, 1, 0), u('soldier', 1, 3, 0), u('soldier', 1, 11, 0), u('soldier', 1, 12, 0), u('jammer', null, 6, 1)]);

test('tiles in the fog are not seen; without fog everything is', () => {
  const g = world();
  assert.equal(seesTile(g, 0, 2, 0), true);
  assert.equal(seesTile(g, 0, 11, 0), false);
  const clear = game(['A' + '.'.repeat(11) + 'B'], [u('soldier', 0, 1, 0), u('soldier', 1, 11, 0)]);
  assert.equal(seesTile(clear, 0, 11, 0), true);
});

test('a fight deep in the fog is not shown, one the human can see is, and so is one that strikes into view', () => {
  const g = world();
  const far = snap(g, 11, 0), far2 = snap(g, 12, 0), near = snap(g, 3, 0), mine = snap(g, 1, 0);
  const strike = (attacker, defender) => ({ type: 'strike', attacker, defender });
  assert.equal(visibleEvents(g, 0, [strike(far, far2)]).length, 0);
  assert.equal(visibleEvents(g, 0, [strike(near, mine)]).length, 1);
  assert.equal(visibleEvents(g, 0, [strike(far, mine)]).length, 1, 'artillery in the fog hitting a visible unit is shown');
});

test('captures in the fog raise no flag; mines going down are never shown', () => {
  const g = world();
  assert.equal(visibleEvents(g, 0, [{ type: 'capture', x: 12, y: 0 }]).length, 0);
  assert.equal(visibleEvents(g, 0, [{ type: 'capture', x: 2, y: 0 }]).length, 1);
  assert.equal(visibleEvents(g, 0, [{ type: 'lay', at: { x: 2, y: 0 } }]).length, 0);
});

test('a move of a unit the human cannot see is hidden; one it saw before the order is shown, and so are unrelated events', () => {
  const g = world();
  const far = g.state.units.find((v) => v.x === 11);
  const near = g.state.units.find((v) => v.x === 3);
  assert.equal(visibleEvents(g, 0, [{ type: 'move', unitId: far.id }]).length, 0);
  assert.equal(visibleEvents(g, 0, [{ type: 'move', unitId: far.id }], true).length, 1, 'it was in sight when it started');
  assert.equal(visibleEvents(g, 0, [{ type: 'move', unitId: near.id }]).length, 1);
  assert.equal(visibleEvents(g, 0, [{ type: 'income' }]).length, 1);
});

test('a submarine under the water nobody watches neither dives nor surfaces on screen', () => {
  const g = game(['A' + '.'.repeat(11) + 'B', '~'.repeat(13)], [u('soldier', 0, 1, 0), u('submarine', 1, 9, 1)]);
  const sub = g.state.units.find((v) => v.type === 'submarine');
  sub.submerged = true;
  g.touch();
  const surface = { type: 'surface', unit: { id: sub.id } };
  assert.equal(visibleEvents(g, 0, [surface]).length, 0, 'unseen, so no animation gives it away');
  assert.equal(visibleEvents(g, 0, [surface], true).length, 1, 'a sub the human could see before the order is shown coming up');
  sub.x = 1; sub.y = 1;   // right next to the human's soldier: noticed
  g.touch();
  assert.equal(visibleEvents(g, 0, [{ type: 'dive', unit: { id: sub.id } }]).length, 1);
});
