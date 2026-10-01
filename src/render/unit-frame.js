// One frame of one unit, composed the way the game draws it (drawUnit in unit-sprites.js calls this): ground shadow first,
// then the sprite lifted by its altitude with the same bob and jitter. Browser-safe (no imports); used by the game,
// the sprite lab (Node) and the live gallery page (browser), so all three draw identically.
//
//   mod  a sprite set: { SPRITES, SHADOWS }
//   o    { s: tile px, c, dk: faction colours, alt: altitude fraction, w: animation clock (s),
//          ph: phase offset, run: 1 while animating / 0 when the unit has acted, moving: true while it slides across
//          the map (infantry only walk then), submerged: a dived submarine (its sprite draws itself under the
//          water), face: 1 right (how sprites are drawn) or -1 mirrored to face left, only: 'body' | 'shadow' }
// The caller translates to the tile centre first.

import { drawFaded } from './layer.js';

/** The wash that marks a unit that has already acted this turn: its colours are blended toward a dark grey. */
export const DISABLED_TINT = { color: '#2f3036', amount: .5 };

const defaultShadow = (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, s * .31, s * .3, s * .06, 0, 0, 7); g.fill(); };

export function drawFrame(g, mod, id, o) {
  const { s, c, dk, alt = 0, w = 0, ph = 0, run = 1, moving = false, only, submerged = false, face = 1 } = o;
  const b = Math.sin(w * 5 + ph) * s * .025 * run, j = Math.sin(w * 14 + ph) * s * .012 * run;
  g.save(); if (face < 0) g.scale(-1, 1);                         // facing left: the whole picture, shadow too, is mirrored about the tile centre
  if (only !== 'body') { g.save(); (mod.SHADOWS?.[id] || defaultShadow)(g, { s, alt, w, ph, run }); g.restore(); }
  if (only !== 'shadow') {
    g.save(); if (alt) g.translate(0, -s * alt + Math.sin(w * 3 + ph) * s * .03 * run);
    mod.SPRITES[id](g, { s, c, dk, w, ph, run, moving, b, j, submerged }); g.restore();
  }
  g.restore();
}

// ---- fading / tinting a unit as ONE image (see layer.js): shadow and unit are drawn opaque, then composited once ----------
export function drawFrameAlpha(g, mod, id, o, alpha = 1, tint = null) {
  const REACH = 1.7, half = o.s * REACH / 2;                    // room for altitude lift and wide sprites
  drawFaded(g, alpha, -half, -half, half * 2, half * 2, (ctx) => drawFrame(ctx, mod, id, o), o.make, tint);
}
