// A dark outline round a unit's drawn shape (a try-out: only the unit gallery uses it so far, the game does not).
//   drawOutlined(g, mod, id, o, { r, color, tint, make })
// Draws the unit like drawFrame does (ground shadow, then the body), but the body first goes into a scratch canvas; its silhouette
// is stamped at a ring of offsets `r` px away, filled with `color`, and drawn under the body. So every sprite is outlined
// without its drawing code knowing, and foam, fins and barrels get the line as well. `o` is drawFrame's options; `tint` as in layer.js.
// Like layer.js it needs a scratch canvas: `make` (Node), OffscreenCanvas or a <canvas> in the browser.

import { drawFrame } from './unit-frame.js';

const REACH = 1.7;                                   // the same room around the tile centre that drawFrameAlpha allows
const cache = { body: null, edge: null, owner: null };

function canvas(slot, w, h, make) {
  const have = cache[slot];
  if (have && have.width === w && have.height === h && cache.owner === make) return have;
  let cv = null;
  try {
    if (make) cv = make(w, h);
    else if (typeof OffscreenCanvas !== 'undefined') cv = new OffscreenCanvas(w, h);
    else if (typeof document !== 'undefined') { cv = document.createElement('canvas'); cv.width = w; cv.height = h; }
  } catch { cv = null; }
  cache.owner = make; cache[slot] = cv;
  return cv;
}

export function drawOutlined(g, mod, id, o, { r = 2, color = '#14161d', tint = null, make } = {}) {
  let k = 1;
  try { const t = g.getTransform?.(); if (t && t.a) k = Math.hypot(t.a, t.b) || 1; } catch { /* keep 1 */ }
  const W = o.s * REACH, px = Math.max(2, Math.ceil(W * k));
  const body = canvas('body', px, px, make), edge = canvas('edge', px, px, make);
  const bc = body && body.getContext?.('2d'), ec = edge && edge.getContext?.('2d');
  if (!bc || !ec) { drawFrame(g, mod, id, o); return; }                       // no scratch canvas: draw plainly
  bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, px, px);
  bc.setTransform(k, 0, 0, k, px / 2, px / 2);
  drawFrame(bc, mod, id, { ...o, only: 'body' });
  bc.setTransform(1, 0, 0, 1, 0, 0);
  if (tint) { bc.save(); bc.globalCompositeOperation = 'source-atop'; bc.globalAlpha = tint.amount; bc.fillStyle = tint.color; bc.fillRect(0, 0, px, px); bc.restore(); }
  // the silhouette, grown by r: the body stamped round a ring (two rings, so a thick line has no gaps), then flooded with the colour
  ec.setTransform(1, 0, 0, 1, 0, 0); ec.clearRect(0, 0, px, px); ec.globalCompositeOperation = 'source-over';
  const rr = Math.max(1, r * k);
  for (const [ring, n] of [[rr, 16], [rr * .55, 8]]) {
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832; ec.drawImage(body, Math.cos(a) * ring, Math.sin(a) * ring); }
  }
  ec.globalCompositeOperation = 'source-in'; ec.fillStyle = color; ec.fillRect(0, 0, px, px); ec.globalCompositeOperation = 'source-over';
  drawFrame(g, mod, id, { ...o, only: 'shadow' });
  g.drawImage(edge, 0, 0, px, px, -W / 2, -W / 2, W, W);
  g.drawImage(body, 0, 0, px, px, -W / 2, -W / 2, W, W);
}
