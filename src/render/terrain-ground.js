// Ground and soft-terrain drawings. The first group is the ground texture each ground.json entry paints under a tile that has no colour of
// its own (snow, sand, hardpan, paving, moss, ash, heath, lawn); the second is the soft terrain laid over it (drift, dune, mud), which slows
// wheeled vehicles. Each is decor(g, px, py, S, { x, y, now, link, radii, style }); position-based variation comes from rnd().

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

  // ---- soft terrain: slows wheels (see terrain.json) ----
  drift(g, px, py, S, at) {
    const { x, y } = at, st = styled({ lit: '#f7fbff', body: '#dbe8f4', shade: '#a9c0d9' }, at), R = (i) => rnd(x, y, 660 + i), P = mapper(px, py, S);
    const mound = (cx, cy, w, h) => {
      ell(g, ...P(cx + .02, cy + h * .45), w * S * 1.05, h * S * .5, st.shade);
      g.save(); g.beginPath(); g.ellipse(...P(cx, cy), w * S, h * S, 0, Math.PI, 0); g.lineTo(...P(cx + w, cy + h * .45)); g.lineTo(...P(cx - w, cy + h * .45)); g.closePath(); g.fillStyle = st.body; g.fill(); g.clip();
      ell(g, ...P(cx - w * .25, cy - h * .15), w * S * .7, h * S * .75, st.lit); g.restore();
    };
    mound(.32 + (R(0) - .5) * .08, .6 + (R(1) - .5) * .06, .26, .22);
    mound(.7 + (R(2) - .5) * .08, .42 + (R(3) - .5) * .06, .2, .17);
    for (let i = 0; i < 3; i++) dot(g, ...P(.1 + .8 * R(10 + i), .12 + .75 * R(14 + i)), Math.max(1, S * .014), 'rgba(255,255,255,.95)');
  },
  dune(g, px, py, S, at) {
    const { x, y } = at, st = styled({ lit: '#f3dc9a', body: '#e0c07a', shade: '#c19a55', ridge: 'rgba(120,80,30,.3)' }, at), R = (i) => rnd(x, y, 680 + i), P = mapper(px, py, S);
    const dune = (cx, cy, w, h) => {   // a crescent: gentle windward slope on the left, a steeper shaded lee on the right
      poly(g, [P(cx - w, cy + h * .4), P(cx - w * .3, cy - h * .5), P(cx + w * .15, cy - h), P(cx + w, cy + h * .4)].map((p) => p), st.body);
      g.beginPath(); g.moveTo(...P(cx - w, cy + h * .4)); g.quadraticCurveTo(...P(cx - w * .2, cy - h * 1.2), ...P(cx + w * .15, cy - h)); g.quadraticCurveTo(...P(cx + w * .7, cy - h * .3), ...P(cx + w, cy + h * .4)); g.quadraticCurveTo(...P(cx, cy + h * .75), ...P(cx - w, cy + h * .4)); g.closePath(); g.fillStyle = st.lit; g.fill();
      g.beginPath(); g.moveTo(...P(cx + w * .15, cy - h)); g.quadraticCurveTo(...P(cx + w * .7, cy - h * .3), ...P(cx + w, cy + h * .4)); g.quadraticCurveTo(...P(cx + w * .4, cy + h * .6), ...P(cx + w * .12, cy + h * .1)); g.closePath(); g.fillStyle = st.shade; g.fill();
      line(g, [P(cx - w * .5, cy + h * .1), P(cx - w * .1, cy - h * .25)], st.ridge, S * .016);
    };
    dune(.34 + (R(0) - .5) * .06, .64, .3, .17);
    dune(.7 + (R(1) - .5) * .06, .34 + (R(2) - .5) * .05, .22, .13);
  },
  mud(g, px, py, S, at) {
    const { x, y } = at, st = styled({ puddle: '#4d3a24', shine: 'rgba(190,170,130,.5)', reed: '#5f8a3a' }, at), R = (i) => rnd(x, y, 700 + i), P = mapper(px, py, S);
    for (let i = 0; i < 3; i++) {
      const cx = .2 + .6 * R(i), cy = .22 + .56 * R(i + 5), w = .1 + .06 * R(i + 10);
      ell(g, ...P(cx, cy), w * S, w * S * .42, st.puddle); ell(g, ...P(cx - w * .3, cy - w * .1), w * S * .35, w * S * .12, st.shine);
    }
    for (let i = 0; i < 2; i++) { const [cx, cy] = [px + (.12 + .76 * R(20 + i)) * S, py + (.8 + .12 * R(24 + i)) * S]; for (const d of [-1, 0, 1]) line(g, [[cx, cy], [cx + d * S * .03, cy - S * (.1 + .03 * R(28 + i + d))]], st.reed, S * .016); }
  },
};
