// The terrain layer: paints every tile of the map. Tiles of the same base colour join up into one shape, and only the
// outer corners of each shape are rounded. A rounded corner is filled with the colour of whatever it opens onto.
// The map edge does not round anything: a shape is treated as carrying on past the edge, so it stays flat along it.
// What is drawn ON the tile (trees, mountains, waves...) comes from terrain-art.js.

import { TERRAIN_DECOR } from './terrain-art.js';
import { BUILDINGS } from './buildings.js';
import { drawFaded } from './layer.js';

/** Colour under the whole layer; it only shows at the outer corners of the map. */
export const BOARD_COLOR = '#141a28';
const CORNER = .3;    // corner radius of a shape, in tiles
const FACE = .2;      // corner radius used by highlights drawn on a single tile
/** How solid a building is drawn while a unit of its owner stands on it (so the unit stands out). */
export const DIMMED_ALPHA = .35;

/** [x, y, w, h, radius] of tile (x, y), for highlights. `margin` keeps an outline that many pixels inside the tile. */
export function faceRect(x, y, S, margin = 0) {
  return [x * S + margin, y * S + margin, S - margin * 2, S - margin * 2, Math.max(0, S * FACE - margin)];
}

/** The colour a rounded corner opens onto: the neighbours' colour, or the board colour at the map edge or when unclear. */
export function backdrop(base, a, b, d) {
  if (a == null || b == null || d == null) return BOARD_COLOR;
  const seen = new Map();
  for (const c of [a, b, d]) if (c !== base) seen.set(c, (seen.get(c) || 0) + 1);
  if (seen.size === 0 || seen.size === 3) return BOARD_COLOR;
  let best = null, top = 0;
  for (const [c, k] of seen) if (k > top) { best = c; top = k; }
  return best;
}

/**
 * Paint one tile whose top-left pixel is (px, py). `nb` holds the base colour of the eight neighbours (null off the map).
 * `at` = { x, y, now, dimmed }: grid position and clock, for drawings that vary per tile or animate; `dimmed` draws the
 * building faintly.
 */
export function paintTile(g, px, py, S, terrain, ownerColor, nb, at) {
  const base = terrain.render.base, r = S * CORNER;
  const same = (c) => c === base;
  const joins = (c) => c === null || c === base;       // off the map counts as more of the same shape: flat along the edge
  // corner order matches roundRect's radii: top-left, top-right, bottom-right, bottom-left
  const corners = [[0, 0, nb.n, nb.w, nb.nw], [1, 0, nb.n, nb.e, nb.ne], [1, 1, nb.s, nb.e, nb.se], [0, 1, nb.s, nb.w, nb.sw]];
  const radii = corners.map(([, , a, b]) => (!joins(a) && !joins(b) ? r : 0));
  corners.forEach(([cx, cy, a, b, d], i) => {
    if (!radii[i]) return;
    g.fillStyle = backdrop(base, a, b, d);
    g.fillRect(px + cx * (S - r), py + cy * (S - r), r, r);
  });
  g.fillStyle = base; g.beginPath(); g.roundRect(px, py, S, S, radii); g.fill();
  // a faint seam where two tiles of the same shape meet, so the grid stays readable for tapping
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; g.beginPath();
  if (same(nb.e)) { g.moveTo(px + S, py); g.lineTo(px + S, py + S); }
  if (same(nb.s)) { g.moveTo(px, py + S); g.lineTo(px + S, py + S); }
  g.stroke();
  const { decor, building } = terrain.render;
  if (decor) TERRAIN_DECOR[decor](g, px, py, S, at);
  if (building) {
    const draw = (c) => BUILDINGS[building](c, px, py, S, ownerColor);
    // the building is drawn opaque into a scratch image and composited once, so its parts do not show through each other
    if (at.dimmed) drawFaded(g, DIMMED_ALPHA, px - S * .3, py - S * 1.1, S * 1.9, S * 2.4, draw);
    else draw(g);
  }
}

/**
 * Paint the whole terrain layer.
 * @param {{width:number,height:number,S:number,now?:number,terrainAt:(x:number,y:number)=>object,ownerColorAt:(x:number,y:number)=>string|null,dimmedAt?:(x:number,y:number)=>boolean}} o
 */
export function drawTerrainLayer(g, { width, height, S, now = 0, terrainAt, ownerColorAt, dimmedAt = () => false }) {
  g.fillStyle = BOARD_COLOR; g.fillRect(0, 0, width * S, height * S);
  const baseAt = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? null : terrainAt(x, y).render.base);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nb = {
        n: baseAt(x, y - 1), e: baseAt(x + 1, y), s: baseAt(x, y + 1), w: baseAt(x - 1, y),
        ne: baseAt(x + 1, y - 1), se: baseAt(x + 1, y + 1), sw: baseAt(x - 1, y + 1), nw: baseAt(x - 1, y - 1),
      };
      paintTile(g, x * S, y * S, S, terrainAt(x, y), ownerColorAt(x, y), nb, { x, y, now, dimmed: dimmedAt(x, y) });
    }
  }
}
