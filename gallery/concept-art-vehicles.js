// Experimental concept units, group "vehicles": an APC, an amphibious tank, a wheeled SAM truck and a rocket buggy (the motorcycle trooper is a real unit now: src/render/art-cycle.js).
// Sprites only; described in concepts.json. Same conventions as concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })
// centred on (0, 0), +x forward, sizes are tile fractions; the ground is at about y = .29.
import { box, disc, poly, stroke, mix, wheel, wheels, treads, propeller, afloat, UNDER_SHADE, INK, STEEL, SKIN, GLASS } from '../src/render/parts.js';

import * as CYCLE from '../src/render/art-cycle.js';

const RED = '#d4442e';

// A rocket or missile seen from the side with its tail at (x, y), pointing along `ang` (radians, negative = up): a cream body, a red nose cone and
// small tail fins. `col` tints the body, so a missile further back in the picture can be a little darker.
const missile = (g, s, x, y, ang, len, th, col = '#e8e4d8', fin = '#555a64') => {
  g.save(); g.translate(x * s, y * s); g.rotate(ang);
  box(g, s, 0, -th / 2, len * .78, th, 2, col);
  poly(g, s, [[len * .76, -th / 2], [len, 0], [len * .76, th / 2]], RED);
  poly(g, s, [[0, -th / 2], [-.02, -th * .95], [len * .12, -th / 2]], fin); poly(g, s, [[0, th / 2], [-.02, th * .95], [len * .12, th / 2]], fin);
  g.restore();
};

// ---- Amphibious tank --------------------------------------------------------------------------------------------------------
// A sealed boat-like hull with a pale flotation collar hiding most of the treads, a snorkel behind a low turret, and a squat gun that flares
// at the muzzle. The turret and gun are the same colour as the body. On land (amphibious_tank) it rolls on its treads; in the water
// (amphibious_tank_swim, the waterSprite) the treads are off, a waterline cuts across the hull and a water-jet propeller turns at the stern.
const HULL = (jj) => [[-.36, -.02 + jj], [.26, -.02 + jj], [.38, .06 + jj], [.33, .2 + jj], [-.3, .2 + jj], [-.37, .12 + jj]];
const amphibTop = (g, s, c, dk, w, ph, run, jj) => {
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .012 * run;
  stroke(g, s, -.2, -.02 + jj, -.2, -.25 + jj, Math.max(3, s * .04), STEEL); stroke(g, s, -.2, -.25 + jj, -.12, -.25 + jj, Math.max(3, s * .04), STEEL);   // snorkel
  g.save(); g.translate(.02 * s, (-.02 + jj) * s);
  box(g, s, -.13, -.14, .26, .14, 4, c);                                                     // turret block, body colour
  box(g, s, -.13, -.035, .26, .035, 2, mix(c, dk, .35));                                     // its base ring
  box(g, s, -.06, -.16, .09, .03, 2, mix(c, '#ffffff', .2));                                 // hatch
  poly(g, s, [[.08, -.115], [.2 - rec, -.105], [.235 - rec, -.135], [.235 - rec, -.015], [.2 - rec, -.045], [.08, -.035]], c);   // gun: thick, flaring muzzle
  box(g, s, .225 - rec, -.13, .012, .11, 1, mix(c, dk, .55));                                // muzzle mouth
  g.restore();
};
const amphibiousTank = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  treads(g, s, -.33, .33, .14 + jj, .15, w, run);                                            // treads, mostly covered
  poly(g, s, HULL(jj), c);                                                                   // sealed hull
  box(g, s, -.34, .07 + jj, .66, .1, .05 * s, mix(c, '#ffffff', .55));                       // flotation collar / skirt
  amphibTop(g, s, c, dk, w, ph, run, jj);
};
const amphibiousTankSwim = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .6 + .03, wc = mix(c, dk, UNDER_SHADE);
  afloat(g, s, w, run, -.41, .41, (light) => {
    g.save(); g.translate(0, bb * s);
    poly(g, s, HULL(0), light ? c : wc);                                                     // no treads in the water: just the sealed hull
    if (light) { box(g, s, -.34, .07, .66, .1, .05 * s, mix(c, '#ffffff', .55)); amphibTop(g, s, c, dk, w, ph, run, 0); }
    else propeller(g, s, -.445, .085, w, run, wc, true);                                      // the water-jet propeller, under the surface
    g.restore();
  });
};

// ---- SAM launcher -----------------------------------------------------------------------------------------------------------
// A wheeled truck with a windowed cab, a side-profile radar dish on the cab roof that nods up and down, and a raised launcher bed with three big
// missiles lying side by side, front to back (each one a step further into the picture, up and to the right), held up by a strut. The body
// bounces on its suspension while the wheels stay planted.
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
  // the launcher: a bed hinged at the rear of the hull, raised on a strut, with three missiles arrayed front to back
  const ang = -.85, ux = Math.cos(ang), uy = Math.sin(ang), Fx = -.3, Fy = -.03 + bb, L = .4, DX = .095, DY = -.018;
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .014 * run;
  stroke(g, s, -.06, -.01 + bb, Fx + ux * .24 + DX, Fy + uy * .24 + DY, 5, '#4a4f58'); stroke(g, s, -.075, -.03 + bb, Fx + ux * .22 + DX, Fy + uy * .22 + DY + .02, 2.4, STEEL);   // the support strut and its piston
  box(g, s, -.1, -.03 + bb, .09, .03, 1, INK);                                               // its foot on the hull
  poly(g, s, [[Fx, Fy], [Fx + ux * L, Fy + uy * L], [Fx + ux * L + DX * 2.6, Fy + uy * L + DY * 2.6], [Fx + DX * 2.6, Fy + DY * 2.6]], mix(dk, '#ffffff', .12));   // the bed, in perspective
  stroke(g, s, Fx, Fy, Fx + ux * L, Fy + uy * L, 3, mix(dk, '#000000', .3));                  // its near rail
  for (const i of [2, 1, 0]) {                                                               // back missile first, near one last
    const k = i + .6, col = i === 0 ? '#e8e4d8' : mix('#e8e4d8', dk, .16 * i);
    missile(g, s, Fx + DX * k + .02 - rec * ux, Fy + DY * k + .005 - rec * uy, ang, .38, .06, col);
  }
  disc(g, s, Fx, Fy, .022, INK);                                                             // the hinge
};

// ---- Rocket buggy -----------------------------------------------------------------------------------------------------------
// A low dune buggy on big knobbly wheels: a wedge body with a deep cockpit tub (only the driver's head and shoulders show over the rim),
// a roll hoop, and two big unguided rockets on a rack raised above the hoop, one behind the other, aimed steeply up.
const rocketBuggy = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, bounce = run ? Math.sin(w * 9 + ph) * .006 : 0, y0 = jj + bounce;
  g.save(); g.translate(0, y0 * s);
  // rocket rack: held up on a post above the hoop, two rockets side by side front to back
  const ang = -.7, ux = Math.cos(ang), uy = Math.sin(ang), Fx = -.26, Fy = -.215, L = .3, DX = .105, DY = -.02;
  stroke(g, s, -.28, .0, Fx, Fy, 3.5, INK); stroke(g, s, -.2, .0, Fx + DX, Fy + DY, 3.5, INK);          // the posts up from the body
  poly(g, s, [[Fx, Fy], [Fx + ux * L, Fy + uy * L], [Fx + ux * L + DX * 2, Fy + uy * L + DY * 2], [Fx + DX * 2, Fy + DY * 2]], dk);
  stroke(g, s, Fx, Fy, Fx + ux * L, Fy + uy * L, 3, darkInterior(dk));   // the rack, in perspective
  for (const i of [1, 0]) missile(g, s, Fx + DX * (i + .5) + .02, Fy + DY * (i + .5) + .005, ang, .3, .056, i === 0 ? '#e8e4d8' : mix('#e8e4d8', dk, .18));
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
// length of the hull), with its rear ramp lowered to the ground behind it. It carries infantry the way the transport copter does.
const apc = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  treads(g, s, -.35, .4, .12 + jj, .17, w, run);                                             // treads as long as the hull
  poly(g, s, [[-.34, -.2 + jj], [.2, -.2 + jj], [.4, -.02 + jj], [.4, .17 + jj], [-.34, .17 + jj]], c);   // tall hull, sloped nose, sunk over the treads
  box(g, s, -.34, .09 + jj, .74, .08, 1, dk);                                                // lower armour band
  box(g, s, -.34, -.14 + jj, .08, .23, 1, darkInterior(dk));                                  // the open rear doorway, dark inside
  g.strokeStyle = mix(c, dk, .5); g.lineWidth = 1.6; g.strokeRect(-.34 * s, (-.14 + jj) * s, .08 * s, .23 * s);   // its frame
  poly(g, s, [[-.34, .03 + jj], [-.34, .13 + jj], [-.49, .28 + jj * .3], [-.49, .19 + jj * .3]], mix(c, dk, .12));   // the lowered ramp, a slab sloping to the ground
  poly(g, s, [[-.34, .13 + jj], [-.49, .28 + jj * .3], [-.465, .28 + jj * .3], [-.34, .155 + jj]], dk);   // its underside edge
  for (const k of [.3, .55, .8]) stroke(g, s, -.34 - .15 * k, .04 + jj + .15 * k, -.34 - .15 * k + .012, .11 + jj + .15 * k, 1.4, dk);   // grip ribs
  disc(g, s, -.34, .095 + jj, .014, INK);                                                    // the hinge
  box(g, s, .12, -.15 + jj, .17, .05, 1, dk);                                                // vision slit, a dark team colour
  box(g, s, .0, -.28 + jj, .12, .08, 2, dk); box(g, s, .1, -.255 + jj, .17, .028, 1, INK);   // the roof gun
};
const darkInterior = (dk) => mix(dk, '#000000', .72);

export const SPRITES = { apc, amphibious_tank: amphibiousTank, amphibious_tank_swim: amphibiousTankSwim, sam_launcher: samLauncher, rocket_buggy: rocketBuggy, ...CYCLE.SPRITES };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  apc: ground(.38, .05, .285), amphibious_tank: ground(.4, .05, .285, -.02), amphibious_tank_swim: () => {}, sam_launcher: ground(.36, .05, .285), rocket_buggy: ground(.36, .05, .295), ...CYCLE.SHADOWS,
};
