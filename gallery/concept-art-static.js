// Experimental concept units, Engineer Works group: immobile static defences, drawn in the SAME flat style as the units (unit-art.js):
// side-on, flat rounded blocks in the team colour, the upper part (turret, roof) in the team's dark colour like a tank's turret, the weapon in
// near-black, and a slanted ground shadow like the buildings' (to the lower right, sliding a little sideways). Where a unit has treads or wheels, a
// defence has a FOOTING: a dark slab the same size and place as a tread, sunk into the ground with tufts of grass over its edge, so it reads as "a
// unit that is bolted down" and never as one that drives.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
import { box, disc, oval, poly, stroke, mix, tubes, plume, INK, STEEL, RED } from '../src/render/parts.js';

export const FOOTING = '#4a4843';
const BLADES = ['#6f9f48', '#86b95c', '#5d8c3c'];          // the terrain's grass green, a lighter and a darker blade
/** A repeatable pseudo-random number in 0..1 from three integers (so the grass is always the same, and never repeats in a short cycle). */
const rnd = (i, k, seed) => { const v = Math.sin((i + 1) * 127.1 + k * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
/**
 * Tufts of grass along the ground from x0 to x1, rising over whatever is behind them: clumps of two to four blades, each clump of its own
 * height, width and spacing, so the pattern does not repeat along a footing. `seed` makes another arrangement (a different tile, a different place).
 */
export const grass = (g, s, x0, x1, base = .3, seed = 0) => {
  const n = Math.max(2, Math.round((x1 - x0) / .17));
  for (let i = 0; i < n; i++) {
    const r = (k) => rnd(i, k, seed);
    const x = x0 + (i + .5 + (r(1) - .5) * .6) * (x1 - x0) / n, big = .75 + r(2) * 1.15, blades = r(3) < .45 ? 3 : r(3) < .75 ? 2 : 4;
    for (let j = 0; j < blades; j++) {
      const off = (j - (blades - 1) / 2) * .026, hgt = (.03 + r(4 + j) * .04) * big, lean = off * .6 + (r(8 + j) - .5) * .05, bw = .015;
      poly(g, s, [[x + off - bw, base], [x + off + lean, base - hgt], [x + off + bw, base]], BLADES[Math.floor(r(12 + j) * 3)]);
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

// ---- guns that turn ------------------------------------------------------------------------------------------------------------
/**
 * The yaw of a gun that sweeps: 0 points right, PI/2 points at the camera, PI points left, and it goes there and back again, slowing at the ends.
 * A defence that is not running (a disabled or still picture) rests a little off the right-hand side.
 */
export const sweep = (w, ph, run, rate = .5) => (run ? Math.PI * (.5 - .5 * Math.cos(w * rate + ph)) : .3);
/**
 * A barrel of length `len` on a mount at (mx, my), turned `phi` round the vertical (see sweep) and raised `el` radians. It is seen from the front and
 * a little above, so a barrel turned toward the camera points down the screen and shortens, and then shows its muzzle. `ext` lengthens it (a recoil
 * is a negative ext). Returns the tip.
 */
export function aim(g, s, mx, my, len, phi, el, thick, col = INK, ext = 0) {
  const ce = Math.cos(el), L = len + ext, ux = ce * Math.cos(phi), uy = -Math.sin(el) + ce * Math.sin(phi) * .45;
  const tx = mx + L * ux, ty = my + L * uy;
  stroke(g, s, mx, my, tx, ty, thick, col);
  stroke(g, s, mx + (L - .07) * ux, my + (L - .07) * uy, tx, ty, thick * 1.45, col);                       // the muzzle brake
  const end = Math.max(0, Math.sin(phi) * ce - .5) * 2;                                                     // 0 side-on .. 1 straight at us: the bore shows
  if (end > 0) { disc(g, s, tx, ty, thick / s * .72 * (.6 + .4 * end), col); disc(g, s, tx, ty, thick / s * .3 * end, '#3a3f49'); }
  return [tx, ty];
}

// Gun turret: a squat bunker under a dark dome, with a machine gun out of the dome that sweeps round, through facing us.
const gunTurret = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.3, .3);
  box(g, s, -.26, -.03, .52, .24, 4, c);                                                            // the bunker
  g.fillStyle = dk; g.beginPath(); g.arc(-.02 * s, -.02 * s, .17 * s, Math.PI, 0); g.fill();         // the dome
  box(g, s, -.17, .05, .3, .045, 1, INK);                                                           // a firing slit
  aim(g, s, -.02, -.07, .3, sweep(w, ph, run, .55), 0, Math.max(3, s * .05));                       // the gun
};

// Cannon turret: a fortified block with a tank-like turret on its roof and a long cannon that sweeps round and recoils.
const cannonTurret = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.36, .36);
  const rec = run ? Math.max(0, Math.sin(w * 1.3 + ph)) ** 8 * .035 : 0;
  box(g, s, -.32, -.07, .64, .27, 4, c);                                                            // the block
  box(g, s, -.32, -.07, .64, .05, 2, mix(c, '#ffffff', .2));                                        // a lighter roof edge
  box(g, s, -.17, -.24, .34, .17, 3, dk);                                                           // the turret
  aim(g, s, 0, -.155, .4, sweep(w, ph, run, .42), 0, Math.max(3.5, s * .06), INK, -rec);            // the cannon
};

// SAM site: a block with a turntable, and a pod of missiles tipped at the sky that turns on it.
const samSite = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.32, .32);
  box(g, s, -.28, -.02, .56, .23, 4, c);
  box(g, s, -.12, -.09, .24, .08, 2, dk);                                                           // the turntable
  const phi = sweep(w, ph, run, .4), el = 1.0;
  for (const off of [-.035, .035]) {                                                                // two missiles side by side
    const [tx, ty] = aim(g, s, off, -.08, .32, phi, el, Math.max(3, s * .05), dk);
    disc(g, s, tx, ty, .022, RED);
  }
};

// Artillery emplacement: a heavy gun behind a wide rounded berm, the barrel up and out; it turns, and slides back when it fires.
const artilleryEmplacement = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.4, .4);
  const rec = run ? Math.max(0, Math.sin(w * 1.0 + ph)) ** 8 * .045 : 0;
  box(g, s, -.38, .0, .76, .21, .08 * s, c);                                                        // the berm
  box(g, s, -.3, .05, .6, .035, 1, mix(c, '#000000', .2));
  box(g, s, -.2, -.14, .2, .16, 3, dk);                                                             // the gun shield
  aim(g, s, -.06, -.06, .5, sweep(w, ph, run, .36), .62, Math.max(3.5, s * .065), INK, -rec);       // the barrel
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
