// The terrain art: what is drawn ON a tile. terrain.json -> render.decor names a drawing (grass, road, forest, mountain,
// sea) and TERRAIN_DECOR supplies one function per name:
//     decor(g, px, py, S, { x, y, now })
// (px, py) is the tile's top-left pixel, S its size, (x, y) its grid position (so tiles can vary without randomness) and
// `now` the clock in ms (so the sea can twinkle). The tile's shape belongs to terrain-layer.js, buildings to buildings.js.
// The test suite requires a drawing for every decor name the terrain data uses.

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

// Pointed pine trees, shaded two-tone mountains with jagged snow, calm water with twinkling glints.
export const TERRAIN_DECOR = {
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
    // Open water is plain; a few white glints twinkle on it.
    sea(g, px, py, S, { x, y, now }) {
      const t = now / 1000;
      for (let i = 0; i < 2; i++) {
        const a = Math.max(0, Math.sin(t * 1.3 + rnd(x, y, i) * 6.28));
        if (a > .05) { g.fillStyle = `rgba(255,255,255,${(a * .75).toFixed(2)})`; g.fillRect(px + (.15 + .6 * rnd(x, y, i + 3)) * S, py + (.45 + .15 * i + .1 * rnd(x, y, i + 6)) * S, S * .09, Math.max(1, S * .028)); }
      }
    },
  };
