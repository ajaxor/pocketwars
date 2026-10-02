// Experimental concept units, group "air": new aircraft for the existing Airfield. NOTHING here is in the game.
// Same conventions as gallery/concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }) centred on (0, 0), +x forward,
// sizes are fractions of the tile s. Drawn like the fighter and bomber: a 3/4 view, near wing toward the viewer, far wing darker.
import { PARTS } from '../src/render/unit-art.js';

const { box, disc, oval, poly, stroke, mirror, mix, GLASS, INK, STEEL } = PARTS;
const ORANGE = '#ff9a2e', RED = '#d4442e', BRASS = '#d9b44a';

// A spinning propeller seen nearly end-on: a translucent disc and a blade that flickers in length.
const propDisc = (g, s, x, y, r, w, run, ph = 0, col = INK) => {
  oval(g, s, x, y, .016, r, 'rgba(235,235,235,.34)');
  const l = (run ? Math.abs(Math.cos(w * 31 + ph)) : .6) * r * .92 + r * .08;
  stroke(g, s, x, y - l, x, y + l, 2.4, col);
  disc(g, s, x, y, .017, STEEL);
};

// A glint that sweeps along a faceted body (the low-observable skin catching the light), clipped to the body outline.
const glint = (g, s, w, run, pts, x0, x1) => {
  const k = run ? ((w * .45) % 1) : .4, x = x0 + (x1 - x0) * k;
  g.save(); g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px * s, py * s) : g.moveTo(px * s, py * s))); g.closePath(); g.clip();
  poly(g, s, [[x - .02, -.4], [x + .05, -.4], [x - .02, .4], [x - .09, .4]], 'rgba(255,255,255,.26)');
  g.restore();
};

// ---- Stealth fighter ----------------------------------------------------------------------------------------------------------
const stealthFighter = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .7), mid = mix(c, dk, .5), lit = mix(c, '#ffffff', .1), side = mix(c, dk, .35);
  const fl = (run ? .6 + .4 * Math.sin(w * 36) : .3) * s * .07;
  poly(g, s, [[-.36, -.025], [-.36 - fl / s, 0], [-.36, .025]], ORANGE);                      // faint engine glow
  poly(g, s, [[.02, -.05], [-.12, -.2], [-.2, -.2], [-.24, -.05]], far);                      // far wing: a flat chevron
  poly(g, s, [[-.15, -.06], [-.2, -.21], [-.3, -.23], [-.3, -.06]], far);                     // far tail fin, canted outward
  poly(g, s, [[-.19, -.04], [-.25, -.19], [-.35, -.2], [-.35, -.04]], mid);                   // near tail fin, canted the other way
  poly(g, s, [[-.25, -.19], [-.35, -.2], [-.35, -.17], [-.26, -.165]], far);                  // fin caps
  const body = [[.45, .01], [.28, -.04], [.08, -.075], [-.14, -.075], [-.36, -.05], [-.36, .045], [-.14, .075], [.08, .07], [.28, .04]];
  poly(g, s, body, side);                                                                     // fuselage: a long faceted wedge
  poly(g, s, [[.45, .01], [.28, -.04], [.08, -.075], [-.14, -.075], [-.36, -.05], [-.1, -.01], [.14, .0]], lit);   // lit top planes
  poly(g, s, [[.14, .0], [.28, -.04], [.45, .01], [.28, .04], [.08, .07], [-.14, .075], [-.36, .045], [-.1, .02]], mid);   // dark underside plane
  poly(g, s, [[.2, -.025], [.1, -.06], [.0, -.06], [.1, -.02]], GLASS);                       // slit canopy, flush
  box(g, s, -.36, -.03, .035, .075, 1, INK);                                                  // flat nozzle
  const wing = [[.14, .04], [-.1, .31], [-.18, .31], [-.14, .13], [-.3, .05], [-.2, .03]];
  poly(g, s, wing, mid);                                                                      // near wing, a sharp arrow
  poly(g, s, [[.14, .04], [-.1, .31], [-.14, .31], [.08, .03]], lit);                         // lit leading edge facet
  poly(g, s, [[-.14, .13], [-.3, .05], [-.2, .03]], far);                                     // trailing facet
  stroke(g, s, .06, .06, -.03, .08, 1, '#00000055');                                          // weapons-bay door line
  box(g, s, -.02, .05, .12, .02, 1, mix(STEEL, c, .2));                                       // missile peeking from the bay
  glint(g, s, w, run, body.concat(wing), -.4, .45);
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
  box(g, s, .38, -.04, .04, .1, 1, mix(dk, '#ffffff', .15));                                  // spinner
  box(g, s, -.44, .03, .76, .035, 2, mix(c, dk, .45));                                        // belly shade
  box(g, s, .06, -.125, .17, .06, 3, GLASS); box(g, s, .06, -.125, .03, .06, 1, dk);          // greenhouse canopy
  poly(g, s, [[.1, .06], [.05, .3], [-.12, .3], [-.15, .06]], near);                          // near wing: broad and straight
  box(g, s, -.12, .26, .17, .04, 1, mix(c, '#ffffff', .12));                                  // lit wing tip
  poly(g, s, [[-.3, .05], [-.36, .16], [-.44, .16], [-.43, .05]], near);                      // near tailplane
  box(g, s, .0, .22, .07, .04, 1, dk); disc(g, s, .03, .235, .014, GLASS);                    // roundel-ish marker on the wing
  // the torpedo, slung under the belly on two pylons: long, steel, with a red warhead and a little tail
  box(g, s, -.1, .06, .025, .05, 0, dk); box(g, s, .12, .06, .025, .05, 0, dk);
  oval(g, s, .02, .135, .3, .05, '#707a88');
  oval(g, s, -.02, .12, .22, .018, '#9aa4b3');                                                // highlight
  poly(g, s, [[.2, .09], [.33, .135], [.2, .18]], RED);                                       // warhead
  box(g, s, .0, .1, .03, .07, 0, BRASS);                                                      // band
  poly(g, s, [[-.24, .13], [-.33, .07], [-.29, .07], [-.2, .12]], '#4c5460');                  // tail fins
  poly(g, s, [[-.24, .14], [-.33, .2], [-.29, .2], [-.2, .15]], '#4c5460');
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
  const a = run ? w * 1.7 : .4;
  for (let i = 0; i < 4; i++) {                                                               // a rotating paddle/stripe set
    const t = a + i * Math.PI / 2, x = Math.sin(t);
    if (Math.cos(t) > 0) oval(g, s, cx + x * rx * .85, cy - .005, .012 + .018 * Math.cos(t), ry * .8, c);
  }
  oval(g, s, cx, cy - .005, rx, ry, 'rgba(0,0,0,0)');
  const blink = run ? (Math.sin(w * 5) > .6 ? 1 : .25) : .5;
  disc(g, s, cx, cy - .06, .017, `rgba(255,70,50,${blink.toFixed(2)})`);                       // beacon
};

// ---- Vintage fighter ----------------------------------------------------------------------------------------------------------
const vintageFighter = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .25), tan = mix(c, dk, .15);
  poly(g, s, [[.06, -.05], [.03, -.17], [-.04, -.21], [-.14, -.2], [-.15, -.05]], far);       // far wing, round-tipped
  poly(g, s, [[-.29, -.04], [-.36, -.12], [-.42, -.12], [-.4, -.03]], far);                   // far tailplane
  poly(g, s, [[-.3, -.06], [-.35, -.2], [-.41, -.19], [-.43, -.04]], tan);                    // tail fin and rudder
  oval(g, s, -.35, .085, .016, .016, INK);                                                    // tail wheel
  poly(g, s, [[.34, -.07], [.26, -.1], [-.02, -.095], [-.3, -.05], [-.42, .0], [-.3, .05], [-.02, .09], [.26, .08], [.34, .06]], c);   // slim fuselage
  poly(g, s, [[.34, .06], [.26, .08], [-.02, .09], [-.3, .05], [-.42, .0], [-.3, .02], [-.02, .045], [.26, .04]], mix(c, dk, .45));   // belly shade
  oval(g, s, .33, -.005, .07, .075, dk);                                                      // round cowling
  oval(g, s, .35, -.005, .05, .065, mix(dk, '#ffffff', .18));                                 // cowl lip
  oval(g, s, .06, -.1, .1, .055, GLASS); oval(g, s, .02, -.09, .05, .03, mix(GLASS, c, .2));  // bubble canopy
  poly(g, s, [[.1, .04], [.06, .2], [.0, .3], [-.09, .32], [-.17, .29], [-.19, .2], [-.18, .04]], near);   // near wing: an elliptical, rounded tip
  poly(g, s, [[.1, .04], [.06, .2], [.0, .3], [.03, .3], [.1, .2], [.13, .04]], mix(c, '#ffffff', .1));    // lit leading edge
  poly(g, s, [[-.27, .04], [-.36, .13], [-.42, .13], [-.4, .03]], near);                      // near tailplane
  disc(g, s, -.06, .21, .045, '#f4f4f0'); disc(g, s, -.06, .21, .034, c); disc(g, s, -.06, .21, .018, '#f4f4f0');   // wing roundel
  disc(g, s, -.2, -.005, .038, '#f4f4f0'); disc(g, s, -.2, -.005, .029, c); disc(g, s, -.2, -.005, .014, '#f4f4f0'); // fuselage roundel
  propDisc(g, s, .41, -.005, .13, w, run);
};

// ---- Vintage bomber -----------------------------------------------------------------------------------------------------------
const vintageBomber = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .3);
  poly(g, s, [[.1, -.06], [.04, -.22], [-.1, -.22], [-.12, -.06]], far);                      // far wing, straight and tapered
  for (const [x, y] of [[.07, -.115], [.02, -.185]]) { box(g, s, x - .13, y - .02, .17, .04, 2, '#2a2a2a'); propDisc(g, s, x + .06, y, .045, w, run, x * 40); }   // far engines
  poly(g, s, [[-.33, -.05], [-.4, -.13], [-.47, -.13], [-.45, -.04]], far);                   // far tailplane
  poly(g, s, [[-.26, -.07], [-.38, -.27], [-.47, -.27], [-.47, -.06]], mix(c, dk, .15));      // tall tail fin
  poly(g, s, [[-.38, -.27], [-.47, -.27], [-.47, -.24], [-.385, -.24]], mix(c, dk, .5));
  box(g, s, -.47, -.085, .91, .16, s * .08, c);                                               // round fuselage
  box(g, s, -.44, .035, .84, .04, 2, mix(c, dk, .45));                                        // belly shade
  poly(g, s, [[.44, .0], [.4, -.06], [.3, -.085], [.3, .07], [.4, .06]], GLASS);              // glazed nose
  stroke(g, s, .4, -.04, .4, .05, 1, '#6a7a88'); stroke(g, s, .34, -.075, .34, .065, 1, '#6a7a88');   // nose framing
  oval(g, s, .12, -.095, .06, .04, '#aebcc9'); disc(g, s, .12, -.1, .018, '#7b8794');         // dorsal gun turret blister
  stroke(g, s, .12, -.1, .2, -.135, 1.5, INK);                                                // its twin guns
  oval(g, s, -.2, -.01, .035, .03, '#aebcc9');                                                // waist blister
  poly(g, s, [[.14, .07], [.06, .32], [-.14, .32], [-.15, .07]], near);                       // near wing
  box(g, s, -.14, .28, .18, .04, 1, mix(c, '#ffffff', .1));                                   // lit wing tip
  poly(g, s, [[-.34, .07], [-.41, .17], [-.47, .17], [-.45, .06]], near);                     // near tailplane
  for (const [x, y] of [[.1, .15], [.01, .27]]) { box(g, s, x - .17, y - .03, .21, .06, 3, mix(dk, '#000000', .2)); propDisc(g, s, x + .06, y, .075, w, run, x * 37); }   // near engines
  disc(g, s, -.3, .0, .04, '#f4f4f0'); disc(g, s, -.3, .0, .03, c); disc(g, s, -.3, .0, .015, '#f4f4f0');   // roundel on the fuselage
  box(g, s, -.47, -.045, .05, .05, 2, dk);                                                    // tail gunner's glass
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
