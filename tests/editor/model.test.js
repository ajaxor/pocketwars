// The map editor: the model (edits, symmetry, undo, players, size, files), the palette, browser storage and the screen's wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { FakeDoc } from '../helpers/fake-dom.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { parseMap } from '../../src/data/map-format.js';
import { EditorModel, ownerInCopy, symmetryPoints } from '../../src/editor/model.js';
import { palette } from '../../src/editor/palette.js';
import { customMaps, deleteMap, loadDraft, saveDraft, saveMap, savedMaps } from '../../src/editor/storage.js';
import { EditorScreen } from '../../src/editor/editor-screen.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);
const fakeStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('a blank map is plain grass with an HQ per player, and it is playable', () => {
  const m = EditorModel.blank(registry, { width: 12, height: 8 });
  assert.equal(m.width, 12); assert.equal(m.height, 8);
  assert.equal(m.terrain.flat().filter((t) => t === 'hq').length, 2);
  assert.deepEqual(m.problems(), []);
  const map = parseMap(m.toRaw(), registry);
  assert.equal(map.width, 12);
});

test('painting terrain: owners only stick to properties; units that cannot stand there are removed', () => {
  const m = EditorModel.blank(registry, { width: 8, height: 6 });
  m.paintTerrain(3, 3, 'city', 1);
  assert.equal(m.owners[3][3], 1);
  m.paintTerrain(3, 3, 'forest', 1);
  assert.equal(m.owners[3][3], null, 'a forest has no owner');
  assert.equal(m.placeUnit(4, 4, 'tank', 0), null);
  assert.equal(m.placeUnit(4, 3, 'tank', 0), null);
  const gone = m.paintTerrain(4, 4, 'sea');
  assert.equal(gone.length, 1, 'a tank cannot stand on the sea');
  assert.equal(m.unitAt(4, 4), null);
  assert.equal(m.paintTerrain(4, 3, 'wall_breach').length, 1, 'a breakable wall needs its tile for the cracked wall');
});

test('placing units: the terrain must take it, only structures can be neutral, and a new unit replaces the old one', () => {
  const m = EditorModel.blank(registry, { width: 8, height: 6 });
  m.paintTerrain(2, 2, 'sea');
  assert.equal(m.placeUnit(2, 2, 'soldier', 0), 'cannot-stand');
  assert.equal(m.placeUnit(2, 2, 'destroyer', 0), null);
  assert.equal(m.placeUnit(3, 3, 'tank', null), 'needs-owner');
  assert.equal(m.placeUnit(3, 3, 'cannon_turret', null), null);
  assert.equal(m.placeUnit(3, 3, 'jammer', 1), null);
  assert.deepEqual(m.unitAt(3, 3), { type: 'jammer', owner: 1, x: 3, y: 3 });
  assert.equal(m.units.length, 2);
  assert.equal(m.placeUnit(4, 4, 'tank', 3), 'no-such-player');
});

test('fill paints the connected area of the same terrain and owner', () => {
  const m = EditorModel.blank(registry, { width: 6, height: 4 });
  m.fill(0, 0, { kind: 'terrain', id: 'plain' });
  for (const [x, y] of [[1, 2], [4, 1]]) m.paintTerrain(x, y, 'plain');   // clear the two HQs
  for (let y = 0; y < 4; y++) m.paintTerrain(2, y, 'mountain');
  m.fill(0, 0, { kind: 'terrain', id: 'sea' });
  assert.deepEqual(m.terrain.map((r) => r.slice(0, 3).join(',')), Array(4).fill('sea,sea,mountain'), 'stops at the mountain ridge');
  assert.equal(m.terrain[0][4], 'plain');
  m.fill(4, 0, { kind: 'ground', id: 'dirt' });
  assert.ok(m.ground.every((r) => r.every((g) => g === 'dirt')), 'ground fills cross terrain');
});

test('symmetry: the tiles a mirrored edit touches, and whose the copies are', () => {
  const m = EditorModel.blank(registry, { width: 10, height: 6 });
  const pts = (mode, x, y) => symmetryPoints(m, x, y, mode).map((p) => `${p.x},${p.y}`);
  assert.deepEqual(pts('mirror_x', 1, 2), ['1,2', '8,2']);
  assert.deepEqual(pts('mirror_y', 1, 2), ['1,2', '1,3']);
  assert.deepEqual(pts('rotate', 1, 2), ['1,2', '8,3']);
  assert.deepEqual(pts('quad', 1, 2), ['1,2', '8,2', '1,3', '8,3']);
  assert.deepEqual(pts('quad', 4, 2).length, 4);
  assert.equal(ownerInCopy(0, 1, 2, 2), 1);
  assert.equal(ownerInCopy(1, 1, 2, 2), 0);
  assert.equal(ownerInCopy(0, 1, 2, 4), 2, 'four players, two halves: the opposite pair');
  assert.equal(ownerInCopy(0, 3, 4, 4), 3);
  assert.equal(ownerInCopy(null, 1, 2, 2), null, 'neutral stays neutral');
});

test('undo and redo take back whole steps', () => {
  const m = EditorModel.blank(registry, { width: 6, height: 4 });
  m.begin(); m.paintTerrain(0, 0, 'sea'); m.paintTerrain(1, 0, 'sea');
  m.begin(); m.placeUnit(3, 3, 'tank', 0);
  assert.ok(m.undo());
  assert.equal(m.unitAt(3, 3), null);
  assert.equal(m.terrain[0][1], 'sea');
  assert.ok(m.undo());
  assert.equal(m.terrain[0][0], 'plain');
  assert.equal(m.undo(), false);
  assert.ok(m.redo()); assert.ok(m.redo());
  assert.equal(m.unitAt(3, 3).type, 'tank');
  m.begin(); m.settle();
  assert.equal(m.past.length, 2, 'a step that changed nothing is dropped');
});

test('resize keeps the anchored corner; units off the edge go', () => {
  const m = EditorModel.blank(registry, { width: 8, height: 6 });
  m.placeUnit(7, 5, 'tank', 1);
  m.placeUnit(0, 0, 'soldier', 0);
  m.resize(10, 6, { x: 1, y: 0 });
  assert.deepEqual(m.unitAt(9, 5)?.type, 'tank', 'everything moved right by two');
  m.resize(4, 4, { x: 0, y: 0 });
  assert.equal(m.width, 4);
  assert.equal(m.units.length, 1, 'only what still fits');
});

test('players: add up to four, remove one (their units go, their buildings turn neutral, the rest move down)', () => {
  const m = EditorModel.blank(registry, { width: 8, height: 6 });
  assert.ok(m.addPlayer()); assert.ok(m.addPlayer());
  assert.equal(m.addPlayer(), false);
  m.paintTerrain(4, 0, 'factory', 2); m.placeUnit(4, 1, 'tank', 2); m.placeUnit(5, 1, 'tank', 3);
  assert.ok(m.removePlayer(2));
  assert.equal(m.players.length, 3);
  assert.equal(m.owners[0][4], null);
  assert.deepEqual(m.units.map((u) => u.owner), [2], 'player 4 is player 3 now');
  m.setPlayer(0, { faction: m.players[1].faction });
  assert.notEqual(m.players[0].faction, m.players[1].faction, 'taking a colour swaps it');
});

test('every shipped map opens in the editor and writes back to the same map', async () => {
  for (const id of Object.keys(index.maps)) {
    const map = await loadMap(readData, registry, id);
    const raw = await readData(`maps/${index.maps[id]}`);
    const m = EditorModel.fromRaw(raw, registry);
    assert.deepEqual(m.problems(), [], id);
    const back = parseMap(m.toRaw(), registry);
    assert.deepEqual(back.terrain, map.terrain, id);
    assert.deepEqual(back.owners, map.owners, id);
    assert.deepEqual(back.ground, map.ground, id);
    assert.deepEqual(back.units, map.units, id);
    assert.deepEqual(back.players, map.players, id);
  }
});

test('problems: a unit on the wrong terrain and a player without an HQ are reported', () => {
  const m = EditorModel.fromRaw({ tiles: ['.~..'], legend: { '.': { terrain: 'plain' }, '~': { terrain: 'sea' } }, units: [{ type: 'tank', owner: 0, x: 1, y: 0 }],
    players: [{ faction: 'ashmark', controller: 'human', funds: 0 }, { faction: 'tidehaven', controller: 'ai', funds: 0 }] }, registry);
  const p = m.problems();
  assert.ok(p.some((x) => /cannot stand on Sea/.test(x)), p.join('\n'));
  assert.ok(p.includes('Player 1 has no HQ'));
});

test('a map that is all dirt keeps its ground when written', () => {
  const m = EditorModel.blank(registry, { width: 5, height: 4 });
  m.fill(0, 0, { kind: 'ground', id: 'dirt' });
  assert.ok(parseMap(m.toRaw(), registry).ground.flat().every((g) => g === 'dirt'));
});

test('the palette lists terrain, buildings, units and defences from the data', () => {
  const p = palette(registry);
  assert.ok(p.terrain.some((i) => i.id === 'wall') && p.terrain.some((i) => i.id === 'wall_breach' && i.label === 'Cracked Wall'));
  assert.ok(p.terrain.some((i) => i.kind === 'ground' && i.id === 'dirt'));
  assert.deepEqual(p.buildings.map((i) => i.id).sort(), ['airfield', 'barracks', 'city', 'factory', 'hq', 'shipyard']);
  assert.deepEqual(p.defences.map((i) => i.id), ['cannon_turret', 'sam_turret', 'artillery_turret', 'jammer']);
  assert.ok(!p.units.some((i) => i.id === 'sea_mine' || i.id === 'cracked_wall' || i.id === 'jammer'));
  assert.ok(p.units.every((i) => !i.neutralOk) && p.defences.every((i) => i.neutralOk));
});

test('storage: My maps and the draft; only playable maps reach the skirmish list, under their own ids', () => {
  const store = fakeStore();
  const good = EditorModel.blank(registry, { name: 'Twin Peaks' }).toRaw();
  const bad = { ...good, id: 'broken', units: [{ type: 'tank', owner: 7, x: 0, y: 0 }] };
  assert.ok(saveMap(good, store)); assert.ok(saveMap(bad, store));
  assert.deepEqual(Object.keys(savedMaps(store)).sort(), ['broken', 'twin_peaks']);
  const maps = customMaps(registry, store);
  assert.deepEqual(maps.map((m) => m.id), ['my-twin_peaks']);
  assert.match(maps[0].name, /my map/);
  deleteMap('broken', store);
  assert.deepEqual(Object.keys(savedMaps(store)), ['twin_peaks']);
  assert.equal(loadDraft(store), null);
  saveDraft(good, store);
  assert.equal(loadDraft(store).name, 'Twin Peaks');
  assert.deepEqual(savedMaps(null), {}, 'no storage: nothing saved, nothing thrown');
});

test('the editor screen builds, resumes the draft, and Play hands over a playable map (or lists what is wrong)', async () => {
  const store = fakeStore();
  const draft = EditorModel.blank(registry, { name: 'Resumed', width: 9, height: 7 }).toRaw();
  saveDraft(draft, store);
  const maps = [await loadMap(readData, registry, 'classic')];
  const played = [];
  const doc = new FakeDoc();
  const s = new EditorScreen(doc, { registry, maps, store, onPlay: (m) => played.push(m), win: {} });
  assert.equal(s.model.name, 'Resumed');
  const tabs = s.root.find((e) => /^ed-tab( |$)/.test(e.className));
  assert.deepEqual(tabs.map((t) => t.textContent), ['Terrain', 'Buildings', 'Units', 'Defences']);
  s.play();
  assert.equal(played.length, 1);
  assert.equal(played[0].width, 9);
  s.model.placeUnit(4, 4, 'tank', 0); s.model.paintTerrain(4, 4, 'mountain');
  s.model.terrain[3][1] = 'plain';   // no HQ for player 1 any more
  s.play();
  assert.equal(played.length, 1, 'not played');
  assert.equal(s.sheet.hidden, false, 'the problems are shown');
  s.remove();
});
