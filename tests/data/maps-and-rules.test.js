// The shipped movement rules and every shipped map: loads, is fair enough to play, and an AI-vs-AI game runs without a bad order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { playTurn } from '../../src/engine/ai.js';
import { allProperties, tileIndex } from '../../src/engine/queries.js';
import { distanceField } from '../../src/engine/movement.js';
import { parseMap, serializeMap } from '../../src/data/map-format.js';
import { roadShape, TERRAIN_DECOR } from '../../src/render/terrain-art.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);
const ids = Object.keys(index.maps);
const cost = (terrain, cls) => registry.terrainDef(terrain).moveCost[cls];

test('movement classes: wheels, treads, foot and air', () => {
  assert.deepEqual(registry.rules.moveClasses, ['foot', 'wheels', 'tread', 'air', 'naval', 'amphibious', 'bike', 'diver', 'hover', 'amphibious_tread']);
  assert.equal(registry.unit('recon').moveClass, 'wheels');
  for (const u of ['tank', 'heavy_tank', 'flak']) assert.equal(registry.unit(u).moveClass, 'tread', u);
  assert.equal(registry.unit('artillery').moveClass, 'wheels');
  for (const u of ['recon', 'tank', 'heavy_tank', 'artillery', 'flak']) assert.ok(registry.unit(u).move <= 6, `${u} is slow enough`);
  for (const t of ['plain', 'forest', 'mountain', 'rough', 'city']) assert.equal(registry.terrainDef(t).render.base, undefined, `${t} is drawn on the ground under it`);
});

test('roads favour wheels; forests and rough ground block wheels; treads pay extra in forests', () => {
  assert.ok(cost('road', 'wheels') < cost('plain', 'wheels'));
  assert.equal(cost('road', 'tread'), 1);
  assert.equal(cost('forest', 'wheels'), null);
  assert.equal(cost('forest', 'tread'), 2);
  assert.ok(cost('forest', 'tread') > cost('plain', 'tread'));
  assert.equal(cost('rough', 'wheels'), null);
  assert.equal(cost('rough', 'tread'), 1);
  assert.ok(cost('rough', 'foot') > 0);
});

test('ground: grass and dirt are separate data, with no functional difference', () => {
  assert.deepEqual(registry.groundIds, ['grass', 'dirt']);
  assert.equal(registry.defaultGround, 'grass');
  assert.equal(registry.groundDef('dirt').name, 'Dirt');
  assert.equal(registry.groundDef(null), null);
  for (const id of ['grass', 'dirt']) assert.equal(typeof TERRAIN_DECOR[registry.ground[id].render.decor], 'function');
});

test('maps carry a ground layer: any tile can be dirt or grass, and a map without one is all grass', async () => {
  const map = await loadMap(readData, registry, 'dust_bowl');
  assert.equal(map.ground.length, map.height);
  const kinds = new Set(map.ground.flat());
  assert.deepEqual([...kinds].sort(), ['dirt', 'grass']);
  const classic = await loadMap(readData, registry, 'classic');
  assert.ok(classic.ground.flat().every((g) => g === 'grass'));
  const raw = await readData('maps/dust_bowl.map.json');
  assert.deepEqual(serializeMap(map).ground, raw.ground, 'serialize writes the ground back');
  assert.equal(serializeMap(classic).ground, undefined, 'and leaves it out when it is all default');
  assert.throws(() => parseMap({ ...raw, groundLegend: { g: 'lava' } }, registry), /unknown ground "lava"/);
  assert.throws(() => parseMap({ ...raw, ground: ['g'] }, registry), /ground must be an array/);
});

test('rough ground gives no defense; only foot (and air) enter mountains', () => {
  assert.equal(registry.terrainDef('rough').defense, 0);
  assert.equal(cost('mountain', 'foot'), 2);
  assert.equal(cost('mountain', 'wheels'), null);
  assert.equal(cost('mountain', 'tread'), null);
});

test('road shapes: straight, corner and junction; wide roads use lanes, not arms', () => {
  const L = (o) => ({ n: 0, e: 0, s: 0, w: 0, ne: 0, se: 0, sw: 0, nw: 0, ...o });
  assert.equal(roadShape().shape, 'straight');
  assert.equal(roadShape(L({ e: 1, w: 1 })).shape, 'straight');
  assert.equal(roadShape(L({ n: 1, e: 1 })).shape, 'corner');
  assert.equal(roadShape(L({ n: 1, e: 1, s: 1 })).shape, 'junction');
  const lane = roadShape(L({ n: 1, s: 1, e: 1, ne: 1, se: 1 }));
  assert.deepEqual([lane.shape, lane.arms.e], ['straight', false]);
});

test('every road and rough decor draws without throwing', () => {
  const noop = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
  const at = { x: 1, y: 1, now: 0, link: { n: 1, e: 1, s: 0, w: 0, ne: 0, se: 0, sw: 0, nw: 0 }, radii: [0, 0, 0, 0] };
  TERRAIN_DECOR.road(noop, 0, 0, 40, at);
  TERRAIN_DECOR.rough(noop, 0, 0, 40, at);
});

for (const id of ids) {
  test(`map ${id}: loads, each player has an HQ and somewhere to build, HQs are reachable on foot`, async () => {
    const map = await loadMap(readData, registry, id);
    assert.ok(map.players.length >= 2 && map.players.length <= 4);
    const game = new Game(registry, map);
    const props = allProperties(game);
    map.players.forEach((_, p) => {
      const mine = props.filter((q) => q.owner === p);
      assert.ok(mine.some((q) => q.terrain.id === 'hq'), `player ${p} has an HQ`);
      assert.ok(mine.some((q) => ['factory', 'barracks', 'airfield'].includes(q.terrain.id)), `player ${p} can build`);
    });
    const hqs = props.filter((q) => q.terrain.id === 'hq');
    const field = distanceField(game, 'foot', [[hqs[0].x, hqs[0].y]]);
    for (const q of hqs) assert.ok(field.has(tileIndex(game.map, q.x, q.y)), `HQ at ${q.x},${q.y} reachable`);
  });

  test(`map ${id}: an AI-vs-AI game runs 60 turns without an invalid order`, async () => {
    const map = await loadMap(readData, registry, id);
    const game = new Game(registry, map);
    for (let t = 0; t < 60 && !game.isOver; t++) { playTurn(game); if (!game.isOver) game.endTurn(); }
    assert.ok(game.state.day >= 1);
  });
}

test('in a 3+ player game, losing an HQ eliminates that player and the game goes on', async () => {
  const map = await loadMap(readData, registry, 'four_corners');
  const game = new Game(registry, map);
  const events = [];
  const hq = allProperties(game).find((q) => q.owner === 1 && q.terrain.id === 'hq');
  // place a capturer next to nothing: call the capture through engine helpers
  const { eliminate } = await import('../../src/engine/victory.js');
  eliminate(game, 1, 'hq');
  assert.equal(game.state.defeated[1], true);
  assert.equal(game.state.units.filter((u) => u.owner === 1).length, 0);
  assert.equal(game.state.owners[hq.y][hq.x], null, 'its properties go neutral');
  assert.equal(game.isOver, false);
  eliminate(game, 2, 'hq'); eliminate(game, 3, 'hq');
  assert.equal(game.isOver, true);
  assert.equal(game.state.winner, 0);
  void events;
});

test('every shipped map gives each player a barracks, so every kit can build infantry', async () => {
  for (const id of ids) {
    const game = new Game(registry, await loadMap(readData, registry, id));
    const props = allProperties(game);
    game.state.funds.forEach((_, p) => assert.ok(props.some((q) => q.owner === p && q.terrain.id === 'barracks'), `${id}: player ${p} has a barracks`));
  }
});
