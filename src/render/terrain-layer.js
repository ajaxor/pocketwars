// The terrain layer: paints every tile of the map. Tiles of the same base colour join up into one shape, and only the
// outer corners of each shape are rounded. A rounded corner is filled with the colour of whatever it opens onto.
// What is drawn ON the tile (trees, mountains, waves...) comes from a theme (terrain-themes.js).

import { BUILDINGS } from './buildings.js';

/** Colour under the whole layer; it only shows at the outer corners of the map. */
export const BOARD_COLOR = '#141a28';
const CORNER = .3;    // corner radius of a shape, in tiles
const FACE = .2;      // corner radius used by highlights drawn on a single tile

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
 * `at` = { x, y, now }: grid position and clock, for themes that vary or animate their drawings. Themes also get the
 * neighbours (`nb`) and the tile's own base colour (`base`), e.g. to draw foam where water meets land.
 */
export function paintTile(g, px, py, S, terrain, ownerColor, nb, theme, at) {
  const base = terrain.render.base, r = S * CORNER;
  const same = (c) => c === base;
  // corner order matches roundRect's radii: top-left, top-right, bottom-right, bottom-left
  const corners = [[0, 0, nb.n, nb.w, nb.nw], [1, 0, nb.n, nb.e, nb.ne], [1, 1, nb.s, nb.e, nb.se], [0, 1, nb.s, nb.w, nb.sw]];
  const radii = corners.map(([, , a, b]) => (!same(a) && !same(b) ? r : 0));
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
  if (decor) theme.decor[decor](g, px, py, S, { x: at.x, y: at.y, now: at.now, nb, base });
  if (building) BUILDINGS[building](g, px, py, S, ownerColor);
}

/**
 * Paint the whole terrain layer.
 * @param {{width:number,height:number,S:number,theme:object,now?:number,terrainAt:(x:number,y:number)=>object,ownerColorAt:(x:number,y:number)=>string|null}} o
 */
export function drawTerrainLayer(g, { width, height, S, theme, now = 0, terrainAt, ownerColorAt }) {
  g.fillStyle = BOARD_COLOR; g.fillRect(0, 0, width * S, height * S);
  const baseAt = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? null : terrainAt(x, y).render.base);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nb = {
        n: baseAt(x, y - 1), e: baseAt(x + 1, y), s: baseAt(x, y + 1), w: baseAt(x - 1, y),
        ne: baseAt(x + 1, y - 1), se: baseAt(x + 1, y + 1), sw: baseAt(x - 1, y + 1), nw: baseAt(x - 1, y - 1),
      };
      paintTile(g, x * S, y * S, S, terrainAt(x, y), ownerColorAt(x, y), nb, theme, { x, y, now });
    }
  }
}
