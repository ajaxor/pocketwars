// Experimental concept ships (Shipyard): sprites only, NOT in the game. Same conventions as the real ships in src/render/unit-art.js:
// drawn twice around a fixed waterline (afloat), light colour above and the UNDER_SHADE mix below, foam at both ends, no shadow.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
import { box, disc, oval, poly, stroke, mix, afloat, hullPath, deckAt, propeller, UNDER_SHADE, INK, STEEL } from '../src/render/parts.js';

const WHITE = '#f4f4f0', SMOKE = 'rgba(70,70,75,', FOAMW = 'rgba(255,255,255,';

// A gun mount lighter than the underwater hull, barrels near black (the real ships' turret rule). `dk` is the underwater colour.
const mount = (g, s, x, y, w, len, { dk, n = 1, elev = 0, dir = 1, bar = .035, rec = 0 }) => {
  g.save(); g.translate(x * s, y * s);
  box(g, s, -w * .5, -w * .5, w, w * .5, 3, mix(dk, '#ffffff', .5));
  g.translate(dir * w * .3 * s, -w * .3 * s); g.rotate(dir > 0 ? -elev : elev);
  g.fillStyle = INK;
  for (let i = 0; i < n; i++) g.fillRect(dir > 0 ? -rec * s : -len * s + rec * s, (-bar * .5 + (i - (n - 1) / 2) * bar * 1.5) * s, len * s, bar * s);
  g.restore();
};

// ---- Shipyard ---------------------------------------------------------------------------------------------------------------
// Aircraft carrier: the longest, flattest hull. One thin flight deck overhangs the whole ship (just the runway line), with a single mast.
const carrier = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .04, H = { x0: -.47, x1: .47, deck: .02, keel: .3, rise: .0, sweep: .12 };
  afloat(g, s, w, run, -.47, .47, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.47 - .02, .27, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      const deck = mix(c, '#26282e', .5);
      poly(g, s, [[-.47, -.06], [.47, -.06], [.47, -.02], [.4, .035], [-.43, .035], [-.47, .0]], deck);   // the flight deck, overhanging the hull
      poly(g, s, [[-.43, .035], [.4, .035], [.38, .06], [-.4, .06]], mix(c, dk, .65));         // shadowed underside of the overhang
      for (let i = 0; i < 7; i++) box(g, s, -.42 + i * .12, -.042, .07, .012, 0, WHITE);        // the runway's centreline
      poly(g, s, [[.1, -.06], [.16, -.06], [.15, -.3], [.12, -.3]], c);                         // the mast, a thin tapered pole
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
  poly(g, s, [[.36, .1], [.42 + .03 * spd, .0], [.5, .1], [.4, .13]].map(([x, y]) => [x, y + bb * .3]), `${FOAMW}.8)`);
  oval(g, s, .44, .115, .08 * p * spd, .028, `${FOAMW}.75)`); oval(g, s, .34, .125, .06 * p, .02, `${FOAMW}.5)`);
  for (let i = 0; i < 4; i++) {                                                                  // wake trailing astern
    const f = ((run ? w * 1.8 : 0) + ph + i / 4) % 1;
    oval(g, s, -.36 - f * .1, .13 + f * .01, .05 * (1 - f * .5), .018, `${FOAMW}${(.6 * (1 - f)).toFixed(2)})`);
  }
};

// Dreadnought: the biggest battleship. Four twin turrets in superfiring pairs (the inner turret of each pair sits on a raised
// barbette), two funnels, and a tall mast with THREE tiers of wings (the battleship's has two).
const dreadnought = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .05, D = .02, H = { x0: -.48, x1: .48, deck: D, keel: .31, rise: .16, sweep: .55 };
  afloat(g, s, w, run, -.48, .48, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.48 - .02, .29, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      const slope = (x, fn) => { const f = deckAt(H, x); g.save(); g.translate(x * s, f.y * s); g.rotate(f.ang); fn(); g.restore(); };   // sits on the swept-up bow
      slope(.2, () => box(g, s, -.065, -.06, .13, .06, 1, mix(c, dk, .35)));                         // barbette
      box(g, s, -.3, D - .06, .13, .06, 1, mix(c, dk, .35));
      slope(.37, () => mount(g, s, 0, -.005, .15, .115, { dk, n: 2, elev: .25, bar: .03 }));
      slope(.2, () => mount(g, s, 0, -.06, .14, .115, { dk, n: 2, elev: .3, bar: .03 }));
      mount(g, s, -.37, D - .005, .15, .115, { dk, n: 2, elev: .25, dir: -1, bar: .03 });
      mount(g, s, -.235, D - .06, .14, .115, { dk, n: 2, elev: .3, dir: -1, bar: .03 });
      for (const x of [-.12, -.03]) box(g, s, x - .025, D - .13, .055, .13, 1, c);                  // two plain funnels
      poly(g, s, [[.02, D - .44], [.08, D - .44], [.11, D], [-.01, D]], c);                           // the mast, tapering thicker toward the deck
      box(g, s, -.09, D - .12, .26, .05, 2, c); box(g, s, -.05, D - .25, .18, .05, 2, c); box(g, s, -.02, D - .37, .12, .05, 2, c);   // three tiers of wings
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
