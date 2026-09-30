// Rebuilds gallery/img/*.png and gallery/index.html from whatever styles exist. Run: node lab.mjs gallery
import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { REPO } from './lib.mjs';
import * as R from './render.mjs';

const GROUPS = [
  {
    title: 'Flat variations',
    intro: 'Three takes on the flat look you liked, all drawn from the same shapes. Each unit now casts a shadow shaped like itself, has more detail, and the sniper, flak, fighter and bomber are redrawn. Row pairs are Orange Star / Blue Moon.',
    styles: ['current', 'flat-a', 'flat-b', 'flat-c'],
    focus: ['sniper', 'flak', 'fighter', 'bomber', 'infantry', 'copter'],
    loupe: ['flat-b', 'flak'],
    anim: ['flat-b', 'flak'],
  },
  {
    title: 'Earlier explorations',
    intro: 'The first round of different directions, kept for comparison.',
    styles: ['current', 'pixel', 'toy', 'badge'],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function build(styles, save) {
  const IMG = path.join(REPO, 'gallery', 'img');
  mkdirSync(IMG, { recursive: true });
  for (const f of readdirSync(IMG)) rmSync(path.join(IMG, f));          // no orphaned images
  const out = (name, cv) => { save(cv, path.join(IMG, name)); return `img/${name}`; };
  const pick = (id) => { if (!styles[id]) throw new Error(`gallery: style "${id}" not found`); return styles[id]; };
  const sheets = new Set();
  let html = '';

  GROUPS.forEach((grp, gi) => {
    const list = grp.styles.map(pick);
    const tag = gi === 0 ? 'flat' : 'earlier';
    html += `\n  <h2>${esc(grp.title)}</h2>\n  <p>${esc(grp.intro)}</p>\n`;
    html += `  <h3>Side by side at phone size</h3>\n  <p>Top to bottom: ${list.map((s) => esc(s.meta.name)).join(', ')}. About a 40 px tile on a 3x screen.</p>\n`;
    html += `  <div class="sheet full"><img src="${out(`compare-${tag}.png`, R.compare(list, { size: 120 }))}" alt="${esc(grp.title)} compared at phone size" loading="lazy"></div>\n`;
    const oneX = R.compare(list, { size: 40 });
    html += `  <h3>The same at 1x</h3>\n  <p>Native size, where readability is decided.</p>\n  <div class="sheet px"><img src="${out(`compare-${tag}-1x.png`, oneX)}" alt="${esc(grp.title)} at 1x" style="width:${oneX.width}px"></div>\n`;
    if (grp.focus) {
      html += `  <h3>Before and after</h3>\n  <p>Columns: ${list.map((s) => esc(s.meta.name)).join(', ')}. Units: ${grp.focus.join(', ')}.</p>\n`;
      html += `  <div class="sheet full"><img src="${out(`focus-${tag}.png`, R.unitsGrid(list, grp.focus, { size: 150 }))}" alt="Before and after" loading="lazy" style="max-width:${list.length * 160 + 20}px"></div>\n`;
    }
    if (grp.loupe) {
      const [sid, uid] = grp.loupe;
      html += `  <h3>Loupe: ${esc(uid)}</h3>\n  <p>${esc(pick(sid).meta.name)} large, at phone size and at 1x on every terrain.</p>\n  <div class="sheet full"><img src="${out(`zoom-${sid}-${uid}.png`, R.zoom(pick(sid), uid))}" alt="${uid} loupe" loading="lazy"></div>\n`;
    }
    if (grp.anim) {
      const [sid, uid] = grp.anim;
      html += `  <h3>Animation: ${esc(uid)}</h3>\n  <p>One second of the idle animation in eight frames.</p>\n  <div class="sheet"><img src="${out(`anim-${sid}-${uid}.png`, R.anim(pick(sid), uid, { frames: 8, period: 1, size: 130 }))}" alt="${uid} animation" loading="lazy"></div>\n`;
    }
    for (const s of list) {
      if (s.meta.id === 'current' && gi > 0) continue;
      if (sheets.has(s.meta.id)) continue; sheets.add(s.meta.id);
      html += `  <h3>${esc(s.meta.name)}</h3>\n  <p>${esc(s.meta.blurb)}</p>\n  <div class="sheet${s.meta.id === 'pixel' ? ' px' : ''}"><img src="${out(`sheet-${s.meta.id}.png`, R.sheet(s, { size: 176 }))}" alt="${esc(s.meta.name)}" loading="lazy"></div>\n`;
    }
  });

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pocket Wars: unit art styles</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #16181d; color: #e9e6dc; font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 900px; margin: 0 auto; padding: 20px 16px 60px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 40px 0 4px; padding-top: 14px; border-top: 1px solid #2a2d35; }
  h3 { font-size: 15px; margin: 22px 0 2px; }
  p { margin: 4px 0 10px; color: #b9b5a8; }
  .sheet { overflow-x: auto; border-radius: 10px; background: #86b95c; -webkit-overflow-scrolling: touch; }
  .sheet img { display: block; height: auto; max-width: none; width: 1100px; }
  .full img { width: 100%; max-width: 100%; }
  .px img { image-rendering: pixelated; }
  .hint { font-size: 13px; color: #8a877c; }
  a { color: #8fc2ee; }
</style>
</head>
<body>
<main>
  <h1>Unit art styles</h1>
  <p>Every unit, both factions, drawn by the same code that would ship in the game. Swipe sideways on the wide sheets.</p>
${html}
  <p class="hint" style="margin-top:32px">Generated by <code>node tools/sprite-lab/lab.mjs gallery</code>. Add a style file and rerun to include it.</p>
  <p class="hint"><a href="../">Back to the game</a></p>
</main>
</body>
</html>
`;
  writeFileSync(path.join(REPO, 'gallery', 'index.html'), page);
  console.log('wrote gallery/index.html');
}
