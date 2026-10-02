// The shared parts library for unit art: drawing primitives, running gear, water handling, weapons and effects that many units use.
// Sprites in src/render/unit-art.js and the experimental ones in gallery/concept-art*.js are built from these, so a wheel, a tread or a
// propeller looks and animates the same everywhere, and a fix lands in every unit at once. docs/render-parts.md is the catalogue.
//
// Conventions (same as the sprites): `g` is a 2D context already translated to the tile's centre, `s` the tile size in pixels; x, y and sizes
// are fractions of s, +x forward, +y down; `w` is the animation clock in seconds, `run` is 1 while animating and 0 when the unit has acted (parts
// freeze), `ph` a per-unit phase. Parts draw and return nothing, unless the doc comment says otherwise. Self-contained and browser-safe.
//
// Sections: colours and primitives | running gear (wheels, treads, legs, hover) | water (afloat, hulls, propellers, bubbles) |
//           weapons and gear (turrets, tubes, dishes, periscope) | infantry body | air (propellers) | effects (glint, smoke).

// ---- colours and primitives -----------------------------------------------------------------------------------------------
export const RED = '#d4442e', GLASS = '#cfe6f5', INK = '#222', STEEL = '#9a9a9a', SKIN = '#f1c99b', OLIVE = '#4b5238';
export const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); };

export const box = (g, s, x, y, w, h, r, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x * s, y * s, w * s, h * s, r); g.fill(); };
export const disc = (g, s, x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x * s, y * s, r * s, 0, 7); g.fill(); };
export const oval = (g, s, x, y, rx, ry, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const poly = (g, s, pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); g.fill(); };
export const stroke = (g, s, x1, y1, x2, y2, width, col) => { g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1 * s, y1 * s); g.lineTo(x2 * s, y2 * s); g.stroke(); };
export const mirror = (top) => top.concat(top.slice(1, -1).reverse().map(([x, y]) => [x, -y]));
export const both = (pts, fn) => { fn(pts); fn(pts.map(([x, y]) => [x, -y])); };

export const wheel = (g, s, x, y, r, w, run, speed) => {
  disc(g, s, x, y, r, INK);
  stroke(g, s, x, y, x + Math.cos(w * speed * run) * r * .9, y + Math.sin(w * speed * run) * r * .9, 1.5, '#aaa');
};
export const treads = (g, s, x0, x1, y, h, w, run, j) => {
  box(g, s, x0, y, x1 - x0, h, h * s * .5, '#2b2b2b');   // a full pill: the radius follows the tread's height, so it stays round at any size
  g.fillStyle = STEEL; const off = (w * s * .3 * run) % (s * .12);
  for (let i = 0; i < 6; i++) { const x = x0 * s + s * .02 + i * s * .12 + off; if (x < x1 * s - s * .05) g.fillRect(x, (y + h * .4) * s, s * .05, s * .04); }
};

// ---- water: waterline, hulls, propellers, turrets -------------------------------------------------------------------------
export const UNDER_SHADE = .45;
export const FOAM = 'rgba(255,255,255,.6)';
export const LINE = .14;                                   // the waterline, in tile fractions (fixed: only the ship moves)
export const skyClip = (g, s, line) => { g.beginPath(); g.rect(-s, -s * 1.5, s * 2, (line + 1.5) * s); g.clip(); };
export const seaClip = (g, s, line) => { g.beginPath(); g.rect(-s, line * s, s * 2, s * 2); g.clip(); };
/** A propeller at (x, y) on the stern, the hull's own colour `col` (dark under water): a blurred blade whose length
 *  flickers as it turns, and (`bubbles`) a stream of bubbles astern. Draw it inside the ship's own transform so it bobs with it. */
export const propeller = (g, s, x, y, w, run, col, bubbles = true) => {
  const blade = col, a = run ? w * 17 : .5, len = .08 * (.35 + .65 * Math.abs(Math.cos(a)));
  oval(g, s, x, y, .018, len, blade);
  oval(g, s, x, y, .018, .018, blade);
  if (!run || !bubbles) return;
  for (let i = 0; i < 3; i++) {
    const f = (w * 1.6 + i / 3) % 1;                          // each bubble drifts back and fades
    oval(g, s, x - .03 - f * .17, y + Math.sin(w * 16 + i * 2.1) * .03, .016 * (1 - f * .5), .016 * (1 - f * .5), `rgba(190,215,245,${(.6 * (1 - f)).toFixed(2)})`);
  }
};
/** Run `draw(light)` above the waterline (light = true) and again below it (false), then lay foam along the waterline and curl it at both ends. */
export const afloat = (g, s, w, run, x0, x1, draw, line = LINE) => {
  g.save(); skyClip(g, s, line); draw(true); g.restore();
  g.save(); seaClip(g, s, line); draw(false); g.restore();
  const p = .8 + .2 * Math.sin(w * 4) * run, q = .8 + .2 * Math.sin(w * 4 + 2) * run;
  g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x0 * s, (line - .012) * s, (x1 - x0) * s, .026 * s);
  oval(g, s, x1 + .005, line + .005, .065 * p, .028, FOAM); oval(g, s, x1 - .07, line + .02, .05 * p, .018, 'rgba(255,255,255,.35)');   // bow
  oval(g, s, x0 - .005, line + .005, .065 * q, .028, FOAM); oval(g, s, x0 + .07, line + .02, .05 * q, .018, 'rgba(255,255,255,.35)');   // stern
};
/** Hull outline: deck at y = deck, keel at y = keel (below the waterline), stern at x0, bow at x1; `rise` sweeps the bow's deck up. */
export const hullPath = (g, s, { x0, x1, deck, keel, rise = 0, sweep = .2 }) => {
  g.beginPath(); g.moveTo(x0 * s, deck * s); g.lineTo((x1 - sweep) * s, deck * s);
  if (rise) g.quadraticCurveTo((x1 - sweep * .55) * s, deck * s, x1 * s, (deck - rise) * s); else g.lineTo(x1 * s, (deck - .02) * s);
  g.lineTo((x1 - .1) * s, keel * s); g.lineTo((x0 + .06) * s, keel * s); g.lineTo(x0 * s, (keel - .07) * s); g.closePath();
};
/** The deck's height and slope (radians, negative = rising) at x on a hull with a swept-up bow. */
export const deckAt = ({ x1, deck, rise = 0, sweep = .2 }, x) => {
  const x0 = x1 - sweep, xc = x1 - sweep * .55;
  if (!rise || x <= x0) return { y: deck, ang: 0 };
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const t = (lo + hi) / 2; ((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xc + t * t * x1 < x ? (lo = t) : (hi = t)); }
  const t = lo;
  return { y: deck - t * t * rise, ang: Math.atan2(-2 * t * rise, 2 * (1 - t) * (xc - x0) + 2 * t * (x1 - xc)) };
};
/** An armoured turret like a tank's: a rounded block, lighter than the dark hull, with barrels out of its front. The block is tilted by `ang`
 *  (to sit on a slope); the barrels are raised `elev` radians on their own, and `dir` -1 points them aft. */
export const turret = (g, s, x, y, w, len, { ang = 0, elev = 0, n = 1, dk = '#3a3d45', bar = .04, dir = 1 } = {}) => {
  dk = mix(dk, '#ffffff', .5);                                    // lighter than the underwater hull, so it never reads as part of it
  g.save(); g.translate(x * s, y * s); g.rotate(ang);
  box(g, s, -w * .5, -w * .5, w, w * .5, 4, dk);
  g.translate(dir * w * .3 * s, -w * .38 * s); g.rotate(dir > 0 ? -elev : elev);
  g.fillStyle = INK;
  for (let i = 0; i < n; i++) g.fillRect(dir > 0 ? 0 : -len * s, (-bar * .5 + (i - (n - 1) / 2) * bar * 1.4) * s, len * s, bar * s);
  g.restore();
};


// ---- running gear, continued ----------------------------------------------------------------------------------------------
/** Several wheels on one axle line: `xs` are their x positions, all at height y and radius r. */
export const wheels = (g, s, xs, y, r, w, run, speed = 10) => { for (const x of xs) wheel(g, s, x, y, r, w, run, speed); };

/** One leg of a walker: hip at (hx, hy), a knee and a foot that swings, lifts and plants. Steps only while `walk` is 1 (the unit is moving). */
export const walkerLeg = (g, s, hx, hy, ph, w, walk, thick, col) => {
  const a = w * 6 + ph, fx = hx + Math.sin(a) * .08 * walk, lift = Math.max(0, Math.cos(a)) * .05 * walk;
  const fy = .27 - lift, kx = hx + .09 + Math.sin(a) * .03 * walk, ky = hy + (fy - hy) * .45;
  stroke(g, s, hx, hy, kx, ky, thick, col); stroke(g, s, kx, ky, fx, fy - .02, thick * .9, col);
  box(g, s, fx - .05, fy - .035, .12, .06, 2, INK);
};

/** A plain walker leg: one straight pillar hanging from the hip (hx, hy) that swings forward and back, and a flat foot. `t` is its thickness. */
export const pillarLeg = (g, s, hx, hy, ph, w, walk, t, col) => {
  const a = Math.sin(w * 6 + ph) * .27 * walk, L = .29 - hy;
  g.save(); g.translate(hx * s, hy * s); g.rotate(a);
  box(g, s, -t / 2, 0, t, L, 2, col);
  box(g, s, -t * .6, L - .035, t * 1.9, .05, 2, INK);
  g.restore();
};

export const GLOW = '#7fe8ff';
/** An anti-gravity hover system: `n` emitter pods spread between x0 and x1 under a hull whose underside is at y, each with a pulsing lens,
 *  a faint cone of light to the ground and a mote rising through the field. */
export const antigrav = (g, s, x0, x1, y, w, run, n = 3) => {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * (n === 1 ? .5 : i / (n - 1)), pulse = run ? .65 + .35 * Math.sin(w * 7 + i * 1.7) : .8;
    poly(g, s, [[x - .05, y + .03], [x + .05, y + .03], [x + .09, y + .115], [x - .09, y + .115]], `rgba(127,232,255,${(.2 * pulse).toFixed(2)})`);   // the cone of light
    box(g, s, x - .06, y - .01, .12, .05, .02 * s, '#2b2f36');                                  // emitter housing
    oval(g, s, x, y + .045, .05, .017, `rgba(127,232,255,${pulse.toFixed(2)})`);                // glowing lens
    oval(g, s, x, y + .045, .025, .008, `rgba(255,255,255,${(.9 * pulse).toFixed(2)})`);
    const f = (w * 1.1 + i * .37) % 1;                                                          // a mote rising through the field
    if (run) disc(g, s, x + Math.sin(f * 6 + i) * .025, y + .12 - f * .08, .007, `rgba(200,250,255,${(.8 * (1 - f)).toFixed(2)})`);
  }
};

// ---- water, continued -----------------------------------------------------------------------------------------------------
/** A few bubbles rising from (x, y) (nothing when the unit is not animating). */
export const bubbles = (g, s, w, run, x, y, n = 3) => {
  if (!run) return;
  for (let i = 0; i < n; i++) { const f = (w * 1.1 + i / n) % 1; oval(g, s, x + Math.sin(w * 5 + i * 2) * .02, y - f * .25, .014, .014, `rgba(200,225,250,${(.65 * (1 - f)).toFixed(2)})`); }
};

/** A periscope (or mast) rising from (x, y) to height top, with a small head looking forward. */
export const periscope = (g, s, x, y, top, col = INK) => {
  stroke(g, s, x, y, x, top, Math.max(2, s * .025), col); box(g, s, x, top - .012, .05, .026, 1, col);
};

// ---- weapons and gear -----------------------------------------------------------------------------------------------------
/** A pod of `n` rocket or missile tubes (a block with round muzzle ends), centred on (x, y) and pointing along +x, `len` long and `h` tall;
 *  draw it inside a g.rotate() to elevate it. `loaded` puts a warhead tip (colour `tip`) in each tube. */
export const tubes = (g, s, x, y, len, h, { n = 2, col = '#3b3f48', tip = RED, loaded = true } = {}) => {
  box(g, s, x - len / 2, y - h / 2, len, h, 2, col);
  const th = h / n;
  for (let i = 0; i < n; i++) {
    const ty = y - h / 2 + th * (i + .5);
    disc(g, s, x + len / 2 - .005, ty, th * .36, INK);
    if (loaded) disc(g, s, x + len / 2 - .005, ty, th * .2, tip);
  }
};

/** A radar dish on a mast at (x, y): the dish turns (a flattening ellipse) while running. `r` is the dish radius. */
export const dish = (g, s, x, y, r, w, run, col = '#d8dce2') => {
  const k = run ? Math.abs(Math.cos(w * 2.2)) * .8 + .2 : .7;
  stroke(g, s, x, y, x, y + r * 1.4, Math.max(1.5, s * .016), INK);
  oval(g, s, x, y, r * k, r, col); oval(g, s, x + r * k * .15, y, r * k * .5, r * .7, mix(col, '#000000', .25));
};

/** A spinning propeller seen nearly end-on, on an aircraft: a translucent disc and a blade that flickers in length. */
export const propDisc = (g, s, x, y, r, w, run, ph = 0, col = INK) => {
  oval(g, s, x, y, .016, r, 'rgba(235,235,235,.34)');
  const l = (run ? Math.abs(Math.cos(w * 31 + ph)) : .6) * r * .92 + r * .08;
  stroke(g, s, x, y - l, x, y + l, 2.4, col);
  disc(g, s, x, y, .017, STEEL);
};

// ---- infantry body --------------------------------------------------------------------------------------------------------
// The foot units share one body: legs that step (l = leg swing in pixels), a torso, a head and a helmet dome. bb is the bob as a tile fraction.
export const legs = (g, s, l, col) => { g.fillStyle = col; g.fillRect(-s * .14, s * .12, s * .1, s * .17 + l); g.fillRect(s * .04, s * .12, s * .1, s * .17 - l); };
export const torso = (g, s, bb, col) => box(g, s, -.16, -.12 + bb, .32, .28, 4, col);
export const head = (g, s, bb) => disc(g, s, 0, -.2 + bb, .09, SKIN);
export const dome = (g, s, bb, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(0, (-.21 + bb) * s, r * s, Math.PI, 0); g.fill(); };

// ---- effects --------------------------------------------------------------------------------------------------------------
/** A bright band that sweeps along a body (a cloak shimmering, low-observable skin catching the light), clipped to the outline `pts`
 *  (points in tile fractions), travelling between x0 and x1. */
export const sheen = (g, s, w, run, pts, x0 = -.4, x1 = .4, { speed = .5, at = .35, alpha = .28 } = {}) => {
  const k = run ? ((w * speed) % 1) : at, x = x0 + (x1 - x0) * k;
  g.save(); g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px * s, py * s) : g.moveTo(px * s, py * s))); g.closePath(); g.clip();
  poly(g, s, [[x - .02, -.4], [x + .06, -.4], [x + .0, .4], [x - .08, .4]], `rgba(255,255,255,${alpha})`);
  g.restore();
};

/** Smoke drifting aft from a funnel or stack at (x, y); k scales it. */
export const plume = (g, s, x, y, w, run, ph, k = 1, rgb = 'rgba(70,70,75,') => {
  for (let i = 0; i < 3; i++) {
    const f = ((run ? w * .5 : 0) + ph + i / 3) % 1;
    oval(g, s, x - f * .16 * k, y - f * .07 - .01, (.022 + f * .03) * k, (.018 + f * .022) * k, `${rgb}${(.4 * (1 - f)).toFixed(2)})`);
  }
};

