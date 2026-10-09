// Ground and crossing drawings. The first group is the ground texture each ground.json entry paints under a tile that has no colour of its own
// (snow, sand, hardpan, paving, moss, ash, heath, lawn); the second is the crossings (ford, ice). (The soft ground that used to sit between them
// is archived in unused/removed-terrain.js.) Each is decor(g, px, py, S, { x, y, now, link, radii, style }); position-based variation comes from rnd().

import { dot, ell, line, mapper, poly, rnd, styled } from './terrain-kit.js';

const spot = (R, i, S, px, py, m = .12) => [px + (m + (1 - 2 * m) * R(i)) * S, py + (m + (1 - 2 * m) * R(i + 40)) * S];

export const GROUND_DECOR = {
  snow(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 500 + i);
    for (let i = 0; i < 3; i++) { const [cx, cy] = spot(R, i, S, px, py, .2); ell(g, cx, cy, S * (.14 + .05 * R(i + 9)), S * .04, 'rgba(150,180,215,.28)'); }
    for (let i = 0; i < 4; i++) { const [cx, cy] = spot(R, 10 + i, S, px, py); dot(g, cx, cy, Math.max(1, S * .017), 'rgba(255,255,255,.95)'); }
  },
  sand(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 520 + i);
    g.lineCap = 'round';
    for (let i = 0; i < 2; i++) {   // wind ripples: short shallow arcs
      const [cx, cy] = spot(R, i, S, px, py, .22), w = S * (.12 + .06 * R(i + 5));
      g.strokeStyle = 'rgba(160,125,60,.28)'; g.lineWidth = Math.max(1, S * .022); g.beginPath(); g.moveTo(cx - w, cy); g.quadraticCurveTo(cx, cy - S * .05, cx + w, cy); g.stroke();
    }
    for (let i = 0; i < 4; i++) { const [cx, cy] = spot(R, 10 + i, S, px, py); dot(g, cx, cy, Math.max(1, S * .014), i % 2 ? 'rgba(255,245,210,.9)' : 'rgba(150,115,55,.4)'); }
  },
  hardpan(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 540 + i);
    for (let i = 0; i < 2; i++) {   // dried cracks
      const sx = .15 + .6 * R(i), sy = .15 + .6 * R(i + 4);
      line(g, [[px + sx * S, py + sy * S], [px + (sx + .12 + R(i + 8) * .1) * S, py + (sy + .08) * S], [px + (sx + .2 + R(i + 12) * .1) * S, py + (sy + .2 + R(i + 16) * .1) * S]], 'rgba(95,60,30,.34)', S * .02);
    }
    for (let i = 0; i < 3; i++) { const [cx, cy] = spot(R, 20 + i, S, px, py); dot(g, cx, cy, S * .02, i % 2 ? 'rgba(255,225,170,.5)' : 'rgba(110,70,35,.3)'); }
  },
  paving(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 560 + i);
    g.strokeStyle = 'rgba(70,74,84,.22)'; g.lineWidth = Math.max(1, S * .02); g.beginPath();   // slab joints
    g.moveTo(px, py + S * .5); g.lineTo(px + S, py + S * .5);
    const o = (x + y) % 2 ? .25 : .75; g.moveTo(px + S * o, py); g.lineTo(px + S * o, py + S * .5);
    g.moveTo(px + S * (1 - o), py + S * .5); g.lineTo(px + S * (1 - o), py + S);
    g.stroke();
    for (let i = 0; i < 2; i++) { const [cx, cy] = spot(R, i, S, px, py); ell(g, cx, cy, S * .07, S * .035, 'rgba(60,64,74,.14)'); }
  },
  moss(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 580 + i);
    for (let i = 0; i < 3; i++) {   // little fern tufts
      const [cx, cy] = spot(R, i, S, px, py, .2), c = i % 2 ? '#7fbc5a' : '#3f7f35';
      for (const d of [-1, 0, 1]) line(g, [[cx, cy + S * .03], [cx + d * S * .06, cy - S * .05]], c, S * .02);
    }
    for (let i = 0; i < 3; i++) { const [cx, cy] = spot(R, 10 + i, S, px, py); dot(g, cx, cy, S * .02, 'rgba(30,70,30,.3)'); }
  },
  ash(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 600 + i);
    for (let i = 0; i < 3; i++) { const [cx, cy] = spot(R, i, S, px, py, .2); ell(g, cx, cy, S * (.12 + .05 * R(i + 9)), S * .05, i % 2 ? 'rgba(50,48,45,.22)' : 'rgba(210,205,195,.22)'); }
    for (let i = 0; i < 4; i++) { const [cx, cy] = spot(R, 10 + i, S, px, py); dot(g, cx, cy, Math.max(1, S * .014), i === 0 && R(30) < .3 ? '#d9703a' : 'rgba(40,38,36,.5)'); }
  },
  heath(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 620 + i);
    for (let i = 0; i < 3; i++) { const [cx, cy] = spot(R, i, S, px, py, .2); ell(g, cx, cy, S * .09, S * .04, i % 2 ? '#8a9166' : '#b3b98b'); }
    for (let i = 0; i < 5; i++) { const [cx, cy] = spot(R, 10 + i, S, px, py); dot(g, cx, cy, Math.max(1, S * .02), i % 2 ? '#9a6fb0' : '#c9a0d4'); }
  },
  lawn(g, px, py, S, { x, y }) {
    const R = (i) => rnd(x, y, 640 + i);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px, py + (((x + y) % 2) ? 0 : S * .5), S, S * .5);   // mown stripes
    for (let i = 0; i < 2; i++) { const [cx, cy] = spot(R, i, S, px, py); dot(g, cx, cy, Math.max(1, S * .022), '#fff6f0'); dot(g, cx, cy, Math.max(1, S * .009), '#f1c64a'); }
  },

  // ---- crossings ----
  // Ford: shallow water with a line of stepping stones and ripples; it has its own pale-blue colour, so it reads as a crossing in the sea or a river.
  ford(g, px, py, S, at) {
    const { x, y, now = 0 } = at, st = styled({ stone: '#b9b2a0', stoneLit: '#e0dac8', ripple: 'rgba(255,255,255,.55)' }, at), R = (i) => rnd(x, y, 720 + i), P = mapper(px, py, S);
    for (let i = 0; i < 2; i++) { const cx = .2 + .6 * R(i), cy = .18 + .64 * R(i + 4), a = Math.max(0, Math.sin(now / 900 + R(i + 8) * 6.28)); line(g, [P(cx - .09, cy), P(cx, cy - .03), P(cx + .09, cy)], `rgba(255,255,255,${(.25 + a * .4).toFixed(2)})`, S * .02); }
    for (let i = 0; i < 4; i++) {   // stepping stones across the tile
      const cx = .14 + i * .24 + (R(10 + i) - .5) * .05, cy = .5 + (R(14 + i) - .5) * .14, r = S * (.055 + .02 * R(18 + i));
      ell(g, ...P(cx, cy + .03), r * 1.3, r * .5, 'rgba(0,50,100,.22)'); ell(g, ...P(cx, cy), r * 1.15, r * .8, st.stone); ell(g, ...P(cx - .01, cy - .015), r * .7, r * .45, st.stoneLit);
    }
  },
  // Ice: a frozen surface with pale cracks and a glint; it never breaks.
  ice(g, px, py, S, at) {
    const { x, y } = at, st = styled({ crack: 'rgba(90,140,185,.5)', sheen: 'rgba(255,255,255,.55)' }, at), R = (i) => rnd(x, y, 760 + i), P = mapper(px, py, S);
    for (let i = 0; i < 2; i++) { const sx = .1 + .7 * R(i), sy = .15 + .6 * R(i + 3); line(g, [P(sx, sy), P(sx + .12 + R(i + 6) * .1, sy + .1), P(sx + .08 + R(i + 9) * .15, sy + .24 + R(i + 12) * .1)], st.crack, S * .018); }
    line(g, [P(.15 + R(20) * .2, .22), P(.3 + R(20) * .2, .12)], st.sheen, S * .04);
    line(g, [P(.55 + R(21) * .2, .8), P(.7 + R(21) * .2, .7)], st.sheen, S * .03);
    for (let i = 0; i < 3; i++) dot(g, ...P(.1 + .8 * R(30 + i), .1 + .8 * R(34 + i)), Math.max(1, S * .014), 'rgba(255,255,255,.9)');
  },
};
