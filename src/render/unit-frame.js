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
