// Experimental concept ships, "fleet" group (Shipyard): a tank landing ship and two submarines. Sprites only, NOT in the game.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
// The landing ship floats like the real ships (afloat). The submarines are drawn dived, always in the underwater shade like the abyss sub.
import { box, disc, oval, poly, stroke, mix, afloat, propeller, bubbles, periscope, UNDER_SHADE, INK, STEEL, RED, SKIN } from '../src/render/parts.js';

// Landing craft: a D-Day style Higgins boat. A flat-bottomed, boxy hull with a blunt bow whose drop ramp is raised, high plain sides round an open
// well with a row of helmeted troops, and a little helmsman's shelter at the stern. (It can still carry a tank; none is drawn.)
const tankTransport = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .02, D = .06, x0 = -.4, x1 = .34;
  afloat(g, s, w, run, x0, x1, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, x0 - .02, .24, w, run, dk);
    g.beginPath(); g.moveTo(x0 * s, D * s); g.lineTo(x1 * s, D * s); g.lineTo((x1 + .02) * s, .2 * s); g.lineTo((x1 - .06) * s, .29 * s);
    g.lineTo((x0 + .05) * s, .29 * s); g.lineTo(x0 * s, .23 * s); g.closePath(); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      for (const x of [-.12, -.01, .1, .21]) { disc(g, s, x, D - .075, .045, SKIN); g.fillStyle = mix(c, '#000000', .4); g.beginPath(); g.arc(x * s, (D - .08) * s, .05 * s, Math.PI, 0); g.fill(); }   // helmets in the well
      box(g, s, -.3, D - .05, .64, .06, 1, mix(c, dk, .2));                                // the near side wall, hiding the troops' bodies
      poly(g, s, [[x1 - .02, D - .06], [x1 + .03, D - .06], [x1 + .05, .24], [x1 + .0, .24]], mix(c, dk, .35));   // the bow ramp, raised: a plate across the blunt bow
      box(g, s, -.4, D - .18, .12, .18, 3, c);                                             // the helmsman's shelter, stern
    }
    g.restore();
  });
};

// Missile sub: a big fat boomer. Long round hull, a sail, and a long raised casing behind the sail with rows of hatches, one open with a missile tip.
const missileSub = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .4), hi = mix(col, '#ffffff', .18), deep = mix(col, '#000000', .3);
  g.save(); g.translate(0, bb * s);
  propeller(g, s, -.5, .06, w, run, deep, false);
  poly(g, s, [[-.4, .02], [-.5, -.1], [-.45, -.1], [-.33, .02]], deep);                      // upper rudder
  poly(g, s, [[-.4, .12], [-.5, .24], [-.45, .24], [-.33, .12]], deep);                      // lower rudder
  box(g, s, -.46, -.1, .92, .32, s * .15, col);                                              // big round hull
  box(g, s, -.4, -.17, .4, .09, 3, mix(col, '#ffffff', .1));                                 // the raised missile casing behind the sail
  for (let i = 0; i < 4; i++) {                                                              // hatch row: four silo covers
    const x = -.37 + i * .095;
    if (i === 1) {                                                                           // this one is open
      box(g, s, x, -.145, .075, .05, 1, '#15181d');
      const lift = run ? .035 + .015 * Math.sin(w * 2 + ph) : .025;                           // a warhead rising out of it
      box(g, s, x + .015, -.2 - lift, .045, .06 + lift, 2, '#d0d4da');
      poly(g, s, [[x + .015, -.2 - lift], [x + .06, -.2 - lift], [x + .0375, -.27 - lift]], RED);
      const p = run ? .5 + .5 * Math.sin(w * 6 + ph) : .4; disc(g, s, x + .0375, -.17 - lift, .012, `rgba(255,150,70,${(.5 + .4 * p).toFixed(2)})`);
    } else box(g, s, x, -.155, .075, .035, 2, deep);
  }
  box(g, s, .06, -.3, .14, .22, 4, col);                                                     // sail, ahead of the casing
  box(g, s, .045, -.2, .025, .06, 1, deep);                                                   // sail plane
  periscope(g, s, .1, -.3, -.38, INK);
  poly(g, s, [[.36, .12], [.43, .02], [.43, .12]], deep);                                    // bow plane
  g.restore();
  bubbles(g, s, w, run, -.3, -.2);
};

// Hunter sub: slim and fast. A long needle hull with a sonar dome on the bow (pinging), a swept sail with planes and a shrouded pump-jet ring astern.
const hunterSub = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .4), hi = mix(col, '#ffffff', .2), deep = mix(col, '#000000', .3);
  g.save(); g.translate(0, bb * s);
  // pump-jet: a shrouded ring with stator blades, seen slightly skewed
  const a = run ? w * 14 : .5;
  oval(g, s, -.45, .02, .024, .085, deep);                                                    // shroud, seen almost edge-on
  oval(g, s, -.452, .02, .015, .062, '#1d2127');
  stroke(g, s, -.452, .02 - .06 * Math.abs(Math.cos(a)), -.452, .02 + .06 * Math.abs(Math.cos(a)), 2, STEEL);
  stroke(g, s, -.45, -.07, -.4, -.12, 3, deep); stroke(g, s, -.45, .11, -.4, .16, 3, deep);       // tail planes
  poly(g, s, [[-.4, -.02], [-.46, -.14], [-.41, -.15], [-.3, -.04]], deep);                    // fin
  // needle hull
  g.fillStyle = col; g.beginPath(); g.moveTo(-.44 * s, .02 * s);
  g.quadraticCurveTo(-.3 * s, -.1 * s, -.0 * s, -.1 * s); g.quadraticCurveTo(.3 * s, -.1 * s, .42 * s, -.0 * s);
  g.quadraticCurveTo(.3 * s, .14 * s, -.0 * s, .14 * s); g.quadraticCurveTo(-.3 * s, .14 * s, -.44 * s, .02 * s); g.fill();
  // sonar dome on the bow, with pings spreading ahead
  disc(g, s, .38, .02, .065, mix(c, '#ffffff', .35)); disc(g, s, .365, -.005, .02, 'rgba(255,255,255,.7)');
  if (run) for (let i = 0; i < 2; i++) {
    const f = (w * .8 + i * .5) % 1; g.strokeStyle = `rgba(190,235,255,${(.7 * (1 - f)).toFixed(2)})`; g.lineWidth = 2;
    g.beginPath(); g.arc(.42 * s, .02 * s, (.04 + f * .07) * s, -1.0, 1.0); g.stroke();
  }
  // swept sail with sail planes
  poly(g, s, [[-.14, -.08], [-.08, -.25], [.06, -.25], [.14, -.08]], col);
  poly(g, s, [[.0, -.14], [.12, -.16], [.1, -.13]], deep);                                    // sail plane, swept
  periscope(g, s, .04, -.25, -.33, INK);
  poly(g, s, [[.22, .08], [.3, .2], [.25, .2], [.17, .1]], deep);                              // bow plane
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
