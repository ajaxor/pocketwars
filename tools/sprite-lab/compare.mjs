// Side-by-side: every style, both factions interleaved, at phone-realistic tile sizes.
// usage: node compare.mjs <out.png> <S> style1 style2 ...
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { UNIT_IDS, units, factions, make } from './lib.mjs';

const [out, Sarg, ...names] = process.argv.slice(2);
const S = Number(Sarg);
const fids = Object.keys(factions);
const pad = Math.round(S * .08), label = 0;
const mods = await Promise.all(names.map((n) => import(`./styles/${n}.mjs`)));
const cols = UNIT_IDS.length;
const W = cols * S + (cols + 1) * pad;
const rowH = fids.length * S + pad;
const H = mods.length * rowH + pad;
const cv = createCanvas(W, H); const g = cv.getContext('2d');
g.fillStyle = '#7fae5a'; g.fillRect(0, 0, W, H);
mods.forEach((m, mi) => fids.forEach((fid, r) => UNIT_IDS.forEach((id, c) => {
  const px = pad + c * (S + pad), py = pad + mi * rowH + r * S;
  g.save(); g.translate(px + S / 2, py + S / 2);
  m.draw(g, id, { s: S, c: factions[fid].color, dk: factions[fid].dark, alt: units[id].render.altitude || 0, w: 0, run: 1, make });
  g.restore();
})));
writeFileSync(out, cv.toBuffer('image/png'));
console.log('wrote', out, W + 'x' + H);
