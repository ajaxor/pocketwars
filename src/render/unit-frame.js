// One frame of one unit, composed the way the game draws it (drawUnit in unit-sprites.js calls this): ground shadow first,
// then the sprite lifted by its altitude with the same bob and jitter. Browser-safe (no imports); used by the game,
// the sprite lab (Node) and the live gallery page (browser), so all three draw identically.
//
//   mod  a sprite set: { SPRITES, SHADOWS }
//   o    { s: tile px, c, dk: faction colours, alt: altitude fraction, w: animation clock (s),
//          ph: phase offset, run: 1 while animating / 0 when the unit has acted, only: 'body' | 'shadow' }
// The caller translates to the tile centre first.

const defaultShadow = (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, s * .31, s * .3, s * .06, 0, 0, 7); g.fill(); };

export function drawFrame(g, mod, id, o) {
  const { s, c, dk, alt = 0, w = 0, ph = 0, run = 1, only } = o;
  const b = Math.sin(w * 5 + ph) * s * .025 * run, j = Math.sin(w * 14 + ph) * s * .012 * run;
  if (only !== 'body') { g.save(); (mod.SHADOWS?.[id] || defaultShadow)(g, { s, alt, w, ph, run }); g.restore(); }
  if (only !== 'shadow') {
    g.save(); if (alt) g.translate(0, -s * alt + Math.sin(w * 3 + ph) * s * .03 * run);
    mod.SPRITES[id](g, { s, c, dk, w, ph, run, b, j }); g.restore();
  }
}

// ---- fading a unit as ONE image -----------------------------------------------------------------------------
// Setting globalAlpha while drawing the parts would blend each part with the ones under it (the body showing through
// its own shadow, wings through the fuselage). Instead the whole frame (shadow and unit) is drawn opaque into a
// scratch canvas, then that image is composited once at `alpha`.
//   o.make(w, h)  optional canvas factory (Node); in a browser an OffscreenCanvas / <canvas> is used.
// With no way to make a scratch canvas it falls back to per-part alpha, which is only ever seen outside a browser.
let scratch = null;
function layer(w, h, make) {
  if (scratch && scratch.width >= w && scratch.height >= h && scratch.owner === make) return scratch;
  let cv = null;
  try {
    if (make) cv = make(w, h);
    else if (typeof OffscreenCanvas !== 'undefined') cv = new OffscreenCanvas(w, h);
    else if (typeof document !== 'undefined') { cv = document.createElement('canvas'); cv.width = w; cv.height = h; }
  } catch { cv = null; }
  if (cv) cv.owner = make;
  return (scratch = cv);
}

export function drawFrameAlpha(g, mod, id, o, alpha = 1) {
  if (alpha >= 1) return drawFrame(g, mod, id, o);
  const REACH = 1.7;                                              // scratch is REACH x tile: room for altitude lift and wide sprites
  let k = 1;
  try { const t = g.getTransform?.(); if (t && t.a) k = Math.hypot(t.a, t.b) || 1; } catch { /* keep 1 */ }
  const px = Math.ceil(o.s * REACH * k), cv = layer(px, px, o.make);
  const sg = cv && cv.getContext?.('2d');
  if (!sg) { g.save(); g.globalAlpha = alpha; drawFrame(g, mod, id, o); g.restore(); return; }
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, cv.width, cv.height);
  sg.setTransform(k, 0, 0, k, px / 2, px / 2);
  drawFrame(sg, mod, id, o);
  sg.setTransform(1, 0, 0, 1, 0, 0);
  const half = o.s * REACH / 2;
  g.save(); g.globalAlpha = alpha; g.drawImage(cv, 0, 0, px, px, -half, -half, half * 2, half * 2); g.restore();
}
