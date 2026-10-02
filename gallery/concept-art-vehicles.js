// Experimental concept units, group "vehicles": an amphibious tank, a tracked SAM carrier, a rocket buggy and a motorcycle trooper.
// Sprites only; described in parts/vehicles.json. Same conventions as concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })
// centred on (0, 0), +x forward, sizes are tile fractions; the ground is at about y = .29.
import { box, disc, oval, poly, stroke, mix, wheel, treads, propeller, turret, tubes, dish, GLASS, INK, STEEL, SKIN } from '../src/render/parts.js';

const RED = '#d4442e', ORANGE = '#ff9a2e';

// ---- Amphibious tank --------------------------------------------------------------------------------------------------------
// A sealed boat-like hull with a pale flotation collar hiding most of the treads, a trim vane folded up on the bow, a water-jet
// housing with a small propeller at the stern, a snorkel behind a low turret. A bright lamp on the vane pulses gently.
const amphibiousTank = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, collar = mix(c, '#ffffff', .55);
  treads(g, s, -.33, .33, .14 + jj, .15, w, run);                                            // treads, mostly covered
  poly(g, s, [[-.36, -.02 + jj], [.26, -.02 + jj], [.38, .06 + jj], [.33, .2 + jj], [-.3, .2 + jj], [-.37, .12 + jj]], c);   // sealed hull
  poly(g, s, [[.26, -.02 + jj], [.38, .06 + jj], [.35, .1 + jj], [.24, .03 + jj]], mix(c, '#ffffff', .22));                    // sloped bow plate
  box(g, s, -.34, .07 + jj, .66, .1, .05 * s, collar);                                       // flotation collar / skirt
  box(g, s, -.34, .07 + jj, .66, .03, .015 * s, mix(collar, '#ffffff', .5));
  for (let i = 0; i < 6; i++) box(g, s, -.28 + i * .11, .105 + jj, .02, .05, 1, mix(collar, dk, .35));   // skirt panel seams
  // stern water-jet housing and its propeller
  box(g, s, -.43, .0 + jj, .1, .17, 3, dk); box(g, s, -.41, .04 + jj, .05, .09, 2, INK);
  g.save(); g.translate(0, jj * s); propeller(g, s, -.445, .085, w, run, STEEL, false); g.restore();
  // bow trim vane, folded up like a splash board
  poly(g, s, [[.2, -.02 + jj], [.35, -.02 + jj], [.4, -.11 + jj], [.33, -.14 + jj], [.25, -.11 + jj]], dk);
  poly(g, s, [[.27, -.03 + jj], [.35, -.03 + jj], [.37, -.09 + jj], [.31, -.11 + jj]], mix(dk, '#ffffff', .3));
  disc(g, s, .21, -.05 + jj, .014, run && Math.sin(w * 3 + ph) > 0 ? ORANGE : '#8a5a22');   // trim light
  // snorkel behind the turret
  stroke(g, s, -.2, -.02 + jj, -.2, -.25 + jj, Math.max(3, s * .04), STEEL); stroke(g, s, -.2, -.25 + jj, -.12, -.25 + jj, Math.max(3, s * .04), STEEL);
  box(g, s, -.14, -.28 + jj, .03, .06, 1, INK);
  // low turret and gun
  g.save(); g.translate(0, jj * s); turret(g, s, .02, -.02, .26, .26, { dk }); g.restore();
  box(g, s, -.06, -.1 + jj, .12, .035, 1, GLASS);
};

// ---- SAM launcher -----------------------------------------------------------------------------------------------------------
// A tracked carrier with a cab, a small turning radar dish on the cab roof and a raised pod of four angled missile tubes that kicks back now and then.
const samLauncher = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  treads(g, s, -.34, .34, .12 + jj, .17, w, run);
  box(g, s, -.3, -.01 + jj, .6, .14, 4, c);                                                  // hull
  box(g, s, .14, -.12 + jj, .17, .13, 3, dk); box(g, s, .2, -.1 + jj, .1, .06, 1, GLASS);     // cab with window
  box(g, s, -.3, .09 + jj, .6, .03, 1, dk);                                                   // lower hull band
  // radar dish on a short mast above the cab
  stroke(g, s, .2, -.12 + jj, .2, -.2 + jj, 2, INK);
  dish(g, s, .2, -.24 + jj, .055, w, run, mix(STEEL, '#ffffff', .5));
  // missile pod on a swing-up cradle, 4 tubes
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .018 * run;
  poly(g, s, [[-.22, -.01 + jj], [-.14, -.01 + jj], [-.05, -.1 + jj], [-.13, -.1 + jj]], dk);   // cradle strut
  g.save(); g.translate(-.14 * s, -.06 * s + j); g.rotate(-.95);
  box(g, s, -.12 - rec, -.095, .08, .19, 2, mix(dk, '#ffffff', .15));                        // pod back
  tubes(g, s, .05 - rec, 0, .32, .19, { n: 4, col: mix(c, dk, .4), tip: RED });
  for (let i = 0; i < 4; i++) {                                                               // the four missiles, noses out of the tubes
    const yy = -.095 + .19 / 4 * (i + .5);
    box(g, s, .15 - rec, yy - .016, .13, .032, 1, '#e8e4d8'); poly(g, s, [[.28 - rec, yy - .016], [.35 - rec, yy], [.28 - rec, yy + .016]], RED);
  }
  g.restore();
  disc(g, s, -.14, -.06 + jj, .028, STEEL);                                                   // pivot
};

// ---- Rocket buggy -----------------------------------------------------------------------------------------------------------
// An open tube-frame dune buggy on big knobbly wheels: a roll cage, a helmeted driver, and a slanted rack of unguided rockets on the back.
const rocketBuggy = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, bounce = run ? Math.sin(w * 9 + ph) * .006 : 0, y0 = jj + bounce;
  g.save(); g.translate(0, y0 * s);
  box(g, s, -.3, .08, .6, .06, 3, dk);                                                        // chassis rail
  poly(g, s, [[-.3, .08], [.32, .08], [.38, .13], [-.3, .13]], c);                            // low floor / nose
  box(g, s, -.02, .02, .08, .08, 2, mix(c, dk, .3));                                          // seat
  // roll cage
  const cage = (a, b, c2, d) => stroke(g, s, a, b, c2, d, Math.max(2.5, s * .03), INK);
  cage(-.1, .08, -.07, -.2); cage(-.07, -.2, .13, -.2); cage(.13, -.2, .17, .08); cage(.0, -.2, .02, .08);
  cage(.17, .08, .3, .04);                                                                   // bonnet strut
  // driver
  box(g, s, -.04, -.1, .09, .13, 3, c);
  disc(g, s, .005, -.15, .045, SKIN); poly(g, s, [[-.045, -.15], [.0, -.2], [.05, -.19], [.052, -.145]], dk); box(g, s, .02, -.16, .036, .02, 1, GLASS);
  stroke(g, s, .02, -.06, .13, -.03, 3, c);                                                   // arm to steering
  // rocket rack
  g.save(); g.translate(-.2 * s, -.02 * s); g.rotate(-.28);
  box(g, s, -.1, -.09, .22, .18, 2, dk);
  for (let i = 0; i < 3; i++) { const yy = -.07 + i * .06; box(g, s, -.08, yy - .014, .26, .028, 1, '#e8e4d8'); poly(g, s, [[.18, yy - .014], [.24, yy], [.18, yy + .014]], RED); }
  g.restore();
  g.restore();
  for (const x of [-.25, .25]) {                                                              // big wheels with a hub
    wheel(g, s, x, .185 + jj, .11, w, run, 12); disc(g, s, x, .185 + jj, .05, STEEL); disc(g, s, x, .185 + jj, .02, dk);
  }
};

// ---- Motorcycle infantry ----------------------------------------------------------------------------------------------------
// A soldier hunched over a motorbike: two spinning wheels, a team-coloured tank, helmet with a visor and a rifle slung across the back. The bike bobs a little.
const motorcycle = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bob = (run ? Math.sin(w * (moving ? 12 : 4) + ph) * (moving ? .008 : .004) : 0) + b / s;
  const wy = .19;
  wheel(g, s, -.22, wy, .1, w, run, 14); wheel(g, s, .22, wy, .1, w, run, 14);
  for (const x of [-.22, .22]) disc(g, s, x, wy, .035, STEEL);
  g.save(); g.translate(0, bob * s);
  stroke(g, s, .22, wy, .13, -.02, 3.5, STEEL);                                               // front fork
  stroke(g, s, -.22, wy, -.04, .1, 3, INK);                                                   // swing arm
  poly(g, s, [[-.05, .12], [.1, .12], [.12, .0], [-.04, .0]], dk);                            // engine block
  poly(g, s, [[-.06, -.02], [.1, -.04], [.14, .03], [-.04, .06]], c);                         // fuel tank
  box(g, s, -.22, .0, .2, .045, 3, INK);                                                      // seat
  stroke(g, s, -.2, .12, -.32, .17, 3.5, STEEL);                                              // exhaust
  stroke(g, s, .13, -.02, .1, -.1, 2.5, INK); stroke(g, s, .1, -.1, .16, -.1, 2.5, INK);      // handlebars
  disc(g, s, .27, .02, .026, run ? '#fff3b0' : '#c9c196');                                    // headlight
  // rider
  stroke(g, s, -.1, .02, .02, .1, 5, dk);                                                     // thigh/shin to the peg
  stroke(g, s, .02, .1, .0, .17, 4.5, INK);
  stroke(g, s, -.14, -.01, -.02, -.19, 11, c);                                                // back/torso, leaning forward
  stroke(g, s, -.04, -.14, .1, -.1, 4, c);                                                    // arm to the grip
  stroke(g, s, -.17, .0, -.11, -.27, 2.5, INK);                                             // rifle slung across the back
  box(g, s, -.12, -.03, .03, .12, 1, '#5a4a32');
  disc(g, s, .0, -.255, .06, SKIN);
  g.fillStyle = dk; g.beginPath(); g.arc(.0, -.26 * s, .07 * s, Math.PI * .95, Math.PI * 1.95); g.fill();   // helmet
  box(g, s, .02, -.27, .06, .035, 1, GLASS);                                                  // visor
  g.restore();
};

export const SPRITES = { amphibious_tank: amphibiousTank, sam_launcher: samLauncher, rocket_buggy: rocketBuggy, motorcycle };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  amphibious_tank: ground(.4, .05, .285, -.02), sam_launcher: ground(.36, .05, .285), rocket_buggy: ground(.36, .05, .295), motorcycle: ground(.3, .04, .295),
};
