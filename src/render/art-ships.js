// Sprites for ships beyond the original four: the gun boat is in the game (unit-art.js takes it by name); the carrier and the
// dreadnought are still concepts (gallery/concepts.json).
// drawn twice around a fixed waterline (afloat), light colour above and the UNDER_SHADE mix below, foam at both ends, no shadow.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
import { box, disc, oval, poly, stroke, mix, afloat, hullPath, deckAt, propeller, UNDER_SHADE, INK, STEEL } from './parts.js';

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
// Aircraft carrier: the longest, flattest hull, seen from above and a little in front of its near side. The flight deck is a wide slab drawn in
// perspective (the near edge longer than the far one) with an angled runway running across it toward the camera's far side, parked planes at
// the back, and a tall island standing on the near edge.
const carrier = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .04, H = { x0: -.47, x1: .47, deck: .02, keel: .36, rise: .1, sweep: .55 };
  afloat(g, s, w, run, -.47, .47, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.47 - .02, .33, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      const deck = mix(c, '#26282e', .62), side = mix(c, dk, .6), rim = mix(deck, '#ffffff', .3);
      const P = (t, v) => { const xn = -.47 + .89 * t, xf = -.38 + .74 * t; return [xn + (xf - xn) * v, -.06 - .16 * v]; };   // t along the deck, v from the near edge (0) to the far edge (1)
      poly(g, s, [[-.47, -.06], [.42, -.06], [.42, .04], [-.43, .04], [-.47, .0]], side);          // the slab's front face, overhanging the hull
      poly(g, s, [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], deck);                                       // the flight deck in perspective
      stroke(g, s, ...P(0, 0), ...P(1, 0), 2, rim); stroke(g, s, ...P(0, 1), ...P(1, 1), 1.4, rim); // lit edges, near and far
      const rw = (k) => [.07 + .6 * k, .12 + .68 * k], half = (k) => .065 * (1 - .45 * k);          // the angled runway: a strip that narrows with distance
      const L = (k) => { const [t, v] = rw(k); return P(t - half(k), v); }, R = (k) => { const [t, v] = rw(k); return P(t + half(k), v); }, C = (k) => P(...rw(k));
      poly(g, s, [L(0), R(0), R(1), L(1)], mix(deck, '#ffffff', .3));
      stroke(g, s, ...L(0), ...L(1), 1.4, 'rgba(255,255,255,.8)'); stroke(g, s, ...R(0), ...R(1), 1.4, 'rgba(255,255,255,.8)');
      for (let i = 0; i < 5; i++) { const k = .1 + i * .19; stroke(g, s, ...C(k), ...C(k + .08), 2.2 * (1 - .4 * k), WHITE); }   // centreline dashes, shorter far away
      for (const t of [.1, .2, .31]) { const [x, y] = P(t, .8); box(g, s, x - .028, y - .007, .056, .014, 2, '#d8dbe0'); box(g, s, x - .004, y - .026, .014, .052, 1, '#c4c8cf'); box(g, s, x - .03, y - .018, .012, .014, 0, '#c4c8cf'); }   // parked planes
      poly(g, s, [[.2, -.06], [.37, -.06], [.34, -.28], [.25, -.28]], c);                           // the island: a tall tapered block on the near edge
      box(g, s, .255, -.25, .075, .022, 1, '#cfe6f5');                                               // bridge windows
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
  const bb = b / s + .05, D = .02, H = { x0: -.48, x1: .48, deck: D, keel: .31, rise: .16, sweep: .55 };
  afloat(g, s, w, run, -.48, .48, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.48 - .02, .29, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      const stack = (dir) => {                                                                       // big turret below, smaller one on its roof
        mount(g, s, 0, -.005, .2, .15, { dk, n: 2, elev: .22, dir, bar: .038 });
        mount(g, s, 0, -.005 - .1, .14, .12, { dk, n: 2, elev: .3, dir, bar: .03 });
      };
      const f = deckAt(H, .32); g.save(); g.translate(.32 * s, f.y * s); g.rotate(f.ang); stack(1); g.restore();   // forward stack sits on the swept-up bow
      g.save(); g.translate(-.32 * s, D * s); stack(-1); g.restore();                                // aft stack
      poly(g, s, [[-.045, D - .44], [.045, D - .44], [.08, D], [-.08, D]], c);                       // the mast: stout, thicker toward the deck
      box(g, s, -.14, D - .12, .28, .05, 2, c); box(g, s, -.1, D - .25, .2, .05, 2, c); box(g, s, -.07, D - .37, .14, .05, 2, c);   // three tiers of wings, centred on it
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
