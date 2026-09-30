#!/usr/bin/env node
// Sprite lab CLI: render unit art to PNG headlessly so it can be looked at, judged and refined in a loop.
//   node lab.mjs help
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { view, HERE, units, factions, UNIT_IDS, FACTION_IDS, loadStyles } from './lib.mjs';
import * as R from './render.mjs';

const OUT_DIR = path.join(HERE, 'out');

// ---- argument parsing: positionals go to _, --key value / --flag to the rest ---------------------------------
function parse(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) a[k] = true; else { a[k] = v; i++; } } else a._.push(argv[i]);
  }
  return a;
}
const args = parse(process.argv.slice(2));
view.moving = !!args.moving;   // --moving: show the walk cycle (foot units only step while moving)
view.submerged = !!args.submerged;   // --submerged: draw units that can dive as dived
const cmd = args._[0] || 'help';
const num = (v, d) => (v === undefined || v === true ? d : Number(v));
const list = (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : null);

function save(canvas, file, dir = OUT_DIR) {
  const out = path.isAbsolute(file) ? file : path.join(dir, file);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(`wrote ${path.relative(process.cwd(), out)}  (${canvas.width}x${canvas.height})`);
  return out;
}
const die = (m) => { console.error(m); process.exit(1); };

// ---- commands ---------------------------------------------------------------------------------------------------
const COMMANDS = {
  // node lab.mjs list
  list(styles) {
    for (const [id, s] of Object.entries(styles)) console.log(`${id.padEnd(10)} ${s.kind === 'game' ? '[game-compatible]' : '[free-form]      '}  ${s.meta.name} - ${s.meta.blurb}`);
  },

  // node lab.mjs sheet <style> [--size 176] [--bg plain] [--t 0.35] [--out file.png]
  sheet(styles) {
    const st = pick(styles, args._[1]); const size = num(args.size, 176);
    save(R.sheet(st, { size, t: num(args.t, .35), bg: args.bg || 'plain' }), args.out || `sheet-${st.meta.id}-${size}.png`);
  },

  // node lab.mjs compare [style,style,...] [--size 120] [--bg plain]   (default: every style)
  compare(styles) {
    const names = list(args._[1]) || Object.keys(styles); const size = num(args.size, 120);
    save(R.compare(names.map((n) => pick(styles, n)), { size, t: num(args.t, .35), bg: args.bg || 'plain' }), args.out || `compare-${names.join('+')}-${size}.png`);
  },

  // node lab.mjs units <style,style,...> <unit,unit,...> [--size 150] [--faction blue_moon]   styles as columns, units as rows
  units(styles) {
    const names = list(args._[1]); const ids = list(args._[2]);
    if (!names || !ids) die('usage: units <style,style,...> <unit,unit,...>');
    ids.forEach((u) => { if (!units[u]) die(`unknown unit "${u}". Units: ${UNIT_IDS.join(', ')}`); });
    save(R.unitsGrid(names.map((n) => pick(styles, n)), ids, { size: num(args.size, 150), t: num(args.t, .35), faction: args.faction || undefined, bg: args.bg || 'plain' }), args.out || `units-${ids.join('+')}-${names.join('+')}.png`);
  },

  // node lab.mjs zoom <style> <unit>   big view + phone size + 1x, on every terrain
  zoom(styles) {
    const st = pick(styles, args._[1]); const id = args._[2];
    if (!units[id]) die(`unknown unit "${id}". Units: ${UNIT_IDS.join(', ')}`);
    save(R.zoom(st, id, { t: num(args.t, .35) }), args.out || `zoom-${st.meta.id}-${id}.png`);
  },

  // node lab.mjs anim <style> <unit> [--frames 8] [--period 1.2]   filmstrip across the animation clock
  anim(styles) {
    const st = pick(styles, args._[1]); const id = args._[2];
    if (!units[id]) die(`unknown unit "${id}". Units: ${UNIT_IDS.join(', ')}`);
    save(R.anim(st, id, { frames: num(args.frames, 8), period: num(args.period, 1.2), size: num(args.size, 140), faction: args.faction || undefined }), args.out || `anim-${st.meta.id}-${id}.png`);
  },

  // node lab.mjs check [style|all]   numbers instead of eyeballing: size, overflow, shadow fit
  check(styles) {
    const which = args._[1] && args._[1] !== 'all' ? [args._[1]] : Object.keys(styles).filter((k) => styles[k].kind === 'game');
    const S = 200, t = num(args.t, .35); let warnings = 0;
    const bbox = (st, id, only) => {
      const R = S * 3, cv = createCanvas(R, R), g = cv.getContext('2d');
      g.translate(R / 2, R / 2);
      st.draw(g, id, { s: S, c: factions[FACTION_IDS[0]].color, dk: factions[FACTION_IDS[0]].dark, alt: units[id].render.altitude || 0, w: t, ph: 0, run: 1, make: (w, h) => createCanvas(w, h), only });
      const d = g.getImageData ? cv.getContext('2d').getImageData(0, 0, R, R).data : null;
      let x0 = R, y0 = R, x1 = -1, y1 = -1;
      for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) if (d[(y * R + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      const f = (v) => v / S; return { l: f(x0 - R / 2), r: f(x1 + 1 - R / 2), t: f(y0 - R / 2), b: f(y1 + 1 - R / 2) };
    };
    for (const name of which) {
      const st = pick(styles, name);
      if (st.kind !== 'game') { console.log(`${name}: check needs a game-compatible style (variants/*.js)`); continue; }
      console.log(`\n${name}   (values as a fraction of the tile; the tile spans -0.50 .. +0.50)`);
      console.log('unit         width  height  bottom  | shadow w  shadow/body  shadow-centre-x  notes');
      for (const id of UNIT_IDS) {
        const body = bbox(st, id, 'body'), sh = bbox(st, id, 'shadow');
        if (!body) { console.log(`${id.padEnd(12)} (draws nothing!)`); warnings++; continue; }
        const bw = body.r - body.l, bh = body.b - body.t, sw = sh ? sh.r - sh.l : 0;
        const notes = [];
        if (body.l < -.5 || body.r > .5 || body.t < -.5 || body.b > .5) notes.push('OVERFLOWS TILE');
        if (!sh) notes.push('NO SHADOW');
        else {
          const air = units[id].render.altitude;
          const ratio = sw / bw, min = units[id].category === 'infantry' ? .45 : .7; if (!air && (ratio < min || ratio > 1.25)) notes.push('shadow width off');
          if (!air && units[id].category !== 'infantry' && Math.abs((sh.l + sh.r) / 2 - (body.l + body.r) / 2) > .06) notes.push('shadow off-centre');
          if (!air && Math.abs(sh.b - body.b) > .06 && sh.t > body.b + .01) notes.push('shadow detached');
        }
        if (bw < .3 && bh < .3) notes.push('very small');
        if (notes.length) warnings++;
        const f = (v) => v.toFixed(2).padStart(6);
        console.log(`${id.padEnd(12)} ${f(bw)} ${f(bh)}  ${f(body.b)}  |${f(sw)}    ${f(sh ? sw / bw : 0)}      ${f(sh ? (sh.l + sh.r) / 2 : 0)}        ${notes.join(', ')}`);
      }
    }
    console.log(warnings ? `\n${warnings} unit(s) with notes` : '\nall clear');
  },

  // node lab.mjs gallery   regenerate gallery/index.html (the live, animated preview page)
  async gallery() { (await import('./gallery.mjs')).build(); },

  help() {
    console.log(`Sprite lab: render unit art to PNG (in tools/sprite-lab/out/) and look at it.

  node lab.mjs list                                       all styles found
  node lab.mjs sheet <style> [--size 176] [--bg plain]    every unit x both factions
  node lab.mjs compare [a,b,c] [--size 120]               styles stacked for side-by-side (default: all)
  node lab.mjs units <a,b,c> <unit,unit> [--size 150]     chosen units, styles as columns (before/after)
  node lab.mjs zoom <style> <unit>                        one unit big + phone size + 1x on every terrain
  node lab.mjs anim <style> <unit> [--frames 8]           animation filmstrip
  node lab.mjs check [style|all]                          bounds, shadow fit and size as numbers
  node lab.mjs gallery                                    rebuild gallery/index.html (the live animated page)

Common flags: --bg plain|forest|mountain|road|sea|#rrggbb   --t <seconds into the animation>   --out <file.png>
Sizes: 40 = a phone tile at 1x, 120 = the same tile on a 3x screen, 176+ = inspect detail.
Units: ${UNIT_IDS.join(', ')}`);
  },
};

function pick(styles, name) {
  if (!name) die(`give a style name. Available: ${Object.keys(styles).join(', ')}`);
  if (!styles[name]) die(`unknown style "${name}". Available: ${Object.keys(styles).join(', ')}`);
  return styles[name];
}

if (!COMMANDS[cmd]) die(`unknown command "${cmd}". Try: node lab.mjs help`);
await COMMANDS[cmd](await loadStyles());
