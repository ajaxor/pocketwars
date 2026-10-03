// Sprites for ships beyond the original four: the gun boat is in the game (unit-art.js takes it by name); the carrier and the
// dreadnought are still concepts (gallery/concepts.json).
// drawn twice around a fixed waterline (afloat), light colour above and the UNDER_SHADE mix below, foam at both ends, no shadow.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
import { box, disc, oval, poly, stroke, mix, afloat, hullPath, deckAt, propeller, UNDER_SHADE, INK, STEEL } from './parts.js';

const WHITE = '#f4f4f0', SMOKE = 'rgba(70,70,75,', FOAMW = 'rgba(255,255,255,';

// A gun mount lighter than the underwater hull, barrels near black (the real ships' turret rule). `dk` is the underwater colour.
const mount = (g, s, x, y, w, len, { dk, n = 1, elev = 0, dir = 1, bar = .035, rec = 0, border = false }) => {
  g.save(); g.translate(x * s, y * s);
  box(g, s, -w * .5, -w * .5, w, w * .5, 3, mix(dk, '#ffffff', .5));
  if (border) { g.strokeStyle = mix(dk, '#000000', .55); g.lineWidth = 1.8; g.strokeRect(-w * .5 * s, -w * .5 * s, w * s, w * .5 * s); }   // an outline so it reads apart from the turret below
  g.translate(dir * w * .3 * s, -w * .3 * s); g.rotate(dir > 0 ? -elev : elev);
  g.fillStyle = INK;
  for (let i = 0; i < n; i++) g.fillRect(dir > 0 ? -rec * s : -len * s + rec * s, (-bar * .5 + (i - (n - 1) / 2) * bar * 1.5) * s, len * s, bar * s);
  g.restore();
};

// ---- Shipyard ---------------------------------------------------------------------------------------------------------------
// Aircraft carrier: the longest, flattest hull, seen from above and a little in front of its near side. The flight deck is a wide slab drawn in
// perspective (the near edge longer than the far one) with an angled runway running across it toward the camera's far side, parked planes at
// the back, and a tall island standing on the near edge.
const carrier = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s - .03, H = { x0: -.47, x1: .47, deck: .02, keel: .36, rise: .1, sweep: .55 };
  afloat(g, s, w, run, -.47, .47, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.47 - .02, .33, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      g.translate(0, .06 * s);                                                                      // the hull rides high, the flight deck sits low and overhangs
      const deck = '#34373e', side = mix(c, dk, .6);
      const P = (t, v) => { const xn = -.53 + .92 * t, xf = -.18 + .48 * t; return [xn + (xf - xn) * v, -.06 - .16 * v]; };   // t along the deck, v from the near edge (0) to the far edge (1): a trapezoid
      poly(g, s, [[-.53, -.06], [.42, -.06], [.42, .04], [-.49, .04], [-.53, .0]], side);          // the slab's front face, overhanging the hull
      poly(g, s, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], deck);                                       // the flight deck in perspective, plain dark grey
      for (const v0 of [.04, .38, .72]) stroke(g, s, ...P(.5, v0), ...P(.5, v0 + .2), 9 * (1 - .6 * v0), '#ffffff');   // one runway centreline in clear dashes, bigger near the camera
      poly(g, s, [[.2, -.06], [.37, -.06], [.34, -.28], [.25, -.28]], c);                           // the island: a tall tapered block on the near edge
      box(g, s, .27, -.33, .03, .05, 0, mix(c, dk, .4)); stroke(g, s, .285, -.33, .285, -.42, 3, INK); oval(g, s, .3, -.385, .035, .014, STEEL);   // mast and radar
    }
    g.restore();
  });
};

// Gun boat: tiny and fast. A short hull that rides high with its bow thrown up, a forward deck gun, a small cabin with a machine gun
// on its roof, a big white bow wave and a rooster tail astern.
const gunBoat = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bb = b / s - .01, H = { x0: -.34, x1: .38, deck: .05, keel: .22, rise: .1, sweep: .26 };
  const spd = run ? (moving ? 1 : .6) : .4;
  afloat(g, s, w, run, -.34, .36, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.34 - .02, .2, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      poly(g, s, [[-.2, .05], [-.2, -.06], [-.12, -.08], [-.02, -.08], [.04, .05]], c);         // a low raked cabin
      mount(g, s, .1, .045, .09, .12, { dk, bar: .03, elev: .52 });                                       // the light cannon, near the middle
    }
    g.restore();
  }, .12);
  // the bow wave: a bright curl thrown up ahead of the stem, and a rooster tail behind
  const p = .85 + .15 * Math.sin(w * 9 + ph) * run;
  oval(g, s, .44, .115, .08 * p * spd, .028, `${FOAMW}.75)`); oval(g, s, .34, .125, .06 * p, .02, `${FOAMW}.5)`);
  for (let i = 0; i < 4; i++) {                                                                  // wake trailing astern
    const f = ((run ? w * 1.8 : 0) + ph + i / 4) % 1;
    oval(g, s, -.36 - f * .1, .13 + f * .01, .05 * (1 - f * .5), .018, `${FOAMW}${(.6 * (1 - f)).toFixed(2)})`);
  }
};

// Dreadnought: the biggest battleship. Two stacks of twin turrets, one forward and one aft, each a big turret on the deck with a smaller one
// riding on top of it, and a tall, stout mast with THREE tiers of wings (the battleship's has two).
const dreadnought = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .05, D = .02, H = { x0: -.48, x1: .48, deck: D, keel: .43, rise: .16, sweep: .55 };
  afloat(g, s, w, run, -.48, .48, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.48 - .02, .38, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      poly(g, s, [[-.045, D - .44], [.045, D - .44], [.13, D], [-.13, D]], c);                       // the mast: stout, flaring wide at its base
      box(g, s, -.23, D - .12, .46, .05, 2, c); box(g, s, -.18, D - .25, .36, .05, 2, c); box(g, s, -.13, D - .37, .26, .05, 2, c);   // three tiers of wings, centred on it
      const stack = (dir) => {                                                                       // big turret below, smaller one on its roof
        mount(g, s, 0, -.005, .28, .19, { dk, n: 2, elev: .22, dir, bar: .045 });
        mount(g, s, 0, -.005 - .13, .16, .13, { dk, n: 2, elev: .3, dir, bar: .032, border: true });
      };
      const f = deckAt(H, .32); g.save(); g.translate(.32 * s, f.y * s); g.rotate(f.ang); stack(1); g.restore();   // forward stack sits on the swept-up bow
      g.save(); g.translate(-.32 * s, D * s); stack(-1); g.restore();                                // aft stack
    }
    g.restore();
  });
};

export const SPRITES = {
  aircraft_carrier: (g, o) => { g.save(); g.scale(.77, .77); carrier(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
  gun_boat: (g, o) => { g.save(); g.scale(.86, .86); gunBoat(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
  dreadnought: (g, o) => { g.save(); g.scale(.76, .76); dreadnought(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
};

// ---- shadows: ships cast none ----------------------------------------------------------------------------------------------
const none = () => {};
export const SHADOWS = { aircraft_carrier: none, gun_boat: none, dreadnought: none };
