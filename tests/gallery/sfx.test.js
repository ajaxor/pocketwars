// The gallery's Sound effects tab: gallery/sfx.json lists the clips, gallery/sfx/ holds them. The two must agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clipCount } from '../../gallery/sfx-view.js';

const galleryDir = fileURLToPath(new URL('../../gallery/', import.meta.url));
const data = JSON.parse(readFileSync(galleryDir + 'sfx.json', 'utf8'));
const clips = data.groups.flatMap((g) => g.clips);

test('every clip has an id, a prompt, a length and a file; ids and files are unique', () => {
  assert.ok(data.groups.length > 0 && clips.length > 0);
  for (const c of clips) {
    assert.match(c.id, /^[a-z0-9-]+$/, `clip id ${c.id}`);
    assert.ok(typeof c.prompt === 'string' && c.prompt.length > 0, `${c.id}: prompt`);
    assert.ok(c.seconds > 0 && c.seconds < 30, `${c.id}: length`);
    assert.equal(c.file, `sfx/${c.id}.mp3`, `${c.id}: file is sfx/<id>.mp3`);
  }
  assert.equal(new Set(clips.map((c) => c.id)).size, clips.length, 'ids are unique');
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

test('the first pass covers the three sounds a tank needs: attack, movement, death', () => {
  assert.deepEqual(data.groups.map((g) => g.id), ['attack', 'move', 'death']);
  for (const g of data.groups) assert.ok(g.clips.length >= 1, `${g.id} has a clip`);
});
