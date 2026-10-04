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
      const door = mix(c, dk, .2), dedge = mix(c, dk, .6), dx = x0 + .035, dy = D + .06;   // the rear door, drawn like the APC's: a panel, hinge, latch rail and seam; no knob
      box(g, s, dx, dy, .075, .2, 1, door); g.strokeStyle = dedge; g.lineWidth = 1.6; g.strokeRect(dx * s, dy * s, .075 * s, .2 * s);
      box(g, s, dx, dy + .18, .075, .02, 1, dedge); box(g, s, dx, dy, .075, .018, 1, edge); stroke(g, s, dx, dy + .1, dx + .075, dy + .1, 1.2, dedge);
      box(g, s, -.3, D - .13, .16, .13, 3, c);                                                      // the small bridge on top, aft (no windows, no mast)
      box(g, s, -.31, D - .15, .18, .025, 1, edge);                                                 // roof overhang
    }
    g.restore();
  });
};

// Missile sub: a big boomer drawn like the regular submarine (a long round hull, a conning tower with a periscope, a propeller on the stern) but bigger,
// with a rounded bulge hanging below the forward section. Three big missile hatches are sunk into the deck near the middle. It rides on the surface
// with the regular sub's waterlines and can dive; bubbles only while down.
const missileSub = (g, { s, c, dk, w, ph, run, b, submerged }) => {
  const d = Math.max(0, Math.min(1, Number(submerged) || 0)), bb = b * (.6 - .3 * d) / s + .03 * (1 - d);
  surfacing(g, s, w, run, submerged, -.46, .46, .22, bb, (light) => {
    const col = light ? c : dk, deep = mix(col, '#000000', .3), hi = mix(col, '#ffffff', .12);
    propeller(g, s, -.51, .08, w, run, col, !light);
    box(g, s, -.46, -.08, .92, .3, s * .15, col);                                                // the long round hull
    for (let i = 0; i < 3; i++) { const hx = -.2 + i * .11; oval(g, s, hx, -.085, .055, .028, hi); oval(g, s, hx, -.08, .045, .02, deep); }   // sunken hatches
    box(g, s, .1, -.24, .17, .17, 3, col);                                                       // conning tower, forward of the hatches
    if (light) periscope(g, s, .24, -.24, -.38, INK);
  }, .3);
  if (d >= .5) bubbles(g, s, w, run, -.3, -.2 + .3 * d);                                        // bubbles only while it is down
};

// Hunter sub: a submarine with a shark-like hull. A torpedo body with a pointed snout and a pale belly, a conning tower with a periscope like the
// regular sub's, a small bow plane, symmetrical tail fins with a propeller astern, and a forward torpedo port. Always drawn dived, in the underwater shade.
const hunterSub = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .4), belly = mix(col, '#ffffff', .4), deep = mix(col, '#000000', .32);
  g.save(); g.translate(0, bb * s);
  poly(g, s, [[-.26, .0], [-.34, -.15], [-.4, -.15], [-.36, .02]], deep);                         // upper tail fin
  poly(g, s, [[-.26, .06], [-.34, .21], [-.4, .21], [-.36, .04]], deep);                          // lower tail fin: its mirror image
  propeller(g, s, -.44, .03, w, run, deep, false);
  g.fillStyle = col; g.beginPath(); g.moveTo(.46 * s, .04 * s); g.quadraticCurveTo(.3 * s, -.06 * s, .1 * s, -.1 * s); g.quadraticCurveTo(-.15 * s, -.13 * s, -.36 * s, -.01 * s);
  g.lineTo(-.36 * s, .06 * s); g.quadraticCurveTo(-.1 * s, .16 * s, .12 * s, .14 * s); g.quadraticCurveTo(.34 * s, .12 * s, .46 * s, .04 * s); g.fill();   // torpedo body
  box(g, s, -.04, -.22, .17, .14, 3, col);                                                       // conning tower, like the regular sub's
  periscope(g, s, .09, -.22, -.34, INK);
  box(g, s, .03, .12, .1, .09, 1, deep);                                                         // a small, squarish bow plane
  g.restore();
  bubbles(g, s, w, run, -.46, -.05, moving ? 5 : 3);
};

const under = (f, k = 1) => (g, o) => { g.save(); g.scale(k, k); f(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); };
export const SPRITES = {
  tank_transport: under((g, o) => { g.save(); g.translate(.03 * o.s, 0); tankTransport(g, o); g.restore(); }, 1.02),
  missile_sub: under(missileSub, .92),
  hunter_sub: under(hunterSub, .9),
};

const none = () => {};
export const SHADOWS = { tank_transport: none, missile_sub: none, hunter_sub: none };
