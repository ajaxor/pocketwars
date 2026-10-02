// Generates the campaign continent: a coastline, one land per nation (a Voronoi split of the continent around each capital) and a
// few islands, all warped by one smooth field so shared borders stay shared. It rewrites `nations[].outline`, `nations[].capital`
// and `islands` in data/campaign.json and leaves everything else alone.
//
//   node tools/make-continent.mjs          regenerate (deterministic: the same input always gives the same continent)
//   node tools/make-continent.mjs --svg    also write a preview to continent.svg in the current directory
//
// Edit SEEDS to move a capital (the id must match a nation in the data); HOME is the player's island. Map space is 100 wide by 120 tall.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/campaign.json', import.meta.url);
const SEEDS = {
  north: [52, 20], northwest: [24, 34], northeast: [73, 33],
  west: [17, 64], centre: [50, 54], east: [82, 62],
  southwest: [28, 91], south: [60, 94],
};
const HOME = { id: 'island', centre: [88, 105], radius: 7 };   // the player's hideout: a nation on its own island, not part of the split
const ISLANDS = [[[8, 108], 4.2, 1.1], [[6, 14], 3.0, 0.4], [[95, 12], 2.4, 1.9]];   // [centre, radius, phase]

// the field that bends every point; low frequencies only, so it cannot tear a border or fold the coast over itself
const warp = ([x, y]) => [
  x + 2.8 * Math.sin(y * 0.19 + 1.3) + 1.6 * Math.sin(x * 0.31 + y * 0.13) + 0.9 * Math.sin(y * 0.55 + x * 0.21),
  y + 2.4 * Math.sin(x * 0.17 + 0.4) + 1.5 * Math.sin(y * 0.29 - x * 0.11) + 0.8 * Math.sin(x * 0.5 + y * 0.23),
];

const angDist = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
const dent = (a, at, width, depth) => 1 - depth * Math.exp(-((angDist(a, at) / width) ** 2));

function coast(n = 400) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let r = 1 + 0.09 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a + 2) + 0.04 * Math.sin(8 * a);
    r += 0.03 * Math.sin(11 * a + 0.5) + 0.022 * Math.sin(17 * a + 2.1) + 0.016 * Math.sin(29 * a + 4) + 0.01 * Math.sin(43 * a + 1);   // ragged shore
    r *= dent(a, Math.PI + 0.35, 0.3, 0.2) * dent(a, 1.1, 0.22, 0.2) * dent(a, 5.3, 0.2, 0.08);      // a bay in the west, an inlet in the south-east, a gulf in the north-east
    r *= 1 + 0.09 * Math.exp(-((angDist(a, 1.75) / 0.17) ** 2)) + 0.12 * Math.exp(-((angDist(a, 3.7) / 0.14) ** 2));   // a peninsula in the south and a cape in the north-west
    pts.push([50 + 41 * r * Math.cos(a), 60 + 52 * r * Math.sin(a)]);
  }
  return pts;
}

/** Keep the part of polygon `poly` that is nearer to `a` than to `b`. */
function clip(poly, a, b) {
  const side = (p) => (p[0] - (a[0] + b[0]) / 2) * (b[0] - a[0]) + (p[1] - (a[1] + b[1]) / 2) * (b[1] - a[1]);   // < 0 on a's side
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

/** Cut long straight edges into short ones so the warp can bend them. */
function subdivide(poly, step = 1.6) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let k = 0; k < n; k++) out.push([p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]);
  }
  return out;
}

const round = (v) => Math.round(v * 10) / 10;
const land = coast();
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const blob = (c, r, ph, n = 22) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 1 + 0.26 * Math.sin(3 * a + ph) + 0.14 * Math.sin(5 * a + 1); return [c[0] + r * k * Math.cos(a), c[1] + r * k * 0.8 * Math.sin(a)]; });
for (const n of data.nations) {
  if (n.id === HOME.id) {
    n.outline = blob(HOME.centre, HOME.radius, 0.7, 30).map(([x, y]) => [round(x), round(y)]);   // small, so it is not warped
    n.capital = HOME.centre;
    continue;
  }
  const seed = SEEDS[n.id]; if (!seed) throw new Error(`no seed for nation "${n.id}"`);
  let poly = land;
  for (const [id, other] of Object.entries(SEEDS)) if (id !== n.id) poly = clip(poly, seed, other);
  n.outline = subdivide(poly).map(warp).map(([x, y]) => [round(x), round(y)]);
  n.capital = warp(seed).map(round);
}
data.islands = ISLANDS.map(([c, r, ph]) => {
  const pts = [];
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, k = 1 + 0.28 * Math.sin(3 * a + ph) + 0.15 * Math.sin(5 * a); pts.push([round(c[0] + r * k * Math.cos(a)), round(c[1] + r * k * 0.8 * Math.sin(a))]); }
  return pts;
});

// one line per outline keeps the file readable
const text = JSON.stringify(data, null, 1).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1,$2]').replace(/\[\s+(\[-?[\d.]+,-?[\d.]+\](?:,\s+\[-?[\d.]+,-?[\d.]+\])*)\s+\]/g, (m) => m.replace(/\s+/g, ' '));
writeFileSync(FILE, text + '\n');
console.log(`wrote ${data.nations.length} nations and ${data.islands.length} islands to data/campaign.json`);

if (process.argv.includes('--svg')) {
  const cols = ['#9a5fd8', '#e0508a', '#f2c81e', '#2f86d6', '#7cc4a0', '#22a06b', '#d6453d', '#e8712c'];
  const poly = (o, fill) => `<polygon points="${o.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="#0b1830" stroke-width=".5"/>`;
  writeFileSync('continent.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="500" height="600"><rect width="100" height="120" fill="#0a1226"/>${data.islands.map((o) => poly(o, '#5a6a50')).join('')}${data.nations.map((n, i) => poly(n.outline, cols[i % 8])).join('')}${data.nations.map((n) => `<circle cx="${n.capital[0]}" cy="${n.capital[1]}" r="1.5" fill="#fff"/>`).join('')}</svg>`);
}
