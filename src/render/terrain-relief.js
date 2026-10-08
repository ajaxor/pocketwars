// Relief drawings: the raised ground of each tileset. Each is decor(g, px, py, S, { x, y, now, link, radii, style }).
//   mesa     a flat-topped butte of banded rock (the desert's mountain)
//   towers   a cluster of tower blocks (the city's mountain: tall, and only infantry get through)
//   spires   castle spires with pointed roofs (the royal gardens' mountain)
//   cliff    a ledge: a raised top and a sheer face below it, linked to the cliff tiles beside it like a wall. Impassable to ground units.
// `style` is the tileset's render.style for that terrain. Anything it leaves out falls back to the defaults below.

import { shade } from './color.js';
import { kit } from './buildings.js';
import { dot, ell, line, mapper, pick, poly, rnd, styled } from './terrain-kit.js';

const MESA = { top: '#e8b27c', bands: ['#cf7c4c', '#bd6a40', '#da9060', '#b05f3b'], dark: .22, shadow: 'rgba(0,0,0,.15)' };
const TOWERS = { walls: ['#7d8aa0', '#8896ab', '#6b788d'], glass: null };
const SPIRES = { stone: '#c3bccf', roof: '#8a56c4', flag: '#f0c94a' };
const CLIFF = { face: '#7c7668', rim: 'rgba(255,255,255,.22)', crack: 'rgba(52,47,40,.38)', texture: 'rock', bands: null, faceH: .32, top2: null };

/** One butte: foot line yb, centre cx, half-width w (at the foot) and summit height top. */
function butte(g, P, S, st, cx, w, top, yb, back) {
  const tw = w * .8, cap = .07;
  const k = back ? -.12 : 0;
  ell(g, ...P(cx + .03, yb + .02), w * S * 1.05, S * .05, st.shadow);
  g.save();
  g.beginPath(); g.moveTo(...P(cx - w, yb)); g.lineTo(...P(cx - tw, top)); g.lineTo(...P(cx + tw, top)); g.lineTo(...P(cx + w, yb)); g.quadraticCurveTo(...P(cx, yb + .07), ...P(cx - w, yb)); g.closePath(); g.clip();
  const n = st.bands.length, h = yb + .1 - top;
  for (let i = 0; i < 6; i++) {   // bands of differing thickness, from the cap down to the foot
    const y0 = top + h * [0, .14, .34, .52, .72, .88][i], y1 = top + h * ([.14, .34, .52, .72, .88, 1][i]);
    g.fillStyle = shade(st.bands[i % n], k); g.fillRect(...P(cx - w - .05, y0), (w * 2 + .1) * S, (y1 - y0) * S + 1);
  }
  poly(g, [P(cx + tw * .25, top), P(cx + w + .05, top), P(cx + w + .05, yb + .1), P(cx + w * .3, yb + .1)], `rgba(0,0,0,${st.dark})`);   // the shaded right side
  g.restore();
  // the flat top, seen from above, with a lit lip
  poly(g, [P(cx - tw - .02, top + .015), P(cx - tw * .88, top - cap), P(cx + tw * .88, top - cap), P(cx + tw + .02, top + .015)], shade(st.top, k));
  poly(g, [P(cx + tw * .3, top - cap), P(cx + tw * .88, top - cap), P(cx + tw + .02, top + .015), P(cx + tw * .4, top + .015)], 'rgba(0,0,0,.1)');
}

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
    for (let i = 0; i < 2; i++) dot(g, ...P(.15 + .7 * R(60 + i), .12 + .5 * R(70 + i)), S * .017, st.bloom ?? '#f4d6e4');
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

export const RELIEF_DECOR = {
  mesa(g, px, py, S, at) {
    const { x, y } = at, st = styled(MESA, at), R = (i) => rnd(x, y, 300 + i), P = mapper(px, py, S);
    const cx = .5 + (R(1) - .5) * .06, w = .34 + R(0) * .1, yb = .84 + R(2) * .05, top = .26 + R(3) * .1;
    if (R(6) > .35) { const side = R(7) > .5 ? 1 : -1, w2 = .15 + R(8) * .05, cx2 = Math.max(w2 + .03, Math.min(.97 - w2, cx + side * (w + .02 - w2 * .3))); butte(g, P, S, st, cx2, w2, top + .16 + R(9) * .1, yb - .05, true); }
    butte(g, P, S, st, cx, w, top, yb, false);
  },

  towers(g, px, py, S, at) {
    const { x, y } = at, st = styled(TOWERS, at), R = (i) => rnd(x, y, 320 + i), k = kit(g, px, py, S);
    const blocks = [   // back to front: x, y (top of the front face), w, h, depth
      { x: .5, y: .1 + R(0) * .1, w: .2, d: .09, c: st.walls[0] },
      { x: .14, y: .3 + R(1) * .1, w: .24, d: .1, c: st.walls[1] },
      { x: .56, y: .5 + R(2) * .08, w: .22, d: .08, c: st.walls[2] },
    ].map((b) => ({ ...b, h: .86 - b.y }));
    for (const b of blocks) k.boxShadow(b.x, b.y, b.w, b.h, b.d);
    for (const b of blocks) {
      k.box(b.x, b.y, b.w, b.h, b.d, b.c);
      k.windows(b.x, b.y, b.w, b.h, 2, Math.max(3, Math.round(b.h * 9)), b.c);
    }
    const t = blocks[0]; k.line([[t.x + t.w / 2 + t.d * .9 * .5, t.y - t.d * .7 * .5], [t.x + t.w / 2 + t.d * .9 * .5, t.y - t.d * .7 * .5 - .1]], '#4a5160', .014);
  },

  spires(g, px, py, S, at) {
    const { x, y } = at, st = styled(SPIRES, at), R = (i) => rnd(x, y, 340 + i), P = mapper(px, py, S);
    const tower = (cx, base, h, hw, shadow) => {
      const top = base - h;
      ell(g, ...P(cx + hw * .6, base), hw * S * 1.4, S * .045, 'rgba(0,0,0,.17)');
      g.fillStyle = shade(st.stone, shadow ? -.12 : 0); g.fillRect(...P(cx - hw, top), hw * 2 * S, h * S);              // the round tower: lit left, shaded right
      g.fillStyle = 'rgba(40,30,70,.22)'; g.fillRect(...P(cx + hw * .25, top), hw * .75 * S, h * S);
      ell(g, ...P(cx, base), hw * S, S * .03, shade(st.stone, shadow ? -.12 : 0)); ell(g, ...P(cx + hw * .5, base), hw * .5 * S, S * .03, 'rgba(40,30,70,.22)');
      g.fillStyle = shade(st.stone, -.25); g.fillRect(...P(cx - hw - .02, top), (hw * 2 + .04) * S, S * .035);        // a band under the roof
      g.fillStyle = '#3c3350'; g.fillRect(...P(cx - hw * .16, top + h * .32), hw * .32 * S, h * .2 * S);              // an arrow slit
      const rh = h * .85, ry = top;
      poly(g, [P(cx - hw - .04, ry), P(cx, ry - rh), P(cx + hw + .04, ry)], shade(st.roof, shadow ? -.12 : 0));     // the cone: lit left, shaded right
      poly(g, [P(cx + .005, ry - rh), P(cx + hw + .04, ry), P(cx + .005, ry)], 'rgba(30,10,60,.3)');
      line(g, [P(cx, ry - rh), P(cx, ry - rh - .09)], '#5a4a3a', S * .014);
      poly(g, [P(cx, ry - rh - .09), P(cx + .09, ry - rh - .065), P(cx, ry - rh - .04)], st.flag);
    };
    tower(.7 + (R(1) - .5) * .05, .66, .34 + R(0) * .06, .09, true);
    tower(.38 + (R(3) - .5) * .06, .88, .5 + R(2) * .08, .13, false);
  },

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
