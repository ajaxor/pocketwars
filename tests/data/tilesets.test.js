// Tilesets: the same rules drawn in each biome (data/tilesets.json), shared by one or two armies, and the skirmish maps that show them off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadMap, loadRegistry } from '../../src/data/loader.js';
import { parseMap, serializeMap, tilesetOf } from '../../src/data/map-format.js';
import { validateTilesets } from '../../src/data/validate.js';
import { drawTerrainLayer } from '../../src/render/terrain-layer.js';
import { TERRAIN_DECOR } from '../../src/render/terrain-art.js';

const registry = await loadRegistry(readData);
const HOME = { temperate: ['lastholm', 'highspire'], tundra: ['deepmere', 'vantor_reach'], desert: ['ashmark', 'skyreach'], jungle: ['solace'], ruins: ['ironvale'], islands: ['tidehaven'] };

test('every army is at home in exactly one of the six biomes (some share one), and the default is the temperate one', () => {
  assert.deepEqual(registry.tilesetIds.sort(), Object.keys(HOME).sort());
  for (const [id, factions] of Object.entries(HOME)) {
    assert.deepEqual(registry.tilesets[id].factions, factions);
    for (const faction of factions) assert.equal(registry.homeTileset(faction), id);
  }
  assert.equal(registry.defaultTileset, 'temperate');
  assert.equal(registry.tilesetDef('nonsense').name, 'Temperate');
  for (const f of registry.factionIds ?? Object.keys(registry.factions)) assert.ok(registry.homeTileset(f), `${f} has a home biome`);
});

test('every drawing a tileset asks for exists, for every terrain and every ground', () => {
  for (const id of registry.tilesetIds) {
    for (const t of registry.terrainIds) {
      const skin = registry.skin(id, t);
      if (skin.render.decor) assert.equal(typeof TERRAIN_DECOR[skin.render.decor], 'function', `${id}/${t}: decor "${skin.render.decor}"`);
    }
    const g = registry.groundDef(registry.tilesets[id].ground);
    assert.ok(g, `${id} has a ground`);
  }
  for (const g of registry.groundIds) if (registry.ground[g].render.decor) assert.equal(typeof TERRAIN_DECOR[registry.ground[g].render.decor], 'function', g);
});

test('a skin changes names and looks, never the rules', () => {
  assert.equal(registry.skin('temperate', 'forest'), registry.terrain.forest, 'the default tileset adds nothing');
  const spruce = registry.skin('tundra', 'forest');
  assert.equal(spruce.name, 'Spruce wood');
  assert.equal(spruce.moveCost, registry.terrain.forest.moveCost);
  assert.equal(spruce.defense, registry.terrain.forest.defense);
  assert.equal(spruce.attributes, registry.terrain.forest.attributes);
  assert.equal(registry.skin('desert', 'mountain').name, 'Mesa');
  assert.throws(() => registry.skin('tundra', 'nonsense'));
});

test('tileset problems are reported: unknown terrain, a faction at home twice, a bad colour, a render key a tileset may not change', () => {
  const raw = { rules: registry.rules };
  const problems = [];
  validateTilesets({
    a: { name: 'A', factions: ['ashmark'], terrain: { nothing: {}, forest: { render: { base: 'green', building: 'city' } } } },
    b: { name: 'B', factions: ['ashmark', 'nobody'] },
  }, registry.terrain, registry.ground, registry.factions, { defaultTileset: 'a' }, problems);
  const text = problems.join('\n');
  assert.match(text, /"nothing" is not in terrain\.json/);
  assert.match(text, /already the home of tileset "a"/);
  assert.match(text, /faction "nobody" is not in factions\.json/);
  assert.match(text, /render\.base must be a hex color/);
  assert.match(text, /render\.building cannot be changed/);
  assert.ok(raw);
});

test('the tileset maps: each is in its tileset, led by one of its armies, mirrored left and right', async () => {
  const MAPS = { ridgeback: 'temperate', garden_maze: 'temperate', whiteout: 'tundra', concrete_canyon: 'tundra', dune_sea: 'desert', skyline_pass: 'desert', mudslide: 'jungle', burnt_offering: 'ruins', atoll: 'islands' };
  for (const [id, set] of Object.entries(MAPS)) {
    const map = await loadMap(readData, registry, id);
    assert.equal(map.tileset, set, id);
    assert.equal(tilesetOf(map, registry), set);
    assert.ok(HOME[set].includes(map.players[0].faction), `${id}: player 0 is at home in ${set}`);
    assert.equal(map.players.length, 2);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const a = map.terrain[y][x], b = map.terrain[y][map.width - 1 - x];
      assert.equal(a, b, `${id}: terrain at ${x},${y} is mirrored`);
      const oa = map.owners[y][x], ob = map.owners[y][map.width - 1 - x];
      assert.equal(oa === null ? null : 1 - oa, ob, `${id}: owners at ${x},${y} are mirrored with players swapped`);
    }
    assert.ok(map.units.filter((u) => u.type === 'jammer').length >= 2, `${id} has jammers`);
  }
});

test('a map keeps its tileset through parse and serialize; a map without one is drawn in the default tileset', async () => {
  const map = await loadMap(readData, registry, 'whiteout');
  const raw = serializeMap(map, { defaultGround: registry.tilesetDef(map.tileset).ground, defaultTileset: registry.defaultTileset });
  assert.equal(raw.tileset, 'tundra');
  assert.equal(parseMap(raw, registry).tileset, 'tundra');
  const classic = await loadMap(readData, registry, 'classic');
  assert.equal(tilesetOf(classic, registry), 'temperate');
});

test('every tileset paints a sampler sheet without a problem', () => {
  const calls = { n: 0 };
  const ctx = new Proxy({}, { get: (_, p) => (typeof p === 'symbol' ? undefined : () => { calls.n++; return { addColorStop() {} }; }), set: () => true });
  const KEY = ['plain', 'forest', 'mountain', 'road', 'sea', 'shoals', 'city', 'hq', 'factory', 'ford', 'ice', 'ruin_city', 'ruin_factory'];
  for (const id of registry.tilesetIds) {
    const terrainAt = (x, y) => registry.skin(id, KEY[(x + y * 4) % KEY.length]);
    drawTerrainLayer(ctx, { width: 8, height: 4, S: 32, now: 0, terrainAt, groundAt: () => registry.groundDef(registry.tilesets[id].ground), ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? '#e8712c' : null) });
  }
  assert.ok(calls.n > 1000);
});
