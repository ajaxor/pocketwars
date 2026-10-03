// Experimental concept units, group "vehicles": an amphibious tank, a wheeled SAM truck, a rocket buggy and a motorcycle trooper.
// Sprites only; described in parts/vehicles.json. Same conventions as concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })
// centred on (0, 0), +x forward, sizes are tile fractions; the ground is at about y = .29.
import { box, disc, oval, poly, stroke, mix, wheel, wheels, treads, propeller, turret, tubes, dish, INK, STEEL, SKIN } from '../src/render/parts.js';

const RED = '#d4442e', ORANGE = '#ff9a2e';

// ---- Amphibious tank --------------------------------------------------------------------------------------------------------
// A sealed boat-like hull with a pale flotation collar hiding most of the treads, a trim vane folded up on the bow, a water-jet
// housing with a small propeller at the stern, a snorkel behind a low turret. A bright lamp on the vane pulses gently.
const amphibiousTank = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, collar = mix(c, '#ffffff', .55);
  treads(g, s, -.33, .33, .14 + jj, .15, w, run);                                            // treads, mostly covered
  poly(g, s, [[-.36, -.02 + jj], [.26, -.02 + jj], [.38, .06 + jj], [.33, .2 + jj], [-.3, .2 + jj], [-.37, .12 + jj]], c);   // sealed hull
  box(g, s, -.34, .07 + jj, .66, .1, .05 * s, collar);                                       // flotation collar / skirt
  // stern propeller
  g.save(); g.translate(0, jj * s); propeller(g, s, -.445, .085, w, run, STEEL, false); g.restore();
  // bow trim vane, folded up like a splash board
  poly(g, s, [[.2, -.02 + jj], [.35, -.02 + jj], [.4, -.11 + jj], [.33, -.14 + jj], [.25, -.11 + jj]], dk);
  // snorkel behind the turret
  stroke(g, s, -.2, -.02 + jj, -.2, -.25 + jj, Math.max(3, s * .04), STEEL); stroke(g, s, -.2, -.25 + jj, -.12, -.25 + jj, Math.max(3, s * .04), STEEL);
  // low turret and gun
  g.save(); g.translate(0, jj * s); turret(g, s, .02, -.02, .26, .26, { dk }); g.restore();
};

// ---- SAM launcher -----------------------------------------------------------------------------------------------------------
// A wheeled truck with a cab, a small turning radar dish on the cab roof and a raised pod of four angled missile tubes that kicks back now and then.
const samLauncher = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  wheels(g, s, [-.24, -.04, .2], .2 + jj, .1, w, run, 12);                                   // a wheeled truck: three big wheels
  box(g, s, -.3, -.01 + jj, .6, .14, 4, c);                                                  // hull
  box(g, s, .14, -.12 + jj, .17, .13, 3, dk);                                                    // cab
  // radar dish on a short mast above the cab
  stroke(g, s, .2, -.12 + jj, .2, -.2 + jj, 2, INK);
  dish(g, s, .2, -.24 + jj, .055, w, run, mix(STEEL, '#ffffff', .5));
  // missile pod on a swing-up cradle, 4 tubes
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .018 * run;
  g.save(); g.translate(-.14 * s, -.06 * s + j); g.rotate(-.95);
  box(g, s, -.12 - rec, -.095, .08, .19, 2, mix(dk, '#ffffff', .15));                        // pod back
  tubes(g, s, .05 - rec, 0, .32, .19, { n: 4, col: mix(c, dk, .4), tip: RED });
  for (let i = 0; i < 4; i++) {                                                               // the four missiles, noses out of the tubes
    const yy = -.095 + .19 / 4 * (i + .5);
    box(g, s, .15 - rec, yy - .016, .13, .032, 1, '#e8e4d8'); poly(g, s, [[.28 - rec, yy - .016], [.35 - rec, yy], [.28 - rec, yy + .016]], RED);
  }
  g.restore();
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
  disc(g, s, .005, -.15, .045, SKIN); poly(g, s, [[-.045, -.15], [.0, -.2], [.05, -.19], [.052, -.145]], dk);
  stroke(g, s, .02, -.06, .13, -.03, 3, c);                                                   // arm to steering
  // rocket rack
  g.save(); g.translate(-.2 * s, -.02 * s); g.rotate(-.28);
  box(g, s, -.1, -.09, .22, .18, 2, dk);
  for (let i = 0; i < 3; i++) { const yy = -.07 + i * .06; box(g, s, -.08, yy - .014, .26, .028, 1, '#e8e4d8'); poly(g, s, [[.18, yy - .014], [.24, yy], [.18, yy + .014]], RED); }
  g.restore();
  g.restore();
  for (const x of [-.25, .25]) {                                                              // big wheels with a hub
    wheel(g, s, x, .185 + jj, .11, w, run, 12);
  }
};

// ---- Motorcycle infantry ----------------------------------------------------------------------------------------------------
// A racing bike: low, with a nose fairing and a tail hump, and the rider lying almost flat along the tank, helmet down by the handlebars.
const motorcycle = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const bob = (run ? Math.sin(w * (moving ? 12 : 4) + ph) * (moving ? .008 : .004) : 0) + b / s;
  const wy = .19;
  wheel(g, s, -.24, wy, .1, w, run, 14); wheel(g, s, .24, wy, .1, w, run, 14);
  g.save(); g.translate(0, bob * s);
  stroke(g, s, .24, wy, .15, .02, 3.5, STEEL);                                                // front fork
  poly(g, s, [[-.3, .05], [-.22, -.03], [-.1, -.02], [-.08, .1], [-.24, .15]], mix(c, dk, .35));   // tail hump
  poly(g, s, [[-.12, .02], [.06, -.02], [.18, .0], [.27, .08], [.17, .15], [-.1, .15]], c);   // body and nose fairing
  // rider: lying forward along the tank
  stroke(g, s, -.17, -.02, .07, -.09, 11, dk);                                                // back
  stroke(g, s, -.14, .0, -.02, .09, 5, dk);                                                  // thigh, tucked in
  stroke(g, s, .03, -.08, .17, -.02, 4, dk);                                                  // arm to the grip
  disc(g, s, .13, -.1, .062, c);                                                              // helmet
  box(g, s, .14, -.125, .05, .04, 1, INK);                                                    // visor
  g.restore();
};


// ---- APC ----------------------------------------------------------------------------------------------------------------------------
// An armoured personnel carrier: a boxy tracked hull with a sloped nose, a small roof gun, and two helmets showing out of the top hatch
// (it carries infantry the way the transport copter does).
const apc = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  treads(g, s, -.34, .34, .13 + jj, .17, w, run);
  poly(g, s, [[-.33, -.1 + jj], [.22, -.1 + jj], [.4, .02 + jj], [.4, .12 + jj], [-.33, .12 + jj]], c);   // hull with a sloped nose
  box(g, s, -.33, .06 + jj, .73, .06, 1, dk);                                                // lower armour band
  for (const x of [-.2, -.08]) { disc(g, s, x, -.13 + jj, .05, SKIN); g.fillStyle = dk; g.beginPath(); g.arc(x * s, (-.135 + jj) * s, .055 * s, Math.PI, 0); g.fill(); }   // two helmets
  box(g, s, .06, -.17 + jj, .1, .07, 2, dk); box(g, s, .14, -.15 + jj, .17, .028, 1, INK);   // the roof gun
};

export const SPRITES = { apc, amphibious_tank: amphibiousTank, sam_launcher: samLauncher, rocket_buggy: rocketBuggy, motorcycle };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  apc: ground(.38, .05, .285), amphibious_tank: ground(.4, .05, .285, -.02), sam_launcher: ground(.36, .05, .285), rocket_buggy: ground(.36, .05, .295), motorcycle: ground(.3, .04, .295),
};
