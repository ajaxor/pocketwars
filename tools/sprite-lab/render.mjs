// Canvas builders shared by the CLI (lab.mjs) and the gallery generator. Each returns a canvas; nothing here writes files.
import { createCanvas } from '@napi-rs/canvas';
import { units, UNIT_IDS, FACTION_IDS, TERRAIN_IDS, drawCell, baseColor } from './lib.mjs';

/** Grid of S-sized tiles on a `bg` margin. draw(g, col, row, x, y) paints one tile. */
export function grid(cols, rows, S, bg, draw, { pad = Math.round(S * .08) } = {}) {
  const W = cols * S + (cols + 1) * pad, H = rows * S + (rows + 1) * pad;
  const cv = createCanvas(W, H), g = cv.getContext('2d');
  g.fillStyle = baseColor(bg); g.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) draw(g, c, r, pad + c * (S + pad), pad + r * (S + pad));
  return cv;
}

/** Every unit x both factions for one style. */
export function sheet(style, { size = 176, t = .35, bg = 'plain' } = {}) {
  return grid(UNIT_IDS.length, FACTION_IDS.length, size, bg, (g, c, r, x, y) => drawCell(g, style, UNIT_IDS[c], FACTION_IDS[r], x, y, size, { bg, t, ph: c * .9 }));
}

/** Styles stacked (both factions each) for side-by-side comparison. */
export function compare(styleList, { size = 120, t = .35, bg = 'plain' } = {}) {
  const F = FACTION_IDS.length;
  return grid(UNIT_IDS.length, styleList.length * F, size, bg,
    (g, c, r, x, y) => drawCell(g, styleList[Math.floor(r / F)], UNIT_IDS[c], FACTION_IDS[r % F], x, y, size, { bg, t, ph: c * .9 }), { pad: Math.round(size * .05) });
}

/** Chosen units (rows) across styles (columns): the before/after view. */
export function unitsGrid(styleList, ids, { size = 150, t = .35, faction = FACTION_IDS[FACTION_IDS.length - 1], bg = 'plain' } = {}) {
  return grid(styleList.length, ids.length, size, bg, (g, c, r, x, y) => drawCell(g, styleList[c], ids[r], faction, x, y, size, { bg, t }));
}

/** One unit big, at phone size and at 1x, on every terrain: the loupe. */
export function zoom(style, id, { t = .35 } = {}) {
  const BIG = 300, MID = 120, SM = 40, pad = 12, F = FACTION_IDS.length;
  const W = BIG + pad * 3 + TERRAIN_IDS.length * (MID + pad);
  const H = Math.max(F * (BIG + pad) + pad, pad * 4 + F * (MID + pad) + F * (SM + pad));
  const cv = createCanvas(W, H), g = cv.getContext('2d'); g.fillStyle = '#1b1d22'; g.fillRect(0, 0, W, H);
  FACTION_IDS.forEach((fid, r) => drawCell(g, style, id, fid, pad, pad + r * (BIG + pad), BIG, { bg: 'plain', t }));
  const x0 = BIG + pad * 2, y1 = pad * 2 + F * (MID + pad);
  FACTION_IDS.forEach((fid, r) => TERRAIN_IDS.forEach((tid, c) => {
    drawCell(g, style, id, fid, x0 + c * (MID + pad), pad + r * (MID + pad), MID, { bg: tid, t });
    drawCell(g, style, id, fid, x0 + c * (SM + pad), y1 + r * (SM + pad), SM, { bg: tid, t });
  }));
  return cv;
}

/** Animation filmstrip across one period of the animation clock. */
export function anim(style, id, { frames = 8, period = 1.2, size = 140, faction = FACTION_IDS[0] } = {}) {
  return grid(frames, 1, size, 'plain', (g, c, r, x, y) => drawCell(g, style, id, faction, x, y, size, { t: c * period / frames }), { pad: 6 });
}

export { units };
