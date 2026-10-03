// Experimental concept units, group "vehicles": an APC, an amphibious tank, a wheeled SAM truck and a rocket buggy (the motorcycle trooper is a real unit now: src/render/art-cycle.js).
// Sprites only; described in concepts.json. Same conventions as concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })
// centred on (0, 0), +x forward, sizes are tile fractions; the ground is at about y = .29.
import { box, disc, oval, poly, stroke, mix, wheel, wheels, treads, propeller, tubes, INK, STEEL, SKIN, GLASS } from '../src/render/parts.js';

import * as CYCLE from '../src/render/art-cycle.js';

const RED = '#d4442e';

// ---- Amphibious tank --------------------------------------------------------------------------------------------------------
// A sealed boat-like hull with a pale flotation collar hiding most of the treads, a snorkel behind a low turret, and a squat gun that flares
// at the muzzle, the same colour as the turret. On land (amphibious_tank) there is no propeller; in the water (amphibious_tank_swim, the
// waterSprite) a water-jet propeller turns at the stern.
const amphibiousBody = (g, { s, c, dk, w, ph, run, j }, swim) => {
  const jj = j / s, collar = mix(c, '#ffffff', .55), tc = mix(dk, '#ffffff', .5);
  treads(g, s, -.33, .33, .14 + jj, .15, w, run);                                            // treads, mostly covered
  poly(g, s, [[-.36, -.02 + jj], [.26, -.02 + jj], [.38, .06 + jj], [.33, .2 + jj], [-.3, .2 + jj], [-.37, .12 + jj]], c);   // sealed hull
  box(g, s, -.34, .07 + jj, .66, .1, .05 * s, collar);                                       // flotation collar / skirt
  if (swim) { g.save(); g.translate(0, jj * s); propeller(g, s, -.445, .085, w, run, STEEL, false); g.restore(); }   // stern propeller, in the water only
  // snorkel behind the turret
  stroke(g, s, -.2, -.02 + jj, -.2, -.25 + jj, Math.max(3, s * .04), STEEL); stroke(g, s, -.2, -.25 + jj, -.12, -.25 + jj, Math.max(3, s * .04), STEEL);
  // low turret with a squat, thick gun that flares at the end (turret colour)
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .012 * run;
  g.save(); g.translate(.02 * s, (-.02 + jj) * s);
  box(g, s, -.13, -.14, .26, .14, 4, tc);                                                    // turret block
  poly(g, s, [[.08, -.115], [.2 - rec, -.105], [.235 - rec, -.135], [.235 - rec, -.015], [.2 - rec, -.045], [.08, -.035]], tc);   // gun: thick, flaring muzzle
  box(g, s, .225 - rec, -.13, .012, .11, 1, mix(tc, '#000000', .45));                         // muzzle mouth
  g.restore();
};
const amphibiousTank = (g, o) => amphibiousBody(g, o, false);
const amphibiousTankSwim = (g, o) => amphibiousBody(g, o, true);

// ---- SAM launcher -----------------------------------------------------------------------------------------------------------
// A wheeled truck with a windowed cab, a side-profile radar dish on the cab roof that nods up and down, and a raised pod of four angled
// missile tubes that kicks back now and then. The body bounces on its suspension while the wheels stay planted.
const samLauncher = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .45;                                                                    // body bounce; the wheels do not take it
  wheels(g, s, [-.24, -.04, .2], .205, .085, w, run, 12);                                    // a wheeled truck: three wheels
  box(g, s, -.3, -.01 + bb, .6, .14, 4, c);                                                  // hull
  box(g, s, .14, -.12 + bb, .17, .13, 3, dk);                                                // cab
  poly(g, s, [[.19, -.1 + bb], [.27, -.1 + bb], [.29, -.04 + bb], [.19, -.04 + bb]], GLASS);   // cab window
  // radar dish in side profile on a short mast: a shallow bowl that tips up and down
  stroke(g, s, .2, -.12 + bb, .2, -.2 + bb, 2, INK); box(g, s, .17, -.22 + bb, .06, .035, 1, INK);
  const r = .095, tilt = -(.75 + (run ? Math.sin(w * 1.8 + ph) * .5 : 0));
  g.save(); g.translate(.2 * s, (-.245 + bb) * s); g.rotate(tilt);
  g.fillStyle = mix(STEEL, '#ffffff', .5); g.beginPath(); g.moveTo(0, -r * s); g.quadraticCurveTo(-r * .9 * s, 0, 0, r * s); g.quadraticCurveTo(-r * .25 * s, 0, 0, -r * s); g.fill();   // the bowl
  stroke(g, s, -r * .1, 0, r * .5, 0, 1.4, INK); disc(g, s, r * .5, 0, .012, RED);           // the feed horn on its arm
  g.restore();
  // missile pod on a swing-up cradle, 4 tubes
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .018 * run;
  g.save(); g.translate(-.14 * s, -.06 * s + bb * s); g.rotate(-.95);
  box(g, s, -.12 - rec, -.095, .08, .19, 2, mix(dk, '#ffffff', .15));                        // pod back
  tubes(g, s, .05 - rec, 0, .32, .19, { n: 4, col: mix(c, dk, .4), tip: RED });
  for (let i = 0; i < 4; i++) {                                                               // the four missiles, noses out of the tubes
    const yy = -.095 + .19 / 4 * (i + .5);
    box(g, s, .15 - rec, yy - .016, .13, .032, 1, '#e8e4d8'); poly(g, s, [[.28 - rec, yy - .016], [.35 - rec, yy], [.28 - rec, yy + .016]], RED);
  }
  g.restore();
};

// ---- Rocket buggy -----------------------------------------------------------------------------------------------------------
// A low dune buggy on big knobbly wheels: a wedge body with a deep cockpit tub (only the driver's head and shoulders show over the rim),
// a roll hoop, and a rack of three big unguided rockets on the back, aimed steeply up.
const rocketBuggy = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, bounce = run ? Math.sin(w * 9 + ph) * .006 : 0, y0 = jj + bounce;
  g.save(); g.translate(0, y0 * s);
  // rocket rack, behind the driver, tilted up
  g.save(); g.translate(-.2 * s, -.03 * s); g.rotate(-.85);
  box(g, s, -.1, -.115, .2, .23, 2, dk);
  for (let i = 0; i < 3; i++) {
    const yy = -.08 + i * .08;
    box(g, s, -.08, yy - .022, .3, .044, 2, '#e8e4d8'); poly(g, s, [[.21, yy - .022], [.31, yy], [.21, yy + .022]], RED);   // big rockets with red noses
    box(g, s, -.1, yy - .026, .035, .052, 1, '#555a64');                                       // their tail fins
  }
  g.restore();
  // driver: only the head and shoulders clear the cockpit rim
  box(g, s, -.075, -.075, .13, .09, 3, dk);                                                   // shoulders
  disc(g, s, -.01, -.115, .045, SKIN); g.fillStyle = dk; g.beginPath(); g.arc(-.01 * s, -.12 * s, .05 * s, Math.PI, 0); g.fill();   // head and helmet
  // wedge body with a deep cockpit
  poly(g, s, [[-.34, -.02], [-.2, -.05], [-.13, .02], [.08, .02], [.15, -.03], [.3, .03], [.41, .08], [.39, .15], [-.34, .15]], c);
  box(g, s, -.34, .1, .73, .05, 2, dk);                                                       // skid plate
  stroke(g, s, -.1, .01, -.09, -.2, Math.max(2.5, s * .03), INK); stroke(g, s, -.09, -.2, .1, -.2, Math.max(2.5, s * .03), INK); stroke(g, s, .1, -.2, .13, .0, Math.max(2.5, s * .03), INK);   // roll hoop
  stroke(g, s, .03, -.05, .1, -.02, 3, c);                                                    // arm to the wheel
  g.restore();
  for (const x of [-.25, .25]) wheel(g, s, x, .185 + jj, .11, w, run, 12);                    // big wheels with a hub
};

// ---- APC ----------------------------------------------------------------------------------------------------------------------------
// An armoured personnel carrier: a tall boxy hull with a sloped nose and a small roof gun, sitting down over its treads (which run the full
// length of the hull), with a door on the rear. It carries infantry the way the transport copter does.
const apc = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  treads(g, s, -.35, .4, .12 + jj, .17, w, run);                                             // treads as long as the hull
  poly(g, s, [[-.34, -.2 + jj], [.2, -.2 + jj], [.4, -.02 + jj], [.4, .17 + jj], [-.34, .17 + jj]], c);   // tall hull, sloped nose, sunk over the treads
  box(g, s, -.34, .09 + jj, .74, .08, 1, dk);                                                // lower armour band
  box(g, s, -.3, -.14 + jj, .15, .27, 2, mix(c, dk, .4));                                    // rear door
  box(g, s, -.285, -.12 + jj, .12, .23, 1, mix(c, dk, .15));                                 // its inset panel
  disc(g, s, -.175, -.01 + jj, .016, dk);                                                    // door handle
  box(g, s, .12, -.15 + jj, .17, .05, 1, '#1d2026');                                         // vision slit
  box(g, s, .0, -.28 + jj, .12, .08, 2, dk); box(g, s, .1, -.255 + jj, .17, .028, 1, INK);   // the roof gun
};

export const SPRITES = { apc, amphibious_tank: amphibiousTank, amphibious_tank_swim: amphibiousTankSwim, sam_launcher: samLauncher, rocket_buggy: rocketBuggy, ...CYCLE.SPRITES };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  apc: ground(.38, .05, .285), amphibious_tank: ground(.4, .05, .285, -.02), amphibious_tank_swim: ground(.4, .05, .285, -.02), sam_launcher: ground(.36, .05, .285), rocket_buggy: ground(.36, .05, .295), ...CYCLE.SHADOWS,
};
