// The terrain gallery page (terrain.html): one sampler sheet per tileset, drawn with the game's own terrain layer (the same code the map uses).
import { fetchReader, loadRegistry } from '../src/data/loader.js';
import { drawTerrainLayer } from '../src/render/terrain-layer.js';

/** Letters -> terrain ids for the sampler below. */
export const KEY = { '.': 'plain', f: 'forest', m: 'mountain', r: 'rough', '=': 'road', '~': 'sea', s: 'shoals', c: 'city', h: 'hq', F: 'factory', k: 'cliff', d: 'snow_drift', u: 'dune', M: 'mud', x: 'ruin_city', X: 'ruin_factory' };
export const SAMPLER = [
  '~~~ss..ffff..mmm.',
  '~~s..=====..mmmm.',
  '~~...=.c.F..kkkk.',
  '.....=..f...kkkk.',
  '.rr..=..hf..kkkk.',
  '.rr..=...xX.ddu..',
  'ffff.=.......uuMM',
  'ffff.======..MM..',
];

/** Draw one tileset's sampler onto `canvas` at `S` pixels a tile. */
export function drawSampler(canvas, registry, tilesetId, S) {
  const w = SAMPLER[0].length, h = SAMPLER.length, d = globalThis.devicePixelRatio || 1;
  canvas.width = w * S * d; canvas.height = h * S * d; canvas.style.width = w * S + 'px';
  const g = canvas.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  const ground = registry.groundDef(registry.tilesetDef(tilesetId).ground);
  const terrainAt = (x, y) => registry.skin(tilesetId, KEY[SAMPLER[y][x]]);
  drawTerrainLayer(g, { width: w, height: h, S, now: 0, terrainAt, groundAt: () => ground, ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? '#e8712c' : null) });
}

if (typeof document !== 'undefined') {
  const registry = await loadRegistry(fetchReader(new URL('../data/', import.meta.url)));
  const host = document.getElementById('sets'), slider = document.getElementById('size'), out = document.getElementById('sizeOut');
  const sheets = [];
  for (const id of registry.tilesetIds) {
    const t = registry.tilesets[id], home = t.faction ? registry.factions[t.faction]?.name : null;
    const sec = document.createElement('section');
    const h = document.createElement('h2'); h.textContent = t.name;
    if (home) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = home; h.append(tag); }
    const p = document.createElement('p'); p.textContent = t.description ?? '';
    const sheet = document.createElement('div'); sheet.className = 'sheet';
    const canvas = document.createElement('canvas'); sheet.append(canvas);
    const names = document.createElement('div'); names.className = 'names';
    names.textContent = ['forest', 'mountain', 'rough', 'road', 'sea', 'cliff'].map((k) => registry.skin(id, k).name).join(' · ');
    sec.append(h, p, sheet, names); host.append(sec);
    sheets.push([canvas, id]);
  }
  const redraw = () => { out.textContent = slider.value; for (const [c, id] of sheets) drawSampler(c, registry, id, +slider.value); };
  slider.addEventListener('input', redraw);
  redraw();
}
