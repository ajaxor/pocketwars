// The terrain art: what is drawn ON a tile. terrain.json -> render.decor names a drawing (grass, road, rough, forest, mountain,
// sea) and TERRAIN_DECOR supplies one function per name:
//     decor(g, px, py, S, { x, y, now, link, radii })
// (px, py) is the tile's top-left pixel, S its size, (x, y) its grid position (so tiles can vary without randomness) and
// `now` the clock in ms (so the sea can twinkle). `link` ({n, e, s, w, ne, se, sw, nw}, booleans) tells which neighbours carry
// the same drawing, so a road can join up with the roads next to it; `radii` are the tile's corner radii (for clipping).
// The tile's shape belongs to terrain-layer.js, buildings to buildings.js.
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

const NO_LINKS = Object.freeze({ n: false, e: false, s: false, w: false, ne: false, se: false, sw: false, nw: false });

/**
 * Which way a road tile runs, from which neighbours are roads: { shape, arms } where `arms` = { n, e, s, w } are the sides the
 * road leaves by and `shape` is 'straight' (one axis), 'corner' (two sides that meet at a right angle) or 'junction' (three or
 * four sides). A side neighbour that is just the next lane of a wider road (it has roads on both ends of the axis this tile
 * already runs along) is not an arm, so a two-wide road is two parallel roads and not a ladder. A tile with no road arms at
 * all runs east-west.
 */
export function roadShape(link = NO_LINKS) {
  const arms = { n: !!link.n, e: !!link.e, s: !!link.s, w: !!link.w };
  // A side neighbour that has roads on both ends of the same axis as this tile's arm is the next lane of a wider road.
  if (link.n || link.s) {
    if (link.e && link.ne && link.se) arms.e = false;
    if (link.w && link.nw && link.sw) arms.w = false;
  }
  if (link.e || link.w) {
    if (link.n && link.nw && link.ne) arms.n = false;
    if (link.s && link.sw && link.se) arms.s = false;
  }
  const count = arms.n + arms.e + arms.s + arms.w;
  if (count >= 3) return { shape: 'junction', arms };
  if (count === 2 && !((arms.n && arms.s) || (arms.e && arms.w))) return { shape: 'corner', arms };
  if (count === 0) return { shape: 'straight', arms: { n: false, e: true, s: false, w: true } };
  if (count === 1) return { shape: 'straight', arms: arms.n || arms.s ? { n: true, e: false, s: true, w: false } : { n: false, e: true, s: false, w: true } };
  return { shape: 'straight', arms };
}

// Pointed pine trees, shaded two-tone mountains with jagged snow, calm water with twinkling glints, paved roads with a painted
// dashed centre line, and rough ground of dry dirt and scattered rocks.
export const TERRAIN_DECOR = {
    grass(g, px, py, S, { x, y }) {
      for (let i = 0; i < 3; i++) {
        const cx = px + (.18 + .64 * rnd(x, y, i)) * S, cy = py + (.2 + .6 * rnd(x, y, i + 9)) * S;
        g.fillStyle = i % 2 ? '#93c668' : '#76a94d'; g.beginPath(); g.ellipse(cx, cy, S * .09, S * .035, 0, 0, 7); g.fill();
      }
    },
    // Asphalt with a pale shoulder line along every side that does not meet another road, and a dashed centre line that runs
    // through each tile in the same rhythm (two dashes a tile, gaps at the tile edges) so it carries on from tile to tile.
    road(g, px, py, S, { x, y, link = NO_LINKS, radii = null }) {
      for (let i = 0; i < 3; i++) dot(g, px + (.14 + .72 * rnd(x, y, i)) * S, py + (.14 + .72 * rnd(x, y, i + 5)) * S, S * .022, i % 2 ? '#6b707a' : '#51555d');
      const lw = Math.max(1, S * .04);
      g.save();
      if (radii) { g.beginPath(); g.roundRect(px, py, S, S, radii); g.clip(); }
      g.strokeStyle = 'rgba(232,228,208,.5)'; g.lineWidth = lw; g.lineCap = 'butt'; g.beginPath();
      const i = S * .075;
      // a side counts as open when the neighbour there is not a road (off the map counts as road, so the edge stays plain)
      if (!link.n) { g.moveTo(px, py + i); g.lineTo(px + S, py + i); }
      if (!link.s) { g.moveTo(px, py + S - i); g.lineTo(px + S, py + S - i); }
      if (!link.w) { g.moveTo(px + i, py); g.lineTo(px + i, py + S); }
      if (!link.e) { g.moveTo(px + S - i, py); g.lineTo(px + S - i, py + S); }
      g.stroke();
      g.restore();

      const { shape, arms } = roadShape(link);
      const cx = px + S / 2, cy = py + S / 2;
      // a dash on one arm, from `a` to `b` tiles out from the centre
      const dash = (dx, dy, a, b) => { g.moveTo(cx + dx * a * S, cy + dy * a * S); g.lineTo(cx + dx * b * S, cy + dy * b * S); };
      g.strokeStyle = '#f1e9c6'; g.lineWidth = Math.max(1.5, S * .06); g.lineCap = 'butt'; g.beginPath();
      const DIRS = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
      for (const [k, dx, dy] of DIRS) {
        if (!arms[k]) continue;
        if (shape === 'corner') dash(dx, dy, 0, .3);        // a bend gets one dash that turns the corner
        else dash(dx, dy, .125, .375);                      // straights and junctions: dashes at .125-.375 out from the centre
      }
      g.stroke();
    },
    // Dry dirt with a few shaded rocks, pebbles and tufts.
    rough(g, px, py, S, { x, y }) {
      for (let i = 0; i < 3; i++) {
        const cx = px + (.2 + .6 * rnd(x, y, i + 20)) * S, cy = py + (.2 + .6 * rnd(x, y, i + 24)) * S;
        g.fillStyle = i % 2 ? '#a88f5e' : '#c2ab7a'; g.beginPath(); g.ellipse(cx, cy, S * (.13 + .05 * rnd(x, y, i + 28)), S * .055, 0, 0, 7); g.fill();
      }
      const rock = (cx, cy, r, seed) => {
        const pts = [], lit = [];
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * 6.2832 + seed, rr = r * (.78 + .22 * rnd(x, y, seed * 11 + k));
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .78]);
          lit.push([cx - r * .1 + Math.cos(a) * rr * .72, cy - r * .16 + Math.sin(a) * rr * .56]);
        }
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(cx + r * .12, cy + r * .62, r * .95, r * .3, 0, 0, 7); g.fill();
        poly(g, pts, '#857c6c');
        poly(g, lit, '#b3a997');
      };
      rock(px + (.26 + .1 * rnd(x, y, 1)) * S, py + (.36 + .08 * rnd(x, y, 2)) * S, S * .15, 1);
      rock(px + (.68 + .08 * rnd(x, y, 3)) * S, py + (.62 + .08 * rnd(x, y, 4)) * S, S * .2, 2);
      rock(px + (.36 + .1 * rnd(x, y, 5)) * S, py + (.82 + .05 * rnd(x, y, 6)) * S, S * .09, 3);
      for (let i = 0; i < 4; i++) dot(g, px + (.1 + .8 * rnd(x, y, i + 40)) * S, py + (.1 + .8 * rnd(x, y, i + 44)) * S, S * .02, i % 2 ? '#d8c8a0' : '#8c7750');
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
