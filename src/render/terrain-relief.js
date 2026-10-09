// Relief drawings: the raised ground of each tileset. Each is decor(g, px, py, S, { x, y, now, link, radii, style }).
//   mesa     a flat-topped butte of banded rock (the desert's mountain)
//   towers   a cluster of tower blocks (the city's mountain: tall, and only infantry get through)
//   spires   castle spires with pointed roofs (the royal gardens' mountain)
// `style` is the tileset's render.style for that terrain. Anything it leaves out falls back to the defaults below.

import { shade } from './color.js';
import { kit } from './buildings.js';
import { dot, ell, line, mapper, pick, poly, rnd, styled } from './terrain-kit.js';

const MESA = { top: '#e8b27c', bands: ['#cf7c4c', '#bd6a40', '#da9060', '#b05f3b'], dark: .22, shadow: 'rgba(0,0,0,.15)' };
const TOWERS = { walls: ['#7d8aa0', '#8896ab', '#6b788d'], glass: null };
const SPIRES = { stone: '#c3bccf', roof: '#8a56c4', flag: '#f0c94a' };

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
};
