// Static defences (cannon, SAM and artillery turrets, the jammer; in the game since October 2026) and a few concept ones still in the gallery
// (gun turret, automated factory, land mine), drawn in the SAME flat style as the units (unit-art.js):
// side-on, flat rounded blocks in the team colour, the upper part (turret, roof) in the team's dark colour like a tank's turret, the weapon in
// near-black, and a slanted ground shadow like the buildings' (to the lower right, sliding a little sideways). Where a unit has treads or wheels, a
// defence has a FOOTING: a dark slab the same size and place as a tread, sunk into the ground with tufts of grass over its edge, so it reads as "a
// unit that is bolted down" and never as one that drives.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
import { missile } from './art-vehicles.js';
import { box, disc, oval, poly, stroke, mix, tubes, plume, INK, STEEL, RED } from './parts.js';
import { drawWall } from './walls.js';

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
 * A barrel of length `len` on a mount at (mx, my), turned `phi` round the vertical (see sweep) and raised `el` radians, drawn in orthographic
 * projection from the side: turning only changes its horizontal length (len x cos phi), so it swings straight across without any depth, shrinks to
 * nothing when it faces the camera (where its muzzle shows as a disc) and comes out the other side. `ext` lengthens it (a recoil is a negative ext).
 * `from`..`to` draws only that stretch of it (a sleeve over the breech). Returns the tip.
 */
export function aim(g, s, mx, my, len, phi, el, thick, col = INK, ext = 0, from = 0, to = null, muzzle = true) {
  const ce = Math.cos(el), L = len + ext, ux = ce * Math.cos(phi), uy = -Math.sin(el);
  const at = (l) => [mx + l * ux, my + l * uy];
  const [ax, ay] = at(from), [tx, ty] = at(to === null ? L : to);
  stroke(g, s, ax, ay, tx, ty, thick, col);
  if (!muzzle) return [tx, ty];
  const [bx, by] = at(L - .07);
  stroke(g, s, bx, by, tx, ty, thick * 1.45, col);                                                          // the muzzle brake
  const end = Math.max(0, Math.abs(Math.sin(phi)) * ce - .6) * 2.5;                                          // 0 side-on .. 1 straight at us: the bore shows
  if (end > 0) { disc(g, s, tx, ty, thick / s * .72 * (.7 + .3 * end), col); disc(g, s, tx, ty, thick / s * .3 * end, '#3a3f49'); }
  return [tx, ty];
}

// Gun turret: a squat bunker under a dark dome, with a machine gun out of the dome that sweeps round, through facing us.
const gunTurret = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.3, .3);
  box(g, s, -.26, -.03, .52, .24, 4, c);                                                            // the bunker, with a dark roof band like the jammer's hut
  box(g, s, -.26, -.03, .52, .05, 2, dk);
  g.fillStyle = c; g.beginPath(); g.arc(-.02 * s, -.02 * s, .17 * s, Math.PI, 0); g.fill();           // the dome, in the team colour
  box(g, s, -.17, .05, .3, .045, 1, INK);                                                           // a firing slit
  aim(g, s, -.02, -.07, .3, sweep(w, ph, run, .55), 0, Math.max(3, s * .05));                       // the gun
};

// Cannon turret: a fortified block with a tank-like turret on its roof and a long cannon that sweeps round and recoils.
const cannonTurret = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.36, .36);
  const rec = run ? Math.max(0, Math.sin(w * 1.3 + ph)) ** 8 * .035 : 0;
  box(g, s, -.32, -.07, .64, .27, 4, c);                                                            // the block
  box(g, s, -.32, -.07, .64, .05, 2, dk);                                                           // a dark roof band, like the jammer's hut
  box(g, s, -.17, -.24, .34, .17, 3, c);                                                            // the turret, in the team colour
  aim(g, s, 0, -.155, .4, sweep(w, ph, run, .42), 0, Math.max(3.5, s * .06), INK, -rec, 0, null, false);   // the cannon: a plain barrel, no muzzle flare
};

/** The angle on the screen of a gun swung like a clock hand: it sweeps from pointing up-right, through straight up, to up-left and back (never toward the camera). */
const hand = (w, ph, run, rate) => -(.12 * Math.PI + .76 * sweep(w, ph, run, rate));

// SAM turret: a block with a turntable, and two big anti-air missiles (like the SAM launcher's) that swing round like a clock hand.
const samSite = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.32, .32);
  box(g, s, -.28, -.02, .56, .23, 4, c);
  box(g, s, -.28, -.02, .56, .05, 2, dk);                                                           // a dark roof band, like the jammer's hut
  box(g, s, -.12, -.09, .24, .08, 2, c);                                                            // the turntable, in the team colour
  const ang = hand(w, ph, run, .4), px = 0, py = -.1, nx = -Math.sin(ang), ny = Math.cos(ang);       // (nx, ny): across the missiles
  missile(g, s, px - nx * .035, py - ny * .035, ang, .44, .075, mix('#e8e4d8', '#000000', .3), '#3f434c');   // one behind
  missile(g, s, px + nx * .035, py + ny * .035, ang, .44, .08);                                      // and one in front
  disc(g, s, px, py, .035, INK);                                                                     // the pivot they swing on
};

// Artillery turret: a long gun barrel coming out from behind a half-round mount on a wide base, that swings round like a clock hand, and slides back when it fires.
const artilleryEmplacement = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.4, .4);
  const rec = run ? Math.max(0, Math.sin(w * 1.0 + ph)) ** 8 * .045 : 0;
  box(g, s, -.28, -.02, .56, .23, 4, c);                                                            // the base, as wide as the SAM site's, with the same dark roof band
  box(g, s, -.28, -.02, .56, .05, 2, dk);
  const ang = hand(w, ph, run, .36), thick = Math.max(3, s * .06), cy = -.02, ca = Math.cos(ang), sa = Math.sin(ang), L = .46 - rec;
  const by = cy - .035;                                                                                // the barrel pivots just inside the dome so its round end never peeps out below
  stroke(g, s, 0, by, ca * L, by + sa * L, thick, INK);                                              // the barrel, swinging like the hand of the clock...
  stroke(g, s, ca * (L - .07), by + sa * (L - .07), ca * L, by + sa * L, thick * 1.45, INK);         // ...with its muzzle brake
  g.fillStyle = c; g.beginPath(); g.arc(0, cy * s, .2 * s, Math.PI, 0); g.closePath(); g.fill();       // the mount, drawn over the barrel's root: a half circle with a flat bottom, like a desk clock
};

// Jammer: a hut with a mast and a big dish, a single flat colour cut off flat at the top and bottom, that turns from facing right, through facing us, to facing left and back.
const jammer = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.24, .24);
  const phi = sweep(w, ph, run, .5), r = .44, cx = 0, cy = -.2, k = Math.sin(phi), nx = Math.cos(phi);   // the dish faces (nx, k): k is how much it faces us
  stroke(g, s, 0, .02, 0, cy + .04, Math.max(3, s * .04), STEEL);                                    // the mast
  const rx = Math.max(.035, .3 * k);
  g.save(); g.beginPath(); g.rect((cx - .5) * s, (cy - .2) * s, s, .4 * s); g.clip();               // the dish is cut off flat above and below
  oval(g, s, cx - nx * .03, cy, rx, r, c);
  g.restore();
  stroke(g, s, cx, cy, cx + nx * .17, cy - .01, Math.max(2, s * .03), INK); disc(g, s, cx + nx * .17, cy - .01, .042, INK); disc(g, s, cx + nx * .17, cy - .01, .03, c);   // the feed on its arm, tipped in the team colour with its own black border so it shows against the dish
  box(g, s, -.2, .0, .4, .21, 4, c);                                                                // the hut
  box(g, s, -.2, .0, .4, .05, 2, dk);                                                               // its roof
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

// Cracked wall: the wall layer (walls.js) draws it in the game, linked to the walls beside it; this sprite is a lone straight cracked piece for the
// gallery and the editor's palette.
const crackedWall = (g, { s }) => drawWall(g, -s / 2, -s / 2, s, null, { links: { e: true, w: true }, cracked: true });

export const SPRITES = {
  cracked_wall: crackedWall,
  gun_turret: gunTurret, cannon_turret: cannonTurret, sam_site: samSite, artillery_emplacement: artilleryEmplacement,
  jammer, auto_factory: autoFactory,
  land_mine: (g, o) => { g.save(); g.translate(0, -.05 * o.s); g.scale(1.25, 1.25); landMine(g, o); g.restore(); },
};

// ---- shadows: the buildings' slanted band under the footing ----------------------------------------------------------------------
export const ground = (rx, ry = .05, y = .3, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  cracked_wall: () => {},   // the pipe draws its own drop shadow
  gun_turret: footShadow(-.3, .3), cannon_turret: footShadow(-.36, .36), sam_site: footShadow(-.32, .32), artillery_emplacement: footShadow(-.4, .4, .05),
  jammer: footShadow(-.24, .24), auto_factory: footShadow(-.4, .4, .05), land_mine: ground(.27),
};
