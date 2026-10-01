// Shoal drawings: the tile is open sea (its colour joins the water around it) and these paint the shallows on top, flat-shaded in
// light blues with a few dark-blue deep spots. Each style is decor(g, px, py, S, { x, y, now }); the shape varies per tile through
// rnd() so a field of shoals does not repeat. TERRAIN_DECOR.shoals picks the one the game uses (see terrain-art.js).

import { rnd } from './rnd.js';

const PALE = '#d9f1ff', LIGHT = '#a9dcf7', MID = '#74bdee', SHALLOW = '#5aa9e6', DEEP = '#2b66b0', DARKER = '#1f4f94';

const kit = (g, px, py, S, x, y) => {
  const R = (i) => rnd(x, y, 60 + i);
  const cx = px + (.44 + .12 * R(0)) * S, cy = py + (.45 + .1 * R(1)) * S;
  const ell = (ox, oy, rx, ry, fill, tilt = 0) => { g.fillStyle = fill; g.beginPath(); g.ellipse(cx + ox * S, cy + oy * S, rx * S, ry * S, tilt, 0, 7); g.fill(); };
  const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(cx + a * S, cy + b * S) : g.moveTo(cx + a * S, cy + b * S))); g.closePath(); g.fill(); };
  const arc = (rx, ry, a0, a1, color, w, tilt = 0) => { g.strokeStyle = color; g.lineWidth = Math.max(1.2, w * S); g.lineCap = 'round'; g.beginPath(); g.ellipse(cx, cy, rx * S, ry * S, tilt, a0, a1); g.stroke(); };
  /** An irregular blob: `n` points around an ellipse, each pushed in or out by a per-tile amount. */
  const blob = (rx, ry, jag, seed, n = 9) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.2832, k = 1 + jag * (rnd(x, y, seed + i) - .5) * 2; return [Math.cos(a) * rx * k, Math.sin(a) * ry * k]; });
  const scale = (pts, k, dx = 0, dy = 0) => pts.map(([a, b]) => [a * k + dx, b * k + dy]);
  return { R, ell, poly, arc, blob, scale };
};

export const SHOAL_STYLES = {
  // 1. Tide rocks: three jagged rock tips of light blue, each split into a lit and a shaded face, standing in a disc of shallows with
  //    white surf at their feet.
  rocks(g, px, py, S, { x, y, now }) {
    const k = kit(g, px, py, S, x, y);
    k.ell(0, .03, .3, .2, SHALLOW);
    k.ell(0, .03, .22, .14, MID);
    const peak = (ox, oy, w, h, lean) => {
      k.poly([[ox - w, oy], [ox + lean, oy - h], [ox, oy]], LIGHT);                   // lit face
      k.poly([[ox, oy], [ox + lean, oy - h], [ox + w * 1.05, oy]], MID);              // shaded face
      k.poly([[ox + lean, oy - h], [ox + lean - w * .28, oy - h * .55], [ox + lean + w * .2, oy - h * .6]], PALE);   // snow-white tip
    };
    peak(-.1, .06, .07, .16 + .05 * k.R(2), .01);
    peak(.07, .09, .08, .22 + .05 * k.R(3), -.01);
    peak(.2, .06, .05, .1 + .04 * k.R(4), .01);
    const pulse = .5 + .5 * Math.sin(now / 650 + k.R(5) * 6);
    k.arc(.25, .15, .1, 1.2, PALE, .028 + .006 * pulse); k.arc(.25, .15, 3.4, 4.5, PALE, .028 + .006 * pulse);
  },

  // 2. Sandbar: a flat lagoon patch in three nested light-blue tones with a couple of dark deep pools cut into it and ripple dashes.
  bar(g, px, py, S, { x, y, now }) {
    const k = kit(g, px, py, S, x, y);
    const edge = k.blob(.3, .2, .22, 70);
    k.poly(edge, MID);
    k.poly(k.scale(edge, .72, -.01, -.01), LIGHT);
    k.poly(k.scale(edge, .38, -.03, -.02), PALE);
    k.ell(.14, .06, .05, .028, DEEP, .3); k.ell(-.13, .07, .035, .02, DEEP, -.2);
    const t = now / 900;
    for (const [ox, oy, w] of [[-.1, -.12, .07], [.12, -.1, .05], [-.02, .15, .06]]) {
      const a = .5 + .5 * Math.sin(t + ox * 20 + k.R(6) * 6);
      k.ell(ox, oy, w * (.8 + .3 * a), .008, PALE);
    }
  },

  // 3. Atoll: a ring of pale reef round a dark-blue lagoon, with bumps along the ring and one gap where the swell gets in.
  atoll(g, px, py, S, { x, y, now }) {
    const k = kit(g, px, py, S, x, y);
    const gap = k.R(7) * 6.28;
    k.ell(0, 0, .31, .21, SHALLOW);
    k.ell(0, 0, .26, .17, LIGHT);
    k.ell(0, 0, .15, .095, DARKER);                                                   // the lagoon
    k.ell(0, .01, .11, .065, DEEP);
    for (let i = 0; i < 8; i++) {                                                     // bumps of reef along the ring
      const a = gap + .5 + i * .73;
      k.ell(Math.cos(a) * .21, Math.sin(a) * .135, .035 + .012 * k.R(8 + i), .026, PALE);
    }
    k.ell(Math.cos(gap) * .2, Math.sin(gap) * .13, .05, .035, DARKER);                // the gap, filled back with deep water
    const p = .5 + .5 * Math.sin(now / 700 + k.R(20) * 6);
    k.arc(.31, .21, gap + .5, gap + 1.5, PALE, .02 + .006 * p);
  },

  // 4. Breakers: one low dark rock with rings of broken white-blue surf spreading round it, the rings pulsing outward.
  breakers(g, px, py, S, { x, y, now }) {
    const k = kit(g, px, py, S, x, y);
    const t = (now / 1800 + k.R(9)) % 1;
    k.ell(0, 0, .29, .19, SHALLOW);
    k.ell(0, 0, .2, .13, MID);
    k.ell(0, 0, .11, .07, LIGHT);
    k.poly(k.blob(.075, .045, .25, 80, 7), DEEP);                                     // the rock
    k.poly(k.scale(k.blob(.075, .045, .25, 80, 7), .5, -.01, -.008), DARKER);
    for (let i = 0; i < 3; i++) {                                                     // surf rings, each in broken arcs
      const f = (t + i / 3) % 1, rx = .09 + f * .24;
      const col = f > .75 ? LIGHT : PALE;
      const a0 = k.R(10 + i) * 6.28;
      k.arc(rx, rx * .65, a0, a0 + 1.5, col, .024 * (1 - f * .5)); k.arc(rx, rx * .65, a0 + 2.6, a0 + 4.1, col, .024 * (1 - f * .5));
    }
  },
};
