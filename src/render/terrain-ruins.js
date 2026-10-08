// Ruined property: a city or factory knocked down to rubble. A soldier can rebuild it for a price (terrain attribute "ruin"). Buildings are never themed,
// but ruins are drawn broken versions of them: toppled walls, a stump of the smokestack, scorch marks and a pile of rubble.
// Each is decor(g, px, py, S, { x, y, style }); `style` (a tileset's) may recolour the stone and the scorch.

import { shade } from './color.js';
import { dot, ell, line, mapper, poly, rnd, styled } from './terrain-kit.js';

const RUIN = { stone: '#9a948a', dark: '#6c675f', scorch: 'rgba(30,26,22,.35)', rebar: '#6a4a3a', ember: '#d9703a' };

function rubble(g, S, st, R, P, n, seed) {
  for (let i = 0; i < n; i++) {
    const cx = .12 + .76 * R(seed + i), cy = .66 + .26 * R(seed + 20 + i), r = .025 + .035 * R(seed + 40 + i);
    ell(g, ...P(cx + .01, cy + r * .8), r * S * 1.2, r * S * .5, 'rgba(0,0,0,.16)');
    poly(g, [P(cx - r, cy + r * .5), P(cx - r * .6, cy - r), P(cx + r, cy - r * .6), P(cx + r * 1.1, cy + r * .5)], i % 2 ? st.stone : shade(st.stone, -.15));
  }
}

export const RUIN_DECOR = {
  ruin_city(g, px, py, S, at) {
    const { x, y } = at, st = styled(RUIN, at), R = (i) => rnd(x, y, 740 + i), P = mapper(px, py, S);
    ell(g, ...P(.5, .86), S * .42, S * .08, st.scorch);
    // two jagged wall stumps with window holes, one taller than the other
    const stump = (x0, w, hTop, hBot, tall) => {
      const yb = .84;
      poly(g, [P(x0, yb), P(x0, hBot), P(x0 + w * .3, hTop + .05), P(x0 + w * .55, hTop), P(x0 + w * .75, hBot - .04), P(x0 + w, hBot + .02), P(x0 + w, yb)], st.stone);
      poly(g, [P(x0 + w * .72, yb), P(x0 + w * .72, hBot), P(x0 + w, hBot + .02), P(x0 + w, yb)], st.dark);
      g.fillStyle = '#35322d'; g.fillRect(...P(x0 + w * .18, hTop + (yb - hTop) * .3), w * S * .24, (yb - hTop) * S * .2);
      if (tall) g.fillRect(...P(x0 + w * .18, hTop + (yb - hTop) * .62), w * S * .24, (yb - hTop) * S * .16);
      line(g, [P(x0 + w * .55, hTop), P(x0 + w * .62, hTop - .07)], st.rebar, S * .016);   // a bent bar
    };
    stump(.14 + R(0) * .04, .3, .3 + R(1) * .06, .5, true);
    stump(.52 + R(2) * .04, .3, .5 + R(3) * .06, .64, false);
    rubble(g, S, st, R, P, 7, 10);
    for (let i = 0; i < 3; i++) dot(g, ...P(.2 + .6 * R(60 + i), .2 + .15 * R(64 + i)), Math.max(1, S * .014), 'rgba(80,76,70,.35)');   // dust
  },
  ruin_factory(g, px, py, S, at) {
    const { x, y } = at, st = styled(RUIN, at), R = (i) => rnd(x, y, 780 + i), P = mapper(px, py, S);
    ell(g, ...P(.5, .86), S * .44, S * .08, st.scorch);
    // the hall's low broken wall with a hanging sawtooth roof section, and the smokestack snapped off
    poly(g, [P(.1, .84), P(.1, .56), P(.3, .6), P(.42, .52), P(.62, .62), P(.9, .56), P(.9, .84)], st.stone);
    poly(g, [P(.66, .84), P(.66, .6), P(.9, .56), P(.9, .84)], st.dark);
    poly(g, [P(.1, .56), P(.18, .4), P(.26, .56)], shade(st.dark, -.1));   // a surviving sawtooth
    poly(g, [P(.26, .56), P(.34, .44), P(.42, .52), P(.34, .6)], st.dark);
    g.fillStyle = '#35322d'; g.fillRect(...P(.46, .64), S * .22, S * .2);          // the garage door, buckled
    line(g, [P(.46, .64), P(.68, .66)], st.rebar, S * .02);
    poly(g, [P(.74, .56), P(.74, .3), P(.8, .26), P(.86, .32), P(.86, .56)], shade(st.stone, -.08));      // the stack's stump
    poly(g, [P(.82, .56), P(.82, .34), P(.86, .32), P(.86, .56)], st.dark);
    line(g, [P(.83, .26), P(.88, .18)], st.rebar, S * .016);
    rubble(g, S, st, R, P, 8, 10);
    if (R(60) < .6) dot(g, ...P(.55, .74), Math.max(1, S * .02), st.ember);
  },
};
