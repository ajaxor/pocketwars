// The terrain art: what is drawn ON a tile. terrain.json -> render.decor names a drawing (grass, road, rough, forest, mountain,
// sea, shoals) and TERRAIN_DECOR supplies one function per name:
//     decor(g, px, py, S, { x, y, now, link, radii })
// (px, py) is the tile's top-left pixel, S its size, (x, y) its grid position (so tiles can vary without randomness) and
// `now` the clock in ms (so the sea can twinkle). `link` ({n, e, s, w, ne, se, sw, nw}, booleans) tells which neighbours carry
// the same drawing, so a road can join up with the roads next to it; `radii` are the tile's corner radii (for clipping).
// The tile's shape belongs to terrain-layer.js, buildings to buildings.js.
// The test suite requires a drawing for every decor name the terrain data uses.

import { SHOAL_STYLES } from './shoal-styles.js';

import { rnd } from './rnd.js';
import { styled } from './terrain-kit.js';
import { WOOD_DECOR } from './terrain-wood.js';
import { RELIEF_DECOR } from './terrain-relief.js';
import { GROUND_DECOR } from './terrain-ground.js';
import { RUIN_DECOR } from './terrain-ruins.js';
export { rnd };


const poly = (g, pts, fill) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
};
const dot = (g, x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

/** How wide the asphalt strip is, as a fraction of the tile (the ground shows either side, which keeps roads apart from the grey of fog of war). */
const ROAD_WIDTH = .42;

/** Paint the dashed centre line on roads (off for now, to see the plain look). */
const ROAD_LINES = false;

/** Paint the dashed centre line on roads. Off for now, to see how plain roads look; roadShape and the dash code are kept. */
const ROAD_CENTRE_LINE = false;

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

// Pointed pine trees, shaded two-tone mountains with jagged snow, calm water with twinkling glints and narrow asphalt roads laid over the ground.
export const TERRAIN_DECOR = {
    grass(g, px, py, S, { x, y }) {
      for (let i = 0; i < 3; i++) {
        const cx = px + (.18 + .64 * rnd(x, y, i)) * S, cy = py + (.2 + .6 * rnd(x, y, i + 9)) * S;
        g.fillStyle = i % 2 ? '#93c668' : '#76a94d'; g.beginPath(); g.ellipse(cx, cy, S * .09, S * .035, 0, 0, 7); g.fill();
      }
    },
    // A narrow strip of mid-grey asphalt laid over the ground (the ground shows either side, so a road never reads as a grey field of its own, and it
    // stays apart from the grey of fog of war). The strip runs out of the tile by each arm roadShape finds, round at a bend, with a darker edge. The
    // tile's `style` may recolour it (`color`, `edge`, `specks`) or change its `width` (a fraction of the tile).
    road(g, px, py, S, at) {
      const { x, y, link = NO_LINKS } = at, RD = styled({ color: '#7d838e', edge: 'rgba(0,0,0,.2)', specks: ['#a3a8b1', '#7f848d'], width: ROAD_WIDTH }, at);
      const { shape, arms } = roadShape(link);
      const c = S / 2, edgePx = Math.max(1, S * .035);
      // An arm with no road neighbour behind it is a dead end: the road does not stop at the tile edge but breaks up and thins out, so it reads as worn away.
      const fade = { n: arms.n && !link.n, e: arms.e && !link.e, s: arms.s && !link.s, w: arms.w && !link.w };
      const DIR = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
      const FADE_STEPS = 8;
      const strip = (half, fill, pad = 0) => {   // the centre block (rounded, so a bend has a round outside corner) and one bar out to the tile edge per arm
        g.fillStyle = fill; g.beginPath();
        if (shape === 'straight') g.rect(px + c - half, py + c - half, half * 2, half * 2); else g.roundRect(px + c - half, py + c - half, half * 2, half * 2, half * .7);
        if (arms.n && !fade.n) g.rect(px + c - half, py, half * 2, c);
        if (arms.s && !fade.s) g.rect(px + c - half, py + c, half * 2, c);
        if (arms.w && !fade.w) g.rect(px, py + c - half, c, half * 2);
        if (arms.e && !fade.e) g.rect(px + c, py + c - half, c, half * 2);
        g.fill();
        for (const k of 'nesw') {
          if (!fade[k]) continue;
          const [dx, dy] = DIR[k];
          for (let i = 0; i < FADE_STEPS; i++) {   // slices that narrow, grow fainter and drop out more often towards the edge
            const t = (i + .5) / FADE_STEPS;
            if (i > 1 && rnd(x * 7 + dx, y * 5 + dy, i + 40) < t * .45) continue;
            const run = c - half + 1, w = half * (1 - .5 * t) + pad, len = run / FADE_STEPS, d = half - 1 + i * len;
            g.globalAlpha = Math.max(.08, 1 - t * .92);
            const sx = dx ? px + c + (dx > 0 ? d : -d - len) : px + c - w, sy = dy ? py + c + (dy > 0 ? d : -d - len) : py + c - w;
            g.beginPath(); g.rect(sx, sy, dx ? len + .5 : w * 2, dy ? len + .5 : w * 2); g.fill();
          }
          g.globalAlpha = 1;
        }
      };
      const half = S * RD.width / 2;
      strip(half + edgePx, RD.edge, 0);
      strip(half, RD.color);
      for (let i = 0; i < 3; i++) {   // a few specks, kept on the strip (along it on a straight, inside the centre block at a bend or junction)
        const reach = shape === 'straight' ? .36 : RD.width * .3, across = (rnd(x, y, i + 5) - .5) * RD.width * .7 * S, along = (rnd(x, y, i) - .5) * 2 * reach * S;
        const vertical = shape === 'straight' && (arms.n || arms.s);
        dot(g, px + c + (vertical ? across : along), py + c + (vertical ? along : across), S * .022, RD.specks[i % 2]);
      }
      if (!ROAD_LINES || !ROAD_CENTRE_LINE) return;
      const cx = px + c, cy = py + c;
      // a dash on one arm, from `a` to `b` tiles out from the centre
      const dash = (dx, dy, a, b) => { g.moveTo(cx + dx * a * S, cy + dy * a * S); g.lineTo(cx + dx * b * S, cy + dy * b * S); };
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, S * .06); g.lineCap = 'butt'; g.beginPath();
      const DIRS = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
      for (const [k, dx, dy] of DIRS) {
        if (!arms[k]) continue;
        if (shape === 'corner') dash(dx, dy, 0, .3);        // a bend gets one dash that turns the corner
        else dash(dx, dy, .125, .375);                      // straights and junctions: dashes at .125-.375 out from the centre
      }
      g.stroke();
    },
    // Bare dirt: a few darker and lighter patches.
    dirt(g, px, py, S, { x, y }) {
      for (let i = 0; i < 3; i++) {
        const cx = px + (.2 + .6 * rnd(x, y, i + 20)) * S, cy = py + (.2 + .6 * rnd(x, y, i + 24)) * S;
        g.fillStyle = i % 2 ? '#a88f5e' : '#c2ab7a'; g.beginPath(); g.ellipse(cx, cy, S * (.13 + .05 * rnd(x, y, i + 28)), S * .055, 0, 0, 7); g.fill();
      }
    },
    // Pines: how many, where, how big, how many tiers and which green all come from the tile's position (rnd), so every forest
    // tile differs but each one looks the same every time it is drawn.
    forest(g, px, py, S, at) {
      const { x, y } = at, FS = styled({ greens: [['#2f6b34', '#3d8443'], ['#2a6330', '#37793e'], ['#37733a', '#47904b'], ['#2c6a3c', '#3b8450']], snow: null, trunk: '#5a4028' }, at);
      const GREENS = FS.greens;
      const pine = (cx, by, s, k) => {
        const u = S * s, ax = px + cx * S, ay = py + by * S;
        const [dark, lit] = GREENS[Math.floor(rnd(x, y, 90 + k) * GREENS.length)];
        g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(ax, ay, u * .2, u * .05, 0, 0, 7); g.fill();
        g.fillStyle = FS.trunk; g.fillRect(ax - u * .03, ay - u * .1, u * .06, u * .1);
        const tiers = rnd(x, y, 100 + k) < .35 ? [[.2, .06, .3], [.15, .2, .44], [.1, .34, .6]] : [[.19, .08, .34], [.14, .24, .52]];
        for (const [hw, y0, y1] of tiers) {
          poly(g, [[ax - hw * u, ay - y0 * u], [ax + hw * u, ay - y0 * u], [ax, ay - y1 * u]], dark);
          poly(g, [[ax - hw * u, ay - y0 * u], [ax, ay - y0 * u], [ax, ay - y1 * u]], lit);
          if (FS.snow) poly(g, [[ax - hw * u * .62, ay - (y0 + (y1 - y0) * .38) * u], [ax + hw * u * .62, ay - (y0 + (y1 - y0) * .38) * u], [ax, ay - y1 * u]], FS.snow);   // snow laid on the tier
        }
      };
      // three or four slots, each nudged, drawn back to front
      const slots = [[.27, .55], [.73, .5], [.5, .9]];
      if (rnd(x, y, 80) < .4) slots.push(rnd(x, y, 81) < .5 ? [.12, .92] : [.9, .92]);
      slots.map(([cx, by], k) => [cx + (rnd(x, y, 82 + k) - .5) * .1, by + (rnd(x, y, 86 + k) - .5) * .08, .8 + rnd(x, y, 110 + k) * .35, k])
        .sort((a, b) => a[1] - b[1]).forEach(([cx, by, sc, k]) => pine(Math.max(.21 * sc + .02, Math.min(1 - .21 * sc - .02, cx)), Math.min(by, .95), sc, k));
    },
    // One rounded mountain, centred in its tile. Its width, height, summit position, snow and a smaller companion peak all come
    // from the tile's position (rnd), so a range of them is varied but never changes between draws.
    mountain(g, px, py, S, at) {
      const { x, y } = at, MS = styled({ rock: ['#a39b8c', '#928a7c'], side: ['#72695e', '#6c655a'], snow: ['#f2efe6', '#dcd9d0'], snowSide: ['#d9d6cc', '#bdbab1'] }, at);
      const r = (i) => rnd(x, y, 60 + i);
      const P = (a, b) => [px + a * S, py + b * S];
      // one peak: centre cx, half-width w, summit height `top`, foot line `yb`; `shade` darkens a peak that stands behind
      const peak = (cx, w, top, yb, pkx, shade) => {
        const xl = cx - w, xr = cx + w, h = yb - top;
        const bulge = .07 * Math.min(1, h / .6);
        const outline = () => {
          g.beginPath(); g.moveTo(...P(xl, yb));
          g.quadraticCurveTo(...P((xl + pkx) / 2 - bulge * .9, (yb + top) / 2 - bulge * .3), ...P(pkx - .035, top + .03));
          g.quadraticCurveTo(...P(pkx, top - .03), ...P(pkx + .035, top + .03));
          g.quadraticCurveTo(...P((xr + pkx) / 2 + bulge * .9, (yb + top) / 2 - bulge * .3), ...P(xr, yb));
          g.quadraticCurveTo(...P(cx, yb + .09), ...P(xl, yb));
          g.closePath();
        };
        g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(...P(cx, yb + .02), w * S * 1.02, S * .05, 0, 0, 7); g.fill();
        g.save(); outline(); g.clip();
        g.fillStyle = MS.rock[shade ? 1 : 0]; g.fillRect(...P(xl - .05, top - .05), (w * 2 + .1) * S, (h + .2) * S);
        // the shaded right face, split by a ridge that runs down from the summit with a little kink
        const kink = pkx + .05 + (r(9) - .5) * .05;
        poly(g, [P(pkx, top - .03), P(xr + .05, top - .03), P(xr + .05, yb + .12), P(cx + .02, yb + .12), P(kink, yb - h * .4)], MS.side[shade ? 1 : 0]);
        g.strokeStyle = 'rgba(60,54,46,.22)'; g.lineWidth = Math.max(1, S * .025); g.lineCap = 'round'; g.beginPath();
        for (let i = 0; i < 2; i++) { const cx2 = pkx - w * (.3 + i * .25) - r(10 + i) * .03; g.moveTo(...P(cx2, top + h * (.38 + i * .12))); g.lineTo(...P(cx2 - .05, top + h * (.55 + i * .14))); }
        g.stroke();
        // snow: from the summit down to a scalloped line, deeper on taller peaks
        const sy = top + h * (.26 + r(12) * .14);
        const snow = [P(pkx - .2, sy + .02), P(pkx - .11, sy - .035), P(pkx - .03, sy + .03), P(pkx + .05, sy - .03), P(pkx + .12, sy + .02), P(pkx + .22, sy + .02)];
        if (MS.snow) {
          poly(g, [P(pkx - .25, top - .04), P(pkx + .25, top - .04), ...snow.reverse()], MS.snow[shade ? 1 : 0]);
          poly(g, [P(pkx, top - .04), P(pkx + .25, top - .04), P(pkx + .22, sy + .02), P(pkx + .12, sy + .02), P(pkx + .05, sy - .03), P(pkx, sy + .01)], MS.snowSide[shade ? 1 : 0]);
        }
        g.restore();
      };
      const cx = .5 + (r(1) - .5) * .06, w = .33 + r(0) * .12, yb = .82 + r(2) * .06, top = .1 + r(3) * .1, pkx = cx + (r(4) - .5) * .14;
      if (r(6) > .4) {   // a smaller companion behind, on the side the summit leans away from
        const side = pkx > cx ? -1 : 1, w2 = .14 + r(7) * .06;
        const cx2 = Math.max(w2 + .03, Math.min(.97 - w2, cx + side * (w + .02 - w2 * .3)));
        peak(cx2, w2, top + .16 + r(8) * .1, yb - .04, cx2 + (r(5) - .5) * .06, true);
      }
      peak(cx, w, top, yb, pkx, false);
    },
    // Shoals: shallows in open sea (the tile colour joins the water around it); the drawing is one of shoal-styles.js.
    shoals: SHOAL_STYLES.boulders,
    // Open water is plain; a few white glints twinkle on it.
    sea(g, px, py, S, { x, y, now }) {
      const t = now / 1000;
      for (let i = 0; i < 2; i++) {
        const a = Math.max(0, Math.sin(t * 1.3 + rnd(x, y, i) * 6.28));
        if (a > .05) { g.fillStyle = `rgba(255,255,255,${(a * .75).toFixed(2)})`; g.fillRect(px + (.15 + .6 * rnd(x, y, i + 3)) * S, py + (.45 + .15 * i + .1 * rnd(x, y, i + 6)) * S, S * .09, Math.max(1, S * .028)); }
      }
    },
  };

Object.assign(TERRAIN_DECOR, WOOD_DECOR, RELIEF_DECOR, GROUND_DECOR, RUIN_DECOR);
