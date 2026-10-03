// Experimental concept ships, "fleet" group (Shipyard): a tank landing ship and two submarines. Sprites only, NOT in the game.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j, submerged })   SHADOWS[name](g, { s, alt, w, ph, run })
// The landing ship floats like the real ships (afloat). The missile sub rides the surface and dives like the regular submarine (surfacing, bubbles
// only when it is down). The hunter sub is drawn dived, always in the underwater shade like the abyss sub.
import { box, disc, oval, poly, stroke, mix, afloat, propeller, bubbles, periscope, surfacing, UNDER_SHADE, INK, RED, GLASS } from '../src/render/parts.js';

// Landing craft: a D-Day style Higgins boat, tall-sided, with a bow that tapers down to a raised drop ramp, a small bridge on the deck at the
// stern, and the outline of a door on the rear of the hull. (It can still carry a tank; none is drawn.)
const tankTransport = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .02, D = -.1, x0 = -.4, x1 = .34, K = .17;     // K: where the deck starts to slope down to the bow
  afloat(g, s, w, run, x0, x1, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, x0 - .02, .26, w, run, dk);
    g.beginPath(); g.moveTo(x0 * s, D * s); g.lineTo(K * s, D * s); g.lineTo(x1 * s, .04 * s); g.lineTo((x1 + .02) * s, .2 * s); g.lineTo((x1 - .06) * s, .32 * s);
    g.lineTo((x0 + .05) * s, .32 * s); g.lineTo(x0 * s, .25 * s); g.closePath(); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      const edge = mix(c, dk, .3);
      poly(g, s, [[x0, D], [K, D], [x1, .04], [x1, .075], [K, D + .035], [x0, D + .035]], edge);   // the rim of the open well, tapering with the deck
      poly(g, s, [[x1 - .13, .1], [x1, .075], [x1 + .02, .2], [x1 - .06, .3]], mix(c, dk, .4));     // the raised bow ramp
      stroke(g, s, x1 - .13, .1, x1 - .06, .3, 1.4, mix(c, dk, .6));                               // its hinge line
      g.strokeStyle = mix(c, dk, .6); g.lineWidth = 1.6; g.strokeRect((x0 + .035) * s, (D + .07) * s, .1 * s, .14 * s);   // outline of the rear door
      disc(g, s, x0 + .035 + .082, D + .14, .011, mix(c, dk, .6));                                  // its handle
      box(g, s, -.3, D - .13, .16, .13, 3, c);                                                      // the small bridge on top, aft
      box(g, s, -.285, D - .1, .13, .04, 1, GLASS);                                                 // its windows
      box(g, s, -.31, D - .15, .18, .025, 1, edge);                                                 // roof overhang
      stroke(g, s, -.22, D - .15, -.22, D - .22, 1.6, INK);                                         // a short mast
    }
    g.restore();
  });
};

// Missile sub: a big boomer. A long round hull that thickens toward the bow in a smooth curve, a sail with a periscope, and a short raised casing
// behind it with three big missile hatches. It rides on the surface with the regular submarine's waterlines and can dive; bubbles only while down.
const boomerBody = (g, s, col) => {
  const pts = [], N = 36, cy = .06;
  const ss = (t) => t * t * (3 - 2 * t);
  const half = (x) => (x <= .34 ? (.09 + .12 * ss((x + .46) / .8)) * Math.min(1, Math.sqrt((x + .46) / .14 + .06)) : .21 * Math.sqrt(Math.max(0, 1 - ((x - .34) / .12) ** 2)));
  for (let i = 0; i <= N; i++) { const x = -.46 + .92 * i / N; pts.push([x, cy - half(x)]); }
  for (let i = N; i >= 0; i--) { const x = -.46 + .92 * i / N; pts.push([x, cy + half(x)]); }
  poly(g, s, pts, col);
};
const missileSub = (g, { s, c, dk, w, ph, run, b, submerged }) => {
  const d = Math.max(0, Math.min(1, Number(submerged) || 0)), bb = b * (.6 - .3 * d) / s + .03 * (1 - d);
  surfacing(g, s, w, run, submerged, -.46, .46, .22, bb, (light) => {
    const col = light ? c : dk, deep = mix(col, '#000000', .3), hi = mix(col, '#ffffff', .1);
    propeller(g, s, -.5, .06, w, run, deep, false);
    poly(g, s, [[-.4, .03], [-.5, -.1], [-.45, -.1], [-.33, .03]], deep);                        // rudder
    boomerBody(g, s, col);
    for (let i = 0; i < 3; i++) {                                                                // three big hatches, sunk into the hull near the middle
      const hx = -.17 + i * .11, hy = -.075;
      oval(g, s, hx, hy, .056, .03, hi); oval(g, s, hx, hy + .004, .046, .022, deep);          // a raised lip round a dark opening
    }
    if (light) disc(g, s, -.06, -.073, .016, RED);                                              // a missile nose showing in the middle one
    poly(g, s, [[.17, -.1], [.2, -.3], [.31, -.3], [.35, -.1]], col);                           // the sail, forward of the hatches
    if (light) box(g, s, .26, -.26, .06, .03, 1, GLASS);
    if (light) periscope(g, s, .22, -.3, -.42, INK);                                              // the periscope on the sail
  }, .3);
  if (d >= .5) bubbles(g, s, w, run, -.3, -.2 + .3 * d);                                        // bubbles only while it is down
};

// Hunter sub: a submarine with a shark-like hull. A torpedo body with a pointed snout and a pale belly, a swept, fin-shaped sail with a periscope, a
// raked tail fin and swept bow planes, a sonar dome and torpedo tube in the nose, a propeller astern. Always drawn dived, in the underwater shade.
const hunterSub = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .4), belly = mix(col, '#ffffff', .4), deep = mix(col, '#000000', .32);
  g.save(); g.translate(0, bb * s);
  propeller(g, s, -.4, .035, w, run, deep, false);
  poly(g, s, [[-.3, .0], [-.38, -.2], [-.45, -.2], [-.4, .02]], deep);                           // upper tail fin: tall, raked back
  poly(g, s, [[-.3, .06], [-.37, .17], [-.43, .17], [-.39, .05]], deep);                         // lower tail fin
  poly(g, s, [[.2, .1], [.12, .2], [.08, .12]], deep);                                           // far bow plane
  g.fillStyle = col; g.beginPath(); g.moveTo(.46 * s, .04 * s); g.quadraticCurveTo(.3 * s, -.06 * s, .1 * s, -.1 * s); g.quadraticCurveTo(-.15 * s, -.13 * s, -.36 * s, -.01 * s);
  g.lineTo(-.36 * s, .06 * s); g.quadraticCurveTo(-.1 * s, .16 * s, .12 * s, .14 * s); g.quadraticCurveTo(.34 * s, .12 * s, .46 * s, .04 * s); g.fill();   // torpedo body
  g.fillStyle = belly; g.beginPath(); g.moveTo(.46 * s, .04 * s); g.quadraticCurveTo(.34 * s, .12 * s, .12 * s, .14 * s); g.quadraticCurveTo(-.1 * s, .16 * s, -.36 * s, .06 * s);
  g.lineTo(-.36 * s, .035 * s); g.quadraticCurveTo(-.05 * s, .075 * s, .2 * s, .055 * s); g.quadraticCurveTo(.36 * s, .047 * s, .46 * s, .04 * s); g.fill();   // pale belly
  disc(g, s, .4, .03, .022, mix(col, '#ffffff', .22)); disc(g, s, .455, .04, .012, '#15161c');    // sonar dome and the torpedo tube
  for (let i = 0; i < 3; i++) box(g, s, .0 - i * .05, .075 - i * .003, .03, .012, 0, deep);      // a few hull plates along the flank
  g.fillStyle = col; g.beginPath(); g.moveTo(.14 * s, -.1 * s); g.quadraticCurveTo(.1 * s, -.2 * s, -.0 * s, -.27 * s); g.quadraticCurveTo(-.0 * s, -.2 * s, -.15 * s, -.115 * s); g.closePath(); g.fill();   // the sail, swept like a fin
  box(g, s, .035, -.19, .05, .022, 1, '#16181d');                                                // its viewport
  periscope(g, s, .02, -.24, -.36, INK);
  poly(g, s, [[.13, .11], [.09, .22], [-.05, .28], [.02, .17], [-.05, .12]], deep);               // near bow plane, swept back
  g.restore();
  bubbles(g, s, w, run, -.46, -.05, moving ? 5 : 3);
};

const under = (f, k = 1) => (g, o) => { g.save(); g.scale(k, k); f(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); };
export const SPRITES = {
  tank_transport: under(tankTransport, .95),
  missile_sub: under(missileSub, .92),
  hunter_sub: under(hunterSub, .9),
};

const none = () => {};
export const SHADOWS = { tank_transport: none, missile_sub: none, hunter_sub: none };
