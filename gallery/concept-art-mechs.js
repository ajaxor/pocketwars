// Experimental concept units, group "vehicles" (Mech Factory): six legged walkers. Sprites only, NOT in the game.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
// Every walker has a head, two arms (a darker far arm behind the torso, a near arm in front) and two stepping legs. To keep them from looking like
// stacked boxes they are built from angled plates: a hunched, sloped torso, pauldrons over the shoulders, a wedge helmet with a slanted visor,
// tapered two-segment limbs and reverse-knee legs ending in claw feet. Weapons are PORTS at the end of an arm (a wedge-shaped pod with a barrel and
// muzzle brake) or MOUNTED ROCKETS on a shoulder, never a free-standing gun. Legs only step while the unit is moving; arms swing with them.
import { box, disc, poly, stroke, mix, tubes, INK, STEEL, RED } from '../src/render/parts.js';

const ORANGE = '#ff9a2e', VISOR = '#ffd45a', PORT = '#2c2f36';
const gait = (run, moving) => (run && moving ? 1 : 0);
const up = (pts, bb) => pts.map(([x, y]) => [x, y + bb]);
const lighter = (col, k = .15) => mix(col, '#ffffff', k), darker = (col, k = .3) => mix(col, '#000000', k);

/** A tapered limb segment from (x1, y1) to (x2, y2), t1 thick at the start and t2 at the end. */
const limb = (g, s, x1, y1, x2, y2, t1, t2, col) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  poly(g, s, [[x1 + nx * t1 / 2, y1 + ny * t1 / 2], [x2 + nx * t2 / 2, y2 + ny * t2 / 2], [x2 - nx * t2 / 2, y2 - ny * t2 / 2], [x1 - nx * t1 / 2, y1 - ny * t1 / 2]], col);
};
/** A reverse-knee leg (knee forward, shin sweeping back to a claw foot): hip (hx, hy), thickness t. The foot swings, lifts and plants while `walk` is 1. */
const leg = (g, s, hx, hy, ph, w, walk, t, col, knee = .1) => {
  const a = w * 6 + ph, fx = hx - .03 + Math.sin(a) * .07 * walk, fy = .285 - Math.max(0, Math.cos(a)) * .05 * walk;
  const kx = hx + knee + Math.sin(a) * .02 * walk, ky = hy + (fy - hy) * .42;
  limb(g, s, hx, hy, kx, ky, t, t * .8, col); disc(g, s, kx, ky, t * .46, lighter(col, .12));
  limb(g, s, kx, ky, fx, fy - .04, t * .75, t * .45, col);
  poly(g, s, [[fx - .035, fy - .05], [fx + .02, fy - .055], [fx + .1, fy + .005], [fx + .1, fy + .013], [fx - .05, fy + .013]], INK);   // claw foot
};
/** An arm: upper arm to the elbow (ex, ey), forearm to the wrist (hx, hy). */
const arm = (g, s, sx, sy, ex, ey, hx, hy, t, col) => { limb(g, s, sx, sy, ex, ey, t, t * .85, col); limb(g, s, ex, ey, hx, hy, t * .85, t * .6, col); disc(g, s, ex, ey, t * .5, lighter(col, .12)); };
/** A shoulder plate over (x, y): an angular pauldron, k times the base size. */
const pauldron = (g, s, x, y, k, col) => poly(g, s, [[x - .07 * k, y + .03 * k], [x - .04 * k, y - .06 * k], [x + .07 * k, y - .05 * k], [x + .09 * k, y + .04 * k], [x, y + .07 * k]], col);
/** A clawed hand at the wrist (x, y): three dark prongs fanning forward and down. */
const claw = (g, s, x, y, k, col) => {
  disc(g, s, x, y, .028 * k, col);
  for (const a of [.1, .65, 1.2]) stroke(g, s, x, y, x + Math.cos(a) * .065 * k, y + Math.sin(a) * .065 * k, Math.max(2, s * .02 * k), INK);
};
/** A wedge helmet whose back-bottom is at (x, y): a swept crest, and a slanted glowing visor slit. */
const helm = (g, s, x, y, k, col, visor = VISOR) => {
  poly(g, s, [[x, y], [x + .01 * k, y - .07 * k], [x + .09 * k, y - .11 * k], [x + .18 * k, y - .06 * k], [x + .21 * k, y - .02 * k], [x + .14 * k, y]], col);
  poly(g, s, [[x + .01 * k, y - .07 * k], [x - .06 * k, y - .13 * k], [x + .08 * k, y - .1 * k]], darker(col, .25));
  poly(g, s, [[x + .09 * k, y - .07 * k], [x + .2 * k, y - .045 * k], [x + .2 * k, y - .026 * k], [x + .1 * k, y - .05 * k]], visor);
};
/** A weapon port at the end of an arm: a wedge-shaped pod, a barrel and a muzzle brake. `rec` pulls the barrel back when it fires. */
const gunPod = (g, s, x, y, len, h, rec = 0) => {
  poly(g, s, [[x, y - h / 2], [x + len * .6, y - h * .42], [x + len * .6, y + h * .42], [x, y + h / 2 + .012]], PORT);
  poly(g, s, [[x + len * .06, y - h / 2], [x + len * .4, y - h * .44], [x + len * .38, y - h * .2], [x + len * .06, y - h * .2]], lighter(PORT, .2));   // a highlight on the pod's top
  box(g, s, x + len * .6 - rec, y - h * .15, len * .4, h * .3, 1, INK);
  poly(g, s, [[x + len - .035 - rec, y - h * .28], [x + len - rec, y - h * .34], [x + len - rec, y + h * .34], [x + len - .035 - rec, y + h * .28]], STEEL);   // muzzle brake
};

// Strider: the all-rounder. Hunched and sleek; a cannon pod on one arm, a clawed hand on the other.
const strider = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, rec = Math.max(0, Math.sin(w * 1.6 + ph)) * .012 * run, hy = -.03 + bb;
  leg(g, s, -.1, hy, 0, w, walk, .1, dk); leg(g, s, .05, hy, Math.PI, w, walk, .1, lighter(dk));
  arm(g, s, -.02, -.22 + bb, .06, -.12 + bb - sw, .1, -.04 + bb - sw, .06, darker(dk, .1)); claw(g, s, .1, -.04 + bb - sw, 1, dk);   // far arm
  poly(g, s, up([[-.2, -.2], [-.14, -.3], [.1, -.31], [.2, -.23], [.15, -.12], [.1, -.03], [-.08, -.03], [-.18, -.08]], bb), c);       // sloped, hunched torso
  poly(g, s, up([[-.02, -.28], [.1, -.29], [.17, -.22], [.12, -.14], [-.02, -.16]], bb), lighter(c, .18));                                // chest plate
  poly(g, s, up([[-.1, -.08], [.1, -.08], [.1, -.03], [-.08, -.03]], bb), dk);                                                           // waist guard
  helm(g, s, .0, -.3 + bb, 1, dk);
  arm(g, s, .1, -.24 + bb, .18, -.14 + bb + sw * .5, .25, -.1 + bb + sw, .08, mix(c, dk, .35));                                          // near arm
  pauldron(g, s, .1, -.26 + bb, 1, lighter(dk, .1));
  gunPod(g, s, .24, -.11 + bb + sw, .2, .1, rec);
};

// Titan: the heavy. Huge pauldrons with spikes, a small head sunk between them, a glowing core, and a cannon pod on both arms.
const titan = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, rec = Math.max(0, Math.sin(w * 1.4 + ph)) * .012 * run, hy = -.03 + bb;
  const glow = run ? .65 + .35 * Math.sin(w * 5 + ph) : .8;
  leg(g, s, -.17, hy, 0, w, walk, .15, dk, .12); leg(g, s, .08, hy, Math.PI, w, walk, .15, lighter(dk), .12);
  arm(g, s, -.06, -.3 + bb, .04, -.18 + bb - sw, .12, -.13 + bb - sw, .1, darker(dk, .1)); gunPod(g, s, .1, -.13 + bb - sw, .19, .12, rec * .6);   // far arm cannon
  poly(g, s, up([[-.32, -.26], [-.22, -.4], [.14, -.42], [.3, -.3], [.24, -.14], [.16, -.02], [-.16, -.02], [-.3, -.1]], bb), c);          // wide torso
  poly(g, s, up([[-.04, -.38], [.14, -.39], [.26, -.3], [.2, -.16], [-.04, -.18]], bb), lighter(c, .16));                                  // chest plate
  disc(g, s, .12, -.25 + bb, .05, `rgba(255,90,60,${(.35 * glow).toFixed(2)})`); disc(g, s, .12, -.25 + bb, .028, '#ff5a3c');              // the glowing core
  poly(g, s, up([[-.14, -.08], [.14, -.08], [.12, -.02], [-.12, -.02]], bb), dk);
  pauldron(g, s, -.13, -.38 + bb, 1.5, lighter(dk, .1));
  helm(g, s, -.02, -.4 + bb, 1.05, dk);
  arm(g, s, .16, -.32 + bb, .25, -.2 + bb, .3, -.11 + bb + sw, .11, mix(c, dk, .35));                                                     // near arm
  pauldron(g, s, .17, -.37 + bb, 1.6, lighter(dk, .1)); poly(g, s, [[.2, -.45 + bb], [.24, -.54 + bb], [.28, -.44 + bb]], darker(dk, .2));   // near pauldron with a spike
  gunPod(g, s, .26, -.1 + bb + sw, .21, .14, rec);
};

// Rocket walker: a slim hunter with two rocket pods on its shoulder, pointing up, and a clawed pair of hands.
const rocketWalker = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, hy = -.03 + bb;
  leg(g, s, -.08, hy, 0, w, walk, .085, dk, .09); leg(g, s, .05, hy, Math.PI, w, walk, .085, lighter(dk), .09);
  arm(g, s, -.02, -.2 + bb, .05, -.11 + bb - sw, .09, -.04 + bb - sw, .05, darker(dk, .1)); claw(g, s, .09, -.04 + bb - sw, .85, dk);
  g.save(); g.translate(-.13 * s, -.27 * s + b); g.rotate(-1.12); tubes(g, s, .1, 0, .26, .13, { n: 2, col: darker(dk, .25), tip: RED }); g.restore();   // the far pod, behind
  poly(g, s, up([[-.17, -.2], [-.12, -.29], [.08, -.3], [.15, -.22], [.1, -.1], [.06, -.03], [-.08, -.03], [-.15, -.08]], bb), c);
  poly(g, s, up([[-.0, -.27], [.08, -.28], [.13, -.22], [.09, -.15], [-.0, -.16]], bb), lighter(c, .18));
  g.save(); g.translate(-.07 * s, -.27 * s + b); g.rotate(-.92); tubes(g, s, .1, 0, .3, .16, { n: 3, col: lighter(dk, .1), tip: RED }); g.restore();    // the near pod: mounted rockets
  poly(g, s, up([[-.14, -.3], [-.02, -.32], [.0, -.25], [-.12, -.24]], bb), darker(dk, .2));                                                 // its mount
  helm(g, s, .0, -.29 + bb, .85, dk);
  arm(g, s, .09, -.23 + bb, .15, -.14 + bb + sw * .5, .2, -.08 + bb + sw, .06, mix(c, dk, .35)); claw(g, s, .2, -.08 + bb + sw, .9, mix(c, dk, .35));
};

// Scout walker: a raptor. Very long reverse-knee legs, a forward-leaning body with a counterweight tail, a bird-like head with a big eye.
const scoutWalker = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .025 * walk, rec = Math.max(0, Math.sin(w * 2.4 + ph)) * .008 * run, hy = -.04 + bb;
  leg(g, s, -.07, hy, 0, w, walk, .065, dk, .1); leg(g, s, .04, hy, Math.PI, w, walk, .065, lighter(dk), .1);
  limb(g, s, -.1, -.08 + bb, -.3, -.15 + bb, .06, .015, dk);                                                                                     // the tail
  arm(g, s, -.02, -.14 + bb, .04, -.06 + bb - sw, .08, -.01 + bb - sw, .04, darker(dk, .1));
  poly(g, s, up([[-.14, -.1], [-.08, -.2], [.08, -.2], [.15, -.12], [.08, -.04], [-.09, -.04]], bb), c);
  poly(g, s, up([[.0, -.18], [.08, -.18], [.12, -.12], [.05, -.08], [-.01, -.1]], bb), lighter(c, .18));
  helm(g, s, .05, -.19 + bb, .8, dk); disc(g, s, .16, -.25 + bb, .026, '#15161c'); disc(g, s, .165, -.253 + bb, .014, VISOR);                         // a big, bright eye
  stroke(g, s, -.01, -.3 + bb, -.07, -.42 + bb, 1.6, INK); disc(g, s, -.07, -.43 + bb, .016, run && Math.sin(w * 6 + ph) > 0 ? RED : '#7a2a22');   // blinking antenna
  arm(g, s, .09, -.15 + bb, .15, -.08 + bb + sw * .5, .18, -.06 + bb + sw, .045, mix(c, dk, .35)); gunPod(g, s, .16, -.06 + bb + sw, .12, .06, rec);
};

// Flame walker: a fuel tank on its back, a flamer pod on one arm with a flickering flame, and glowing vents on a hunched chest.
const flameWalker = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, hy = -.03 + bb;
  const f = run ? .5 + .5 * Math.sin(w * 31 + ph) : .6;
  leg(g, s, -.1, hy, 0, w, walk, .11, dk); leg(g, s, .05, hy, Math.PI, w, walk, .11, lighter(dk));
  arm(g, s, -.02, -.22 + bb, .06, -.12 + bb - sw, .1, -.04 + bb - sw, .06, darker(dk, .1)); claw(g, s, .1, -.04 + bb - sw, 1, dk);
  box(g, s, -.34, -.3 + bb, .14, .32, 6, lighter(dk, .12)); box(g, s, -.34, -.19 + bb, .14, .045, 1, RED); box(g, s, -.31, -.34 + bb, .08, .05, 2, STEEL);   // fuel tank on the back
  poly(g, s, up([[-.21, -.2], [-.15, -.3], [.08, -.31], [.18, -.23], [.14, -.12], [.1, -.03], [-.08, -.03], [-.19, -.08]], bb), c);
  poly(g, s, up([[-.02, -.28], [.08, -.29], [.15, -.22], [.11, -.14], [-.02, -.16]], bb), lighter(c, .18));
  for (let i = 0; i < 3; i++) box(g, s, .02 + i * .035, -.24 + bb + i * .018, .022, .05, 1, `rgba(255,140,40,${(.5 + .4 * f).toFixed(2)})`);   // glowing vents
  helm(g, s, -.01, -.3 + bb, 1, dk, ORANGE);
  const ny = -.1 + bb + sw;
  arm(g, s, .1, -.24 + bb, .17, -.15 + bb + sw * .5, .24, ny, .08, mix(c, dk, .35)); pauldron(g, s, .1, -.26 + bb, 1, lighter(dk, .1));
  poly(g, s, [[.23, ny - .05], [.31, ny - .04], [.33, ny - .06], [.33, ny + .06], [.31, ny + .04], [.23, ny + .055]], PORT);       // the flamer nozzle, flared
  const len = .06 + .04 * f, x = .335;
  poly(g, s, [[x, ny - .04], [x + len, ny - .015 - .03 * f], [x + len * 1.15, ny], [x + len, ny + .015 + .03 * f], [x, ny + .04]], ORANGE);
  poly(g, s, [[x, ny - .02], [x + len * .65, ny], [x, ny + .02]], '#ffe27a');
};

// Bulwark: a defensive walker behind a big spiked, kite-shaped shield on its near arm and a piston fist on the other.
const bulwark = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, hy = -.03 + bb;
  leg(g, s, -.16, hy, 0, w, walk, .14, dk, .11); leg(g, s, .06, hy, Math.PI, w, walk, .14, lighter(dk), .11);
  arm(g, s, -.1, -.28 + bb, .0, -.16 + bb - sw, .06, -.09 + bb - sw, .09, darker(dk, .1)); poly(g, s, [[.02, -.14 + bb - sw], [.12, -.13 + bb - sw], [.13, -.04 + bb - sw], [.03, -.03 + bb - sw]], dk);   // far arm: a piston fist
  poly(g, s, up([[-.28, -.24], [-.2, -.36], [.1, -.37], [.2, -.28], [.18, -.1], [.12, -.02], [-.16, -.02], [-.28, -.08]], bb), c);
  poly(g, s, up([[-.08, -.34], [.1, -.35], [.17, -.28], [.14, -.14], [-.08, -.16]], bb), lighter(c, .16));
  poly(g, s, up([[-.16, -.08], [.12, -.08], [.12, -.02], [-.14, -.02]], bb), dk);
  helm(g, s, -.04, -.36 + bb, 1, dk);
  pauldron(g, s, .1, -.33 + bb, 1.3, lighter(dk, .1));
  arm(g, s, .12, -.28 + bb, .2, -.18 + bb, .24, -.1 + bb + sw, .09, mix(c, dk, .35));
  const sy = sw * .5 + bb;                                                                                                                 // the shield: a kite with a rim, a ridge and a spike
  poly(g, s, [[.2, -.4 + sy], [.36, -.32 + sy], [.36, -.04 + sy], [.27, .14 + sy], [.2, -.04 + sy]], dk);
  poly(g, s, [[.215, -.375 + sy], [.345, -.31 + sy], [.345, -.05 + sy], [.27, .1 + sy], [.215, -.05 + sy]], lighter(c, .1));
  stroke(g, s, .28, -.36 + sy, .28, .08 + sy, 2, dk); disc(g, s, .28, -.14 + sy, .03, dk);
  poly(g, s, [[.24, -.39 + sy], [.28, -.48 + sy], [.32, -.35 + sy]], darker(dk, .2));
};

/** Shrink a sprite by k about the ground line (y = .29), so its feet stay where they were and its crest or spike stays inside the tile. */
const fit = (f, k) => (g, o) => { g.save(); g.translate(0, .29 * o.s * (1 - k)); g.scale(k, k); f(g, o); g.restore(); };
export const SPRITES = { strider, titan: fit(titan, .88), rocket_walker: fit(rocketWalker, .9), scout_walker: scoutWalker, flame_walker: flameWalker, bulwark: fit(bulwark, .93) };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  strider: ground(.27, .045, .295, .02), titan: ground(.36, .055, .295), rocket_walker: ground(.26, .045, .295),
  scout_walker: ground(.2, .04, .295), flame_walker: ground(.3, .045, .295), bulwark: ground(.32, .055, .295, .03),
};
