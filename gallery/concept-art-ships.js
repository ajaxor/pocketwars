// Experimental concept ships (Shipyard): sprites only, NOT in the game. Same conventions as the real ships in src/render/unit-art.js:
// drawn twice around a fixed waterline (afloat), light colour above and the UNDER_SHADE mix below, foam at both ends, no shadow.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
import { box, disc, oval, poly, stroke, mix, afloat, hullPath, propeller, UNDER_SHADE, GLASS, INK, STEEL, plume } from '../src/render/parts.js';

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
// Aircraft carrier: the longest, flattest hull. One thin flight deck overhangs the whole ship, with a stripe, numerals and two parked
// planes; a small island stands on the right of the deck with a turning radar dish. No big guns, just a pair of tiny sponson mounts.
const plane = (g, s, x, y, col) => {
  oval(g, s, x, y - .018, .05, .016, col);                                                   // fuselage
  poly(g, s, [[x - .04, y - .02], [x - .06, y - .06], [x - .03, y - .06], [x + .0, y - .02]], col);   // tail fin
  box(g, s, x - .012, y - .006, .06, .012, 1, mix(col, '#000000', .25));                       // wing, seen edge-on
  oval(g, s, x + .02, y - .03, .016, .01, GLASS);                                             // canopy
};
const carrier = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .04, H = { x0: -.47, x1: .47, deck: .02, keel: .3, rise: .0, sweep: .12 };
  afloat(g, s, w, run, -.47, .47, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.47 - .02, .27, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      const deck = mix(c, '#26282e', .5);
      poly(g, s, [[-.47, -.06], [.47, -.06], [.47, -.02], [.4, .035], [-.43, .035], [-.47, .0]], deck);   // flight deck, overhanging the hull
      poly(g, s, [[-.43, .035], [.4, .035], [.38, .06], [-.4, .06]], mix(c, dk, .65));         // shadowed underside of the overhang
      box(g, s, -.47, -.065, .94, .012, 1, mix(deck, '#ffffff', .25));                        // deck edge highlight
      for (let i = 0; i < 7; i++) box(g, s, -.42 + i * .12, -.042, .07, .012, 0, WHITE);        // centreline dashes
      box(g, s, .3, -.052, .05, .007, 0, WHITE); box(g, s, .36, -.052, .05, .007, 0, WHITE);  // bow bars
      plane(g, s, -.34, -.062, WHITE); plane(g, s, -.14, -.062, '#d7dbe2');                    // parked aircraft
      box(g, s, .1, -.21, .13, .15, 2, c);                                                      // island
      box(g, s, .08, -.14, .17, .03, 1, mix(c, dk, .3));                                       // bridge wing
      box(g, s, .12, -.19, .09, .03, 1, GLASS);
      stroke(g, s, .165, -.21, .165, -.29, 2, INK);                                             // mast
      const a = run ? w * 3 + ph : 0.6, len = .045 * (.3 + .7 * Math.abs(Math.cos(a)));        // radar: a turning bar seen edge-on
      stroke(g, s, .165 - len, -.295, .165 + len, -.295, 2.5, STEEL);
      disc(g, s, .165, -.31, .012, run && Math.sin(w * 5 + ph) > .3 ? '#ff5a4a' : '#7a2a24');   // masthead light
      for (const x of [-.4, .33]) { box(g, s, x, .01, .07, .035, 1, mix(dk, '#ffffff', .5)); stroke(g, s, x + .035, .012, x + .07, -.03, 2, INK); }   // two small gun tubs
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
      box(g, s, -.3, .035, .46, .02, 1, mix(c, '#ffffff', .25));                               // gunwale strip
      poly(g, s, [[-.2, .05], [-.2, -.06], [-.12, -.08], [-.0, -.08], [.07, .05]], c);         // low raked cabin
      poly(g, s, [[-.0, -.08], [.07, .05], [.03, .05], [-.03, -.04]], mix(c, dk, .35));        // sloped windscreen frame
      box(g, s, -.17, -.055, .12, .035, 1, GLASS);                                             // cabin windows
      stroke(g, s, -.1, -.08, -.1, -.115, 2, INK);                                             // machine gun on the cabin roof
      const f = run ? (Math.sin(w * 22 + ph) > .6 ? 1 : 0) : 0;
      stroke(g, s, -.1, -.115, -.04, -.13, 2.5, INK);
      if (f) disc(g, s, -.03, -.133, .014, '#ffd24a');
      box(g, s, -.32, .0, .03, .05, 1, mix(c, dk, .5));                                        // stern rail post
      mount(g, s, .24, .045, .09, .12, { dk, bar: .03 });                                      // the light cannon, forward
    }
    g.restore();
  }, .12);
  // the bow wave: a bright curl thrown up ahead of the stem, and a rooster tail behind
  const p = .85 + .15 * Math.sin(w * 9 + ph) * run;
  poly(g, s, [[.36, .1], [.42 + .03 * spd, .0], [.5, .1], [.4, .13]].map(([x, y]) => [x, y + bb * .3]), `${FOAMW}.8)`);
  oval(g, s, .44, .115, .08 * p * spd, .028, `${FOAMW}.75)`); oval(g, s, .34, .125, .06 * p, .02, `${FOAMW}.5)`);
  for (let i = 0; i < 4; i++) {                                                                  // spray flying off the bow
    const f = ((run ? w * 2.4 : 0) + ph + i / 4) % 1;
    disc(g, s, .4 + f * .06, .09 - Math.sin(f * 3.14) * .1, .012 * (1 - f * .5), `${FOAMW}${(.8 * (1 - f)).toFixed(2)})`);
  }
  for (let i = 0; i < 4; i++) {                                                                  // wake trailing astern
    const f = ((run ? w * 1.8 : 0) + ph + i / 4) % 1;
    oval(g, s, -.36 - f * .1, .13 + f * .01, .05 * (1 - f * .5), .018, `${FOAMW}${(.6 * (1 - f)).toFixed(2)})`);
  }
};

// Dreadnought: the biggest battleship. Four twin turrets in superfiring pairs (the inner turret of each pair sits on a raised
// barbette), a tripod bridge tower rising from the middle of the ship and two raked funnels.
const dreadnought = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s + .05, D = .02, H = { x0: -.48, x1: .48, deck: D, keel: .31, rise: .06, sweep: .12 };
  afloat(g, s, w, run, -.48, .48, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.48 - .02, .29, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      box(g, s, -.4, D - .03, .76, .03, 1, mix(c, dk, .25));                                   // raised deck line along the hull
      // superfire: low turret on the deck, inner turret lifted up on its barbette
      box(g, s, .13, D - .06, .13, .06, 1, mix(c, dk, .35)); box(g, s, -.3, D - .06, .13, .06, 1, mix(c, dk, .35));
      mount(g, s, .33, D - .005, .15, .115, { dk, n: 2, elev: .25, bar: .03 });
      mount(g, s, .195, D - .06, .14, .115, { dk, n: 2, elev: .3, bar: .03 });
      mount(g, s, -.37, D - .005, .15, .115, { dk, n: 2, elev: .25, dir: -1, bar: .03 });
      mount(g, s, -.235, D - .06, .14, .115, { dk, n: 2, elev: .3, dir: -1, bar: .03 });
      // funnels: raked, with a black cap
      for (const x of [-.12, -.03]) { poly(g, s, [[x - .03, D - .02], [x - .015, D - .17], [x + .035, D - .17], [x + .035, D - .02]], c); box(g, s, x - .02, D - .18, .06, .025, 1, INK); }
      plume(g, s, -.1, D - .19, w, run, ph, 1.2); plume(g, s, -.01, D - .19, w, run, ph + .4, 1.2);
      // tripod tower (in front of the funnels): two splayed legs and a mast, with a fire-control top and bridge tiers
      stroke(g, s, .055, D - .02, .1, D - .3, 4, c); stroke(g, s, .145, D - .02, .1, D - .3, 4, c); stroke(g, s, .1, D - .02, .1, D - .3, 3.5, c);
      box(g, s, .045, D - .135, .11, .045, 2, c); box(g, s, .06, D - .15, .08, .02, 1, GLASS);   // bridge tiers
      box(g, s, .06, D - .245, .08, .05, 2, mix(c, dk, .25));                                     // fire-control top
      stroke(g, s, .1, D - .3, .1, D - .37, 2, INK);
      const sw = run ? Math.sin(w * 3 + ph) * .02 : 0;
      poly(g, s, [[.1, D - .37], [.15 + sw, D - .355], [.1, D - .34]], '#e8e2c8');             // a small ensign, fluttering
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
