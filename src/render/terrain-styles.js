// Tile styles: how the whole terrain layer is painted. The decorations and buildings themselves live in
// terrain-sprites.js and are shared by every style; a style only decides the shape and finish of the tile they sit on.
//
// A style is { id, name, note, board, face(S), paint(g, px, py, S, terrain, ownerColor, nb) }
//   board  colour painted under the whole layer; it shows through the gaps and rounded corners
//   face   { inset, radius } of the tile's face in pixels, so selection outlines and highlights can follow the shape
//   paint  draws one tile whose top-left pixel is (px, py). `nb` holds the base colour of the eight neighbours
//          (null off the map), which only the merged style uses.
// Add a style by adding an object to TILE_STYLES; the gallery (gallery/terrain.html) and `?tiles=<id>` pick it up.

import { TERRAIN_DECOR, BUILDINGS } from './terrain-sprites.js';

/** Lighten (amt > 0, towards white) or darken (amt < 0, towards black) a #rgb / #rrggbb colour. */
export function shade(hex, amt) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const v = amt < 0 ? c * (1 + amt) : c + (255 - c) * amt;
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  });
  return '#' + ch.join('');
}

const contents = (g, x, y, size, terrain, ownerColor) => {
  const r = terrain.render;
  if (r.decor) TERRAIN_DECOR[r.decor](g, x, y, size);
  if (r.building) BUILDINGS[r.building](g, x, y, size, ownerColor);
};

const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

// ---- square: the original look, kept as the baseline to compare against -----------------------------------------
const square = {
  id: 'square', name: 'Square', note: 'The original tiles: sharp corners and a hairline grid.',
  board: '#1d2436',
  face: () => ({ inset: 0, radius: 0 }),
  paint(g, px, py, S, terrain, ownerColor) {
    g.fillStyle = terrain.render.base; g.fillRect(px, py, S, S);
    contents(g, px, py, S, terrain, ownerColor);
    g.strokeStyle = '#0002'; g.lineWidth = 1; g.strokeRect(px, py, S, S);
  },
};

// ---- soft: flat colour, rounded, thin gap. The closest to the flat unit art. ------------------------------------------
const soft = {
  id: 'soft', name: 'Soft', note: 'Flat colour on rounded tiles with a thin gap between them.',
  board: '#141a28',
  face: (S) => ({ inset: S * .035, radius: S * .2 }),
  paint(g, px, py, S, terrain, ownerColor) {
    const gap = S * .035;
    const x = px + gap, y = py + gap, w = S - gap * 2;
    g.fillStyle = terrain.render.base; rrect(g, x, y, w, w, S * .2); g.fill();
    contents(g, x, y, w, terrain, ownerColor);
  },
};

// ---- cushion: a soft top-to-bottom gradient and a bright rim, like a padded button ------------------------------
const cushion = {
  id: 'cushion', name: 'Cushion', note: 'Rounder, with a gentle gradient and a light rim, like a padded button.',
  board: '#141a28',
  face: (S) => ({ inset: S * .04, radius: S * .26 }),
  paint(g, px, py, S, terrain, ownerColor) {
    const gap = S * .04, r = S * .26, base = terrain.render.base;
    const x = px + gap, y = py + gap, w = S - gap * 2;
    const grad = g.createLinearGradient(0, y, 0, y + w);
    grad.addColorStop(0, shade(base, .14)); grad.addColorStop(1, shade(base, -.14));
    g.fillStyle = grad; rrect(g, x, y, w, w, r); g.fill();
    const lw = Math.max(1, S * .03);
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = lw;
    rrect(g, x + lw / 2, y + lw / 2, w - lw, w - lw, r - lw / 2); g.stroke();
    contents(g, x, y, w, terrain, ownerColor);
  },
};

// ---- tabletop: raised blocks with a darker side. terrain.render.height (default 1) sets how tall; sea is sunken. -------
const tabletop = {
  id: 'tabletop', name: 'Tabletop', note: 'Chunky raised blocks like a board game. Roads sit low and the sea is sunken.',
  board: '#10151f',
  face: (S) => ({ inset: S * .03, radius: S * .18 }),
  paint(g, px, py, S, terrain, ownerColor) {
    const gap = S * .03, r = S * .18, base = terrain.render.base;
    const x = px + gap, y = py + gap, w = S - gap * 2;
    const lift = S * .1 * (terrain.render.height ?? 1);
    if (lift > 0) { g.fillStyle = shade(base, -.32); rrect(g, x, y, w, w, r); g.fill(); }
    const h = w - lift;
    g.fillStyle = base; rrect(g, x, y, w, h, r); g.fill();
    if (lift > 0) {
      const lw = Math.max(1, S * .025);
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = lw;
      rrect(g, x + lw / 2, y + lw / 2, w - lw, h - lw, r - lw / 2); g.stroke();
    } else {
      const lw = Math.max(1.5, S * .05);
      g.strokeStyle = shade(base, -.22); g.lineWidth = lw;
      rrect(g, x + lw / 2, y + lw / 2, w - lw, h - lw, r - lw / 2); g.stroke();
    }
    const size = Math.min(w, h);
    contents(g, x + (w - size) / 2, y + (h - size) / 2, size, terrain, ownerColor);
  },
};

// ---- merged: no gaps. Neighbouring tiles of the same colour join up into one shape, and only the outer corners of
// each shape are rounded. The corner is filled with the colour of whatever it opens onto (see backdrop). ----------
const MERGED_R = .3;

function backdrop(base, a, b, d, board) {
  if (a == null || b == null || d == null) return board;   // the map edge
  const seen = new Map();
  for (const c of [a, b, d]) if (c !== base) seen.set(c, (seen.get(c) || 0) + 1);
  if (seen.size === 0 || seen.size === 3) return board;
  let best = null, top = 0;
  for (const [c, k] of seen) if (k > top) { best = c; top = k; }
  return best;
}

const merged = {
  id: 'merged', name: 'Merged', note: 'No gaps: grass, roads and sea flow together and only the outer corners are rounded.',
  board: '#141a28',
  face: (S) => ({ inset: 0, radius: S * .2 }),
  paint(g, px, py, S, terrain, ownerColor, nb) {
    const base = terrain.render.base, r = S * MERGED_R;
    const same = (c) => c === base;
    // corner order matches roundRect's radii: top-left, top-right, bottom-right, bottom-left
    const corners = [[0, 0, nb.n, nb.w, nb.nw], [1, 0, nb.n, nb.e, nb.ne], [1, 1, nb.s, nb.e, nb.se], [0, 1, nb.s, nb.w, nb.sw]];
    const radii = corners.map(([, , a, b]) => (!same(a) && !same(b) ? r : 0));
    corners.forEach(([cx, cy, a, b, d], i) => {
      if (!radii[i]) return;
      g.fillStyle = backdrop(base, a, b, d, this.board);
      g.fillRect(px + cx * (S - r), py + cy * (S - r), r, r);
    });
    g.fillStyle = base; rrect(g, px, py, S, S, radii); g.fill();
    // a faint seam where two tiles of the same shape meet, so the grid stays readable for tapping
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; g.beginPath();
    if (same(nb.e)) { g.moveTo(px + S, py); g.lineTo(px + S, py + S); }
    if (same(nb.s)) { g.moveTo(px, py + S); g.lineTo(px + S, py + S); }
    g.stroke();
    contents(g, px, py, S, terrain, ownerColor);
  },
};

// ---- outlined: sticker-like, very round, with a darker outline in each tile's own colour ------------------------------
const outlined = {
  id: 'outlined', name: 'Outlined', note: 'Very round, with a dark outline in each tile\'s own colour, like a sticker.',
  board: '#141a28',
  face: (S) => ({ inset: S * .045, radius: S * .3 }),
  paint(g, px, py, S, terrain, ownerColor) {
    const gap = S * .045, r = S * .3, base = terrain.render.base;
    const x = px + gap, y = py + gap, w = S - gap * 2;
    const lw = Math.max(1.5, S * .055);
    g.fillStyle = shade(base, .05); rrect(g, x, y, w, w, r); g.fill();
    g.strokeStyle = shade(base, -.42); g.lineWidth = lw;
    rrect(g, x + lw / 2, y + lw / 2, w - lw, w - lw, r - lw / 2); g.stroke();
    contents(g, x, y, w, terrain, ownerColor);
  },
};

export const TILE_STYLES = [soft, cushion, tabletop, merged, outlined, square];
export const DEFAULT_TILE_STYLE = 'soft';
/** localStorage key under which the gallery remembers the chosen style for the game. */
export const TILE_STYLE_KEY = 'pocketwars.tiles';

/** The style with this id; anything unknown (or missing) falls back to the default. */
export function tileStyleById(id) {
  return TILE_STYLES.find((s) => s.id === id) || TILE_STYLES.find((s) => s.id === DEFAULT_TILE_STYLE);
}

/**
 * [x, y, w, h, radius] of the tile face at grid position (x, y), for highlights that should follow the tile's shape.
 * `margin` is the least distance from the tile edge, so an outline can sit inside the face.
 */
export function faceRect(style, x, y, S, margin = 0) {
  const { inset, radius } = style.face(S);
  const m = Math.max(inset, margin);
  return [x * S + m, y * S + m, S - m * 2, S - m * 2, Math.max(0, radius - (m - inset))];
}

/**
 * Paint the whole terrain layer.
 * @param {{width:number,height:number,S:number,style:object,terrainAt:(x:number,y:number)=>object,ownerColorAt:(x:number,y:number)=>string|null}} o
 */
export function drawTerrainLayer(g, { width, height, S, style, terrainAt, ownerColorAt }) {
  g.fillStyle = style.board; g.fillRect(0, 0, width * S, height * S);
  const baseAt = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? null : terrainAt(x, y).render.base);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nb = {
        n: baseAt(x, y - 1), e: baseAt(x + 1, y), s: baseAt(x, y + 1), w: baseAt(x - 1, y),
        ne: baseAt(x + 1, y - 1), se: baseAt(x + 1, y + 1), sw: baseAt(x - 1, y + 1), nw: baseAt(x - 1, y - 1),
      };
      style.paint(g, x * S, y * S, S, terrainAt(x, y), ownerColorAt(x, y), nb);
    }
  }
}
