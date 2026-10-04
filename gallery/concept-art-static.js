// Experimental concept units, Engineer Works group: immobile static defences. They are drawn in the BUILDINGS' language rather than the
// units' (src/render/buildings.js): solid blocks seen from the front-left and above, a lit front face in the team colour, a darker right side,
// a lighter roof, and a soft shadow to the lower right, all standing on a pale poured-concrete pad (the same concrete as the walls,
// gallery/structure-art.js). The weapon is the one dark part, like a unit's gun, so a defence reads as "a small building with a gun on it".
// Same calling convention as the unit sprites (concept-art.js):
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
import { box, disc, oval, poly, stroke, mix, tubes, INK, STEEL, RED } from '../src/render/parts.js';
import { shade } from '../src/render/color.js';

export const CONCRETE = '#c9c5b8';
const DX = .9, DY = -.7;                 // the buildings' depth direction: up and to the right, per unit of depth
const GROUND = .29;                      // where a unit's feet are

/** A block like a building's: front face with its top-left at (x, y), `w` wide and `h` tall, `d` deep. Right side, roof, then the front. */
export const block = (g, s, x, y, w, h, d, col, { roof = shade(col, .25), side = shade(col, -.3) } = {}) => {
  const dx = d * DX, dy = d * DY;
  poly(g, s, [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], side);
  poly(g, s, [[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]], roof);
  poly(g, s, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col);
};
/** The ground shadow of a block whose front face sits on the ground at y = b from x to x + w: a band to the lower right, as the buildings cast. */
const blockShadow = (g, s, x, w, d, b = GROUND) => {
  const dx = d * DX, dy = d * DY;
  poly(g, s, [[x + .03, b], [x + w, b], [x + w + dx, b + dy], [x + w + dx + .09, b + dy + .045], [x + w + .09, b + .045], [x + .03, b + .045]], 'rgba(0,0,0,.2)');
};
/** The poured pad every defence stands on: a low concrete slab. */
const pad = (g, s, x0 = -.42, x1 = .3, d = .16) => block(g, s, x0, GROUND - .06, x1 - x0, .06, d, CONCRETE);
/** A team-coloured stripe across a front face (the bunker's band), for blocks that are mostly concrete. */
const stripe = (g, s, x, y, w, col) => box(g, s, x, y, w, .035, 0, col);

// ---- the defences --------------------------------------------------------------------------------------------------------------
// Gun turret (pillbox): a squat block with a dark firing slit; a machine gun pokes out of the slit and sweeps a little.
const gunTurret = (g, { s, c, w, ph, run }) => {
  pad(g, s, -.4, .26, .16);
  block(g, s, -.32, .0, .44, .23, .17, c);
  block(g, s, -.35, -.05, .5, .06, .19, shade(c, -.18));                                          // a thick roof slab
  box(g, s, -.22, .07, .3, .055, 1, '#23252b');                                                    // the firing slit
  const sw = run ? Math.sin(w * 1.1 + ph) * .07 : 0;
  g.save(); g.translate(.02 * s, .098 * s); g.rotate(sw);
  box(g, s, 0, -.018, .3, .036, 1, INK); box(g, s, .26, -.026, .05, .052, 1, INK);               // the gun and its flash hider
  g.restore();
};

// Cannon turret: a fortified base with a block turret on its roof, and a long cannon that recoils.
const cannonTurret = (g, { s, c, w, ph, run }) => {
  pad(g, s, -.42, .28, .17);
  block(g, s, -.36, .03, .5, .2, .19, c); stripe(g, s, -.36, .03, .5, shade(c, -.18));
  const rec = run ? Math.max(0, Math.sin(w * 1.3 + ph)) ** 8 * .04 : 0;
  box(g, s, .08 - rec, -.1, .4, .05, 1, INK); box(g, s, .4 - rec, -.11, .06, .07, 1, INK);        // the cannon and its muzzle brake
  block(g, s, -.22, -.15, .3, .15, .13, shade(c, .08));                                           // the turret
  box(g, s, -.15, -.09, .12, .03, 1, shade(c, -.3));
};

// SAM site: a launcher block on the roof of a low base, a pod of missile tubes tipped at the sky.
const samSite = (g, { s, c }) => {
  pad(g, s, -.42, .28, .17);
  block(g, s, -.34, .06, .52, .17, .18, c); stripe(g, s, -.34, .06, .52, shade(c, -.18));
  block(g, s, -.16, -.01, .2, .07, .1, shade(c, -.2));                                            // the turntable
  g.save(); g.translate(-.06 * s, -.03 * s); g.rotate(-.7);
  tubes(g, s, .13, -.02, .4, .18, { n: 2, col: shade(c, .08) });
  g.restore();
};

// Artillery emplacement: an earth-and-concrete berm round a heavy gun, the barrel up and out over it; it slides back when it fires.
const artilleryEmplacement = (g, { s, c, w, ph, run }) => {
  pad(g, s, -.44, .3, .14);
  const rec = run ? Math.max(0, Math.sin(w * 1.0 + ph)) ** 8 * .05 : 0;
  g.save(); g.translate(-.06 * s, .02 * s); g.rotate(-.62);
  box(g, s, -.04 - rec, -.04, .58, .08, 1, INK); box(g, s, .5 - rec, -.05, .07, .1, 1, INK);   // the barrel
  g.restore();
  block(g, s, -.16, -.08, .17, .18, .1, shade(c, .08));                                                        // the gun shield, in the team colour
  block(g, s, -.4, .08, .64, .15, .16, c); stripe(g, s, -.4, .08, .64, shade(c, -.18));            // the berm, in front of the gun
};

// Jammer: a small hut with a lattice mast, a dish on top, and signal rings spreading from it.
const jammer = (g, { s, c, w, run }) => {
  g.save(); g.translate(0, .29 * s); g.scale(.88, .88); g.translate(0, -.29 * s);
  pad(g, s, -.32, .2, .14);
  const mx = .02;
  stroke(g, s, mx - .05, .1, mx, -.24, 2, '#555a64'); stroke(g, s, mx + .05, .1, mx, -.24, 2, '#555a64');   // the lattice mast
  for (const y of [.02, -.08, -.16]) stroke(g, s, mx - .04 + (.1 - y) * .0, y, mx + .04, y, 1.5, '#555a64');
  block(g, s, -.3, .04, .26, .19, .14, c);                                                         // the hut
  box(g, s, -.24, .12, .08, .11, 1, '#23252b');
  oval(g, s, mx, -.26, .13, .06, '#e6e8ee'); oval(g, s, mx + .01, -.265, .06, .028, shade(c, -.1));   // the dish
  for (let i = 0; i < 2; i++) {
    const f = run ? (w * .7 + i / 2) % 1 : (i + .5) / 2, r = (.08 + f * .15) * s;
    g.strokeStyle = mix(c, '#ffffff', .45); g.globalAlpha = Math.min(1, (1 - f) * 1.3); g.lineWidth = 2.5;
    g.beginPath(); g.arc(mx * s, -.27 * s, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.globalAlpha = 1;
  }
  g.restore();
};

// Automated factory: a small hall with the factory's sawtooth roof, a dark door and a conveyor carrying crates out of it.
const autoFactory = (g, { s, c, w, run }) => {
  pad(g, s, -.44, .3, .14);
  block(g, s, .1, -.2, .07, .2, .04, '#565a63');                                                   // chimney, behind
  block(g, s, -.36, -.02, .5, .25, .14, c);
  for (let i = 0; i < 2; i++) { const x0 = -.36 + i * .25; poly(g, s, [[x0, -.02], [x0 + .25, -.02], [x0 + .25, -.12]], shade(c, -.12)); poly(g, s, [[x0, -.02], [x0 + .25, -.12], [x0 + .25, -.105], [x0 + .02, -.02]], '#cfe6f5'); }
  box(g, s, -.24, .08, .2, .15, 1, '#23252b');                                                     // the door
  box(g, s, -.08, .19, .38, .04, 1, '#3a3d44');                                                    // the conveyor belt
  const f = run ? (w * .4) % 1 : .5;
  block(g, s, -.04 + f * .24, .12, .07, .07, .05, '#b58a52');                                      // a crate riding it
};

// Land mine: a flat dark disc half-buried in a mound, with one red light. (Not a building, so it keeps the plain unit look.)
const landMine = (g, { s, c, w, ph, run }) => {
  oval(g, s, 0, .26, .27, .06, '#6b5338');
  oval(g, s, 0, .24, .2, .1, '#3b4048');
  oval(g, s, 0, .2, .13, .04, mix(c, '#3b4048', .4));
  disc(g, s, .06, .17, .022, run && Math.sin(w * 6 + ph) < -.2 ? '#6b2a22' : RED);
};

export const SPRITES = {
  gun_turret: gunTurret, cannon_turret: cannonTurret, sam_site: samSite, artillery_emplacement: artilleryEmplacement,
  jammer, auto_factory: autoFactory,
  land_mine: (g, o) => { g.save(); g.translate(0, -.05 * o.s); g.scale(1.25, 1.25); landMine(g, o); g.restore(); },
};

// ---- shadows: the buildings' lower-right band under the pad --------------------------------------------------------------------
const padShadow = (x0, x1, d) => (g, { s }) => blockShadow(g, s, x0, x1 - x0, d);
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  gun_turret: padShadow(-.4, .26, .16), cannon_turret: padShadow(-.42, .28, .17), sam_site: padShadow(-.42, .28, .17),
  artillery_emplacement: padShadow(-.44, .3, .14), jammer: padShadow(-.32, .2, .14), auto_factory: padShadow(-.44, .3, .14), land_mine: ground(.27, .05, .3),
};
export const DEFENCE_KIT = { block, blockShadow, pad, stripe, CONCRETE, GROUND };
