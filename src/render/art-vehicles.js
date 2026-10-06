// Vehicle art: the APC, the amphibious tank (on land and swimming), the SAM launcher, the rocket buggy and the technical (the Recon). unit-art.js takes them by name.
// Same conventions as unit-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })
// centred on (0, 0), +x forward, sizes are tile fractions; the ground is at about y = .29.
import { box, disc, poly, stroke, mix, wheel, wheels, treads, propeller, afloat, UNDER_SHADE, INK, STEEL, SKIN, GLASS } from './parts.js';

import * as CYCLE from './art-cycle.js';

const RED = '#d4442e';

// A rocket or missile seen from the side with its tail at (x, y), pointing along `ang` (radians, negative = up): a dark outline so overlapping rockets
// stay readable, a cream body with a dark band, a red nose cone and swept tail fins. `col` tints the body, so a rocket further back can be darker.
export const missile = (g, s, x, y, ang, len, th, col = '#e8e4d8', fin = '#555a64', nose = RED) => {
  const o = .009;
  g.save(); g.translate(x * s, y * s); g.rotate(ang);
  poly(g, s, [[-.02, -th * .95 - o], [len * .16, -th / 2 - o], [len * .16, th / 2 + o], [-.02, th * .95 + o]], INK);                 // fin outline
  box(g, s, -o, -th / 2 - o, len * .78 + o, th + o * 2, 2, INK); poly(g, s, [[len * .76, -th / 2 - o], [len + o * 1.6, 0], [len * .76, th / 2 + o]], INK);   // body outline
  poly(g, s, [[0, -th / 2], [-.02, -th * .95], [len * .16, -th / 2]], fin); poly(g, s, [[0, th / 2], [-.02, th * .95], [len * .16, th / 2]], fin);
  box(g, s, 0, -th / 2, len * .78, th, 2, col);
  box(g, s, len * .5, -th / 2, len * .06, th, 0, mix(col, '#000000', .35));                                                          // a dark band
  poly(g, s, [[len * .76, -th / 2], [len, 0], [len * .76, th / 2]], nose);
  box(g, s, len * .05, -th * .36, len * .66, th * .2, 1, mix(col, '#ffffff', .6));                                                   // a highlight along the top
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
  box(g, s, -.34, .07 + jj, .66, .1, .05 * s, dk);                       // flotation collar / skirt
  amphibTop(g, s, c, dk, w, ph, run, jj);
};
const amphibiousTankSwim = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .6 + .03, wc = mix(c, dk, UNDER_SHADE);
  afloat(g, s, w, run, -.41, .41, (light) => {
    g.save(); g.translate(0, bb * s);
    treads(g, s, -.33, .33, .14, .15, w, 0);                                                 // the treads are back, but parked: not animated in the water
    poly(g, s, HULL(0), light ? c : wc);
    if (light) { box(g, s, -.34, .07, .66, .1, .05 * s, dk); amphibTop(g, s, c, dk, w, ph, run, 0); }
    else { stroke(g, s, -.34, .15, -.43, .19, 3, wc); propeller(g, s, -.44, .19, w, run, wc, true); }   // the propeller hangs below the hull, under the surface
    g.restore();
  });
};

// ---- SAM launcher -----------------------------------------------------------------------------------------------------------
// A wheeled truck with a windowed cab, a side-profile radar dish on the cab roof that nods up and down, and a raised launcher bed with three big
// missiles lying side by side, front to back (each one a step further into the picture, up and to the right), held up by a strut. The body
// bounces on its suspension while the wheels stay planted.
const samLauncher = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .45;                                                                    // body bounce; the wheels do not take it
  box(g, s, -.36, .03 + bb, .72, .14, 3, dk);                                                // dark chassis, like the rocket launcher's
  box(g, s, .17, -.08 + bb, .19, .17, 3, c); box(g, s, .22, -.05 + bb, .12, .07, 2, GLASS);   // cab and its window
  box(g, s, -.32, -.02 + bb, .44, .06, 2, c);                                                // the flatbed
  // the launcher: a bed hinged at the rear of the hull, raised on a strut, with three missiles arrayed front to back
  const ang = -.9, ux = Math.cos(ang), uy = Math.sin(ang), Fx = -.22, Fy = -.03 + bb, L = .34, DX = .0, DY = -.045;
  const rec = Math.max(0, Math.sin(w * 1.5 + ph)) * .014 * run;
  stroke(g, s, -.06, -.01 + bb, Fx + ux * .24 + DX, Fy + uy * .24 + DY, 5, '#4a4f58'); stroke(g, s, -.075, -.03 + bb, Fx + ux * .22 + DX, Fy + uy * .22 + DY + .02, 2.4, STEEL);   // the support strut and its piston
  box(g, s, -.1, -.03 + bb, .09, .03, 1, INK);                                               // its foot on the hull
  poly(g, s, [[Fx, Fy], [Fx + ux * L, Fy + uy * L], [Fx + ux * L + DX * 1.4, Fy + uy * L + DY * 1.4], [Fx + DX * 1.4, Fy + DY * 1.4]], mix(dk, '#ffffff', .12));   // the bed, in perspective
  stroke(g, s, Fx, Fy, Fx + ux * L, Fy + uy * L, 3, mix(dk, '#000000', .3));                  // its near rail
  missile(g, s, Fx + DX * .5 + .01 - rec * ux, Fy + DY * .5 - rec * uy, ang, .44, .08);        // one big anti-air missile, white
  disc(g, s, Fx, Fy, .022, INK);                                                             // the hinge
  wheels(g, s, [-.24, -.04, .2], .205, .085, w * .4, run, 12);                               // the wheels are drawn last, on top of the chassis
};

// ---- Rocket buggy -----------------------------------------------------------------------------------------------------------
// A low dune buggy on big knobbly wheels: a wedge body with a deep cockpit tub (only the driver's head and shoulders show over the rim),
// a roll hoop, and two big unguided rockets on a rack raised above the hoop, one behind the other, aimed steeply up.
const rocketBuggy = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, bounce = run ? Math.sin(w * 9 + ph) * .006 : 0, y0 = jj + bounce;
  g.save(); g.translate(0, y0 * s);
  // rocket rack: held up on a post above the hoop, two rockets side by side front to back
  const ang = -.2, ux = Math.cos(ang), uy = Math.sin(ang), Fx = -.19, Fy = -.225, L = .36, DX = .0, DY = -.045;
  stroke(g, s, -.1, -.2, Fx + .06, Fy + .02, 3.5, c); stroke(g, s, .09, -.2, Fx + .27, Fy + .02, 3.5, c);                     // short posts from the roof hoop: the rockets sit on the roof
  poly(g, s, [[Fx, Fy + .02], [Fx + ux * L, Fy + .02 + uy * L], [Fx + ux * L + DX * 1.4, Fy + .02 + uy * L + DY * 1.4], [Fx + DX * 1.4, Fy + .02 + DY * 1.4]], dk);
  missile(g, s, Fx + DX * .5 + .01, Fy + DY * .5, ang, .42, .075, c, dk, dk);                    // one rocket in the player's colour (white is for anti-air missiles)
  // driver: only the head and shoulders clear the cockpit rim
  box(g, s, -.075, -.075, .13, .09, 3, dk);                                                   // shoulders
  disc(g, s, -.01, -.115, .045, SKIN); g.fillStyle = dk; g.beginPath(); g.arc(-.01 * s, -.12 * s, .05 * s, Math.PI, 0); g.fill();   // head and helmet
  // wedge body with a deep cockpit
  poly(g, s, [[-.34, -.02], [-.2, -.05], [-.13, .02], [.08, .02], [.15, -.03], [.3, .03], [.41, .08], [.39, .15], [-.34, .15]], c);
  box(g, s, -.34, .1, .73, .05, 2, dk);                                                       // skid plate
  stroke(g, s, -.1, .01, -.09, -.2, Math.max(2.5, s * .03), c); stroke(g, s, -.09, -.2, .1, -.2, Math.max(2.5, s * .03), c); stroke(g, s, .1, -.2, .13, .0, Math.max(2.5, s * .03), c);   // roll hoop
  stroke(g, s, .03, -.05, .1, -.02, 3, c);                                                    // arm to the wheel
  g.restore();
  for (const x of [-.25, .25]) wheel(g, s, x, .185 + jj, .11, w, run, 12);                    // big wheels with a hub
};

// ---- APC ----------------------------------------------------------------------------------------------------------------------------
// An armoured personnel carrier: a tall boxy hull with a sloped nose and a small roof gun, sitting down over its treads (which run the full
// length of the hull), with the outline of a rear door that hints a ramp can fold out. It carries infantry the way the transport copter does.
const apc = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  treads(g, s, -.35, .4, .12 + jj, .17, w, run);                                             // treads as long as the hull
  poly(g, s, [[-.34, -.2 + jj], [.2, -.2 + jj], [.4, -.02 + jj], [.4, .17 + jj], [-.34, .17 + jj]], c);   // tall hull, sloped nose, sunk over the treads
  box(g, s, -.34, .09 + jj, .74, .08, 1, dk);                                                // lower armour band
  const door = mix(c, dk, .2), edge = mix(c, dk, .6);                                        // the rear door: only an outline hinting that a ramp folds out
  box(g, s, -.34, -.14 + jj, .075, .24, 1, door);
  g.strokeStyle = edge; g.lineWidth = 1.6; g.strokeRect(-.34 * s, (-.14 + jj) * s, .075 * s, .24 * s);
  box(g, s, -.34, .085 + jj, .075, .02, 1, edge);                                            // heavy hinge along the bottom edge, where it would swing down
  box(g, s, -.34, -.14 + jj, .075, .018, 1, edge);                                           // latch rail along the top
  stroke(g, s, -.34, -.04 + jj, -.265, -.04 + jj, 1.2, edge);                                // a seam across it
  disc(g, s, -.288, -.075 + jj, .011, INK);                                                  // the latch handle
  box(g, s, .12, -.15 + jj, .17, .05, 1, dk);                                                // vision slit, a dark team colour
  box(g, s, .0, -.28 + jj, .12, .08, 2, dk); box(g, s, .1, -.255 + jj, .17, .028, 1, INK);   // the roof gun
};
const darkInterior = (dk) => mix(dk, '#000000', .72);

// Technical (the Recon's art): a battered pickup with a machine gun on a post in its bed and a rusty door.
const RUST = '#9a5a2e';
const technical = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  box(g, s, -.36, .0 + jj, .74, .13, 3, c);                                                   // the body
  box(g, s, .02, -.14 + jj, .2, .15, 4, c);                                                   // the cab
  box(g, s, .07, -.11 + jj, .12, .07, 2, GLASS);
  box(g, s, .04, .02 + jj, .12, .08, 2, RUST);                                                // a mismatched rusty door
  box(g, s, -.36, -.03 + jj, .34, .04, 1, dk);                                                // the bed's rail
  stroke(g, s, -.2, -.02 + jj, -.2, -.17 + jj, Math.max(2, s * .03), '#555a64');              // the gun post
  const sw = run ? Math.sin(w * 1.3 + ph) * .05 : 0;
  g.save(); g.translate(-.2 * s, (-.18 + jj) * s); g.rotate(sw);
  box(g, s, -.06, -.03, .12, .06, 2, INK); box(g, s, .04, -.016, .22, .032, 1, INK);          // the machine gun, sweeping
  g.restore();
  wheel(g, s, -.22, .19, .085, w, run, 10); wheel(g, s, .24, .19, .085, w, run, 10);
};

export const SPRITES = { apc, amphibious_tank: amphibiousTank, amphibious_tank_swim: amphibiousTankSwim, sam_launcher: samLauncher, rocket_buggy: rocketBuggy, technical, ...CYCLE.SPRITES };

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  apc: ground(.38, .05, .285), amphibious_tank: ground(.4, .05, .285, -.02), amphibious_tank_swim: () => {}, sam_launcher: ground(.36, .05, .285), rocket_buggy: ground(.36, .05, .295), technical: ground(.38, .05, .285), ...CYCLE.SHADOWS,
};
