// Shoal drawings: the tile is open sea (its colour joins the water around it) and the decor paints a patch of shallows on it, flat-shaded
// in light blues, with a cluster of the same boulders the rough terrain has standing in it, ringed with surf. The shape of the patch and
// the boulders vary per tile through rnd(). TERRAIN_DECOR.shoals uses SHOAL_STYLES.boulders; the lab tool renders every style listed.

import { rnd } from './rnd.js';

const PALE = '#d9f1ff', LIGHT = '#a9dcf7', MID = '#74bdee', SHALLOW = '#5aa9e6';
const ROCK = '#857c6c', ROCK_LIT = '#b3a997';   // as in the rough terrain

export const SHOAL_STYLES = {
  boulders(g, px, py, S, { x, y, now }) {
    const R = (i) => rnd(x, y, 60 + i);
    const cx = px + (.47 + .06 * R(0)) * S, cy = py + (.5 + .05 * R(1)) * S;
    const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fill(); };
    const ell = (ex, ey, rx, ry, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, 7); g.fill(); };
    // the shallows: an irregular patch in three nested tones
    const patch = (rx, ry, k, seed) => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * 6.2832, j = 1 + k * (rnd(x, y, seed + i) - .5) * 2; return [cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]; });
    poly(patch(.4 * S, .33 * S, .14, 100), SHALLOW);
    poly(patch(.31 * S, .25 * S, .14, 120), MID);
    poly(patch(.2 * S, .16 * S, .12, 140), LIGHT);
    // boulders, drawn like the rough terrain's, each with a ring of surf round its foot that swells slowly
    const swell = 1 + .08 * Math.sin(now / 700 + R(2) * 6);
    const rock = (bx, by, r, seed) => {
      const pts = [], lit = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * 6.2832 + seed, rr = r * (.78 + .22 * rnd(x, y, seed * 11 + k));
        pts.push([bx + Math.cos(a) * rr, by + Math.sin(a) * rr * .78]);
        lit.push([bx - r * .1 + Math.cos(a) * rr * .72, by - r * .16 + Math.sin(a) * rr * .56]);
      }
      ell(bx, by + r * .3, r * 1.3 * swell, r * .55 * swell, PALE);
      ell(bx, by + r * .32, r * 1.1, r * .42, LIGHT);
      poly(pts, ROCK);
      poly(lit, ROCK_LIT);
    };
    rock(cx - .1 * S + .03 * S * R(3), cy - .06 * S, S * .14, 1);
    rock(cx + .1 * S, cy + .05 * S, S * .18, 2);
    rock(cx - .05 * S, cy + .16 * S, S * .08, 3);
  },
};
