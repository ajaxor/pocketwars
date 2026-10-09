// Small drawing helpers shared by the terrain drawings (trees, relief, ground, ruins, water). They only paint flat shapes on a 2D context.

export { rnd } from './rnd.js';

/** Fill a polygon given as [[x, y], ...] (px). */
export const poly = (g, pts, fill) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
};
/** A filled dot. */
export const dot = (g, x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
/** A filled ellipse (rotated by `rot` radians). */
export const ell = (g, cx, cy, rx, ry, fill, rot = 0) => { g.fillStyle = fill; g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, 7); g.fill(); };
/** A stroked polyline. */
export const line = (g, pts, color, w, cap = 'round') => {
  g.strokeStyle = color; g.lineWidth = Math.max(1, w); g.lineCap = cap; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
};
/** Tile-fraction -> pixel mapper for the tile at (px, py) of size S. */
export const mapper = (px, py, S) => (a, b) => [px + a * S, py + b * S];
/** One of `list` chosen by r in [0, 1). */
export const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
/** The tile's own style object merged over `defaults` (a tileset gives it through render.style). */
export const styled = (defaults, at) => {
  if (!at?.style) return defaults;
  styleAudit.onStyle?.(defaults, at.style);
  return { ...defaults, ...at.style };
};
/** A test hook: called with every (defaults, tileset style) pair a drawing merges, so unknown style keys can be reported. */
export const styleAudit = { onStyle: null };
