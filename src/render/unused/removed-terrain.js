// ARCHIVED terrain drawings: not imported anywhere. Rough ground, the soft ground (snowdrift, dune, mud) and the cliff were taken out of the
// game (October 2026) but their drawings are kept here, ready to be wired back in. To revive one: add the terrain id back to data/terrain.json with
// `render.decor` naming it, move its function into TERRAIN_DECOR (terrain-art.js, terrain-ground.js or terrain-relief.js), and bring the helpers
// it uses. The cliff also needs its `CLIFF` defaults and the two helpers below it; its tileset styles (face, rim, crack, texture, faceH) are in git history.

import { shade } from '../color.js';
import { dot, ell, line, mapper, poly, rnd, styled } from '../terrain-kit.js';

// ---- rough ground: shaded boulders and pebbles over whatever ground is under the tile (was terrain-art.js) ----
export const ROUGH_DECOR = {
  // A few shaded boulders and pebbles; what they lie on (grass or dirt) is the ground under the tile.
  rough(g, px, py, S, at) {
    const { x, y } = at, RS = styled({ rock: '#857c6c', lit: '#b3a997', specks: ['#cfc9bb', '#7d7667'] }, at);
    const rock = (cx, cy, r, seed) => {
      const pts = [], lit = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * 6.2832 + seed, rr = r * (.78 + .22 * rnd(x, y, seed * 11 + k));
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .78]);
        lit.push([cx - r * .1 + Math.cos(a) * rr * .72, cy - r * .16 + Math.sin(a) * rr * .56]);
      }
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(cx + r * .12, cy + r * .62, r * .95, r * .3, 0, 0, 7); g.fill();
      poly(g, pts, RS.rock);
      poly(g, lit, RS.lit);
    };
    rock(px + (.26 + .1 * rnd(x, y, 1)) * S, py + (.36 + .08 * rnd(x, y, 2)) * S, S * .15, 1);
    rock(px + (.68 + .08 * rnd(x, y, 3)) * S, py + (.62 + .08 * rnd(x, y, 4)) * S, S * .2, 2);
    rock(px + (.36 + .1 * rnd(x, y, 5)) * S, py + (.82 + .05 * rnd(x, y, 6)) * S, S * .09, 3);
    for (let i = 0; i < 4; i++) dot(g, px + (.1 + .8 * rnd(x, y, i + 40)) * S, py + (.1 + .8 * rnd(x, y, i + 44)) * S, S * .02, i % 2 ? RS.specks[0] : RS.specks[1]);
  },
};

// ---- soft ground: slowed wheels (was terrain-ground.js). `drift` snowdrift, `dune`, `mud` ----
export const SOFT_DECOR = {
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

// ---- cliff: a ledge with a raised top and a sheer face, linked to the cliff tiles beside it (was terrain-relief.js) ----
const CLIFF = { face: '#7c7668', rim: 'rgba(255,255,255,.22)', crack: 'rgba(52,47,40,.38)', texture: 'rock', bands: null, faceH: .32, top2: null, bloom: '#f4d6e4' };

/** Cracks, strata or leaves on the top face of a cliff tile. */
function cliffTop(g, P, S, st, x, y, base) {
  const R = (i) => rnd(x, y, 400 + i);
  if (st.texture === 'strata') {
    for (let i = 0; i < 2; i++) { const yy = .22 + i * .27 + R(i) * .08; g.strokeStyle = st.crack; g.lineWidth = Math.max(1, S * .02); g.beginPath(); g.moveTo(...P(0, yy)); g.quadraticCurveTo(...P(.5, yy + (R(i + 4) - .5) * .06), ...P(1, yy + (R(i + 6) - .5) * .05)); g.stroke(); }
  } else if (st.texture === 'ice') {
    for (let i = 0; i < 3; i++) { const a = R(i) * .7, b = R(i + 3) * .5; line(g, [P(.1 + a * .7, .08 + b * .5), P(.28 + a * .7, .24 + b * .5)], 'rgba(255,255,255,.55)', S * .035); }
    line(g, [P(.45 + R(8) * .2, .1), P(.55 + R(8) * .2, .3), P(.5 + R(9) * .2, .42)], 'rgba(90,130,170,.35)', S * .018);
  } else if (st.texture === 'hedge') {
    for (let i = 0; i < 12; i++) dot(g, ...P(.06 + .88 * R(i), .06 + .64 * R(i + 20)), S * (.035 + .02 * R(i + 40)), i % 3 ? shade(base, .14) : shade(base, -.16));
    for (let i = 0; i < 2; i++) dot(g, ...P(.15 + .7 * R(60 + i), .12 + .5 * R(70 + i)), S * .017, st.bloom);
  } else if (st.texture === 'wall') {   // a stone coping: two courses of blocks
    g.strokeStyle = st.crack; g.lineWidth = Math.max(1, S * .02); g.beginPath();
    g.moveTo(...P(0, .34)); g.lineTo(...P(1, .34));
    const o = R(1) * .1; for (const xx of [.25 + o, .6 + o]) { g.moveTo(...P(xx, 0)); g.lineTo(...P(xx, .34)); }
    for (const xx of [.1 + o, .45 + o, .85 + o * .2]) { g.moveTo(...P(xx, .34)); g.lineTo(...P(xx, .68)); }
    g.stroke();
  } else if (st.texture === 'concrete') {
    g.strokeStyle = st.crack; g.lineWidth = Math.max(1, S * .018); g.beginPath(); g.moveTo(...P(.5, 0)); g.lineTo(...P(.5, .7)); g.moveTo(...P(0, .36)); g.lineTo(...P(1, .36)); g.stroke();
    for (let i = 0; i < 4; i++) dot(g, ...P(.1 + .8 * R(i), .08 + .55 * R(i + 5)), S * .014, st.crack);
  } else {   // rock: angular cracks and a few pebbles
    for (let i = 0; i < 3; i++) { const sx = .1 + .8 * R(i), sy = .08 + .5 * R(i + 4); line(g, [P(sx, sy), P(sx + (R(i + 8) - .3) * .2, sy + .08), P(sx + (R(i + 12) - .4) * .25, sy + .16 + R(i + 16) * .08)], st.crack, S * .02); }
    for (let i = 0; i < 3; i++) dot(g, ...P(.12 + .76 * R(20 + i), .1 + .55 * R(24 + i)), S * .02, shade(base, i % 2 ? .18 : -.12));
  }
}

/** The sheer face under a cliff tile with no cliff to its south: x0..x1 by y0..y1 in tile fractions. */
function cliffFace(g, P, S, st, x, y, y0) {
  const R = (i) => rnd(x, y, 440 + i), h = 1 - y0;
  g.fillStyle = st.face; g.fillRect(...P(0, y0), S, h * S + 1);
  if (st.texture === 'strata' || st.bands) {
    const bands = st.bands ?? [shade(st.face, .12), st.face, shade(st.face, -.1)];
    const cuts = [0, .3, .55, .8, 1];
    for (let i = 0; i < 4; i++) { g.fillStyle = bands[i % bands.length]; g.fillRect(...P(0, y0 + h * cuts[i]), S, h * S * (cuts[i + 1] - cuts[i]) + 1); }
  } else if (st.texture === 'wall') {
    g.strokeStyle = st.crack; g.lineWidth = Math.max(1, S * .02); g.beginPath();
    for (let c = 1; c < 3; c++) { g.moveTo(...P(0, y0 + h * c / 3)); g.lineTo(...P(1, y0 + h * c / 3)); }
    for (let c = 0; c < 3; c++) { const o = c % 2 ? .3 : .55; for (const xx of [o, o + .5]) if (xx < 1) { g.moveTo(...P(xx, y0 + h * c / 3)); g.lineTo(...P(xx, y0 + h * (c + 1) / 3)); } }
    g.stroke();
  } else if (st.texture === 'ice') {
    for (let i = 0; i < 4; i++) { const xx = .08 + .84 * R(i); g.fillStyle = i % 2 ? 'rgba(255,255,255,.35)' : 'rgba(40,90,140,.18)'; g.fillRect(...P(xx, y0 + h * .08), S * (.05 + .05 * R(i + 5)), h * S * (.55 + .4 * R(i + 9))); }
  } else if (st.texture === 'hedge') {
    for (let i = 0; i < 9; i++) dot(g, ...P(.06 + .88 * R(i), y0 + h * (.15 + .7 * R(i + 12))), S * (.03 + .02 * R(i + 24)), i % 2 ? shade(st.face, .13) : shade(st.face, -.18));
  } else {   // rock and concrete: vertical cracks and darker weathering
    for (let i = 0; i < 3; i++) { const xx = .12 + .76 * R(i); line(g, [P(xx, y0 + h * .05), P(xx + (R(i + 5) - .5) * .1, y0 + h * .5), P(xx + (R(i + 9) - .5) * .12, y0 + h * .95)], st.crack, S * .022); }
    g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(...P(.55 + R(20) * .2, y0 + h * .1), S * (.15 + .1 * R(21)), h * S * .8);
  }
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(...P(0, 1 - h * .16), S, h * S * .16 + 1);          // the foot is in shadow
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(...P(0, y0), S, Math.max(1, S * .022));             // the edge where the top turns over
}

export const CLIFF_DECOR = {
  cliff(g, px, py, S, at) {
    const { x, y, link = {}, radii = [0, 0, 0, 0] } = at, st = styled(CLIFF, at), P = mapper(px, py, S);
    const top = st.top ?? null, base = st.baseTop ?? null;
    const open = (k) => link[k] === false;
    g.save();
    g.beginPath(); g.roundRect(px, py, S, S, radii); g.clip();
    // the top: the tile's own colour, with the texture of the rock
    if (top) { g.fillStyle = top; g.fillRect(px, py, S, S); }
    cliffTop(g, P, S, st, x, y, top ?? base ?? '#a39d8e');
    if (open('n')) { g.fillStyle = st.rim; g.fillRect(px, py, S, Math.max(1, S * .05)); }
    if (open('w')) { g.fillStyle = st.rim; g.fillRect(px, py, Math.max(1, S * .045), S); }
    if (open('e')) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(px + S * .93, py, S * .07, S); }
    if (open('s')) cliffFace(g, P, S, st, x, y, 1 - st.faceH);
    g.restore();
  },
};
