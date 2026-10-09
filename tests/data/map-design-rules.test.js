// House rules for the shipped skirmish maps (they are data, so the rules are tests).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../data/maps/', import.meta.url);
const maps = readdirSync(DIR).filter((n) => n.endsWith('.map.json')).map((n) => JSON.parse(readFileSync(new URL(n, DIR), 'utf8')));
const MIN_WATER = 40;   // a shipyard needs a lake or sea of at least this many tiles (sea and shoals joined up) to sail on

const info = (m) => {
  const W = m.tiles[0].length, H = m.tiles.length;
  const ter = (x, y) => m.legend[m.tiles[y][x]];
  const at = (cb) => { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cb(ter(x, y), x, y)) out.push({ x, y, ...ter(x, y) }); return out; };
  return { W, H, ter, at };
};

test('a shipyard sits on a lake or sea big enough to sail, never a pond', () => {
  for (const m of maps) {
    const { W, H, ter, at } = info(m), water = (x, y) => ['sea', 'shoals'].includes(ter(x, y).terrain);
    const size = (x0, y0) => { const seen = new Set([y0 * W + x0]), st = [[x0, y0]]; while (st.length) { const [a, b] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = a + dx, d = b + dy; if (c < 0 || d < 0 || c >= W || d >= H || seen.has(d * W + c) || !water(c, d)) continue; seen.add(d * W + c); st.push([c, d]); } } return seen.size; };
    for (const y of at((t) => t.terrain === 'shipyard')) {
      const best = Math.max(0, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => y.x + dx >= 0 && y.y + dy >= 0 && y.x + dx < W && y.y + dy < H && water(y.x + dx, y.y + dy)).map(([dx, dy]) => size(y.x + dx, y.y + dy)));
      assert.ok(best >= MIN_WATER, `${m.id}: the shipyard at ${y.x},${y.y} only touches ${best} tiles of water`);
    }
  }
});

test('a factory away from its owner\'s HQ (in the middle of the map) starts neutral', () => {
  for (const m of maps) {
    const { W, H, at } = info(m), hqs = at((t) => t.terrain === 'hq');
    for (const f of at((t) => t.terrain === 'factory' && t.owner != null)) {
      const own = hqs.find((h) => h.owner === f.owner), toOwn = Math.abs(own.x - f.x) + Math.abs(own.y - f.y);
      const toCentre = Math.abs((W - 1) / 2 - f.x) + Math.abs((H - 1) / 2 - f.y);
      assert.ok(toOwn < toCentre, `${m.id}: the factory at ${f.x},${f.y} is nearer the middle than its owner's HQ, so it should be neutral`);
    }
  }
});

test('jammers are an advantage for the computer: one holds the middle, one sits in each enemy base, none are mirrored', () => {
  for (const m of maps.filter((x) => x.id !== 'classic' && x.id !== 'iron_curtain')) {   // (Iron Curtain keeps its jammers sealed in the middle bunker, by design)
    const { W, H, at } = info(m), jam = m.units.filter((u) => u.type === 'jammer'), hqs = at((t) => t.terrain === 'hq');
    const enemy = hqs.filter((h) => h.owner !== 0);
    assert.equal(jam.length, 1 + enemy.length, `${m.id}: a central jammer and one per enemy base`);
    for (const h of enemy) assert.ok(jam.some((j) => Math.abs(j.x - h.x) + Math.abs(j.y - h.y) <= 4), `${m.id}: a jammer in the base of player ${h.owner}`);
    for (const h of hqs.filter((x) => x.owner === 0)) assert.ok(!jam.some((j) => Math.abs(j.x - h.x) + Math.abs(j.y - h.y) <= 4), `${m.id}: no jammer in the human's own base`);
    const mirrored = jam.every((j) => jam.some((k) => k.x === W - 1 - j.x && k.y === H - 1 - j.y) || jam.some((k) => k.x === W - 1 - j.x && k.y === j.y));
    assert.ok(!mirrored, `${m.id}: the jammers are placed symmetrically`);
  }
});
