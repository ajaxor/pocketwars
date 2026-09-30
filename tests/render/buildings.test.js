// Buildings: each kind draws for every owner colour and size, and each kind is drawn differently from the others.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../../src/render/buildings.js';
import { luma, rgb, shade } from '../../src/render/color.js';

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, p) => (typeof p === 'symbol' ? undefined : (...a) => { calls.push([p, ...a]); }),
    set: (_, p, v) => { calls.push(['=' + String(p), v]); return true; },
  });
  return { ctx, calls };
}
const drawn = (id, owner = '#e8712c', S = 40) => { const { ctx, calls } = recorder(); BUILDINGS[id](ctx, 0, 0, S, owner); return calls; };

test('there is a drawing for every kind of property', () => assert.deepEqual(Object.keys(BUILDINGS).sort(), ['airfield', 'barracks', 'city', 'factory', 'hq']));

test('every building draws for orange, blue and neutral owners at several sizes', () => {
  for (const id of Object.keys(BUILDINGS)) {
    for (const owner of ['#e8712c', '#3c74d6', '#b9b9b9', '#fff', '#000']) {
      for (const S of [24, 40, 160]) assert.ok(drawn(id, owner, S).length > 5, `${id} ${owner} @${S}`);
    }
  }
});

test('every kind is drawn differently from every other (the three producers must be told apart)', () => {
  const ids = Object.keys(BUILDINGS);
  const sig = Object.fromEntries(ids.map((id) => [id, JSON.stringify(drawn(id))]));
  for (const a of ids) for (const b of ids) if (a < b) assert.notEqual(sig[a], sig[b], `${a} vs ${b}`);
});

test('buildings use the owner colour, and it changes with the owner', () => {
  for (const id of Object.keys(BUILDINGS)) {
    assert.ok(drawn(id, '#e8712c').some((c) => c[0] === '=fillStyle' && c[1] === '#e8712c'), `${id}: owner colour is used`);
    assert.notEqual(JSON.stringify(drawn(id, '#e8712c')), JSON.stringify(drawn(id, '#3c74d6')), id);
  }
});

test('buildings stay inside their tile (plus a little for the flag, smoke and shadow)', () => {
  for (const id of Object.keys(BUILDINGS)) {
    for (const c of drawn(id, '#e8712c', 100)) {
      if (c[0] === 'moveTo' || c[0] === 'lineTo') assert.ok(c[1] >= -1 && c[1] <= 101 && c[2] >= -1 && c[2] <= 101, `${id}: ${c.join(',')}`);
      if (c[0] === 'fillRect') assert.ok(c[1] >= -1 && c[1] + c[3] <= 101 && c[2] >= -1 && c[2] + c[4] <= 101, `${id}: ${c.join(',')}`);
    }
  }
});

test('shade lightens and darkens, and understands short hex', () => {
  assert.equal(shade('#808080', 0), '#808080');
  assert.equal(shade('#000000', 1), '#ffffff');
  assert.equal(shade('#ffffff', -1), '#000000');
  assert.equal(shade('#fff', -1), '#000000');
  assert.ok(rgb(shade('#86b95c', -.3))[1] < rgb('#86b95c')[1]);
});

test('luma tells light colours from dark ones', () => {
  assert.ok(luma('#ffffff') > .99 && luma('#000000') < .01);
  assert.ok(luma('#b9b9b9') > .62 && luma('#3c74d6') < .62 && luma('#e8712c') < .62);
});
