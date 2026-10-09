// Terrain lab: renders a sampler of every tileset with the game's own terrain layer to PNG, so the art can be judged without a browser.
//   node tools/sprite-lab/terrain.mjs [tilesetId ...] [--S=48] [--out=dir]      (default: every tileset, into ./out-terrain)
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO } from './lib.mjs';

const at = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { loadRegistry, loadMap } = await at('src/data/loader.js');
const { readData } = await at('tests/helpers/node-io.js');
const { drawTerrainLayer } = await at('src/render/terrain-layer.js');
const reg = await loadRegistry(readData);

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1];
const S = +opt('S', 48), out = opt('out', 'out-terrain');
const ids = args.filter((a) => !a.startsWith('--'));
const sets = ids.length ? ids : reg.tilesetIds;

// the sampler: letters -> terrain ids (. plain, f forest, m mountain, = road, ~ sea, s shoals, c city, h hq, F factory, w ford, i ice, x ruin_city, X ruin_factory)
const KEY = { '.': 'plain', f: 'forest', m: 'mountain', '=': 'road', '~': 'sea', s: 'shoals', c: 'city', h: 'hq', F: 'factory', w: 'ford', i: 'ice', x: 'ruin_city', X: 'ruin_factory' };
const SAMPLER = [
  '~~~ss..ffff..mmm.',
  '~~s..=====..mmmm.',
  '~~...=.c.F..mmmm.',
  '.....=..f...mmmm.',
  '.....=..hf.......',
  '.....=...xX......',
  'ffff.=.......=...',
  'ffff.======..=...',
  '~~wwwiiii...=====',
];

mkdirSync(out, { recursive: true });
// --map=id[,id]: render whole maps (terrain only) in their own tileset instead of the sampler
const mapIds = opt('map', '').split(',').filter(Boolean);
for (const mid of mapIds) {
  const map = await loadMap(readData, reg, mid);
  const set = map.tileset ?? reg.defaultTileset;
  const c = createCanvas(map.width * S, map.height * S), g = c.getContext('2d');
  const skin = (x, y) => reg.skin(set, map.terrain[y][x]);
  drawTerrainLayer(g, { width: map.width, height: map.height, S, now: 0, terrainAt: skin, groundAt: (x, y) => reg.groundDef(map.ground?.[y]?.[x]), ownerColorAt: (x, y) => (skin(x, y).attributes.property ? (map.owners[y][x] === 0 ? '#2f86d6' : map.owners[y][x] === 1 ? '#d6453d' : '#9aa0a8') : null) });
  for (const u of map.units) { g.fillStyle = u.owner === 0 ? '#2f86d6' : u.owner === 1 ? '#d6453d' : '#fff'; g.beginPath(); g.arc((u.x + .5) * S, (u.y + .5) * S, S * .28, 0, 7); g.fill(); g.strokeStyle = '#000'; g.stroke(); }
  const file = path.join(out, `map-${mid}.png`);
  writeFileSync(file, c.toBuffer('image/png'));
  console.log(file);
}
if (mapIds.length) process.exit(0);
for (const id of sets) {
  const rows = SAMPLER.map((r) => [...r]);
  const w = rows[0].length, h = rows.length;
  const c = createCanvas(w * S, h * S), g = c.getContext('2d');
  const ground = reg.ground[reg.tilesetDef(id).ground ?? 'grass'];
  const terrainAt = (x, y) => reg.skin(id, KEY[rows[y][x]]);
  drawTerrainLayer(g, { width: w, height: h, S, now: 0, terrainAt, groundAt: () => ground, ownerColorAt: (x, y) => (terrainAt(x, y).attributes.property ? '#e8712c' : null) });
  const file = path.join(out, `${id}.png`);
  writeFileSync(file, c.toBuffer('image/png'));
  console.log(file);
}
