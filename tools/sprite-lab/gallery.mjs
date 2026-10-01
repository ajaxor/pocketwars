// Writes gallery/index.html: a static shell with the unit and faction data embedded. The page itself
// (gallery/preview.js) renders the real sprite code live, so nothing here draws. Run: node lab.mjs gallery
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO, units, weapons, factions, terrain } from './lib.mjs';

// "range 2–3" from the unit's longest-reaching weapon ("unarmed" when it has none)
const rangeNote = (u) => {
  const ws = (u.weapons || []).map((id) => weapons[id]).filter(Boolean);
  if (!ws.length) return 'unarmed';
  const w = ws.reduce((a, b) => (b.range[1] > a.range[1] ? b : a));
  return `range ${w.range[0] === w.range[1] ? w.range[0] : `${w.range[0]}–${w.range[1]}`}`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function build() {
  const data = {
    units: Object.entries(units).map(([id, u]) => ({
      id, name: u.name, sprite: u.render.sprite, altitude: u.render.altitude || 0,
      note: `${u.planned ? 'PLANNED, not in the game · ' : ''}${u.category} · move ${u.move} · ${rangeNote(u)}`,
    })),
    factions: Object.entries(factions).map(([id, f]) => ({ id, name: f.name, color: f.color, dark: f.dark })),
    terrain: { plain: terrain.plain.render.base ?? '#86b95c', road: terrain.road.render.base, sea: terrain.sea.render.base },
  };
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pocket Wars: unit art</title>
<style>
  :root { color-scheme: dark; --s: 96px; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #16181d; color: #e9e6dc; font: 15px/1.5 system-ui, sans-serif; }
  header, main { max-width: 980px; margin: 0 auto; padding: 0 16px; }
  header { padding-top: 20px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { margin: 4px 0 12px; color: #b9b5a8; }
  .controls { position: sticky; top: 0; z-index: 2; background: #16181dee; backdrop-filter: blur(6px); border-bottom: 1px solid #2a2d35; }
  .controls-inner { max-width: 980px; margin: 0 auto; padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; }
  .ctl { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #b9b5a8; }
  .seg { display: inline-flex; border: 1px solid #383c46; border-radius: 8px; overflow: hidden; }
  .seg button, #pause { background: #20232b; color: #e9e6dc; border: 0; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer; }
  .seg button + button { border-left: 1px solid #383c46; }
  .seg button[aria-pressed="true"], #pause[aria-pressed="true"] { background: #3c74d6; color: #fff; }
  #pause { border: 1px solid #383c46; border-radius: 8px; }
  input[type=range] { width: 130px; accent-color: #e8712c; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(var(--s) * 2 + 34px), 1fr)); gap: 12px; padding: 16px 0 48px; }
  .card { background: #1d2027; border: 1px solid #2a2d35; border-radius: 12px; padding: 10px; }
  .name { font-weight: 600; }
  .note { font-size: 12px; color: #8a877c; margin-bottom: 8px; }
  .row { display: flex; gap: 8px; }
  canvas { display: block; border-radius: 8px; flex: none; }
  .hint { font-size: 13px; color: #8a877c; }
  a { color: #8fc2ee; }
</style>
</head>
<body>
<header>
  <h1>Unit art</h1>
  <p>The real sprite code, drawn live with the animations running. Orange Star on the left, Violet Nebula on the right.</p>
</header>
<div class="controls"><div class="controls-inner">
  <div class="ctl">State <span class="seg" id="mode"><button data-v="idle" aria-pressed="true">Idle</button><button data-v="moving" aria-pressed="false">Moving</button><button data-v="done" aria-pressed="false">Done</button></span></div>
  <div class="ctl">Ground <span class="seg" id="bg"><button data-v="plain" aria-pressed="true">Grass</button><button data-v="road" aria-pressed="false">Road</button><button data-v="sea" aria-pressed="false">Sea</button></span></div>
  <div class="ctl">Outline <span class="seg" id="outline"><button data-v="off" aria-pressed="true">Off</button><button data-v="thin" aria-pressed="false">Thin</button><button data-v="medium" aria-pressed="false">Medium</button><button data-v="thick" aria-pressed="false">Thick</button></span></div>
  <div class="ctl">Line <span class="seg" id="outlineColor"><button data-v="navy" aria-pressed="true">Navy</button><button data-v="black" aria-pressed="false">Black</button><button data-v="faction" aria-pressed="false">Team dark</button></span></div>
  <div class="ctl">Size <input id="size" type="range" min="40" max="160" step="4" value="96" aria-label="Tile size"><output id="sizeOut">96 px</output></div>
  <button id="pause" aria-pressed="false">Pause</button>
</div></div>
<main>
  <div id="grid"></div>
  <p class="hint">Idle is what a ready unit does, Moving is the same at double speed, and Done is the dark-grey still pose of a unit that has acted. 40 px is a phone tile at 1x. Generated by <code>node tools/sprite-lab/lab.mjs gallery</code>.</p>
  <p class="hint"><a href="../">Back to the game</a></p>
</main>
<script type="module">
// Same cache-busting as the game: find the current build via version.json (fetched fresh), then load that build's copy of
// the gallery code, so a new deploy shows up immediately. In dev there is no version.json and the local files are used.
let base = './preview.js?t=' + Date.now();
try {
  const r = await fetch('../version.json', { cache: 'no-store' });
  if (r.ok) base = '../v/' + (await r.json()).hash + '/gallery/preview.js';
} catch {}
await import(base);
</script>
</body>
</html>
`;
  writeFileSync(path.join(REPO, 'gallery', 'index.html'), page);
  writeFileSync(path.join(REPO, 'gallery', 'data.json'), JSON.stringify(data));
  console.log('wrote gallery/index.html, gallery/data.json');
}
