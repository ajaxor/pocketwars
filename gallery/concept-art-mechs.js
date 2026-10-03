// Experimental concept units, group "vehicles" (Mech Factory): six legged walkers. Sprites only, NOT in the game.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
// Every walker has a head, two arms (a darker far arm behind the torso, a near arm in front) and two stepping legs, kept to flat blocks so the
// icon still reads at phone size. Weapons are PORTS at the end of an arm (a squat block with a round muzzle) or MOUNTED ROCKETS on a shoulder,
// never a free-standing gun. Legs only step while the unit is moving; arms swing with them.
import { box, disc, oval, poly, stroke, mix, tubes, pillarLeg, INK, STEEL, RED } from '../src/render/parts.js';

const ORANGE = '#ff9a2e';

const VISOR = '#ffd45a', PORT = '#2c2f36';
const gait = (run, moving) => (run && moving ? 1 : 0);

/** Both legs, hips at hipY, x positions xa and xb, thickness t (the far leg a touch lighter, as on the other walkers). */
const legPair = (g, s, xa, xb, hipY, t, dk, w, walk) => {
  pillarLeg(g, s, xa, hipY, 0, w, walk, t, dk); pillarLeg(g, s, xb, hipY, Math.PI, w, walk, t, mix(dk, '#ffffff', .15));
};
/** An arm: a rounded limb of thickness t (tile fraction) from the shoulder (sx, sy) to the hand (hx, hy), with a shoulder joint. */
const arm = (g, s, sx, sy, hx, hy, t, col) => { stroke(g, s, sx, sy, hx, hy, t * s, col); disc(g, s, sx, sy, t * .62, mix(col, '#ffffff', .14)); };
/** A weapon port at the end of an arm: a squat block centred on y, then a round muzzle that kicks back by `rec` when it fires. */
const port = (g, s, x, y, len, h, rec = 0) => {
  box(g, s, x, y - h / 2, len, h, 2, PORT);
  box(g, s, x + len - .01 - rec, y - h * .3, .06, h * .6, 1, INK);
  box(g, s, x + len + .045 - rec, y - h * .36, .02, h * .72, 1, STEEL);
};
const head = (g, s, x, y, wd, h, col, visor = true) => {
  box(g, s, x, y, wd, h, 4, col);
  if (visor) box(g, s, x + wd * .45, y + h * .28, wd * .5, h * .3, 1, VISOR);
};

// Strider: the all-rounder. One arm ends in a cannon port, the other in a plain fist.
const strider = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, rec = Math.max(0, Math.sin(w * 1.6 + ph)) * .012 * run;
  legPair(g, s, -.08, .07, .02 + bb, .1, dk, w, walk);
  arm(g, s, -.02, -.14 + bb, .08, -.01 + bb - sw, .06, mix(dk, '#000000', .1)); disc(g, s, .08, -.01 + bb - sw, .04, dk);     // far arm, a fist
  box(g, s, -.2, -.24 + bb, .4, .28, 5, c);                                                  // torso
  box(g, s, -.2, -.04 + bb, .4, .05, 2, dk);                                                 // belly band
  head(g, s, -.02, -.37 + bb, .17, .14, dk);
  arm(g, s, .14, -.15 + bb, .26, -.05 + bb + sw, .07, mix(c, dk, .35)); port(g, s, .24, -.05 + bb + sw, .15, .1, rec);       // near arm: cannon port
};

// Titan: the heavy. Both arms end in cannon ports; broad shoulders and a big torso.
const titan = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk, rec = Math.max(0, Math.sin(w * 1.4 + ph)) * .012 * run;
  legPair(g, s, -.15, .11, .04 + bb, .16, dk, w, walk);
  arm(g, s, -.08, -.24 + bb, .1, -.09 + bb - sw, .09, mix(dk, '#000000', .1)); port(g, s, .08, -.09 + bb - sw, .17, .12, rec * .6);   // far arm port
  box(g, s, -.32, -.34 + bb, .62, .4, 6, c);                                                 // huge torso
  box(g, s, -.34, -.36 + bb, .2, .1, 3, dk); box(g, s, .1, -.36 + bb, .2, .1, 3, dk);        // shoulder plates
  box(g, s, -.32, -.02 + bb, .62, .06, 2, dk);                                               // belly band
  head(g, s, -.04, -.47 + bb, .2, .14, dk);
  arm(g, s, .2, -.24 + bb, .27, -.06 + bb + sw, .1, mix(c, dk, .35)); port(g, s, .24, -.06 + bb + sw, .18, .14, rec);       // near arm port
};

// Rocket walker: a slim body with a rocket pod mounted on its shoulder, pointing up. The arms end in small hands.
const rocketWalker = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk;
  legPair(g, s, -.07, .06, .02 + bb, .09, dk, w, walk);
  arm(g, s, -.02, -.14 + bb, .07, -.01 + bb - sw, .055, mix(dk, '#000000', .1)); disc(g, s, .07, -.01 + bb - sw, .035, dk);
  g.save(); g.translate(-.2 * s, -.2 * s + b); g.rotate(-.95); tubes(g, s, .1, 0, .26, .17, { n: 3, col: mix(dk, '#ffffff', .12), tip: RED }); g.restore();   // mounted rockets
  box(g, s, -.24, -.23 + bb, .09, .06, 2, mix(dk, '#000000', .25));                         // the pod's mount
  box(g, s, -.17, -.24 + bb, .33, .28, 5, c);                                                // torso
  box(g, s, -.17, -.04 + bb, .33, .05, 2, dk);
  head(g, s, .0, -.36 + bb, .15, .13, dk);
  arm(g, s, .12, -.15 + bb, .2, -.05 + bb + sw, .06, mix(c, dk, .35)); disc(g, s, .21, -.05 + bb + sw, .04, dk);
};

// Scout walker: small and light on long thin legs; a big sensor head, a tiny gun port on one arm.
const scoutWalker = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .025 * walk, rec = Math.max(0, Math.sin(w * 2.4 + ph)) * .008 * run;
  legPair(g, s, -.06, .05, .0 + bb, .065, dk, w, walk);
  arm(g, s, -.03, -.1 + bb, .05, .0 + bb - sw, .045, mix(dk, '#000000', .1)); disc(g, s, .05, .0 + bb - sw, .03, dk);
  box(g, s, -.13, -.17 + bb, .26, .19, 4, c);                                                // small torso
  oval(g, s, .03, -.26 + bb, .11, .075, dk);                                                 // domed sensor head
  disc(g, s, .1, -.26 + bb, .038, '#15161c'); disc(g, s, .1, -.26 + bb, .022, VISOR);        // big eye
  stroke(g, s, -.03, -.32 + bb, -.07, -.42 + bb, 1.6, INK); disc(g, s, -.07, -.43 + bb, .016, run && Math.sin(w * 6 + ph) > 0 ? RED : '#7a2a22');   // blinking antenna
  arm(g, s, .1, -.1 + bb, .16, -.01 + bb + sw, .05, mix(c, dk, .35)); port(g, s, .14, -.01 + bb + sw, .1, .07, rec);
};

// Flame walker: a fuel tank on its back and a flamer port on one arm; a flame flickers from the nozzle.
const flameWalker = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk;
  legPair(g, s, -.08, .07, .02 + bb, .1, dk, w, walk);
  arm(g, s, -.02, -.14 + bb, .08, -.01 + bb - sw, .06, mix(dk, '#000000', .1)); disc(g, s, .08, -.01 + bb - sw, .04, dk);
  box(g, s, -.33, -.28 + bb, .13, .32, 5, mix(dk, '#ffffff', .12)); box(g, s, -.33, -.18 + bb, .13, .05, 1, RED);   // fuel tank on the back
  box(g, s, -.2, -.24 + bb, .38, .28, 5, c);
  box(g, s, -.2, -.04 + bb, .38, .05, 2, dk);
  head(g, s, -.01, -.37 + bb, .16, .14, dk);
  const ny = -.05 + bb + sw;
  arm(g, s, .14, -.15 + bb, .24, ny, .07, mix(c, dk, .35));
  box(g, s, .22, ny - .045, .12, .09, 2, PORT); box(g, s, .33, ny - .03, .035, .06, 1, INK);   // flamer port
  const f = run ? .5 + .5 * Math.sin(w * 31 + ph) : .6, len = .06 + .04 * f, x = .365;
  poly(g, s, [[x, ny - .035], [x + len, ny - .015 - .03 * f], [x + len * 1.15, ny], [x + len, ny + .015 + .03 * f], [x, ny + .035]], ORANGE);
  poly(g, s, [[x, ny - .018], [x + len * .65, ny], [x, ny + .018]], '#ffe27a');
};

// Bulwark: a defensive walker behind a big shield plate on its near arm, a short piston fist on the other.
const bulwark = (g, { s, c, dk, ph, w, run, moving, b }) => {
  const walk = gait(run, moving), bb = b / s, sw = Math.sin(w * 6 + ph) * .02 * walk;
  legPair(g, s, -.14, .1, .04 + bb, .14, dk, w, walk);
  arm(g, s, -.1, -.2 + bb, .06, -.02 + bb - sw, .08, mix(dk, '#000000', .1)); box(g, s, .04, -.07 + bb - sw, .1, .1, 3, dk);   // far arm, piston fist
  box(g, s, -.28, -.3 + bb, .5, .34, 6, c);                                                  // torso
  box(g, s, -.28, -.02 + bb, .5, .06, 2, dk);
  head(g, s, -.04, -.4 + bb, .2, .12, dk);
  arm(g, s, .14, -.2 + bb, .24, -.08 + bb + sw, .08, mix(c, dk, .35));
  box(g, s, .2, -.34 + bb + sw * .5, .16, .5, 4, mix(c, '#ffffff', .1));                     // the shield plate
  box(g, s, .2, -.34 + bb + sw * .5, .16, .06, 3, dk); box(g, s, .2, .1 + bb + sw * .5, .16, .06, 3, dk);   // its rim, top and bottom
  disc(g, s, .28, -.09 + bb + sw * .5, .035, dk);                                            // the boss
};

export const SPRITES = { strider, titan, rocket_walker: rocketWalker, scout_walker: scoutWalker, flame_walker: flameWalker, bulwark };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  strider: ground(.27, .045, .295, .02), titan: ground(.36, .055, .295), rocket_walker: ground(.26, .045, .295),
  scout_walker: ground(.2, .04, .295), flame_walker: ground(.3, .045, .295), bulwark: ground(.32, .055, .295, .03),
};
