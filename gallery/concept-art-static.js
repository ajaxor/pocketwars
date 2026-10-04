// Experimental concept units, Engineer Works group: immobile static defences, drawn in the SAME flat style as the units (unit-art.js):
// side-on, flat rounded blocks in the team colour, the upper part (turret, roof) in the team's dark colour like a tank's turret, the weapon in
// near-black, and a slanted ground shadow like the buildings' (to the lower right, sliding a little sideways). Where a unit has treads or wheels, a
// defence has a FOOTING: a dark slab the same size and place as a tread, sunk into the ground with tufts of grass over its edge, so it reads as "a
// unit that is bolted down" and never as one that drives.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
import { box, disc, oval, poly, stroke, mix, tubes, plume, INK, STEEL, RED } from '../src/render/parts.js';

export const FOOTING = '#4a4843';
const BLADES = ['#6f9f48', '#86b95c', '#5d8c3c'];          // the terrain's grass green, a lighter and a darker blade
/** Tufts of grass along the ground from x0 to x1, rising over whatever is behind them: three-blade clumps of varied height, always the same. */
export const grass = (g, s, x0, x1, base = .3) => {
  const n = Math.max(3, Math.round((x1 - x0) / .13));
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + .5) * (x1 - x0) / n, k = (i * 7 + 3) % 5;                                  // a repeating pseudo-random pattern, so it never flickers
    for (let j = -1; j <= 1; j++) {
      const hgt = (.03 + ((k + j + 3) % 3) * .014 + (j === 0 ? .012 : 0)), lean = j * .016 + (k - 2) * .004, bw = .015;
      poly(g, s, [[x + j * .022 - bw, base], [x + j * .022 + lean, base - hgt], [x + j * .022 + bw, base]], BLADES[(k + j + 4) % 3]);
    }
  }
};
/** The slab a defence is bolted to: a flat dark rounded block along the ground from x0 to x1, with grass over its foot so it seems to go into the ground. */
export const footing = (g, s, x0 = -.34, x1 = .34, h = .1) => {
  box(g, s, x0, .3 - h, x1 - x0, h, 3, FOOTING);
  grass(g, s, x0 - .02, x1 + .02, .305);
};
/** The slanted ground shadow of a defence whose footing spans x0 to x1: a band along the ground that slides up and to the right, the way the buildings' do. */
export const footShadow = (x0, x1, d = .07) => (g, { s }) => {
  const b = .3, dx = d * .9, dy = d * .7;
  poly(g, s, [[x0 + .04, b], [x1, b], [x1 + dx, b - dy], [x1 + dx + .09, b - dy + .04], [x1 + .09, b + .045], [x0 + .04, b + .045]], 'rgba(0,0,0,.2)');
};

// Gun turret: a squat bunker under a dark dome, with a machine gun out of the dome that sweeps a little.
const gunTurret = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.3, .3);
  const sw = run ? Math.sin(w * 1.1 + ph) * .07 : 0;
  g.save(); g.translate(.08 * s, -.08 * s); g.rotate(sw);
  box(g, s, 0, -.025, .32, .05, 1, INK); box(g, s, .27, -.035, .06, .07, 1, INK);                 // the gun and its flash hider
  g.restore();
  g.fillStyle = dk; g.beginPath(); g.arc(-.02 * s, -.02 * s, .17 * s, Math.PI, 0); g.fill();         // the dome
  box(g, s, -.26, -.03, .52, .24, 4, c);                                                            // the bunker
  box(g, s, -.17, .05, .3, .045, 1, INK);                                                           // a firing slit
};

// Cannon turret: a fortified block with a tank-like turret on its roof and a long cannon that recoils.
const cannonTurret = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.36, .36);
  const rec = run ? Math.max(0, Math.sin(w * 1.3 + ph)) ** 8 * .035 : 0;
  box(g, s, .1 - rec, -.17, .36, .055, 1, INK); box(g, s, .41 - rec, -.18, .06, .075, 1, INK);      // the cannon and its muzzle brake
  box(g, s, -.17, -.24, .34, .17, 3, dk);                                                           // the turret
  box(g, s, -.32, -.07, .64, .27, 4, c);                                                            // the block
  box(g, s, -.32, -.07, .64, .05, 2, mix(c, '#ffffff', .2));                                        // a lighter roof edge
};

// SAM site: a block with a turntable, and a pod of missiles tipped at the sky.
const samSite = (g, { s, c, dk }) => {
  footing(g, s, -.32, .32);
  g.save(); g.translate(-.04 * s, -.06 * s); g.rotate(-.75);
  tubes(g, s, .15, 0, .38, .17, { n: 2, col: dk });
  g.restore();
  box(g, s, -.12, -.09, .2, .08, 2, dk);                                                            // the turntable
  box(g, s, -.28, -.02, .56, .23, 4, c);
};

// Artillery emplacement: a heavy gun behind a wide rounded berm, the barrel up and out; it slides back when it fires.
const artilleryEmplacement = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.4, .4);
  const rec = run ? Math.max(0, Math.sin(w * 1.0 + ph)) ** 8 * .045 : 0;
  g.save(); g.translate(-.06 * s, -.04 * s); g.rotate(-.6);
  box(g, s, -.04 - rec, -.035, .56, .07, 1, INK); box(g, s, .48 - rec, -.045, .07, .09, 1, INK);   // the barrel
  g.restore();
  box(g, s, -.2, -.14, .2, .16, 3, dk);                                                             // the gun shield
  box(g, s, -.38, .0, .76, .21, .08 * s, c);                                                        // the berm
  box(g, s, -.3, .05, .6, .035, 1, mix(c, '#000000', .2));
};

// Jammer: a small hut with a mast, a dish on top, and signal rings spreading from it.
const jammer = (g, { s, c, dk, w, run }) => {
  footing(g, s, -.24, .24);
  stroke(g, s, .02, .02, .02, -.2, Math.max(2.5, s * .035), STEEL);                                 // the mast
  oval(g, s, .02, -.24, .12, .06, '#e6e8ee'); oval(g, s, .03, -.245, .06, .028, dk);               // the dish
  for (let i = 0; i < 2; i++) {
    const f = run ? (w * .7 + i / 2) % 1 : (i + .5) / 2, r = (.08 + f * .14) * s;
    g.strokeStyle = mix(c, '#ffffff', .45); g.globalAlpha = Math.min(1, (1 - f) * 1.3); g.lineWidth = 2.5;
    g.beginPath(); g.arc(.02 * s, -.25 * s, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.globalAlpha = 1;
  }
  box(g, s, -.2, .0, .4, .21, 4, c);                                                                // the hut
  box(g, s, -.2, .0, .4, .05, 2, dk);                                                               // its roof
  box(g, s, -.12, .08, .1, .12, 1, INK);                                                            // a door
};

// Automated factory: a plain shed with a dark sawtooth roof, a door with a crate coming out, and a smoking chimney.
const autoFactory = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.4, .4);
  box(g, s, .18, -.24, .07, .14, 1, STEEL);                                                         // chimney
  plume(g, s, .215, -.25, w, run, ph, .7);
  for (let i = 0; i < 3; i++) poly(g, s, [[-.36 + i * .24, -.08], [-.12 + i * .24, -.08], [-.12 + i * .24, -.16]], dk);   // the sawtooth roof
  box(g, s, -.36, -.09, .72, .3, 3, c);                                                             // the shed
  box(g, s, -.06, .04, .2, .17, 2, INK);                                                            // the door
  const f = run ? (w * .4) % 1 : .5;
  box(g, s, -.02 + f * .1, .1, .1, .1, 2, '#b58a52');                                               // a crate coming out of it
};

// Land mine: a flat dark disc half-buried in a mound, with one red light.
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

// ---- shadows: the buildings' slanted band under the footing ----------------------------------------------------------------------
export const ground = (rx, ry = .05, y = .3, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  gun_turret: footShadow(-.3, .3), cannon_turret: footShadow(-.36, .36), sam_site: footShadow(-.32, .32), artillery_emplacement: footShadow(-.4, .4, .05),
  jammer: footShadow(-.24, .24), auto_factory: footShadow(-.4, .4, .05), land_mine: ground(.27),
};
