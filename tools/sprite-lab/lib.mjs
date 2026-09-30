// Shared helpers for the sprite lab: palettes, colour maths, and the contact-sheet renderer.
// A "style" is a module exporting { meta, draw(g, id, o) }.
//   draw() paints one unit centred on (0,0) of a tile of size o.s
//   o = { s, c, dk, alt, w, run, make(w,h) -> canvas }   (alt = altitude fraction from units.json)
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
export const units = JSON.parse(readFileSync(`${REPO}/data/units.json`, 'utf8'));
export const factions = JSON.parse(readFileSync(`${REPO}/data/factions.json`, 'utf8'));
export const UNIT_IDS = Object.keys(units);

export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
export const lighten = (h, t) => mix(h, '#ffffff', t);
export const darken = (h, t) => mix(h, '#000000', t);

export const make = (w, h) => createCanvas(w, h);

/** Draw every unit for both factions on a grass-coloured contact sheet. */
export function renderSheet(style, S, out, { bg = '#7fae5a', now = 0 } = {}) {
  const fids = Object.keys(factions);
  const pad = Math.round(S * 0.1);
  const W = UNIT_IDS.length * S + (UNIT_IDS.length + 1) * pad;
  const H = fids.length * S + (fids.length + 1) * pad;
  const cv = createCanvas(W, H);
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  fids.forEach((fid, r) => UNIT_IDS.forEach((id, c) => {
    const px = pad + c * (S + pad), py = pad + r * (S + pad);
    g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(px, py, S, S);
    g.save(); g.translate(px + S / 2, py + S / 2);
    style.draw(g, id, { s: S, c: factions[fid].color, dk: factions[fid].dark, alt: units[id].render.altitude || 0, w: now, run: 1, make });
    g.restore();
  }));
  writeFileSync(out, cv.toBuffer('image/png'));
  return { W, H };
}
