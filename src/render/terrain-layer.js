// The terrain layer: paints every tile of the map. Tiles of the same base colour join up into one shape, and only the
// outer corners of each shape are rounded. A rounded corner is filled with the colour of whatever it opens onto.
// `terrain.render.group` (optional) puts different terrains in ONE shape even though their colours differ: shallows and deep sea are
// both "water", so the shore is rounded as a single body of water and the shallows/deep border is a straight edge, not a pair of
// rounded shapes. A terrain without a group is grouped by its base colour.
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
export function backdrop(base, a, b, d, ca = a, cb = b, cd = d) {
  if (a == null || b == null || d == null) return BOARD_COLOR;
  const seen = new Map();                              // group key -> [count, colour of the first tile seen]
  [[a, ca], [b, cb], [d, cd]].forEach(([k, col]) => { if (k !== base) seen.set(k, [(seen.get(k)?.[0] || 0) + 1, seen.get(k)?.[1] ?? col]); });
  if (seen.size === 0 || seen.size === 3) return BOARD_COLOR;
  let best = null, top = 0;
  for (const [, [n, col]] of seen) if (n > top) { best = col; top = n; }
  return best;
}

/**
 * Paint one tile whose top-left pixel is (px, py). `nb` holds the base colour of the eight neighbours (null off the map).
 * `nb.group` (optional) holds the same eight keys as shape keys (terrain.render.group, else the colour); without it the colours are used.
 * `nb.inlay` (optional) says which of the four sides carry an inlaid terrain (terrain.render.inlay, the road).
 * `at` = { x, y, now, dimmed, link, ground }: grid position and clock, for drawings that vary per tile or animate; `ground` is the ground definition under the tile (ground.json); `dimmed` draws the
 * building faintly; `link` says which of the eight neighbours carry on the same drawing (off the map counts as yes), which
 * is how roads know where to run. paintTile adds `radii`, the tile's corner radii, so a drawing can clip itself to the tile.
 */
export function paintTile(g, px, py, S, terrain, ownerColor, nb, at) {
  // terrain without a colour of its own (plain, forest, mountain, rough, properties) is drawn on the ground under it
  const ground = at.ground || null;
  const base = terrain.render.base ?? ground?.render.base ?? '#86b95c', r = S * CORNER;
  const key = terrain.render.group ?? base;           // what makes tiles one shape
  const K = nb.group || nb;                            // neighbours' shape keys (colours when no groups are given)
  const same = (c) => c === key;
  const joins = (c) => c === null || c === key;        // off the map counts as more of the same shape: flat along the edge
  // corner order matches roundRect's radii: top-left, top-right, bottom-right, bottom-left
  const corners = [[0, 0, K.n, K.w, K.nw, 'n', 'w', 'n', 'w', 'nw'], [1, 0, K.n, K.e, K.ne, 'n', 'e', 'n', 'e', 'ne'], [1, 1, K.s, K.e, K.se, 's', 'e', 's', 'e', 'se'], [0, 1, K.s, K.w, K.sw, 's', 'w', 's', 'w', 'sw']];
  // an inlaid neighbour (a road) is laid over the ground, so a tile that is not itself inlaid stays square against it: its edge
  // is a straight line, and no corner of the ground opens up to show asphalt outside the road's shoulder
  const flatSide = (k) => !terrain.render.inlay && !!nb.inlay?.[k];
  const radii = corners.map(([, , a, b, , ka, kb]) => (!joins(a) && !joins(b) && !flatSide(ka) && !flatSide(kb) ? r : 0));
  corners.forEach(([cx, cy, a, b, d, , , ka, kb, kd], i) => {
    if (!radii[i]) return;
    g.fillStyle = backdrop(key, a, b, d, nb[ka], nb[kb], nb[kd]);
    g.fillRect(px + cx * (S - r), py + cy * (S - r), r, r);
  });
  g.fillStyle = base; g.beginPath(); g.roundRect(px, py, S, S, radii); g.fill();
  at.radii = radii;
  // a faint seam where two tiles of the same shape meet, so the grid stays readable for tapping
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; g.beginPath();
  if (same(K.e)) { g.moveTo(px + S, py); g.lineTo(px + S, py + S); }
  if (same(K.s)) { g.moveTo(px, py + S); g.lineTo(px + S, py + S); }
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
  const keyAt = (x, y) => (off(x, y) ? null : terrainAt(x, y).render.group ?? baseAt(x, y));
  const decorAt = (x, y) => (off(x, y) ? null : terrainAt(x, y).render.decor || null);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nb = {
        n: baseAt(x, y - 1), e: baseAt(x + 1, y), s: baseAt(x, y + 1), w: baseAt(x - 1, y),
        ne: baseAt(x + 1, y - 1), se: baseAt(x + 1, y + 1), sw: baseAt(x - 1, y + 1), nw: baseAt(x - 1, y - 1),
      };
      const inlayAt = (dx, dy) => !off(x + dx, y + dy) && !!terrainAt(x + dx, y + dy).render.inlay;
      nb.group = { n: keyAt(x, y - 1), e: keyAt(x + 1, y), s: keyAt(x, y + 1), w: keyAt(x - 1, y), ne: keyAt(x + 1, y - 1), se: keyAt(x + 1, y + 1), sw: keyAt(x - 1, y + 1), nw: keyAt(x - 1, y - 1) };
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
