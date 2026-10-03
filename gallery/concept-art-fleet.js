// Experimental concept ships, "fleet" group (Shipyard): a tank landing ship and two submarines. Sprites only, NOT in the game.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j, submerged })   SHADOWS[name](g, { s, alt, w, ph, run })
// The landing ship floats like the real ships (afloat). The missile sub rides the surface and dives like the regular submarine (surfacing, bubbles
// only when it is down). The hunter sub is drawn dived, always in the underwater shade like the abyss sub.
import { box, disc, poly, stroke, mix, afloat, propeller, bubbles, periscope, surfacing, UNDER_SHADE, INK, RED, GLASS } from '../src/render/parts.js';

// Landing craft: a D-Day style Higgins boat, tall-sided, with a bow that tapers down to a raised drop ramp, a small bridge on the deck at the
// stern, and the outline of a door on the rear of the hull. (It can still carry a tank; none is drawn.)
const tankTransport = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .02, D = -.1, x0 = -.4, x1 = .34, K = .05;     // K: where the deck starts to slope down to the bow
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
  const half = (x) => (x <= .34 ? .07 + .1 * ss((x + .46) / .8) : .17 * Math.sqrt(Math.max(0, 1 - ((x - .34) / .12) ** 2)));
  for (let i = 0; i <= N; i++) { const x = -.46 + .92 * i / N; pts.push([x, cy - half(x)]); }
  for (let i = N; i >= 0; i--) { const x = -.46 + .92 * i / N; pts.push([x, cy + half(x)]); }
  poly(g, s, pts, col);
};
const missileSub = (g, { s, c, dk, w, ph, run, b, submerged }) => {
  const d = Math.max(0, Math.min(1, Number(submerged) || 0)), bb = b * (.6 - .3 * d) / s + .03 * (1 - d);
  surfacing(g, s, w, run, submerged, -.46, .46, .15, bb, (light) => {
    const col = light ? c : dk, deep = mix(col, '#000000', .3), hi = mix(col, '#ffffff', .1);
    propeller(g, s, -.5, .06, w, run, deep, false);
    poly(g, s, [[-.4, .03], [-.5, -.1], [-.45, -.1], [-.33, .03]], deep);                        // rudder
    boomerBody(g, s, col);
    box(g, s, -.38, -.16, .32, .14, 4, hi);                                                      // the raised missile casing behind the sail
    for (let i = 0; i < 3; i++) box(g, s, -.355 + i * .1, -.135, .08, .06, 2, deep);              // three big hatches
    if (light) disc(g, s, -.255, -.105, .014, RED);                                                // a missile nose showing in the middle one
    box(g, s, .06, -.3, .14, .22, 4, col);                                                       // sail, ahead of the casing
    if (light) periscope(g, s, .15, -.3, -.4, INK);                                              // the periscope on the sail
  }, .3);
  if (d >= .5) bubbles(g, s, w, run, -.3, -.2 + .3 * d);                                        // bubbles only while it is down
};

// Hunter sub: a shark. A torpedo body with a pointed snout, a pale belly, a scythe of a dorsal fin, swept pectoral fins, gill slits, a mouth full of
// teeth, a cold red eye and a crescent tail that swishes.
const hunterSub = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .4), belly = mix(col, '#ffffff', .4), deep = mix(col, '#000000', .32);
  g.save(); g.translate(0, bb * s);
  const sw = run ? Math.sin(w * 4 + ph) * .14 : 0;
  g.save(); g.translate(-.34 * s, .03 * s); g.rotate(sw);                                       // the crescent tail, swishing from its base
  poly(g, s, [[.03, -.02], [-.07, -.22], [-.15, -.22], [-.1, -.03]], deep);                      // upper lobe: tall and swept back
  poly(g, s, [[.03, .0], [-.05, .13], [-.12, .13], [-.09, .01]], deep);                          // shorter lower lobe
  g.restore();
  poly(g, s, [[.2, .1], [.12, .2], [.08, .12]], deep);                                           // far pectoral fin
  g.fillStyle = col; g.beginPath(); g.moveTo(.46 * s, .04 * s); g.quadraticCurveTo(.3 * s, -.06 * s, .1 * s, -.1 * s); g.quadraticCurveTo(-.15 * s, -.13 * s, -.36 * s, -.01 * s);
  g.lineTo(-.36 * s, .06 * s); g.quadraticCurveTo(-.1 * s, .16 * s, .12 * s, .14 * s); g.quadraticCurveTo(.34 * s, .12 * s, .46 * s, .04 * s); g.fill();   // torpedo-shark body
  g.fillStyle = belly; g.beginPath(); g.moveTo(.46 * s, .04 * s); g.quadraticCurveTo(.34 * s, .12 * s, .12 * s, .14 * s); g.quadraticCurveTo(-.1 * s, .16 * s, -.36 * s, .06 * s);
  g.lineTo(-.36 * s, .035 * s); g.quadraticCurveTo(-.05 * s, .075 * s, .2 * s, .055 * s); g.quadraticCurveTo(.36 * s, .047 * s, .46 * s, .04 * s); g.fill();   // pale belly
  poly(g, s, [[.455, .043], [.27, .09], [.3, .052]], '#16181d');                                 // the open mouth
  for (let i = 0; i < 5; i++) { const x = .44 - i * .03, y = .05 + i * .004; poly(g, s, [[x, y], [x - .02, y + .004], [x - .009, y + .03]], '#f4f4f0'); }   // teeth
  for (let i = 0; i < 3; i++) stroke(g, s, .16 - i * .03, -.02, .13 - i * .03, .06, 1.8, deep);   // gill slits
  disc(g, s, .34, .0, .017, '#15161c'); disc(g, s, .344, -.002, .01, RED);                       // cold red eye
  stroke(g, s, .3, -.03, .375, -.01, 2.2, deep);                                                  // a scowling brow
  g.fillStyle = col; g.beginPath(); g.moveTo(.1 * s, -.1 * s); g.quadraticCurveTo(.07 * s, -.2 * s, -.02 * s, -.31 * s); g.quadraticCurveTo(-.0 * s, -.2 * s, -.17 * s, -.115 * s); g.closePath(); g.fill();   // scythe dorsal fin
  poly(g, s, [[-.24, -.075], [-.31, -.15], [-.32, -.065]], deep);                                 // small second dorsal
  g.fillStyle = deep; g.beginPath(); g.moveTo(.13 * s, .11 * s); g.quadraticCurveTo(.09 * s, .22 * s, -.05 * s, .28 * s); g.quadraticCurveTo(.02 * s, .17 * s, -.05 * s, .12 * s); g.closePath(); g.fill();   // near pectoral fin
  g.restore();
  bubbles(g, s, w, run, -.4, -.05, moving ? 5 : 3);
};

const under = (f, k = 1) => (g, o) => { g.save(); g.scale(k, k); f(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); };
export const SPRITES = {
  tank_transport: under(tankTransport, .86),
  missile_sub: under(missileSub, .92),
  hunter_sub: under(hunterSub, .9),
};

const none = () => {};
export const SHADOWS = { tank_transport: none, missile_sub: none, hunter_sub: none };
