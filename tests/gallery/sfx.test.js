// The gallery's Sound effects tab: gallery/sfx.json lists the clips and maps units, weapon looks and events to them; gallery/sfx/ holds the files.
// The list, the files and the game's data must agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clipCount } from '../../gallery/sfx-view.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const galleryDir = root + 'gallery/';
const json = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const data = json('gallery/sfx.json');
const units = json('data/units.json');
const weapons = json('data/weapons.json');
const clips = data.groups.flatMap((g) => g.clips);
const ids = new Set(clips.map((c) => c.id));

test('every clip has an id, a prompt, a length and a file; ids and files are unique', () => {
  assert.ok(data.groups.length > 0 && clips.length > 0);
  for (const c of clips) {
    assert.match(c.id, /^[a-z0-9_-]+$/, `clip id ${c.id}`);
    assert.ok(typeof c.prompt === 'string' && c.prompt.length > 0, `${c.id}: prompt`);
    assert.ok(c.seconds > 0 && c.seconds < 30, `${c.id}: length`);
    assert.equal(c.file, `sfx/${c.id}.mp3`, `${c.id}: file is sfx/<id>.mp3`);
  }
  assert.equal(ids.size, clips.length, 'ids are unique');
  assert.equal(clipCount(data), clips.length);
});

test('every listed file exists and is an mp3, and no file in gallery/sfx is left unlisted', () => {
  for (const c of clips) {
    const bytes = readFileSync(galleryDir + c.file);
    const id3 = bytes.subarray(0, 3).toString('latin1') === 'ID3';
    const frame = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;   // an MPEG frame sync
    assert.ok(bytes.length > 1000 && (id3 || frame), `${c.file} is not an mp3`);
  }
  const onDisk = readdirSync(galleryDir + 'sfx').filter((f) => f.endsWith('.mp3')).sort();
  assert.deepEqual(onDisk, clips.map((c) => `${c.id}.mp3`).sort(), 'files on disk match sfx.json');
});

test('the groups are attack, impact, movement, death and UI', () => {
  assert.deepEqual(data.groups.map((g) => g.id), ['attack', 'impact', 'move', 'death', 'ui']);
  for (const g of data.groups) assert.ok(g.clips.length >= 1, `${g.id} has a clip`);
});

test('each clip is new or approved; tank-move-2 is approved; the tank moves once with a fade, not looped', () => {
  for (const c of clips) assert.ok([undefined, 'new', 'approved'].includes(c.status), `${c.id}: status ${c.status}`);
  assert.ok(clips.find((c) => c.id === 'tank-move-2').status === 'approved');
  assert.equal(data.movePlayback.loop, false);
  assert.ok(data.movePlayback.fadeInMs > 0 && data.movePlayback.fadeOutMs > 0);
  assert.equal(data.movePlayback.stopWhenMoveEnds, true);
});

test('every mapping points at a listed clip', () => {
  for (const [table, rows] of Object.entries(data.map)) {
    for (const [key, id] of Object.entries(rows)) assert.ok(ids.has(id), `map.${table}.${key} -> ${id} is not a clip`);
  }
});

test('every weapon look has an attack sound, and every impact style an impact sound', () => {
  for (const w of Object.values(weapons)) assert.ok(data.map.attack[w.fx], `weapon look "${w.fx}" has no attack sound`);
  for (const style of ['blast', 'spark', 'fire', 'zap', 'splash', 'flak']) assert.ok(data.map.impact[style], `impact "${style}" has no sound`);
});

test('every unit that moves has a movement sound, and every unit a death sound', () => {
  for (const [id, u] of Object.entries(units)) {
    assert.ok(data.map.death[id], `${id} has no death sound`);
    const moves = u.move > 0 && u.category !== 'structure' && u.category !== 'mine';
    if (moves) assert.ok(data.map.move[id], `${id} has no movement sound`);
    else assert.equal(data.map.move[id], undefined, `${id} does not move`);
  }
});

test('every engine event the game announces has a sound', () => {
  const messages = readFileSync(root + 'src/ui/messages.js', 'utf8');
  const types = [...messages.matchAll(/ev\.type === '(\w+)'/g)].map((m) => m[1]);
  const covered = new Set(Object.keys(data.map.events).map((k) => k.split('-')[0]));
  for (const t of new Set(types)) assert.ok(t === 'strike' || covered.has(t), `event "${t}" has no sound`);
  for (const k of ['tap', 'select', 'confirm', 'cancel', 'undo', 'invalid', 'menu-open', 'menu-close', 'end-turn', 'your-turn', 'enemy-turn']) assert.ok(data.map.ui[k], `UI "${k}" has no sound`);
});
