// Tree drawings for the forest terrain in every tileset (terrain.json -> render.decor, or a tileset's override). `forest` (the pines) lives in
// terrain-art.js; these are the others. Each is decor(g, px, py, S, { x, y, now, style }): `style` is the tileset's render.style for that terrain.
//   roundwood   round-crowned trees: orchards, parks, rainforest (`dense`: crowns packed edge to edge), blossom (`dots`)
//   palm        palm trees with a few drooping fronds
//   deadwood    bare charred trunks standing in ash
// Position, size and colour vary per tile through rnd(), so every tile differs but each draws the same every time.

import { dot, ell, line, pick, poly, rnd, styled } from './terrain-kit.js';

const ROUND = { canopy: [['#2f7a3a', '#47a050'], ['#2a7035', '#3f9448']], trunk: '#5a4028', dense: false, dots: null, scale: 1 };

export const WOOD_DECOR = {
  roundwood(g, px, py, S, at) {
    const { x, y } = at, st = styled(ROUND, at), R = (i) => rnd(x, y, 200 + i);
    if (st.dense) {   // a rainforest: crowns heaped edge to edge, back to front, each lit from the upper left
      const slots = [[.22, .42], [.74, .36], [.48, .6], [.18, .86], [.8, .84], [.5, .3]];
      slots.map(([cx, cy], k) => [cx + (R(k) - .5) * .1, cy + (R(k + 9) - .5) * .08, k]).sort((a, b) => a[1] - b[1]).forEach(([cx, cy, k]) => {
        const [dark, lit] = pick(st.canopy, R(20 + k)), r = S * (.2 + .05 * R(30 + k)) * st.scale;
        const ax = px + cx * S, ay = py + cy * S;
        ell(g, ax + r * .1, ay + r * .5, r * 1.02, r * .55, 'rgba(0,0,0,.16)');
        ell(g, ax, ay, r, r * .92, dark);
        ell(g, ax - r * .22, ay - r * .24, r * .68, r * .6, lit);
        if (st.dots) for (let i = 0; i < 3; i++) dot(g, ax + (R(40 + k * 3 + i) - .55) * r * 1.3, ay + (R(60 + k * 3 + i) - .6) * r * 1.1, Math.max(1, S * .018), pick(st.dots, R(80 + i)));
      });
      return;
    }
    const tree = (cx, by, u, k) => {
      const [dark, lit] = pick(st.canopy, R(30 + k)), r = S * .16 * u * st.scale, ax = px + cx * S, ay = py + by * S;
      ell(g, ax + r * .25, ay, r * 1.05, r * .3, 'rgba(0,0,0,.16)');
      g.fillStyle = st.trunk; g.fillRect(ax - r * .14, ay - r * 1.05, r * .28, r * 1.05);
      ell(g, ax, ay - r * 1.6, r * 1.05, r * .96, dark);
      ell(g, ax - r * .24, ay - r * 1.82, r * .72, r * .66, lit);
      if (st.dots) for (let i = 0; i < 5; i++) dot(g, ax + (R(50 + k * 5 + i) - .55) * r * 1.5, ay - r * 1.6 + (R(70 + k * 5 + i) - .6) * r * 1.3, Math.max(1, S * .02), pick(st.dots, R(90 + i)));
    };
    const slots = [[.27, .56], [.74, .5], [.5, .93]];
    if (R(1) < .4) slots.push(R(2) < .5 ? [.12, .93] : [.9, .93]);
    slots.map(([cx, by], k) => [cx + (R(3 + k) - .5) * .1, by + (R(7 + k) - .5) * .06, .85 + R(11 + k) * .3, k]).sort((a, b) => a[1] - b[1]).forEach(([cx, by, u, k]) => tree(cx, Math.min(by, .95), u, k));
  },

  palm(g, px, py, S, at) {
    const { x, y } = at, st = styled({ trunk: '#b8935a', trunkDark: '#8c6c3c', fronds: [['#2d8a3e', '#52b24d'], ['#25793a', '#44a049']], nuts: '#5a3a1c' }, at), R = (i) => rnd(x, y, 220 + i);
    const palm = (cx, by, u, k) => {
      const ax = px + cx * S, ay = py + by * S, h = S * (.4 + .12 * u), lean = (R(k) - .5) * S * .22;
      const tx = ax + lean, ty = ay - h;
      ell(g, ax + S * .06, ay, S * .13 * u, S * .035, 'rgba(0,0,0,.16)');
      // the trunk: a gentle curve, a lit stroke over a dark one
      const curve = (w, c, off) => { g.strokeStyle = c; g.lineWidth = Math.max(1.5, w); g.lineCap = 'round'; g.beginPath(); g.moveTo(ax + off, ay); g.quadraticCurveTo(ax + lean * .1 + off, ay - h * .55, tx + off, ty); g.stroke(); };
      curve(S * .07, st.trunkDark, S * .008); curve(S * .045, st.trunk, -S * .006);
      // fronds: leaves that fan out from the crown and droop at the tips
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + (i + .5) * (Math.PI / n) + (R(10 + i + k * 7) - .5) * .3;   // fan over the top half
        const len = S * (.2 + .05 * R(30 + i + k * 7)) * (.85 + .2 * u);
        const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * .7 + len * .3 * Math.abs(Math.cos(a));   // tips droop
        const mx = (tx + ex) / 2, my = (ty + ey) / 2 - len * .12, rot = Math.atan2(ey - ty, ex - tx);
        const [dark, lit] = st.fronds[(i + k) % st.fronds.length];
        ell(g, mx, my + S * .012, len / 2, S * .035, dark, rot);
        ell(g, mx, my - S * .006, len / 2.1, S * .026, lit, rot);
      }
      dot(g, tx - S * .015, ty + S * .015, S * .02, st.nuts); dot(g, tx + S * .02, ty + S * .02, S * .02, st.nuts);
    };
    const slots = [[.3, .78, 1.05], [.7, .62, .9], [.52, .96, 1.15]];
    if (R(1) < .45) slots.splice(2, 1);
    slots.map(([cx, by, u], k) => [cx + (R(3 + k) - .5) * .1, by + (R(7 + k) - .5) * .05, u, k]).sort((a, b) => a[1] - b[1]).forEach(([cx, by, u, k]) => palm(cx, Math.min(by, .95), u, k));
  },

  deadwood(g, px, py, S, at) {
    const { x, y } = at, st = styled({ trunk: '#4a4540', lit: '#6b645b', ash: '#c4c0b6', soot: '#2c2926' }, at), R = (i) => rnd(x, y, 240 + i);
    ell(g, px + S * .5, py + S * .88, S * .4, S * .09, 'rgba(0,0,0,.12)');
    for (let i = 0; i < 7; i++) dot(g, px + (.12 + .76 * R(i)) * S, py + (.78 + .17 * R(i + 9)) * S, S * (.012 + .012 * R(i + 18)), i % 2 ? st.ash : st.soot);
    const trunk = (cx, by, h, lean, k) => {
      const w = S * (.05 + .02 * R(40 + k)), bx = px + cx * S, bY = py + by * S, tx = bx + lean * S, ty = bY - h * S;
      poly(g, [[bx - w, bY], [tx - w * .35, ty], [tx + w * .35, ty + S * .02], [bx + w, bY]], st.trunk);
      poly(g, [[bx - w, bY], [tx - w * .35, ty], [tx, ty + S * .01], [bx - w * .1, bY]], st.lit);
      // a snapped top and a couple of bare branches
      for (let b = 0; b < 2; b++) {
        const t = .45 + .3 * R(50 + k * 3 + b), sx = bx + (tx - bx) * t, sy = bY + (ty - bY) * t, dir = b ? 1 : -1;
        line(g, [[sx, sy], [sx + dir * S * (.1 + .06 * R(60 + k + b)), sy - S * (.08 + .06 * R(70 + k + b))]], st.trunk, S * .03);
      }
    };
    [[.26, .86, .5, -.04], [.55, .93, .62, .05], [.8, .8, .4, .06], ...(R(1) < .5 ? [[.4, .72, .34, -.05]] : [])]
      .map(([cx, by, h, lean], k) => [cx + (R(5 + k) - .5) * .08, by, h * (.85 + .3 * R(9 + k)), lean, k]).sort((a, b) => a[1] - b[1]).forEach((t) => trunk(...t));
  },
};
