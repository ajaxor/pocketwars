// Leaders as data: loadouts.json (validation, resolution), a map's players having leaders, and placing a leader's starting formation
// around the HQ (forward toward the enemy, nearby when a spot is blocked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { LEGEND, makeData, makeRegistry, rawMap } from '../helpers/fixtures.js';
import { createRegistry } from '../../src/data/registry.js';
import { DataError, MAX_START_UNITS, validateData } from '../../src/data/validate.js';
import { loadRegistry } from '../../src/data/loader.js';
import { MapError, parseMap, serializeMap } from '../../src/data/map-format.js';
import { campaignProblems, loadCampaign } from '../../src/data/campaign.js';
import { EYE_STYLES } from '../../src/render/eye-styles.js';
import { CHIN_STYLES, MOUTH_STYLES, NOSE_STYLES } from '../../src/render/face-styles.js';
import { frontOf, hqOf, placeFormation, placeStart, withLeaders } from '../../src/data/formation.js';

const registry = await loadRegistry(readData);
const campaign = await loadCampaign(readData, registry);

const problemsOf = (loadouts, over = {}) => validateData(makeData({ units: { a: {}, b: { moveClass: 'wheel' } }, loadouts, ...over })).join('\n');
const KIT = { default: { build: { base: ['a', 'b'] }, start: { hq: [{ unit: 'a', at: [0, 1] }], base: [{ unit: 'b', at: [0, 1] }] } }, leaders: { x: {} } };

// ---- the shipped data -----------------------------------------------------------------------------------------------------------------
test('every leader of the campaign has a loadout, except the Chorus\' own', () => {
  assert.deepEqual(registry.leaderIds, campaign.leaders.filter((l) => l.faction !== 'chorus').map((l) => l.id));
  assert.ok(!registry.leaderIds.includes('envoy'));
  assert.deepEqual(campaignProblems(JSON.parse(JSON.stringify(campaign)), registry), []);
});

test('campaign validation catches a leader without a loadout and a loadout without a leader', async () => {
  const raw = JSON.parse(JSON.stringify(await readData('campaign.json')));
  raw.leaders.push({ ...raw.leaders[1], id: 'newcomer' });
  raw.leaders = raw.leaders.filter((l) => l.id !== 'vex');
  raw.nations = raw.nations.filter((n) => n.leader !== 'vex' && n.leader !== 'newcomer');
  const p = campaignProblems(raw, registry).join('\n');
  assert.match(p, /leader "newcomer" has no loadout/);
  assert.match(p, /loadouts.json has a loadout for "vex", who is not a leader/);
});

test('every leader has eyes, a nose, a mouth and a chin of their own, and the campaign check enforces it', async () => {
  const features = { eyeStyle: EYE_STYLES, noseStyle: NOSE_STYLES, mouthStyle: MOUTH_STYLES, chinStyle: CHIN_STYLES };
  for (const [trait, styles] of Object.entries(features)) {
    const used = campaign.leaders.map((l) => l[trait]);
    assert.equal(new Set(used).size, used.length, `no two leaders share a ${trait}`);
    assert.ok(used.every((s) => styles[s]), trait);
  }
  const raw = JSON.parse(JSON.stringify(await readData('campaign.json')));
  raw.leaders[1].eyeStyle = raw.leaders[0].eyeStyle;
  raw.leaders[2].noseStyle = 'nope';
  delete raw.leaders[3].mouthStyle;
  raw.leaders[4].chinStyle = raw.leaders[5].chinStyle;
  const p = campaignProblems(raw, registry).join('\n');
  assert.match(p, /share the eyeStyle "weary"/);
  assert.match(p, /leader "vex" needs noseStyle/);
  assert.match(p, /leader "hiroshi" needs mouthStyle/);
  assert.match(p, /share the chinStyle "weak"|share the chinStyle "cleft"/);
});

test('the standard kit lists what the building categories give (a unit added to units.json has to be added to the kit as well)', () => {
  for (const [id, t] of Object.entries(registry.terrain)) {
    const builds = t.attributes.property?.builds;
    if (!builds?.length) { assert.equal(registry.loadouts.default.build[id], undefined, `${id} builds nothing`); continue; }
    assert.deepEqual([...registry.loadouts.default.build[id]].sort(), registry.unitsInCategories(builds).map((u) => u.id).sort(), id);
  }
});

test('the standard start gives the HQ and each building type a set of units that exist', () => {
  const start = registry.loadouts.default.start;
  assert.ok(start.hq.length >= 2, 'the HQ has its own set');
  for (const [site, list] of Object.entries(start)) {
    assert.ok(site === 'hq' || registry.terrain[site].attributes.property?.builds?.length, `${site} is the HQ or a production building`);
    assert.ok(list.length <= MAX_START_UNITS && list.every((s) => registry.units[s.unit]), site);
    assert.equal(new Set(list.map((s) => s.at.join(','))).size, list.length, `${site}: no two units share a spot`);
  }
  assert.equal(start.hq.length, 3, 'the HQ gets three units');
  for (const site of Object.keys(start).filter((k) => k !== 'hq')) assert.equal(start[site].length, 1, `${site} gets one extra unit`);
});

test('every leader starts with three HQ units and one unit per building, and the starting armies cost about the same', () => {
  const costs = registry.leaderIds.map((id) => {
    const start = { ...registry.loadouts.default.start, ...registry.loadouts.leaders[id]?.start };
    assert.equal(start.hq.length, 3, `${id}: HQ`);
    for (const site of ['barracks', 'factory', 'airfield', 'shipyard']) assert.equal(start[site].length, 1, `${id}: ${site}`);
    return Object.values(start).flat().reduce((sum, s) => sum + registry.units[s.unit].cost, 0);
  });
  assert.ok(Math.max(...costs) - Math.min(...costs) <= 4500, `army costs ${costs.join(', ')} stay within 4,500 of each other`);
});

// ---- validation -----------------------------------------------------------------------------------------------------------------------
test('valid loadouts pass; a bundle without loadouts.json is still valid', () => {
  assert.equal(problemsOf(KIT), '');
  assert.equal(problemsOf(undefined), '');
});

test('loadout validation reports every kind of mistake', () => {
  const bad = {
    extra: 1,
    default: { build: { base: ['a', 'a', 'nope'], hq: ['a'], ghost: ['a'], city: ['a'] }, start: { hq: [{ unit: 'a', at: [0, 0] }, { unit: 'a', at: [1, 1], x: 2 }, { unit: 'a', at: [1, 1] }, { unit: 'zzz', at: [0, 1] }, { unit: 'a', at: [0.5, 1] }, 7], city: [{ unit: 'a', at: [0, 1] }], ghost: [], base: 'no' } },
    leaders: { 'Bad Id': {}, random: {}, empty: { build: { base: [] }, mystery: 1 }, sea: { build: { base: ['b'] } }, string: { start: 'no' } },
  };
  const noWheels = { name: 'Base', defense: 3, moveCost: { foot: 1, wheel: null, air: 1 }, attributes: { property: { income: 1000, capturePoints: 20, repair: 2, builds: ['ground'] } }, render: { base: '#86b95c' } };
  const p = problemsOf(bad, { terrain: { base: noWheels } });
  for (const re of [
    /unknown key "extra"/, /build.base: "a" is listed twice/, /build.base: unknown unit "nope"/, /"hq" is not a production building/, /"ghost" is not a production building/, /"city" is not a production building/,
    /\[0, 0\] is the building itself/, /start.hq\[1\]: unknown key "x"/, /start.city: "city" is neither "hq" nor a production building/, /start.ghost: "ghost" is neither/, /start.base must be an array/, /another unit already has the spot \[1,1\]/, /unknown unit "zzz"/, /at must be \[side, forward\] whole numbers/, /start.hq\[5\] must be an object/,
    /leader id "Bad Id" must be lowercase/, /"random" is reserved/, /build.base must be a non-empty list/, /loadouts.leaders.empty: unknown key "mystery"/,
    /loadouts.leaders.string: start must be an object/,
  ]) assert.match(p, re);
});

test('a default kit is required with both parts, leaders must be an object, and a set has a size limit', () => {
  assert.match(problemsOf({ leaders: {} }), /default is required/);
  assert.match(problemsOf({ default: {}, leaders: {} }), /default: build is required[\s\S]*default: start is required/);
  assert.match(problemsOf({ default: KIT.default, leaders: [] }), /leaders must be an object/);
  assert.match(problemsOf('x'), /loadouts.json must be an object/);
  const crowd = { default: { build: {}, start: { hq: Array.from({ length: MAX_START_UNITS + 1 }, (_, i) => ({ unit: 'a', at: [i, 1] })) } }, leaders: {} };
  assert.match(problemsOf(crowd), /more than \d+ units/);
  assert.throws(() => createRegistry(makeData({ loadouts: crowd })), DataError);
});

// ---- resolving them in the registry -----------------------------------------------------------------------------------------------------
test('a leader inherits what its kit leaves out; a part it names replaces the default\'s (per building)', () => {
  const r = makeRegistry({
    units: { a: {}, b: {}, c: {} },
    terrain: { lab: { name: 'Lab', defense: 3, moveCost: { foot: 1, wheel: 1, air: 1 }, attributes: { property: { income: 1000, capturePoints: 20, repair: 2, builds: ['ground'] } }, render: { base: '#888888' } } },
    loadouts: { default: { build: { base: ['a'], lab: ['a', 'b'] }, start: { hq: [{ unit: 'a', at: [0, 1] }], lab: [{ unit: 'c', at: [0, 1] }] } }, leaders: { plain: {}, menu: { build: { base: ['c'] } }, army: { start: { hq: [{ unit: 'b', at: [1, 1] }, { unit: 'b', at: [-1, 1] }], base: [{ unit: 'b', at: [0, 1] }] } }, bare: { start: { lab: [] } } } },
  });
  assert.deepEqual(r.leaderIds, ['plain', 'menu', 'army', 'bare']);
  assert.deepEqual(r.loadoutFor('plain'), r.loadoutFor(null), 'an empty kit is the default');
  assert.deepEqual(r.loadoutFor('menu').build, { base: ['c'], lab: ['a', 'b'] }, 'the base menu is replaced, the lab menu is inherited');
  assert.deepEqual(r.loadoutFor('menu').start, r.loadoutFor(null).start);
  assert.deepEqual(r.loadoutFor('army').start.hq.map((s) => s.at), [[1, 1], [-1, 1]], 'the HQ set is replaced');
  assert.deepEqual(r.loadoutFor('army').start.lab, [{ unit: 'c', at: [0, 1] }], 'the lab set is inherited');
  assert.deepEqual(r.loadoutFor('bare').start.lab, [], 'an empty list takes a set away');
  assert.deepEqual(r.loadoutFor('army').build, r.loadoutFor(null).build);
  assert.throws(() => r.loadoutFor('nobody'), /Unknown leader "nobody"/);
  assert.ok(Object.isFrozen(r.loadoutFor('menu')) && Object.isFrozen(r.loadoutFor('menu').build.base));
});

test('without loadouts.json there are no leaders and no kit overrides', () => {
  const r = makeRegistry();
  assert.deepEqual(r.leaderIds, []);
  assert.deepEqual(r.loadoutFor(null), { build: {}, start: {} });
});

// ---- a map's players having leaders -------------------------------------------------------------------------------------------------------
const withKit = makeRegistry({ loadouts: KIT });
const players = (leader) => [{ faction: 'red', controller: 'human', funds: 5000, ...(leader !== undefined && { leader }) }, { faction: 'blue', controller: 'ai', funds: 5000 }];

test('a map file may name a leader for a player; it must be one the registry knows', () => {
  const map = parseMap(rawMap({ rows: ['.H.h.'], players: players('x') }), withKit);
  assert.equal(map.players[0].leader, 'x');
  assert.equal('leader' in map.players[1], false, 'no leader, no key');
  assert.equal(parseMap(rawMap({ rows: ['.H.h.'], players: players(null) }), withKit).players[0].leader, undefined);
  assert.throws(() => parseMap(rawMap({ rows: ['.H.h.'], players: players('ghost') }), withKit), (e) => e instanceof MapError && /players\[0\]: unknown leader "ghost"/.test(e.message));
  const round = serializeMap(map);
  assert.equal(round.players[0].leader, 'x');
  assert.deepEqual(parseMap(round, withKit).players, map.players);
});

// ---- the formation ------------------------------------------------------------------------------------------------------------------------
const field = (rows, extra = {}) => parseMap(rawMap({ rows, players: players(), ...extra }), withKit);
const at = (r) => r.units.map((u) => [u.x, u.y]);

test('forward points at the enemy: north, south, east or west', () => {
  const m = field(['..h..', '.....', '.....', '.....', '..H..']);
  assert.deepEqual(frontOf(m, withKit, 0, hqOf(m, withKit, 0)), [0, -1]);
  assert.deepEqual(frontOf(m, withKit, 1, hqOf(m, withKit, 1)), [0, 1]);
  const w = field(['H...h']);
  assert.deepEqual(frontOf(w, withKit, 0, { x: 0, y: 0 }), [1, 0]);
  assert.deepEqual(frontOf(w, withKit, 1, { x: 4, y: 0 }), [-1, 0]);
  const solo = parseMap(rawMap({ rows: ['.....', '.....', '..H..'], players: players() }), withKit);
  assert.deepEqual(frontOf(solo, withKit, 0, { x: 2, y: 2 }), [0, -1], 'with no enemy HQ, toward the middle of the map');
});

test('a formation is mirrored for a player on the other side of the map', () => {
  const m = field(['..h..', '.....', '.....', '.....', '.....', '.....', '..H..']);
  const start = [{ unit: 'a', at: [0, 2] }, { unit: 'a', at: [1, 1] }, { unit: 'a', at: [-1, 1] }];
  const south = placeFormation(m, withKit, 0, start);
  assert.deepEqual(at(south), [[2, 4], [3, 5], [1, 5]], 'facing north, +side is east');
  assert.equal(south.moved, 0);
  const north = placeFormation(m, withKit, 1, start);
  assert.deepEqual(at(north), [[2, 2], [1, 1], [3, 1]], 'facing south, +side is west');
  const east = placeFormation(field(['H...h', '.....', '.....']), withKit, 0, [{ unit: 'a', at: [1, 1] }, { unit: 'a', at: [-1, 2] }]);
  assert.deepEqual(at(east), [[1, 1], [2, 0]], 'facing east, +side is south: [1, 1] is one ahead and one south; [-1, 2] two ahead and one north (off the map, so nearest)');
});

test('a spot that is blocked sends the unit to the nearest tile that is fine, keeping its row', () => {
  const rows = ['..h..', '.....', '..M..', '.....', '..H..'];
  const m = field(rows);
  const wheeled = makeRegistry({ units: { a: {}, b: { moveClass: 'wheel' } }, loadouts: KIT });
  const mw = parseMap(rawMap({ rows, players: players() }), wheeled);
  const spot = (reg, map, unit) => placeFormation(map, reg, 0, [{ unit, at: [0, 2] }]);
  assert.deepEqual(at(spot(withKit, m, 'a')), [[2, 2]], 'a soldier walks over the mountain');
  const r = spot(wheeled, mw, 'b');
  assert.deepEqual(at(r), [[1, 2]], 'a wheeled unit cannot stand on it: the next tile in the same row');
  assert.equal(r.moved, 1);
});

test('a unit never goes on a property, off the map, or on a tile another unit has', () => {
  const m = field(['h....', '.....', '.....', '.....', 'aH...']);
  const r = placeFormation(m, withKit, 0, [{ unit: 'a', at: [-1, 0] }, { unit: 'a', at: [0, 1] }, { unit: 'a', at: [0, 2] }, { unit: 'a', at: [1, -3] }], new Set(['1,3']));
  assert.equal(r.units.length, 4);
  assert.equal(new Set(at(r).map(String)).size, 4, 'all on different tiles');
  for (const u of r.units) {
    assert.ok(u.x >= 0 && u.x < 5 && u.y >= 0 && u.y < 5, 'on the map');
    assert.ok(!(u.x === 0 && u.y === 4) && !(u.x === 1 && u.y === 4), 'not on the base or the HQ');
    assert.notDeepEqual([u.x, u.y], [1, 3], 'not on a tile already taken');
  }
  assert.deepEqual(at(r)[0], [0, 3], 'the base is where [-1, 0] points: the unit goes next to it');
});

test('nobody is stranded across the water: only a flier may take a spot on the far shore', () => {
  const rows = ['h....', '.....', '.....', '~~~~~', '..H..'];
  const m = field(rows);
  const flying = makeRegistry({ units: { a: {}, f: { moveClass: 'air' } }, loadouts: { default: { build: {}, start: {} }, leaders: {} } });
  const mf = parseMap(rawMap({ rows, players: players() }), flying);
  assert.deepEqual(at(placeFormation(m, withKit, 0, [{ unit: 'a', at: [0, 2] }])), [[1, 4]], 'a soldier stays on its own shore');
  assert.deepEqual(at(placeFormation(mf, flying, 0, [{ unit: 'f', at: [0, 2] }])), [[2, 2]], 'a flier goes where it was meant to');
});

test('a unit with nowhere at all to stand is skipped, not forced', () => {
  const m = field(['~~H~h']);
  const r = placeFormation(m, withKit, 0, [{ unit: 'a', at: [0, 1] }, { unit: 'a', at: [1, 1] }]);
  assert.deepEqual([r.units, r.skipped], [[], ['a', 'a']]);
});

test('placing is deterministic, and leaves earlier units their spots', () => {
  const m = field(['h....', '.....', '..M..', '.....', '..H..']);
  const start = [{ unit: 'a', at: [0, 1] }, { unit: 'a', at: [0, 2] }, { unit: 'a', at: [1, 2] }, { unit: 'a', at: [-1, 2] }];
  assert.deepEqual(placeFormation(m, withKit, 0, start), placeFormation(m, withKit, 0, start));
  assert.deepEqual(at(placeFormation(m, withKit, 0, start)).slice(0, 2), [[2, 3], [2, 2]]);
});

test('a player without an HQ falls back to any property, and without one has nothing to build around', () => {
  assert.deepEqual(hqOf(field(['.a...', '..h..']), withKit, 0), { x: 1, y: 0 });
  assert.equal(hqOf(field(['.....', '..h..']), withKit, 0), null);
  assert.equal(placeFormation(field(['.....', '..h..']), withKit, 0, [{ unit: 'a', at: [0, 1] }]), null);
});

test('withLeaders swaps in each leader\'s units and keeps the units of a team without one', () => {
  const kits = makeRegistry({
    units: { a: {}, b: {} },
    loadouts: { default: { build: {}, start: { hq: [{ unit: 'a', at: [0, 1] }] } }, leaders: { x: {}, y: { start: { hq: [{ unit: 'b', at: [0, 1] }, { unit: 'b', at: [1, 1] }] } } } },
  });
  const map = parseMap(rawMap({ rows: ['..h..', '.....', '.....', '..H..'], players: players(), unitsOnMap: [['a', 0, 0, 3], ['a', 0, 1, 3], ['b', 1, 4, 0]] }), kits);
  const both = withLeaders(map, kits, ['x', 'y']);
  assert.ok(Object.isFrozen(both) && Object.isFrozen(both.players[0]) && Object.isFrozen(both.units));
  assert.deepEqual(both.players.map((p) => p.leader), ['x', 'y']);
  assert.deepEqual(both.units.map((u) => [u.type, u.owner]), [['a', 0], ['b', 1], ['b', 1]], 'the map\'s own units are gone; each formation is the kit\'s');
  assert.deepEqual(at(both).slice(0, 1), [[2, 2]]);
  const one = withLeaders(map, kits, ['x', null]);
  assert.deepEqual(one.units.map((u) => [u.type, u.owner]), [['b', 1], ['a', 0]], 'the second team keeps the map\'s unit');
  assert.equal('leader' in one.players[1], false);
  assert.equal(map.units.length, 3, 'the original map is untouched');
  assert.equal(map.players[0].leader, undefined);
});

test('an HQ set, plus a copy of each building type\'s set for every such building the player owns', () => {
  const m = field(['..h..', '.....', '.....', '.....', 'a.H.a', '.....']);
  const r = placeStart(m, withKit, 0, { hq: [{ unit: 'a', at: [0, 1] }], base: [{ unit: 'b', at: [0, 1] }, { unit: 'b', at: [1, 1] }] });
  assert.deepEqual(r.sites.map((x) => [x.site, x.x, x.y, x.placed]), [['hq', 2, 4, 1], ['base', 0, 4, 2], ['base', 4, 4, 2]]);
  assert.deepEqual(r.units.map((u) => [u.type, u.x, u.y]), [['a', 2, 3], ['b', 0, 3], ['b', 1, 3], ['b', 4, 3], ['b', 3, 3]], 'each set is around its own building; the one that does not fit goes nearby');
  assert.equal(new Set(r.units.map((u) => `${u.x},${u.y}`)).size, 5, 'nobody shares a tile');
  assert.equal(r.skipped.length, 0);
});

test('a type the player has no building of gets no set; enemy buildings do not count; sets are optional', () => {
  const m = field(['..h.b', '.....', '..H..']);
  const r = placeStart(m, withKit, 0, { hq: [{ unit: 'a', at: [0, 1] }], base: [{ unit: 'b', at: [0, 1] }] });
  assert.deepEqual(r.sites.map((x) => x.site), ['hq']);
  assert.deepEqual(placeStart(m, withKit, 0, {}).units, []);
  assert.equal(placeStart(field(['.....', '..h..']), withKit, 0, { hq: [{ unit: 'a', at: [0, 1] }] }), null);
});

test('a building\'s set faces the enemy from the building, and a crowded building pushes its units to nearby tiles', () => {
  const m = field(['..h..', '.....', '.....', 'a....', '.....', '..H..']);
  const r = placeStart(m, withKit, 0, { base: [{ unit: 'b', at: [0, 1] }, { unit: 'b', at: [0, 1] }, { unit: 'b', at: [0, 1] }] });
  assert.equal(r.units.length, 3);
  assert.equal(r.moved, 2, 'two of them could not have the one spot');
  assert.ok(r.units.every((u) => Math.abs(u.x - 0) + Math.abs(u.y - 3) <= 3));
});

test('a team with a leader but no property keeps its map units (and still gets the leader\'s menus)', () => {
  const map = parseMap(rawMap({ rows: ['.....', '..H..'], players: players(), unitsOnMap: [['a', 1, 3, 0]] }), withKit);
  const out = withLeaders(map, withKit, ['x', 'x']);
  assert.deepEqual(out.players.map((p) => p.leader), ['x', 'x']);
  assert.deepEqual(out.units.filter((u) => u.owner === 1).map((u) => [u.x, u.y]), [[3, 0]]);
});

const setsFor = (map, owner) => {
  const { start } = registry.loadoutFor(null);
  let n = start.hq.length;
  map.terrain.forEach((row, y) => row.forEach((t, x) => { if (map.owners[y][x] === owner && registry.terrain[t].attributes.property?.builds?.length) n += start[t]?.length ?? 0; }));
  return n;
};

test('a leader\'s units fit every shipped map: nobody skipped, none on a property, none sharing a tile', async () => {
  const { loadMapIndex, loadMap } = await import('../../src/data/loader.js');
  const index = await loadMapIndex(readData);
  for (const id of Object.keys(index.maps)) {
    const map = await loadMap(readData, registry, id);
    const out = withLeaders(map, registry, map.players.map(() => registry.leaderIds[0]));
    const each = (o) => out.units.filter((u) => u.owner === o && !registry.unit(u.type).attributes.structure);   // the map's own turrets stay as well
    map.players.forEach((_, o) => assert.equal(each(o).length, setsFor(map, o), `${id}: team ${o + 1} has all its sets`));
    assert.equal(new Set(out.units.map((u) => `${u.x},${u.y}`)).size, out.units.length, `${id}: one unit per tile`);
    for (const u of out.units) {
      assert.equal(registry.terrain[map.terrain[u.y][u.x]].attributes.property, undefined, `${id}: unit on a property at ${u.x},${u.y}`);
      assert.notEqual(registry.terrain[map.terrain[u.y][u.x]].moveCost[registry.unit(u.type).moveClass], null, `${id}: ${u.type} cannot stand at ${u.x},${u.y}`);
    }
  }
});

test('LEGEND sanity: the fixture legend used above', () => assert.deepEqual([LEGEND.a, LEGEND.H], [{ terrain: 'base', owner: 0 }, { terrain: 'hq', owner: 0 }]));
