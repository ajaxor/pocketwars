#!/usr/bin/env node
// Renders the experimental concept units (gallery/concept-art.js, described in gallery/concepts.json) to a PNG contact sheet.
//   node concepts.mjs [--art gallery/concept-art-x.js --data gallery/parts/x.json] [--size 150] [--bg plain|sea|road] [--only id,id] [--t 0.35] [--moving] [--out file.png]
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE, REPO, factions, FACTION_IDS, paintTile, make } from './lib.mjs';
import { drawFrameAlpha } from '../../src/render/unit-frame.js';

const argv = process.argv.slice(2), arg = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) arg[argv[i].slice(2)] = true; else { arg[argv[i].slice(2)] = v; i++; } }
const mod = await import(pathToFileURL(path.join(REPO, arg.art || 'gallery/concept-art.js')).href);
const data = JSON.parse(readFileSync(path.join(REPO, arg.data || 'gallery/concepts.json'), 'utf8'));
const S = Number(arg.size || 150), cols = Number(arg.cols || 5), bg = arg.bg || 'plain', t = Number(arg.t ?? .35);
const only = typeof arg.only === 'string' ? arg.only.split(',') : null;
const list = data.units.filter((u) => mod.SPRITES[u.sprite] && (!only || only.includes(u.id)));   // walls and bases are drawn by structure-art.js, not as unit sprites
const pad = Math.round(S * .06), rows = Math.ceil(list.length / cols);
const cv = createCanvas(cols * 2 * (S + pad) + pad, rows * (S + pad) + pad), g = cv.getContext('2d');
g.fillStyle = '#16181d'; g.fillRect(0, 0, cv.width, cv.height);
list.forEach((u, i) => {
  FACTION_IDS.slice(0, 2).forEach((fid, fi) => {
    const x = pad + (((i % cols) * 2) + fi) * (S + pad), y = pad + Math.floor(i / cols) * (S + pad);
    const f = factions[fid];
    const water = !!u.water;
    paintTile(g, arg.bg ? bg : water ? 'sea' : 'plain', x, y, S);
    g.save(); g.translate(x + S / 2, y + S / 2);
    drawFrameAlpha(g, mod, u.sprite, { s: S, c: u.fixedColors?.color || f.color, dk: u.fixedColors?.dark || f.dark, alt: u.altitude || 0, w: t, ph: i * .9, run: 1, moving: !!arg.moving, make }, 1);
    g.restore();
  });
});
const out = path.join(HERE, 'out', arg.out || 'concepts.png');
mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, cv.toBuffer('image/png')); console.log('wrote', out, cv.width + 'x' + cv.height);

if (arg.check) {   // bounding box of every body (and its shadow) as a fraction of the tile; the tile spans -0.5 .. +0.5
  const R = 300, k = 200;
  for (const u of data.units.filter((u) => mod.SPRITES[u.sprite] && (!only || only.includes(u.id)))) {   // structures drawn as buildings or walls have no unit sprite
    const box = (only) => {
      const c2 = createCanvas(R * 2, R * 2), h = c2.getContext('2d'); h.translate(R, R);
      mod.SPRITES[u.sprite](h, { s: k, c: '#e8712c', dk: '#8a3d10', w: .35, ph: 0, run: 1, moving: true, b: 0, j: 0 });
      if (only === 'shadow') { h.clearRect(-R, -R, R * 2, R * 2); mod.SHADOWS[u.sprite](h, { s: k, alt: u.altitude || 0 }); }
      const d = h.getImageData(0, 0, R * 2, R * 2).data; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) if (d[(y * R * 2 + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return x1 < 0 ? null : { l: (x0 - R) / k, r: (x1 + 1 - R) / k, t: (y0 - R) / k, b: (y1 + 1 - R) / k };
    };
    const b = box(), sh = box('shadow'), f = (v) => v.toFixed(2).padStart(6);
    const alt = (u.altitude || 0), bt = b ? b.t - alt : 0, bb2 = b ? b.b - alt : 0;
    const notes = [];
    if (b && (b.l < -.5 || b.r > .5 || bt < -.5 || bb2 > .5)) notes.push('OVERFLOWS (after lift)');
    if (!sh && !u.water) notes.push('no shadow');
    console.log(u.id.padEnd(15), b ? `l${f(b.l)} r${f(b.r)} t${f(b.t)} b${f(b.b)}` : 'draws nothing', notes.join(', '));
  }
}
