// The shared sound review: decisions are kept in one store (and one localStorage key) for every gallery page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createReviewStore, clipsFor, REVIEW_KEY } from '../../gallery/sfx-review.js';
import { PAGE_CLIPS } from '../../gallery/sfx-panel.js';
import { soundsOf } from '../../gallery/units-view.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const data = JSON.parse(readFileSync(root + 'gallery/sfx.json', 'utf8'));
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const allIds = data.groups.flatMap((g) => g.clips.map((c) => c.id));
const fresh = allIds.find((id) => data.groups.flatMap((g) => g.clips).find((c) => c.id === id).status !== 'approved');
const approved = allIds.find((id) => data.groups.flatMap((g) => g.clips).find((c) => c.id === id).status === 'approved');

test('a decision shows up as the clip\'s status, is saved, and choosing it again undoes it', () => {
  const storage = memory(), s = createReviewStore(data, storage);
  assert.equal(s.statusOf(fresh), 'new');
  s.decide(fresh, 'rejected', ' too quiet ');
  assert.equal(s.statusOf(fresh), 'rejected');
  assert.equal(s.noteOf(fresh), 'too quiet');
  assert.equal(s.pendingCount(), 1);
  assert.ok(JSON.parse(storage.m.get(REVIEW_KEY))[fresh]);
  s.decide(fresh, 'rejected');
  assert.equal(s.statusOf(fresh), 'new');
  assert.equal(s.pendingCount(), 0);
});

test('a second store on the same storage (another page) sees the decisions, and changes notify subscribers', () => {
  const storage = memory(), a = createReviewStore(data, storage);
  let n = 0; a.subscribe(() => n++);
  a.decide(fresh, 'approved');
  assert.equal(n, 1);
  assert.equal(createReviewStore(data, storage).statusOf(fresh), 'approved');
});

test('a decision the file already holds, or for an unknown clip, is dropped; unknown clips cannot be decided', () => {
  const storage = memory();
  storage.setItem(REVIEW_KEY, JSON.stringify({ [approved]: { v: 'approved', note: '' }, ghost: { v: 'rejected', note: '' } }));
  const s = createReviewStore(data, storage);
  assert.equal(s.pendingCount(), 0);
  s.decide('ghost', 'approved');
  assert.equal(s.pendingCount(), 0);
  assert.equal(s.statusOf(approved), 'approved');
  s.decide(approved, 'rejected', 'muddy');
  assert.equal(s.statusOf(approved), 'rejected');
  s.decide(approved, 'approved');   // back to what the file says
  assert.equal(s.pendingCount(), 0);
});

test('the export text keeps the format Claude reads: approved ids, then rejected ones with their notes', () => {
  const s = createReviewStore(data, memory());
  assert.match(s.exportText(), /Approved \(0\): none/);
  s.decide(fresh, 'rejected', 'harsh');
  const other = allIds.find((id) => id !== fresh && createReviewStore(data, memory()).statusOf(id) === 'new');
  s.decide(other, 'approved');
  const text = s.exportText();
  assert.match(text, new RegExp(`^Sound review\\n\\nApproved \\(1\\): ${other}\\n\\nRejected, please redo \\(1\\):\\n- ${fresh}: harsh$`));
});

test('storage that throws (private window) does not break the store', () => {
  const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  const s = createReviewStore(data, broken);
  s.decide(fresh, 'approved');
  assert.equal(s.statusOf(fresh), 'approved');
});

test('clipsFor lists each mapped clip once and skips anything unmapped', () => {
  const m = data.map;
  const tank = clipsFor.unit(m, 'tank', ['cannon', 'cannon']);
  assert.deepEqual(tank.map(([id]) => id), [m.move.tank, m.death.tank, m.attack.cannon]);
  assert.deepEqual(clipsFor.unit(m, 'nobody', ['nothing']), []);
  assert.deepEqual(clipsFor.attack(m, 'cannon', 'blast').map(([id]) => id), [m.attack.cannon, m.impact.blast]);
});

test('every unit that is in the game has sounds to review, and every page clip is a real clip', () => {
  const units = JSON.parse(readFileSync(root + 'data/units.json', 'utf8')), weapons = JSON.parse(readFileSync(root + 'data/weapons.json', 'utf8'));
  for (const [id, u] of Object.entries(units)) {
    const pairs = soundsOf(data.map, { kind: 'unit', inGame: true, id, weapons: (u.weapons || []).map((w) => weapons[w]).filter(Boolean) });
    assert.ok(pairs.length >= 1, `${id} has a sound to review`);
    for (const [clip] of pairs) assert.ok(allIds.includes(clip), `${id}: ${clip}`);
  }
  assert.equal(soundsOf(data.map, { kind: 'unit', inGame: false, id: 'x', weapons: [] }), null, 'a concept makes no sound');
  for (const [page, spec] of Object.entries(PAGE_CLIPS)) {
    const pairs = [...clipsFor.events(data.map, spec.events || []), ...clipsFor.ui(data.map, spec.ui || [])];
    assert.ok(pairs.length > 0, `${page} has clips`);
    for (const [clip] of pairs) assert.ok(allIds.includes(clip));
  }
});
