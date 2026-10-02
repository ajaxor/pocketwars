// Experimental concept units, group "air": new aircraft for the existing Airfield. NOTHING here is in the game.
// Same conventions as gallery/concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }) centred on (0, 0), +x forward,
// sizes are fractions of the tile s. Drawn like the fighter and bomber: a 3/4 view, near wing toward the viewer, far wing darker.
import { box, disc, oval, poly, stroke, mirror, mix, GLASS, INK, STEEL, propDisc, sheen } from '../src/render/parts.js';

const ORANGE = '#ff9a2e', RED = '#d4442e', BRASS = '#d9b44a';


// ---- Stealth fighter ----------------------------------------------------------------------------------------------------------
// A dark, flat-shaded wedge: chisel nose, canted twin tails, a broad trapezoid wing with a notched trailing edge. No markings.
const stealthFighter = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .75), mid = mix(c, dk, .55), top = mix(c, dk, .35);
  const fl = (run ? .6 + .4 * Math.sin(w * 36) : .3) * s * .06;
  poly(g, s, [[-.36, -.02], [-.36 - fl / s, .005], [-.36, .03]], ORANGE);                     // faint engine glow
  poly(g, s, [[.14, -.04], [-.1, -.15], [-.2, -.15], [-.2, -.09], [-.3, -.05], [-.2, -.03]], far);   // far wing: the near wing seen foreshortened, behind the body
  poly(g, s, [[.46, .01], [.3, -.045], [.1, -.075], [-.3, -.065], [-.37, -.03], [-.37, .045], [-.3, .065], [.1, .07], [.3, .04]], mid);   // fuselage
  poly(g, s, [[.46, .01], [.3, -.045], [.1, -.075], [-.3, -.065], [-.37, -.03], [-.1, 0], [.2, .01]], top);                              // lit top plane
  poly(g, s, [[.22, -.03], [.12, -.065], [.04, -.06], [.12, -.025]], GLASS);                  // flush canopy
  poly(g, s, [[-.27, -.06], [-.34, -.2], [-.41, -.2], [-.39, -.05]], mid);                    // one tail fin, aft, standing up from the fuselage
  poly(g, s, [[.18, .04], [-.12, .31], [-.2, .31], [-.2, .2], [-.34, .12], [-.3, .04]], top); // near wing: broad, with a notched trailing edge
};

// ---- Torpedo bomber -----------------------------------------------------------------------------------------------------------
const torpedoBomber = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .3);
  poly(g, s, [[.08, -.07], [.04, -.2], [-.09, -.2], [-.1, -.07]], far);                       // far wing, straight
  poly(g, s, [[-.32, -.05], [-.37, -.13], [-.44, -.13], [-.43, -.04]], far);                  // far tailplane
  poly(g, s, [[-.28, -.07], [-.36, -.22], [-.45, -.22], [-.45, -.06]], mix(c, dk, .15));      // tail fin
  poly(g, s, [[-.36, -.22], [-.45, -.22], [-.45, -.19], [-.365, -.19]], mix(c, dk, .5));
  box(g, s, -.44, -.08, .76, .15, s * .07, c);                                                // fuselage
  poly(g, s, [[.3, -.08], [.4, -.05], [.4, .05], [.3, .07]], dk);                             // engine cowl
  box(g, s, -.44, .03, .76, .035, 2, mix(c, dk, .45));                                        // belly shade
  box(g, s, .06, -.125, .17, .06, 3, GLASS);                                                  // canopy
  poly(g, s, [[.1, .06], [.05, .3], [-.12, .3], [-.15, .06]], near);                          // near wing: broad and straight
  poly(g, s, [[-.3, .05], [-.36, .16], [-.44, .16], [-.43, .05]], near);                      // near tailplane
  // the torpedo, slung under the belly on two pylons: long, steel, with a red warhead and a little tail
  oval(g, s, .02, .135, .3, .05, '#707a88');
  poly(g, s, [[.2, .09], [.33, .135], [.2, .18]], RED);                                       // warhead
  poly(g, s, [[-.24, .13], [-.33, .07], [-.29, .07], [-.2, .12]], '#4c5460');                  // tail fins
  propDisc(g, s, .43, -.005, .12, w, run);
};

// ---- Radar plane --------------------------------------------------------------------------------------------------------------
const radarPlane = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .3), disk = '#e7e9ee';
  poly(g, s, [[.08, -.03], [.05, -.16], [-.12, -.16], [-.12, -.03]], far);                    // far wing
  box(g, s, -.04, -.12, .17, .045, 2, '#2a2a2a'); propDisc(g, s, .14, -.098, .05, w, run, 1.1);   // far turboprop
  poly(g, s, [[-.32, -.03], [-.37, -.1], [-.46, -.1], [-.44, -.03]], far);                    // far tailplane
  box(g, s, -.47, -.2, .06, .12, 2, far);                                                     // far tail fin (on the tailplane's tip)
  box(g, s, -.43, -.07, .86, .15, s * .075, c);                                               // fuselage
  poly(g, s, [[.43, -.02], [.36, -.07], [.28, -.07], [.28, .08], [.36, .08], [.43, .04]], mix(c, dk, .2));   // nose
  box(g, s, .3, -.05, .09, .045, 2, GLASS);                                                   // cockpit
  box(g, s, -.43, .035, .84, .04, 2, mix(c, dk, .45));                                        // belly shade
  box(g, s, -.34, -.2, .07, .13, 2, mix(c, dk, .15));                                         // centre tail fin
  poly(g, s, [[.08, .06], [.05, .31], [-.12, .31], [-.15, .06]], near);                       // near wing: long, straight
  box(g, s, -.04, .11, .19, .055, 3, mix(dk, '#000000', .2)); propDisc(g, s, .17, .138, .06, w, run, 0);      // near turboprop
  poly(g, s, [[-.3, .05], [-.37, .16], [-.46, .16], [-.44, .05]], near);                      // near tailplane
  box(g, s, -.47, .06, .06, .13, 2, mix(c, dk, .15));                                         // near tail fin
  // the rotodome: two pylons carry a big flat disc on the spine; it slowly turns (stripes sliding across its face)
  stroke(g, s, -.14, -.065, -.12, -.17, 3, dk); stroke(g, s, .08, -.065, .06, -.17, 3, dk);
  const cx = -.03, cy = -.215, rx = .24, ry = .055;
  oval(g, s, cx, cy + .03, rx, ry, mix(disk, dk, .35));                                       // underside / rim
  box(g, s, cx - rx, cy - .005, rx * 2, .035, 0, mix(disk, dk, .35));
  oval(g, s, cx, cy - .005, rx, ry, disk);                                                    // top face
};

// ---- Vintage fighter ----------------------------------------------------------------------------------------------------------
const vintageFighter = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .25), tan = mix(c, dk, .15);
  poly(g, s, [[.06, -.05], [.03, -.17], [-.04, -.21], [-.14, -.2], [-.15, -.05]], far);       // far wing, round-tipped
  poly(g, s, [[-.29, -.04], [-.36, -.12], [-.42, -.12], [-.4, -.03]], far);                   // far tailplane
  poly(g, s, [[-.3, -.06], [-.35, -.2], [-.41, -.19], [-.43, -.04]], tan);                    // tail fin and rudder
  poly(g, s, [[.34, -.07], [.26, -.1], [-.02, -.095], [-.3, -.05], [-.42, .0], [-.3, .05], [-.02, .09], [.26, .08], [.34, .06]], c);   // slim fuselage
  poly(g, s, [[.34, .06], [.26, .08], [-.02, .09], [-.3, .05], [-.42, .0], [-.3, .02], [-.02, .045], [.26, .04]], mix(c, dk, .45));   // belly shade
  oval(g, s, .33, -.005, .07, .075, dk);                                                      // round cowling
  oval(g, s, .06, -.1, .1, .055, GLASS);                                                      // bubble canopy
  poly(g, s, [[.1, .04], [.06, .2], [.0, .3], [-.09, .32], [-.17, .29], [-.19, .2], [-.18, .04]], near);   // near wing: an elliptical, rounded tip
  poly(g, s, [[-.27, .04], [-.36, .13], [-.42, .13], [-.4, .03]], near);                      // near tailplane
  propDisc(g, s, .41, -.005, .13, w, run);
};

// ---- Vintage bomber -----------------------------------------------------------------------------------------------------------
const vintageBomber = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .3);
  poly(g, s, [[.1, -.06], [.04, -.22], [-.1, -.22], [-.12, -.06]], far);                      // far wing, straight and tapered
  for (const [x, y] of [[.07, -.115], [.02, -.185]]) { box(g, s, x - .13, y - .02, .17, .04, 2, '#2a2a2a'); propDisc(g, s, x + .06, y, .045, w, run, x * 40); }   // far engines
  poly(g, s, [[-.33, -.05], [-.4, -.13], [-.47, -.13], [-.45, -.04]], far);                   // far tailplane
  poly(g, s, [[-.26, -.07], [-.38, -.27], [-.47, -.27], [-.47, -.06]], mix(c, dk, .15));      // tall tail fin
  box(g, s, -.47, -.085, .91, .16, s * .08, c);                                               // round fuselage
  box(g, s, -.44, .035, .84, .04, 2, mix(c, dk, .45));                                        // belly shade
  poly(g, s, [[.44, .0], [.4, -.06], [.3, -.085], [.3, .07], [.4, .06]], GLASS);              // glazed nose
  poly(g, s, [[.14, .07], [.06, .32], [-.14, .32], [-.15, .07]], near);                       // near wing
  poly(g, s, [[-.34, .07], [-.41, .17], [-.47, .17], [-.45, .06]], near);                     // near tailplane
  for (const [x, y] of [[.1, .15], [.01, .27]]) { box(g, s, x - .17, y - .03, .21, .06, 3, mix(dk, '#000000', .2)); propDisc(g, s, x + .06, y, .075, w, run, x * 37); }   // near engines
};

export const SPRITES = {
  stealth_fighter: stealthFighter,
  torpedo_bomber: (g, o) => { g.save(); g.scale(.96, .96); torpedoBomber(g, o); g.restore(); },
  radar_plane: (g, o) => { g.save(); g.scale(.93, .93); radarPlane(g, o); g.restore(); },
  vintage_fighter: vintageFighter,
  vintage_bomber: (g, o) => { g.save(); g.scale(.93, .93); vintageBomber(g, o); g.restore(); },
};

// ---- shadows ------------------------------------------------------------------------------------------------------------------
const airShadow = (outline, k = 1) => (g, { s, alt = 0 }) => {
  g.save(); g.translate(0, s * (.25 + alt * .35)); g.scale(s * k, s * .3 * k);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); outline.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.restore();
};

export const SHADOWS = {
  stealth_fighter: airShadow(mirror([[.45, 0], [.28, -.04], [.1, -.08], [-.1, -.3], [-.2, -.3], [-.16, -.1], [-.3, -.2], [-.36, -.1], [-.36, 0]])),
  torpedo_bomber: airShadow(mirror([[.43, 0], [.3, -.08], [.05, -.08], [-.1, -.3], [-.14, -.3], [-.14, -.08], [-.3, -.08], [-.44, -.2], [-.44, 0]]), .96),
  radar_plane: airShadow(mirror([[.42, 0], [.3, -.07], [.08, -.07], [-.12, -.32], [-.15, -.32], [-.15, -.07], [-.3, -.07], [-.46, -.17], [-.46, 0]]), .93),
  vintage_fighter: airShadow(mirror([[.4, 0], [.3, -.08], [.1, -.09], [.0, -.3], [-.1, -.34], [-.18, -.3], [-.18, -.09], [-.3, -.07], [-.42, -.13], [-.42, 0]])),
  vintage_bomber: airShadow(mirror([[.44, 0], [.3, -.08], [.12, -.08], [.0, -.34], [-.15, -.34], [-.15, -.08], [-.34, -.07], [-.47, -.18], [-.47, 0]]), .93),
};
