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
export const DIMMED_ALPHA = .5;

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
 * `nb.inlay` (optional) says which of the four sides carry an inlaid terrain (terrain.render.inlay, the road).
 * `at` = { x, y, now, dimmed, link, ground }: grid position and clock, for drawings that vary per tile or animate; `ground` is the ground definition under the tile (ground.json); `dimmed` draws the
 * building faintly; `link` says which of the eight neighbours carry on the same drawing (off the map counts as yes), which
 * is how roads know where to run. paintTile adds `radii`, the tile's corner radii, so a drawing can clip itself to the tile.
 */
export function paintTile(g, px, py, S, terrain, ownerColor, nb, at) {
  // terrain without a colour of its own (plain, forest, mountain, rough, properties) is drawn on the ground under it
  const ground = at.ground || null;
  const base = terrain.render.base ?? ground?.render.base ?? '#86b95c', r = S * CORNER;
  const same = (c) => c === base;
  const joins = (c) => c === null || c === base;       // off the map counts as more of the same shape: flat along the edge
  // corner order matches roundRect's radii: top-left, top-right, bottom-right, bottom-left
  const corners = [[0, 0, nb.n, nb.w, nb.nw, 'n', 'w'], [1, 0, nb.n, nb.e, nb.ne, 'n', 'e'], [1, 1, nb.s, nb.e, nb.se, 's', 'e'], [0, 1, nb.s, nb.w, nb.sw, 's', 'w']];
  // an inlaid neighbour (a road) is laid over the ground, so a tile that is not itself inlaid stays square against it: its edge
  // is a straight line, and no corner of the ground opens up to show asphalt outside the road's shoulder
  const flatSide = (k) => !terrain.render.inlay && !!nb.inlay?.[k];
  const radii = corners.map(([, , a, b, , ka, kb]) => (!joins(a) && !joins(b) && !flatSide(ka) && !flatSide(kb) ? r : 0));
  corners.forEach(([cx, cy, a, b, d], i) => {
    if (!radii[i]) return;
    g.fillStyle = backdrop(base, a, b, d);
    g.fillRect(px + cx * (S - r), py + cy * (S - r), r, r);
  });
  g.fillStyle = base; g.beginPath(); g.roundRect(px, py, S, S, radii); g.fill();
  at.radii = radii;
  // a faint seam where two tiles of the same shape meet, so the grid stays readable for tapping
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; g.beginPath();
  if (same(nb.e)) { g.moveTo(px + S, py); g.lineTo(px + S, py + S); }
  if (same(nb.s)) { g.moveTo(px, py + S); g.lineTo(px + S, py + S); }
  g.stroke();
  const { decor, building } = terrain.render;
  if (terrain.render.base === undefined && ground?.render.decor) TERRAIN_DECOR[ground.render.decor]?.(g, px, py, S, at);
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
 * @param {{width:number,height:number,S:number,now?:number,terrainAt:(x:number,y:number)=>object,ownerColorAt:(x:number,y:number)=>string|null,groundAt?:(x:number,y:number)=>object|null,dimmedAt?:(x:number,y:number)=>boolean,view?:{x0:number,y0:number,x1:number,y1:number}}} o
 */
export function drawTerrainLayer(g, { width, height, S, now = 0, terrainAt, ownerColorAt, dimmedAt = () => false, groundAt = () => null, view = null }) {
  // `view` = { x0, y0, x1, y1 } limits painting to those tiles (inclusive); big maps only pay for what is on screen. The rest of
  // the board is left alone, so callers that scroll must only look at the part they asked for.
  const x0 = view ? Math.max(0, view.x0) : 0, y0 = view ? Math.max(0, view.y0) : 0;
  const x1 = view ? Math.min(width - 1, view.x1) : width - 1, y1 = view ? Math.min(height - 1, view.y1) : height - 1;
  g.fillStyle = BOARD_COLOR;
  g.fillRect(x0 * S, y0 * S, (x1 - x0 + 1) * S, (y1 - y0 + 1) * S);
  const off = (x, y) => x < 0 || y < 0 || x >= width || y >= height;
  const baseAt = (x, y) => (off(x, y) ? null : terrainAt(x, y).render.base ?? groundAt(x, y)?.render.base ?? '#86b95c');
  const decorAt = (x, y) => (off(x, y) ? null : terrainAt(x, y).render.decor || null);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nb = {
        n: baseAt(x, y - 1), e: baseAt(x + 1, y), s: baseAt(x, y + 1), w: baseAt(x - 1, y),
        ne: baseAt(x + 1, y - 1), se: baseAt(x + 1, y + 1), sw: baseAt(x - 1, y + 1), nw: baseAt(x - 1, y - 1),
      };
      const inlayAt = (dx, dy) => !off(x + dx, y + dy) && !!terrainAt(x + dx, y + dy).render.inlay;
      nb.inlay = { n: inlayAt(0, -1), e: inlayAt(1, 0), s: inlayAt(0, 1), w: inlayAt(-1, 0) };
      const decor = decorAt(x, y);
      const same = (dx, dy) => off(x + dx, y + dy) || decorAt(x + dx, y + dy) === decor;
      const link = {
        n: same(0, -1), e: same(1, 0), s: same(0, 1), w: same(-1, 0),
        ne: same(1, -1), se: same(1, 1), sw: same(-1, 1), nw: same(-1, -1),
      };
      paintTile(g, x * S, y * S, S, terrainAt(x, y), ownerColorAt(x, y), nb, { x, y, now, dimmed: dimmedAt(x, y), link, ground: groundAt(x, y) });
    }
  }
}
