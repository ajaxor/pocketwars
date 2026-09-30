// Fade a drawing as ONE image. Setting globalAlpha while drawing several overlapping shapes blends each shape with the
// ones under it (a white digit over its own black outline goes grey, a body shows through its shadow: the "fades to
// black" look). Instead the drawing is made opaque in a scratch canvas and that image is composited once at `alpha`.
//
//   drawFaded(g, alpha, x, y, w, h, draw, make)
//     g       target context; x, y, w, h  the region (in g's current coordinates) that `draw` will paint inside
//     draw    (ctx) => void   paints in the same coordinates as g, fully opaque
//     make    optional canvas factory (Node); browsers use OffscreenCanvas or a <canvas>
// With no way to make a scratch canvas it falls back to per-shape alpha, which only ever happens outside a browser.
let scratch = null;
function getLayer(w, h, make) {
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

export function drawFaded(g, alpha, x, y, w, h, draw, make) {
  if (alpha >= 1) return draw(g);
  if (alpha <= 0) return undefined;
  let k = 1;                                                     // device scale, so the scratch is as sharp as the screen
  try { const t = g.getTransform?.(); if (t && t.a) k = Math.hypot(t.a, t.b) || 1; } catch { /* keep 1 */ }
  const pw = Math.max(1, Math.ceil(w * k)), ph = Math.max(1, Math.ceil(h * k));
  const cv = getLayer(pw, ph, make);
  const sg = cv && cv.getContext?.('2d');
  if (!sg) { g.save(); g.globalAlpha = alpha; draw(g); g.restore(); return undefined; }
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, cv.width, cv.height);
  sg.setTransform(k, 0, 0, k, -x * k, -y * k);
  draw(sg);
  sg.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.globalAlpha = alpha; g.drawImage(cv, 0, 0, pw, ph, x, y, w, h); g.restore();
  return undefined;
}
