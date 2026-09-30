import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRegistry, rawMap, LEGEND } from '../helpers/fixtures.js';
import { parseMap, serializeMap, MapError } from '../../src/data/map-format.js';

const registry = makeRegistry({ units: { a: {}, b: {} } });
const problemsOf = (raw) => { try { parseMap(raw, registry); } catch (e) { assert.ok(e instanceof MapError); return e.problems; } return []; };
const has = (raw, re) => { const p = problemsOf(raw); assert.ok(p.some((m) => re.test(m)), `expected ${re}, got:\n${p.join('\n')}`); };

test('a valid map parses into a frozen GameMap', () => {
  const m = parseMap(rawMap({ rows: ['.a.', '.b.'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 2, 1, 7]] }), registry);
  assert.equal(m.width, 3); assert.equal(m.height, 2);
  assert.equal(m.terrain[0][1], 'base'); assert.equal(m.owners[0][1], 0); assert.equal(m.owners[1][1], 1);
  assert.equal(m.owners[0][0], null);
  assert.equal(m.units[1].hp, 7);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.terrain[0]));
});

test('header problems: format, version, id, name', () => {
  has({ ...rawMap(), format: 'other' }, /format must be/);
  has({ ...rawMap(), version: 2 }, /unsupported version 2/);
  has({ ...rawMap(), id: 'Bad Id' }, /lowercase slug/);
  has({ ...rawMap(), name: '' }, /name is required/);
});

test('players: count, faction, duplicates, controller, funds', () => {
  const p = (o) => rawMap({ players: o });
  has(p([{ faction: 'red', controller: 'human', funds: 0 }]), /2 to 4/);
  has(p([{ faction: 'red', controller: 'human', funds: 0 }, { faction: 'zzz', controller: 'ai', funds: 0 }]), /unknown faction "zzz"/);
  has(p([{ faction: 'red', controller: 'human', funds: 0 }, { faction: 'red', controller: 'ai', funds: 0 }]), /more than one player/);
  has(p([{ faction: 'red', controller: 'robot', funds: 0 }, { faction: 'blue', controller: 'ai', funds: 0 }]), /controller must be/);
  has(p([{ faction: 'red', controller: 'human', funds: -5 }, { faction: 'blue', controller: 'ai', funds: 0 }]), /funds/);
});

test('legend: unknown terrain, bad owner, owner on a non-property, multi-char glyph', () => {
  const l = (glyph, entry) => rawMap({ legend: { ...LEGEND, [glyph]: entry } });
  has(l('x', { terrain: 'lava' }), /unknown terrain "lava"/);
  has(l('x', { terrain: 'base', owner: 5 }), /not a player index/);
  has(l('x', { terrain: 'plain', owner: 0 }), /not a property/);
  has(l('xy', { terrain: 'plain' }), /exactly one character/);
});

test('tiles: ragged rows, glyphs missing from the legend, empty map', () => {
  has(rawMap({ rows: ['...', '..'] }), /rows must be equal length/);
  has(rawMap({ rows: ['.?.'] }), /glyph "\?" is not in the legend/);
  has(rawMap({ rows: [] }), /tiles must be a non-empty array/);
});

test('units: unknown type, owner, bounds, hp, impassable tile, stacking', () => {
  const u = (...list) => rawMap({ rows: ['..~'], unitsOnMap: list });
  has(u(['zzz', 0, 0, 0]), /unknown unit type "zzz"/);
  has(u(['a', 9, 0, 0]), /owner must be a player index/);
  has(u(['a', 0, 5, 0]), /outside the 3x1 map/);
  has(u(['a', 0, 0, 0, 11]), /hp must be/);
  has(u(['a', 0, 2, 0]), /cannot stand on Sea/);
  has(u(['a', 0, 0, 0], ['b', 1, 0, 0]), /already occupied/);
});

test('all problems come back in one MapError', () => {
  const p = problemsOf({ ...rawMap({ rows: ['.?.', '..'] }), format: 'x', name: '' });
  assert.ok(p.length >= 4, p.join('\n'));
});

test('serializeMap is the inverse of parseMap', () => {
  const raw = rawMap({ rows: ['.a.', 'Fb~', '.H.'], unitsOnMap: [['a', 0, 0, 0], ['b', 1, 2, 0, 4]] });
  const map = parseMap(raw, registry);
  const out = serializeMap(map);
  const { legend: _a, ...before } = map; // serialize drops legend glyphs no tile uses
  const { legend: _b, ...after } = parseMap(out, registry);
  assert.deepEqual(after, before);
  assert.deepEqual(serializeMap(parseMap(out, registry)), out, 'serialising twice is stable');
  assert.deepEqual(JSON.parse(JSON.stringify(out)), out, 'output is plain JSON');
});

test('serializeMap assigns glyphs for tiles that were edited in', () => {
  const map = parseMap(rawMap({ rows: ['..'] }), registry);
  const edited = { ...map, terrain: [['plain', 'forest']], owners: [[null, null]], legend: { '.': { terrain: 'plain' } } };
  const out = serializeMap(edited);
  assert.equal(parseMap(out, registry).terrain[0][1], 'forest');
});
