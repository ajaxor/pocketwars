// Sprite lab library: game data, colour maths, style discovery, real-terrain backdrops.
//
// Two kinds of style are discovered automatically:
//   styles/*.mjs    export { meta, draw(g, id, o) }               free-form experiments (pixel, toy, badge...)
//   variants/*.js   export { meta, SPRITES, SHADOWS }             game-compatible sprite sets (same signature as
//                                                                  src/render/unit-sprites.js) - these can be
//                                                                  copied into the game as-is
// draw(g, id, o) paints one unit centred on (0,0) of a tile of size o.s
//   o = { s, c, dk, alt, w, ph, run, make, only }   only: 'body' | 'shadow' (game-compatible styles only)
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
const readJson = (p) => JSON.parse(readFileSync(path.join(REPO, p), 'utf8'));
export const units = readJson('data/units.json');
export const factions = readJson('data/factions.json');
export const terrain = readJson('data/terrain.json');
export const UNIT_IDS = Object.keys(units);
export const FACTION_IDS = Object.keys(factions);
export const make = (w, h) => createCanvas(w, h);

// ---- colour maths ----------------------------------------------------------------------------------------
export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
export const lighten = (h, t) => mix(h, '#ffffff', t);
export const darken = (h, t) => mix(h, '#000000', t);

// ---- backdrops: the game's own terrain drawing, so units are judged on what they will really sit on -------
const { TERRAIN_DECOR } = await import(pathToFileURL(path.join(REPO, 'src/render/terrain-sprites.js')).href);
export const TERRAIN_IDS = ['plain', 'forest', 'mountain', 'road', 'sea'].filter((t) => terrain[t]);

/** Paint one tile-sized backdrop. `bg` is a terrain id from data/terrain.json or a #rrggbb colour. */
export function paintTile(g, bg, x, y, S) {
  const t = terrain[bg];
  g.fillStyle = t ? t.render.base : bg; g.fillRect(x, y, S, S);
  if (t && t.render.decor && TERRAIN_DECOR[t.render.decor]) TERRAIN_DECOR[t.render.decor](g, x, y, S);
}
export const baseColor = (bg) => (terrain[bg] ? terrain[bg].render.base : bg);

// ---- styles ----------------------------------------------------------------------------------------------
const defaultShadow = (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, s * .31, s * .3, s * .06, 0, 0, 7); g.fill(); };

/** Wrap a game-compatible module ({ SPRITES, SHADOWS }) with the same frame logic as drawUnit() in the game. */
export function gameStyle(mod) {
  return {
    meta: mod.meta, kind: 'game', mod,
    draw(g, id, o) {
      const { s, c, dk, alt = 0, w = 0, ph = 0, run = 1, only } = o;
      const b = Math.sin(w * 5 + ph) * s * .025 * run, j = Math.sin(w * 14 + ph) * s * .012 * run;
      if (only !== 'body') { g.save(); (mod.SHADOWS?.[id] || defaultShadow)(g, { s, alt, w, ph, run }); g.restore(); }
      if (only !== 'shadow') {
        g.save(); if (alt) g.translate(0, -s * alt + Math.sin(w * 3 + ph) * s * .03 * run);
        mod.SPRITES[id](g, { s, c, dk, w, ph, run, b, j }); g.restore();
      }
    },
  };
}

export async function loadStyles() {
  const out = {};
  const load = async (dir, test) => {
    for (const f of readdirSync(path.join(HERE, dir)).sort()) {
      if (!/\.m?js$/.test(f)) continue;
      const m = await import(pathToFileURL(path.join(HERE, dir, f)).href);
      if (test(m)) out[m.meta.id] = m.SPRITES ? gameStyle(m) : m;
    }
  };
  await load('styles', (m) => m.meta && m.draw);
  await load('variants', (m) => m.meta && m.SPRITES);
  return out;
}

// ---- drawing ---------------------------------------------------------------------------------------------
/** Draw one unit into a tile whose top-left is (x, y). */
export function drawCell(g, style, id, fid, x, y, S, { bg = 'plain', t = .35, ph = 0, only } = {}) {
  if (bg) paintTile(g, bg, x, y, S);
  g.save(); g.translate(x + S / 2, y + S / 2);
  style.draw(g, id, { s: S, c: factions[fid].color, dk: factions[fid].dark, alt: units[id].render.altitude || 0, w: t, ph, run: 1, make, only });
  g.restore();
}
