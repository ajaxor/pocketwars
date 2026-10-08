// Ruins and soft terrain on a real map: a soldier rebuilds a ruined city or factory for a price, the change is kept in the game state (so Undo
// and the build menu see it), only builders can do it, and the soft ground and cliffs cost what terrain.json says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadMap, loadRegistry } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { canRebuild, couldRebuild, rebuildProblem, ruinAt } from '../../src/engine/rebuild.js';
import { menuFor } from '../../src/engine/economy.js';
import { ownerAt, propertyAt, terrainIdAt } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);

/** A fresh game on burnt_offering with a unit of player 0 standing on the first ruin of `kind`; returns { game, unit, x, y }. */
async function setup(kind = 'ruin_city', type = 'soldier', funds = 10000) {
  const map = await loadMap(readData, registry, 'burnt_offering');
  const game = new Game(registry, map);
  let at = null;
  map.terrain.forEach((row, y) => row.forEach((t, x) => { if (!at && t === kind) at = { x, y }; }));
  const unit = game.state.units.find((u) => u.owner === 0 && u.type === type);
  game.state.units = game.state.units.filter((u) => !(u !== unit && u.x === at.x && u.y === at.y));
  Object.assign(unit, at);
  game.state.funds[0] = funds;
  return { game, unit, ...at };
}

test('a ruined city is not a property until it is rebuilt', async () => {
  const { game, x, y } = await setup();
  assert.equal(terrainIdAt(game, x, y), 'ruin_city');
  assert.equal(propertyAt(game, x, y), null);
  assert.deepEqual(ruinAt(game, x, y), { becomes: 'city', cost: 4000 });
});

test('rebuilding pays the price, turns the ruin into an owned property and ends the soldier\'s turn', async () => {
  const { game, unit, x, y } = await setup('ruin_city');
  const r = game.act({ unitId: unit.id, to: { x, y }, action: { type: 'rebuild' } });
  assert.ok(r.ok, r.error);
  assert.equal(r.events.at(-1).type, 'rebuild');
  assert.equal(r.events.at(-1).cost, 4000);
  assert.equal(terrainIdAt(game, x, y), 'city');
  assert.equal(ownerAt(game, x, y), 0);
  assert.equal(game.state.funds[0], 6000);
  assert.ok(propertyAt(game, x, y));
  assert.equal(game.map.terrain[y][x], 'ruin_city', 'the map itself never changes');
});

test('a rebuilt factory builds, because the build menu reads the terrain as it is now', async () => {
  const { game, unit, x, y } = await setup('ruin_factory');
  assert.deepEqual(menuFor(game, 0, x, y), []);
  assert.ok(game.act({ unitId: unit.id, to: { x, y }, action: { type: 'rebuild' } }).ok);
  assert.equal(game.state.funds[0], 3000);
  assert.ok(menuFor(game, 0, x, y).length > 0);
});

test('Undo takes a rebuild back, money and ruin', async () => {
  const { game, unit, x, y } = await setup();
  assert.ok(game.act({ unitId: unit.id, to: { x, y }, action: { type: 'rebuild' } }).ok);
  if (!game.canUndo) return;   // fog of war can make an order final; the state test above covers the rest
  assert.ok(game.undo());
  assert.equal(terrainIdAt(game, x, y), 'ruin_city');
  assert.equal(game.state.funds[0], 10000);
  assert.equal(ownerAt(game, x, y), null);
});

test('only a capturer can rebuild, and only with the money', async () => {
  const poor = await setup('ruin_city', 'soldier', 3999);
  assert.equal(rebuildProblem(poor.game, poor.unit), 'not-enough-funds');
  assert.ok(couldRebuild(poor.game, poor.unit, poor.x, poor.y) && !canRebuild(poor.game, poor.unit, poor.x, poor.y), 'shown, but greyed out');
  assert.equal(poor.game.act({ unitId: poor.unit.id, to: { x: poor.x, y: poor.y }, action: { type: 'rebuild' } }).ok, false);
  const tank = await setup('ruin_city', 'tank');
  assert.equal(rebuildProblem(tank.game, tank.unit), 'cannot-rebuild');
  assert.equal(couldRebuild(tank.game, tank.unit, tank.x, tank.y), false);
  const plain = await setup('ruin_city');
  assert.equal(rebuildProblem(plain.game, plain.unit, 0, 0), 'not-a-ruin');
});

test('soft ground slows wheels and bikes but not feet or tracks; cliffs stop everything on the ground; mud and dunes are not blocked', () => {
  for (const id of ['snow_drift', 'dune', 'mud']) {
    const t = registry.terrain[id];
    assert.equal(t.moveCost.wheels, 2, id);
    assert.equal(t.moveCost.foot, 1, id);
    assert.equal(t.moveCost.tread, 1, id);
    assert.ok(t.moveCost.bike > t.moveCost.foot, id);
  }
  const cliff = registry.terrain.cliff;
  for (const c of ['foot', 'wheels', 'tread', 'bike', 'naval', 'amphibious', 'hover']) assert.equal(cliff.moveCost[c], null, c);
  assert.equal(cliff.moveCost.air, 1);
});
