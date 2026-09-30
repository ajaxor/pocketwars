// Terrain themes: alternative drawings for what sits on a tile. terrain.json -> render.decor names the drawing
// (grass, road, forest, mountain, sea) and every theme supplies one function per name:
//     decor(g, px, py, S, { x, y, now, nb, base })
// (px, py) is the tile's top-left pixel, S its size, (x, y) its grid position (so a theme can vary tiles without
// randomness), `now` the clock in ms (so the sea can move), `nb` the base colours of the eight neighbours (n, e, s, w, ne,
// se, sw, nw; null off the map) and `base` the tile's own colour. Themes never draw the tile shape (terrain-layer.js) or
// buildings (terrain-sprites.js). Add a theme by adding an object to TERRAIN_THEMES; the gallery, `?terrain=<id>` and the
// tests pick it up. The test suite requires every theme to cover every decor name the terrain data uses.

import { TERRAIN_DECOR } from './terrain-sprites.js';

/** Deterministic pseudo-random number in [0, 1) for grid position (x, y) and a per-call index. */
export function rnd(x, y, i = 0) {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(i + 31, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const poly = (g, pts, fill) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
};
const dot = (g, x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
const lw = (S, k = .05, min = 1.5) => Math.max(min, S * k);

// ---- flat: the original drawings -------------------------------------------------------------------------------------
const flat = {
  id: 'flat', name: 'Flat', note: 'The original simple shapes: round trees, one triangle for a mountain, a single wave.',
  decor: TERRAIN_DECOR,
};

// ---- pines: pointed pine trees, shaded two-tone mountains, and waves that drift ----------------------------------------
const pines = {
  id: 'pines', name: 'Pines', note: 'Pine trees, shaded two-tone mountains with jagged snow, flowing waves with glints and shoreline foam.',
  decor: {
    grass(g, px, py, S, { x, y }) {
      for (let i = 0; i < 3; i++) {
        const cx = px + (.18 + .64 * rnd(x, y, i)) * S, cy = py + (.2 + .6 * rnd(x, y, i + 9)) * S;
        g.fillStyle = i % 2 ? '#93c668' : '#76a94d'; g.beginPath(); g.ellipse(cx, cy, S * .09, S * .035, 0, 0, 7); g.fill();
      }
    },
    road(g, px, py, S, { x, y }) {
      for (let i = 0; i < 4; i++) dot(g, px + (.12 + .76 * rnd(x, y, i)) * S, py + (.12 + .76 * rnd(x, y, i + 5)) * S, S * .028, i % 2 ? '#dccda3' : '#bfab7c');
    },
    forest(g, px, py, S) {
      const pine = (cx, by, s) => {
        const u = S * s;
        g.fillStyle = '#5a4028'; g.fillRect(px + cx * S - u * .03, py + by * S - u * .1, u * .06, u * .1);
        for (const [hw, y0, y1] of [[.19, .08, .34], [.14, .24, .52]]) {
          const ax = px + cx * S, ay = py + by * S;
          poly(g, [[ax - hw * u, ay - y0 * u], [ax + hw * u, ay - y0 * u], [ax, ay - y1 * u]], '#2f6b34');
          poly(g, [[ax - hw * u, ay - y0 * u], [ax, ay - y0 * u], [ax, ay - y1 * u]], '#3d8443');
        }
      };
      pine(.27, .55, .95); pine(.73, .5, .95); pine(.5, .9, 1.1);
    },
    mountain(g, px, py, S) {
      const P = (a, b) => [px + a * S, py + b * S];
      poly(g, [P(.26, .42), P(.0, .9), P(.52, .9)], '#9a9284');
      poly(g, [P(.26, .42), P(.52, .9), P(.32, .9)], '#847c6f');
      poly(g, [P(.56, .12), P(.06, .92), P(.98, .92)], '#8a8275');
      poly(g, [P(.56, .12), P(.98, .92), P(.6, .92)], '#6f695e');
      poly(g, [P(.56, .12), P(.4, .38), P(.48, .33), P(.56, .43), P(.64, .33), P(.72, .4)], '#f2efe6');
    },
    // Waves are a function of the tile's world position, so the lines run on unbroken from tile to tile and drift together;
    // white glints twinkle, and a pale foam line follows the shore wherever the water meets land.
    sea(g, px, py, S, { x, y, now, nb, base }) {
      const t = now / 1000;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const wave = (row, amp, speed, phase, color, width) => {
        g.strokeStyle = color; g.lineWidth = width; g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const u = i / 8, yy = py + (row + amp * Math.sin((x + u) * 6.2832 + t * speed + phase)) * S;
          if (i) g.lineTo(px + u * S, yy); else g.moveTo(px, yy);
        }
        g.stroke();
      };
      wave(.3, .045, 1.1, y * 1.9, '#9ccbf2', lw(S, .05));
      wave(.68, .05, .9, y * 1.9 + 2.4, '#79b0e6', lw(S, .045));
      for (let i = 0; i < 2; i++) {
        const a = Math.max(0, Math.sin(t * 1.3 + rnd(x, y, i) * 6.28));
        if (a > .05) { g.fillStyle = `rgba(255,255,255,${(a * .75).toFixed(2)})`; g.fillRect(px + (.15 + .6 * rnd(x, y, i + 3)) * S, py + (.45 + .15 * i + .1 * rnd(x, y, i + 6)) * S, S * .09, Math.max(1, S * .028)); }
      }
      const land = (c) => c != null && c !== base;
      g.strokeStyle = 'rgba(236,246,255,.85)'; g.lineWidth = lw(S, .05);
      const foam = (x0, y0, x1, y1) => { const w = Math.sin(t * 1.6 + x * 2 + y * 3) * S * .012; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + w, (y0 + y1) / 2 + w, x1, y1); g.stroke(); };
      // Foam runs the full tile where the shore carries on into the next tile, and curves round the rounded corners.
      const m = S * .07, R = S * .3;
      const ends = (p, pd, q, qd) => [land(p) ? R : land(pd) ? 0 : S * .16, land(q) ? S - R : land(qd) ? S : S * .84];
      if (land(nb.n)) { const [a, b] = ends(nb.w, nb.nw, nb.e, nb.ne); foam(px + a, py + m, px + b, py + m); }
      if (land(nb.s)) { const [a, b] = ends(nb.w, nb.sw, nb.e, nb.se); foam(px + a, py + S - m, px + b, py + S - m); }
      if (land(nb.w)) { const [a, b] = ends(nb.n, nb.nw, nb.s, nb.sw); foam(px + m, py + a, px + m, py + b); }
      if (land(nb.e)) { const [a, b] = ends(nb.n, nb.ne, nb.s, nb.se); foam(px + S - m, py + a, px + S - m, py + b); }
      for (const [cx, cy, a0, sideA, sideB] of [[R, R, Math.PI, nb.n, nb.w], [S - R, R, Math.PI * 1.5, nb.n, nb.e], [S - R, S - R, 0, nb.s, nb.e], [R, S - R, Math.PI / 2, nb.s, nb.w]]) {
        if (land(sideA) && land(sideB)) { g.beginPath(); g.arc(px + cx, py + cy, R - m, a0, a0 + Math.PI / 2); g.stroke(); }
      }
    },
  },
};

// ---- storybook: dark outlines, bushy round trees, rounded hills, scalloped waves ---------------------------------------
const INK = '#243b2a';
const storybook = {
  id: 'storybook', name: 'Storybook', note: 'Dark outlines like a picture book: bushy trees, rounded hills with snowy tops, scalloped waves.',
  decor: {
    grass(g, px, py, S, { x, y }) {
      g.strokeStyle = '#6fa34a'; g.lineWidth = lw(S, .03, 1); g.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        const cx = px + (.2 + .6 * rnd(x, y, i)) * S, cy = py + (.3 + .5 * rnd(x, y, i + 4)) * S;
        g.beginPath(); g.moveTo(cx - S * .05, cy); g.quadraticCurveTo(cx - S * .02, cy - S * .07, cx, cy - S * .09);
        g.moveTo(cx + S * .05, cy); g.quadraticCurveTo(cx + S * .02, cy - S * .07, cx, cy - S * .09); g.stroke();
      }
    },
    road(g, px, py, S, { x, y }) {
      g.strokeStyle = '#a59468'; g.lineWidth = lw(S, .03, 1);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(px + (.2 + .6 * rnd(x, y, i)) * S, py + (.2 + .6 * rnd(x, y, i + 3)) * S, S * .04, 0, 7); g.stroke(); }
    },
    forest(g, px, py, S) {
      const w = lw(S, .045);
      for (const [a, b, r] of [[.3, .38, .2], [.7, .42, .2], [.5, .72, .23]]) {
        const cx = px + a * S, cy = py + b * S;
        g.fillStyle = '#3f8a45'; g.strokeStyle = INK; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, S * r, 0, 7); g.fill(); g.stroke();
        dot(g, cx - S * r * .35, cy - S * r * .35, S * r * .3, '#69b26c');
      }
    },
    mountain(g, px, py, S) {
      const P = (a, b) => [px + a * S, py + b * S];
      const w = lw(S, .045);
      g.lineJoin = 'round';
      g.beginPath(); g.moveTo(...P(.08, .88)); g.quadraticCurveTo(...P(.32, .5), ...P(.5, .14)); g.quadraticCurveTo(...P(.72, .5), ...P(.92, .88)); g.closePath();
      g.fillStyle = '#9c9384'; g.fill(); g.strokeStyle = INK; g.lineWidth = w; g.stroke();
      g.beginPath(); g.moveTo(...P(.5, .14)); g.quadraticCurveTo(...P(.42, .32), ...P(.35, .36)); g.quadraticCurveTo(...P(.44, .42), ...P(.5, .38));
      g.quadraticCurveTo(...P(.58, .44), ...P(.65, .36)); g.quadraticCurveTo(...P(.58, .32), ...P(.5, .14)); g.closePath();
      g.fillStyle = '#f7f4ec'; g.fill(); g.lineWidth = w * .7; g.stroke();
    },
    sea(g, px, py, S, { x, y, now }) {
      g.strokeStyle = '#b5dcf7'; g.lineWidth = lw(S, .04); g.lineCap = 'round';
      [[.4, 0], [.72, .5]].forEach(([row, off], k) => {
        const dx = Math.sin(now / 1100 + x + y * .6 + k) * S * .03;
        for (let i = 0; i < 2; i++) {
          const cx = px + (.28 + off * .3 + i * .42) * S + dx; g.beginPath(); g.arc(cx, py + row * S, S * .1, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
      });
    },
  },
};

// ---- grain: textured and busy: grass tufts, pebbly roads, dense canopy, hatched rock, twinkling water -------------------
const grain = {
  id: 'grain', name: 'Grain', note: 'Textured: grass tufts, pebbly roads, a dense leafy canopy, hatched rock and twinkling water.',
  decor: {
    grass(g, px, py, S, { x, y }) {
      g.strokeStyle = '#6a9c46'; g.lineWidth = lw(S, .03, 1); g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const cx = px + (.12 + .76 * rnd(x, y, i)) * S, cy = py + (.25 + .65 * rnd(x, y, i + 7)) * S, h = S * (.07 + .04 * rnd(x, y, i + 13));
        g.beginPath(); g.moveTo(cx - S * .03, cy); g.lineTo(cx - S * .05, cy - h); g.moveTo(cx, cy); g.lineTo(cx, cy - h * 1.2); g.moveTo(cx + S * .03, cy); g.lineTo(cx + S * .05, cy - h); g.stroke();
      }
    },
    road(g, px, py, S, { x, y }) {
      for (let i = 0; i < 10; i++) dot(g, px + (.08 + .84 * rnd(x, y, i)) * S, py + (.08 + .84 * rnd(x, y, i + 20)) * S, S * (.018 + .018 * rnd(x, y, i + 40)), i % 3 ? '#b8a373' : '#e0d2a8');
    },
    forest(g, px, py, S, { x, y }) {
      dot(g, px + S * .5, py + S * .56, S * .36, '#25572b');
      for (let i = 0; i < 9; i++) {
        const a = rnd(x, y, i) * 6.28, d = S * .26 * Math.sqrt(rnd(x, y, i + 9));
        dot(g, px + S * .5 + Math.cos(a) * d, py + S * .5 + Math.sin(a) * d, S * .11, i % 2 ? '#3a7a3f' : '#2f6b34');
      }
      for (let i = 0; i < 4; i++) dot(g, px + (.3 + .4 * rnd(x, y, i + 30)) * S, py + (.25 + .3 * rnd(x, y, i + 34)) * S, S * .045, '#5fa565');
    },
    mountain(g, px, py, S) {
      const P = (a, b) => [px + a * S, py + b * S];
      poly(g, [P(.5, .1), P(.05, .9), P(.95, .9)], '#8a8275');
      poly(g, [P(.5, .1), P(.95, .9), P(.58, .9)], '#736c60');
      g.strokeStyle = '#5f594f'; g.lineWidth = lw(S, .022, 1);
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const y = .36 + i * .1, x1 = .5 + .45 * (y - .1) / .8 - .04;   // stay inside the right face
        g.moveTo(...P(x1 - .15, y + .06)); g.lineTo(...P(x1, y));
      }
      g.stroke();
      poly(g, [P(.5, .1), P(.37, .36), P(.45, .31), P(.52, .4), P(.6, .31), P(.64, .36)], '#f2efe6');
      dot(g, px + S * .25 * 1, py + S * .82, S * .03, '#6f695e'); dot(g, px + S * .75, py + S * .85, S * .025, '#a19a8c');
    },
    sea(g, px, py, S, { x, y, now }) {
      for (let i = 0; i < 8; i++) {
        const a = .25 + .45 * (.5 + .5 * Math.sin(now / 500 + rnd(x, y, i) * 6.28));
        g.fillStyle = `rgba(190,225,250,${a.toFixed(2)})`;
        g.fillRect(px + (.1 + .72 * rnd(x, y, i + 9)) * S, py + (.12 + .74 * rnd(x, y, i + 17)) * S, S * .11, Math.max(1, S * .03));
      }
    },
  },
};

// ---- muted: low contrast so units and highlights stand out; only the essentials are drawn ------------------------------
const muted = {
  id: 'muted', name: 'Muted', note: 'Quiet and low contrast so units stand out: soft blobs, one gentle peak, two thin waves.',
  decor: {
    grass() {},
    road() {},
    forest(g, px, py, S) {
      dot(g, px + S * .36, py + S * .55, S * .25, '#6aa04a'); dot(g, px + S * .64, py + S * .5, S * .27, '#6aa04a'); dot(g, px + S * .5, py + S * .38, S * .22, '#77ad55');
    },
    mountain(g, px, py, S) {
      const P = (a, b) => [px + a * S, py + b * S];
      poly(g, [P(.5, .16), P(.12, .84), P(.88, .84)], '#a59e90');
      poly(g, [P(.5, .16), P(.4, .34), P(.6, .34)], '#f3f0e8');
    },
    sea(g, px, py, S) {
      g.strokeStyle = '#6fa6dd'; g.lineWidth = Math.max(1, S * .035); g.lineCap = 'round';
      for (const row of [.4, .66]) { g.beginPath(); g.moveTo(px + S * .2, py + row * S); g.quadraticCurveTo(px + S * .35, py + (row - .08) * S, px + S * .5, py + row * S); g.quadraticCurveTo(px + S * .65, py + (row + .08) * S, px + S * .8, py + row * S); g.stroke(); }
    },
  },
};

export const TERRAIN_THEMES = [flat, pines, storybook, grain, muted];
export const DEFAULT_TERRAIN_THEME = 'pines';
/** localStorage key under which the gallery remembers the chosen theme for the game. */
export const TERRAIN_THEME_KEY = 'pocketwars.terrain';

/** The theme with this id; anything unknown (or missing) falls back to the default. */
export function terrainThemeById(id) {
  return TERRAIN_THEMES.find((t) => t.id === id) || TERRAIN_THEMES.find((t) => t.id === DEFAULT_TERRAIN_THEME);
}
