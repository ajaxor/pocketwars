// Experimental concept units, the October 2026 brainstorm (gallery/concepts.json, entries after "engineer"): variations on existing units
// and units that each bring one new mechanic (building, burning, shielding, sniffing out cloaks, bridging, decoys, smoke, EMP, salvage,
// wrecks, liberating assimilated units, ...). NOT in the game. Same conventions as concept-art.js:
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
// Infantry follow the training-ground rule (art-infantry.js): the plain soldier plus ONE thing. Vehicles are the game's flat blocks.
// The new static defences use the units' flat style and the footing from src/render/art-defences.js.
import { box, disc, oval, poly, stroke, mix, wheel, wheels, treads, afloat, hullPath, propeller, propDisc, legs, torso, head, dome, INK, STEEL, GLASS, RED } from '../src/render/parts.js';
import { shade } from '../src/render/color.js';
import { footing, footShadow } from '../src/render/art-defences.js';
import * as VEHICLES from '../src/render/art-vehicles.js';
import { missile } from '../src/render/art-vehicles.js';
const WOOD = '#7a4e2a', HAZARD = '#ffc531', RUST = '#9a5a2e', FLAME = '#ff9a2e', FLAME_HOT = '#ffe36b', ARC = '#9fe8ff';

// ---- infantry ------------------------------------------------------------------------------------------------------------------
const gait = (s, { w, ph, run, moving, b }) => { const walk = run && moving ? 1 : 0, k = Math.sin(w * 8 + ph); return { l: k * s * .05 * walk, sw: k * .02 * walk, bb: b / s }; };
const body = (g, o, pack) => {
  const { s, c, dk } = o, { l, sw, bb } = gait(s, o);
  legs(g, s, l, dk); if (pack) pack(bb); torso(g, s, bb, c); head(g, s, bb);
  return { s, c, dk, bb, sw };
};
const helmet = (g, s, bb, col, r = .11) => { dome(g, s, bb, r, col); g.fillStyle = col; g.fillRect(-s * (r + .02), (-.22 + bb) * s, s * (r + .02) * 2, s * .03); };

// Engineer: a soldier in a yellow hard hat with a shovel over the shoulder.
const engineer = (g, o) => {
  const { s, bb, sw } = body(g, o);
  dome(g, s, bb, .115, HAZARD); g.fillStyle = HAZARD; g.fillRect(-s * .15, (-.225 + bb) * s, s * .3, s * .035);   // the hard hat and its brim
  box(g, s, -.015, (-.33 + bb), .03, .04, 1, shade(HAZARD, -.2));                                              // its ridge
  g.save(); g.translate(-.04 * s, (.06 + bb + sw) * s); g.rotate(-.95);
  box(g, s, -.08, -.016, .38, .032, 1, WOOD);                                                                   // the handle
  poly(g, s, [[.29, -.06], [.42, -.05], [.45, 0], [.42, .05], [.29, .06]], '#b9bec6');                         // the blade
  g.restore();
};

// Flame trooper: a soldier with two plain white fuel tanks standing behind his back (on the left), and a long flamer carried across his chest
// (no arm) with a tall flame burning upright at its tip.
const flame = (g, s, x, y, h, w, sway, col) => {   // a teardrop standing on its base at (x, y), h tall, its point leaning by `sway`
  g.fillStyle = col; g.beginPath();
  g.moveTo((x - w) * s, y * s);
  g.quadraticCurveTo((x - w * 1.15) * s, (y - h * .55) * s, (x + sway) * s, (y - h) * s);
  g.quadraticCurveTo((x + w * 1.15) * s, (y - h * .55) * s, (x + w) * s, y * s);
  g.quadraticCurveTo(x * s, (y + w * .9) * s, (x - w) * s, y * s);
  g.fill();
};
const flameTrooper = (g, o) => {
  const { s, dk, bb, sw } = body(g, o, (bb) => {   // drawn before the torso, so the tanks stand behind the body, toward the left
    box(g, o.s, -.34, -.3 + bb, .13, .44, .065 * o.s, '#d3d6db');                                          // a plain white tank, a little shaded (the far one)
    box(g, o.s, -.25, -.3 + bb, .13, .44, .065 * o.s, '#f3f4f6');                                          // and the near one
  });
  helmet(g, s, bb, dk);
  const y0 = -.01 + bb, y1 = -.07 + bb + sw;
  stroke(g, s, -.12, y0, .29, y1, Math.max(2.5, s * .05), INK);                                               // the flamer, long across the chest
  box(g, s, .28, y1 - .04, .045, .08, 1, '#555a64');                                                          // its nozzle
  const f = o.run ? .85 + .2 * Math.sin(o.w * 19 + o.ph) : .9, lean = o.run ? Math.sin(o.w * 13 + o.ph) * .015 : 0;
  const fx = .335, fy = y1 - .035;
  flame(g, s, fx, fy, .27 * f, .065, lean, FLAME);                                                            // the flame, upright at the tip
  flame(g, s, fx, fy, .15 * f, .033, lean * .6, FLAME_HOT);
};

// Royal Guard: a soldier in a tall black bearskin with a team-coloured band, a tall shield in a pale tint of the team colour, and a rifle
// (the soldier's single black line) carried over his shoulder.
const BEAR = '#2b2b2f';
const royalGuard = (g, o) => {
  const { s, c, bb, sw } = body(g, o);
  box(g, s, -.115, -.47 + bb, .23, .23, .06 * s, BEAR);                                                         // the bearskin, sitting on top of the head
  box(g, s, -.115, -.285 + bb, .23, .035, 1, c);                                                                // its band, in the team colour
  const sh = mix(c, '#dfe6ee', .55);
  box(g, s, .1, -.16 + bb, .11, .44, 4, shade(sh, -.25));                                                       // the shield's edge
  box(g, s, .14, -.18 + bb, .1, .44, 4, sh);                                                                    // and its plain face
  stroke(g, s, .08, .08 + bb, -.2, -.3 + bb + sw * .5, Math.max(2, s * .05), INK);                              // the rifle: up across the shoulder, barrel behind it
};

// Shock trooper: a soldier in a helmet with a hand-held Tesla rifle: a long dark gun with a stock, copper coil windings along the barrel and a
// glowing ball at the muzzle.
const COPPER = '#c58b3a';
const shockTrooper = (g, o) => {
  const { s, dk, bb, sw } = body(g, o);
  helmet(g, s, bb, dk);
  const glow = o.run ? .6 + .4 * Math.sin(o.w * 11 + o.ph) : .7;
  g.save(); g.translate(-.02 * s, (.02 + bb + sw * .3) * s); g.rotate(-.3 + sw * .4);                           // held across the body, muzzle up, like a rifle
  box(g, s, -.22, -.03, .14, .065, 2, '#555a64');                                                              // the stock
  box(g, s, -.1, -.035, .42, .07, 2, '#3b3f48');                                                               // the long body and barrel
  for (const x of [.0, .08, .16, .24]) box(g, s, x, -.06, .03, .12, 1, COPPER);                                // coil windings all along it
  disc(g, s, .35, 0, .05 * glow + .03, 'rgba(159,232,255,.35)'); disc(g, s, .35, 0, .035, ARC);                // the glowing ball at the muzzle
  if (o.run) {                                                                                                 // a little arc that jumps about
    const j = ((Math.floor(o.w * 9 + o.ph) * 7) % 5 - 2) * .012;
    g.strokeStyle = ARC; g.lineWidth = Math.max(1.5, s * .014); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(.35 * s, 0); g.lineTo(.39 * s, (-.05 + j) * s); g.lineTo(.37 * s, (-.065 + j) * s); g.lineTo(.42 * s, (-.11 + j) * s); g.stroke();
  }
  g.restore();
};

// Fanatic: a plain soldier with a dark headband and a simple AK-47; his attack does not fall as he is hurt.
const simpleAk = (g, s, x, y, ang) => {   // a stock, one black body-and-barrel, a curved magazine
  g.save(); g.translate(x * s, y * s); g.rotate(ang);
  box(g, s, -.2, -.02, .12, .05, 1, WOOD);
  box(g, s, -.09, -.025, .38, .04, 1, INK);
  poly(g, s, [[.0, .015], [.06, .015], [.085, .11], [.03, .12]], '#3a2c20');
  g.restore();
};
const fanatic = (g, o) => {
  const { s, dk, bb, sw } = body(g, o);
  box(g, s, -.085, -.27 + bb, .17, .032, 1, dk);                                                                // a dark headband, high on the forehead
  simpleAk(g, s, -.02, .02 + bb + sw * .3, -.36 + sw * .4);
};

// K9 team: a handler (a plain soldier, a little smaller and further back) and a dog out in front on a lead.
const k9Team = (g, o) => {
  const { s, w, ph, run, moving } = o, walk = run && moving ? 1 : 0;
  g.save(); g.translate(-.13 * s, -.01 * s); g.scale(.82, .82);
  const { bb } = body(g, o); helmet(g, s, bb, o.dk);
  g.restore();
  const DOG = '#7b5a3a', DOG_DK = '#4c3624', t = w * 10 + ph, bob = Math.sin(t) * .008 * walk;
  for (const [x, p] of [[.1, 0], [.15, Math.PI], [.28, Math.PI], [.33, 0]]) stroke(g, s, x, .17 + bob, x + Math.sin(t + p) * .03 * walk, .28, Math.max(2, s * .028), DOG_DK);   // legs
  box(g, s, .06, .07 + bob, .3, .12, 6, DOG);                                                                   // body
  const wag = run ? Math.sin(w * 14 + ph) * .04 : 0;
  stroke(g, s, .07, .09 + bob, .0, .02 + bob + wag, Math.max(2, s * .03), DOG);                                 // the tail
  box(g, s, .31, .0 + bob, .12, .1, 4, DOG); box(g, s, .39, .04 + bob, .07, .05, 2, DOG);                       // head and muzzle
  disc(g, s, .455, .055 + bob, .014, INK); poly(g, s, [[.32, .01 + bob], [.35, -.06 + bob], [.37, .01 + bob]], DOG_DK);   // nose and an ear
  box(g, s, .3, .06 + bob, .05, .025, 1, o.c);                                                                  // a collar in the team colour
  stroke(g, s, -.02, .02, .31, .08 + bob, 1, '#2a2a2a');                                                        // the lead
};

// ---- vehicles ------------------------------------------------------------------------------------------------------------------
// Missile tank: the rocket buggy grown up: a squat tracked hull with heavy armour skirts and a front glacis, carrying a raised rack of three
// missiles side by side (white, red-nosed), angled up and forward.
const missileTank = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, rec = run ? Math.max(0, Math.sin(w * 1.1 + ph)) ** 8 * .02 : 0;
  treads(g, s, -.38, .38, .1 + jj, .18, w, run);
  box(g, s, -.38, .06 + jj, .76, .1, 3, dk);                                                                    // the heavy side skirt over the tracks
  poly(g, s, [[-.34, .08 + jj], [-.34, -.06 + jj], [.2, -.06 + jj], [.38, .02 + jj], [.38, .08 + jj]], c);      // the hull, with a sloped front plate
  poly(g, s, [[.2, -.06 + jj], [.38, .02 + jj], [.38, .05 + jj], [.2, -.02 + jj]], mix(c, dk, .45));            // its shaded slope
  const ang = -.75, ux = Math.cos(ang), uy = Math.sin(ang), Fx = -.24, Fy = -.1 + jj;
  stroke(g, s, -.1, -.05 + jj, Fx + ux * .2, Fy + uy * .2 + .04, Math.max(3, s * .04), dk);                      // the rack's support
  poly(g, s, [[Fx, Fy], [Fx + ux * .42, Fy + uy * .42], [Fx + ux * .42 + .04, Fy + uy * .42 - .05], [Fx + .04, Fy - .05]], dk);   // the rack
  for (const k of [0, 1, 2]) missile(g, s, Fx + .06 + (k - 1) * .045 * -uy - rec * ux, Fy - .05 + (k - 1) * .045 * ux - rec * uy, ang, .4, .06, '#e8e4d8', '#555a64', RED);   // three missiles side by side
};

// Remote technical: the technical with nobody in it: a radio mast on the cab with a blinking light.
const remoteTechnical = (g, o) => {
  VEHICLES.SPRITES.technical(g, o);
  const { s, j, w, ph, run } = o, jj = j / s, on = !run || Math.sin(w * 6 + ph) > 0;
  stroke(g, s, .12, -.14 + jj, .12, -.3 + jj, Math.max(1.5, s * .02), '#555a64');                               // the mast
  stroke(g, s, .07, -.25 + jj, .17, -.25 + jj, Math.max(1.5, s * .02), '#555a64');                              // its crossbar
  disc(g, s, .12, -.315 + jj, .025, on ? RED : '#7a2a1e');                                                       // the blinking light
};

// Bridge layer: a tank hull carrying a folded bridge on its back, the hinge toward the front.
const bridgeLayer = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s, BR = '#8d93a0';
  treads(g, s, -.36, .34, .1 + jj, .18, w, run);
  box(g, s, -.32, -.04 + jj, .62, .16, 4, c);
  box(g, s, .14, -.1 + jj, .14, .08, 2, dk);                                                                    // the cab
  poly(g, s, [[-.42, -.06 + jj], [.3, -.06 + jj], [.36, -.14 + jj], [-.36, -.14 + jj]], BR);                   // the lower span
  poly(g, s, [[-.36, -.14 + jj], [.36, -.14 + jj], [.3, -.22 + jj], [-.3, -.22 + jj]], shade(BR, .2));          // the upper span, folded back on it
  for (let i = 0; i < 5; i++) stroke(g, s, -.3 + i * .14, -.07 + jj, -.24 + i * .14, -.13 + jj, 1.5, shade(BR, -.3));   // its truss
  disc(g, s, .33, -.14 + jj, .035, INK);                                                                        // the hinge
};

// Inflatable decoy: a tank made of rubber: every part rounded and a little too soft, a valve on the hull and a patch; it sways gently.
const decoyTank = (g, { s, c, dk, w, ph, run }) => {
  const k = run ? Math.sin(w * 2 + ph) : 0;
  g.save(); g.translate(0, .29 * s); g.scale(1 + k * .015, 1 - k * .025); g.translate(0, -.29 * s);
  box(g, s, -.34, .1, .68, .18, .09 * s, '#3a3a3a');                                                           // rubber treads, no cleats
  for (const x of [-.22, -.07, .08, .23]) disc(g, s, x, .19, .045, '#4a4a4a');
  box(g, s, -.31, -.06, .62, .18, .08 * s, c);
  box(g, s, -.14, -.18, .28, .15, .07 * s, dk);
  box(g, s, .1, -.135, .26, .055, .027 * s, INK);                                                               // a soft, round-ended barrel
  disc(g, s, -.24, -.07, .022, '#e6e6e6'); box(g, s, -.25, -.11, .02, .04, 1, '#e6e6e6');                      // the valve
  box(g, s, .14, .0, .08, .06, 2, mix(c, '#ffffff', .35));                                                      // a patch
  g.restore();
};

// Smoke carrier: a truck with a bank of short smoke tubes tipped up over its bed; grey puffs drift off them.
const truck = (g, s, c, dk, w, run, jj, { cab = .16 } = {}) => {
  box(g, s, -.38, .04 + jj, .76, .12, 3, dk);                                                                   // chassis
  box(g, s, .38 - cab - .02, -.14 + jj, cab, .2, 4, c);                                                         // cab
  box(g, s, .38 - cab + .03, -.1 + jj, cab - .07, .08, 2, GLASS);
  wheels(g, s, [-.25, -.07, .24], .2, .075, w, run);
};
const smokeCarrier = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  truck(g, s, c, dk, w, run, jj);
  box(g, s, -.34, -.04 + jj, .5, .09, 2, c);                                                                    // the bed
  g.save(); g.translate(-.1 * s, (-.06 + jj) * s); g.rotate(-.55);
  for (let i = 0; i < 3; i++) box(g, s, -.04, -.11 + i * .06, .2, .05, 2, '#3b3f48');
  g.restore();
  if (run) for (let i = 0; i < 3; i++) { const f = (w * .35 + i / 3 + ph * .1) % 1; disc(g, s, .02 - f * .3, -.2 - f * .18, .04 + f * .07, `rgba(225,225,225,${(.7 * (1 - f)).toFixed(2)})`); }
};

// EMP truck: a truck carrying a coil tower with a ball on top; blue arcs crackle round it.
const empTruck = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  truck(g, s, c, dk, w, run, jj);
  box(g, s, -.3, -.06 + jj, .38, .1, 2, c);                                                                     // the generator housing
  box(g, s, -.15, -.24 + jj, .08, .2, 2, '#4a4f5a');                                                            // the coil
  for (let i = 0; i < 4; i++) box(g, s, -.18, -.22 + i * .045 + jj, .14, .022, 2, '#c58b3a');                   // copper windings
  disc(g, s, -.11, -.29 + jj, .055, '#d8dce2'); disc(g, s, -.125, -.305 + jj, .018, '#ffffff');
  if (run) {
    const t = Math.floor(w * 9 + ph);
    g.strokeStyle = ARC; g.lineWidth = Math.max(1.5, s * .014); g.lineJoin = 'round';
    for (let a = 0; a < 2; a++) {
      const ang = ((t * 2.3 + a * 3.1) % 6.28), r = .14;
      g.beginPath(); g.moveTo(-.11 * s, (-.29 + jj) * s);
      for (let k = 1; k <= 4; k++) { const f = k / 4, jx = ((t * 7 + k * 13 + a * 5) % 9 - 4) * .006; g.lineTo((-.11 + Math.cos(ang) * r * f + jx) * s, (-.29 + jj + Math.sin(ang) * r * f * .7 + jx) * s); }
      g.stroke();
    }
  }
};

// Tank destroyer: no turret, a low sloped casemate with a very long gun straight out of its front plate.
const tankDestroyer = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, rec = run ? Math.max(0, Math.sin(w * 1.4 + ph)) ** 8 * .03 : 0;
  treads(g, s, -.36, .32, .1 + jj, .18, w, run);
  box(g, s, .06 - rec, -.06 + jj, .44, .045, 1, INK); box(g, s, .44 - rec, -.07 + jj, .05, .065, 1, INK);      // the long gun
  poly(g, s, [[-.34, .12 + jj], [-.34, -.04 + jj], [-.22, -.12 + jj], [.1, -.12 + jj], [.24, .0 + jj], [.3, .12 + jj]], c);   // the casemate
  poly(g, s, [[-.2, -.12 + jj], [.1, -.12 + jj], [.14, -.08 + jj], [-.2, -.08 + jj]], dk);
  box(g, s, .1, -.08 + jj, .07, .08, 2, dk);                                                                    // the gun mantlet
};

// ---- Salvage Yard (Harlan's volunteers): old machines and scrap ------------------------------------------------------------------
// Salvager: a tracked scrap hauler with a crane arm and a claw, and a pile of scrap on its back.
const salvager = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  treads(g, s, -.34, .3, .1 + jj, .18, w, run);
  poly(g, s, [[-.36, -.02 + jj], [-.3, -.12 + jj], [-.18, -.15 + jj], [-.08, -.08 + jj], [-.14, -.02 + jj]], '#8a8478');   // scrap pile
  box(g, s, -.32, -.08 + jj, .1, .06, 1, RUST); box(g, s, -.22, -.13 + jj, .08, .05, 1, '#5a5f68');
  box(g, s, -.3, -.02 + jj, .58, .15, 4, c);                                                                    // the hull
  box(g, s, .08, -.14 + jj, .16, .13, 3, dk); box(g, s, .14, -.12 + jj, .08, .06, 1, GLASS);                    // the cab
  const sw = run ? Math.sin(w * 1.2 + ph) * .08 : 0, ax = -.02, ay = -.04 + jj;
  const ex = ax + .28, ey = ay - .22 + sw * .5;
  stroke(g, s, ax, ay, ex, ey, Math.max(3, s * .04), HAZARD);                                                   // the crane arm
  stroke(g, s, ex, ey, ex + .05, ey + .14, 1.5, INK);                                                           // its cable
  poly(g, s, [[ex + .0, ey + .14], [ex + .1, ey + .14], [ex + .12, ey + .21], [ex + .08, ey + .17], [ex + .02, ey + .17], [ex - .02, ey + .21]], '#3a3d44');   // the claw
};

// Broadcast truck: a truck with loudspeaker horns on a mast; rings of sound pulse from them.
const broadcastTruck = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  truck(g, s, c, dk, w, run, jj);
  box(g, s, -.34, -.08 + jj, .48, .12, 3, c);                                                                   // the box body
  box(g, s, -.28, -.05 + jj, .2, .05, 1, mix(c, '#ffffff', .5));                                                // a stripe
  stroke(g, s, -.1, -.08 + jj, -.1, -.24 + jj, Math.max(2, s * .025), '#555a64');                               // the mast
  for (const [dy, a] of [[-.27, -.25], [-.2, .2]]) {
    g.save(); g.translate(-.1 * s, (dy + jj) * s); g.rotate(a);
    poly(g, s, [[0, -.015], [.11, -.045], [.11, .045], [0, .015]], '#e6e8ee'); box(g, s, .1, -.045, .02, .09, 1, '#9aa0aa');   // a horn
    g.restore();
  }
  for (let i = 0; i < 2; i++) {
    const f = run ? (w * .8 + i / 2 + ph * .1) % 1 : (i + .5) / 2;
    g.strokeStyle = mix(c, '#ffffff', .5); g.globalAlpha = Math.min(1, (1 - f) * 1.4); g.lineWidth = 2.5;
    g.beginPath(); g.arc(.04 * s, (-.235 + jj) * s, (.04 + f * .16) * s, -.9, .9); g.stroke(); g.globalAlpha = 1;
  }
};

// ---- air -------------------------------------------------------------------------------------------------------------------------
// Armoured airship: a fat envelope with an armoured belly band and two tail fins, and a gondola with one big bomb slung under it.
const airship = (g, { s, c, dk }) => {
  poly(g, s, [[-.36, -.04], [-.46, -.17], [-.3, -.09]], dk); poly(g, s, [[-.36, .02], [-.46, .13], [-.3, .07]], dk);   // tail fins
  oval(g, s, 0, -.02, .42, .16, c);                                                                             // the envelope
  box(g, s, -.3, .05, .6, .04, 2, dk);                                                                          // the armoured belly band
  box(g, s, -.1, .1, .22, .07, 3, dk);                                                                          // the gondola
  stroke(g, s, 0, .17, 0, .21, 2, INK);
  oval(g, s, 0, .26, .06, .035, INK); poly(g, s, [[.045, .26], [.085, .26], [.045, .285]], RED);                // the bomb and its nose
  poly(g, s, [[-.055, .26], [-.085, .235], [-.085, .285]], INK);                                                // its tail
};

// Loitering drone: a small delta wing with a pusher propeller and a red warhead nose, circling as it waits.
const loiterDrone = (g, { s, c, dk, w, ph, run }) => {
  const a = run ? w * 1.4 + ph : 0;
  g.save(); g.translate(Math.cos(a) * .05 * s, Math.sin(a) * .025 * s);
  poly(g, s, [[.24, 0], [-.14, -.17], [-.08, 0], [-.14, .17]], dk);                                             // the far and near wings
  box(g, s, -.2, -.035, .42, .07, .035 * s, c);                                                                 // the fuselage
  poly(g, s, [[.22, -.035], [.31, 0], [.22, .035]], RED);                                                       // the warhead nose
  box(g, s, .02, -.05, .1, .03, 2, GLASS);                                                                      // the camera
  propDisc(g, s, -.22, 0, .06, w, run, ph);
  g.restore();
};

// ---- naval -------------------------------------------------------------------------------------------------------------------
// Q-ship: a harmless-looking cargo steamer stacked with containers; one container's side hangs open on a hidden gun. Only its funnel band
// carries the team colour, as a merchant would.
const qShip = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .6, HULL = '#4a4f58', CONT = ['#b8543a', '#3d7a8a', '#c9a23a'];
  afloat(g, s, w, run, -.44, .44, (light) => {
    g.save(); g.translate(0, bb * s);
    const hc = light ? HULL : mix(HULL, '#0a2a4a', .45);
    hullPath(g, s, { x0: -.44, x1: .44, deck: .02, keel: .22, rise: .05, sweep: .18 }); g.fillStyle = hc; g.fill();
    if (light) {
      box(g, s, -.42, .04, .82, .03, 1, '#c9c5b8');                                                             // a pale boot-top line
      for (let i = 0; i < 3; i++) box(g, s, -.08 + i * .13, -.1, .12, .12, 1, CONT[i]);                         // containers
      box(g, s, -.02, -.2, .12, .1, 1, CONT[1]);
      box(g, s, -.08, -.1, .02, .12, 0, '#23252b');                                                             // the open container: a dark hole
      box(g, s, .3, -.08, .05, .09, 1, CONT[0]);                                                                // its side, hanging open
      box(g, s, -.04, -.07, .16, .035, 1, INK);                                                                 // the hidden gun
      box(g, s, -.36, -.16, .2, .18, 2, '#e3e0d6'); box(g, s, -.33, -.13, .14, .04, 1, GLASS);                  // the bridge
      box(g, s, -.3, -.27, .07, .12, 1, '#2b2d33'); box(g, s, -.3, -.24, .07, .03, 0, c);                       // the funnel and its team band
      stroke(g, s, .16, .0, .34, -.24, 1.5, '#555a64');                                                         // a derrick
    } else propeller(g, s, -.44, .16, w, run, hc, true);
    g.restore();
  });
};

// ---- static defences (the units' flat style, bolted to a footing: src/render/art-defences.js) --------------------------------------------
// Coastal battery: a heavy casemate with a dark roof and a long naval gun; it fires out to sea.
const coastalBattery = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.38, .38);
  const rec = run ? Math.max(0, Math.sin(w * .9 + ph)) ** 8 * .04 : 0;
  box(g, s, .1 - rec, -.06, .34, .065, 1, INK); box(g, s, .39 - rec, -.075, .06, .095, 1, INK);                // the naval gun
  box(g, s, -.36, -.12, .52, .33, 4, c);                                                                        // the casemate
  box(g, s, -.38, -.17, .56, .08, 3, dk);                                                                       // its thick roof
  box(g, s, .06, -.07, .1, .09, 1, INK);                                                                        // the embrasure
};

// Barrage balloon: a winch hut on a footing and a fat silver balloon tethered high above it, bobbing.
const barrageBalloon = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.24, .2);
  const by = -.27 + (run ? Math.sin(w * 1.2 + ph) * .02 : 0), bx = .04;
  stroke(g, s, -.04, .04, bx - .04, by + .09, 1, '#555a64');                                                    // the cable
  poly(g, s, [[bx - .24, by], [bx - .31, by - .09], [bx - .2, by - .03]], c); poly(g, s, [[bx - .24, by], [bx - .31, by + .07], [bx - .2, by + .03]], c);   // fins
  oval(g, s, bx, by, .2, .1, '#d6d9de'); oval(g, s, bx + .02, by - .04, .13, .03, '#f2f3f5');
  box(g, s, bx - .12, by - .015, .04, .03, 1, c);
  box(g, s, -.2, .04, .36, .17, 4, c);                                                                          // the winch hut
  disc(g, s, -.04, .12, .05, dk); disc(g, s, -.04, .12, .02, STEEL);                                            // the drum
};

// Tank trap: three steel "hedgehogs" of crossed beams in plain grey (no owner, like the walls): vehicles cannot pass, infantry climb through.
const tankTrap = (g, { s, c, dk }) => {   // drawn in whatever colours it is given; the game and the gallery give it a fixed dark grey (render.fixedColors)
  const hog = (x, y, r) => {
    const t = Math.max(3, s * .06);
    stroke(g, s, x - r, y, x + r * .7, y - r * 1.6, t, dk);                                                     // the far beam
    stroke(g, s, x - r * 1.15, y - r * .7, x + r * 1.15, y - r * .95, t, mix(c, '#000000', .2));               // the cross beam
    stroke(g, s, x + r, y, x - r * .7, y - r * 1.6, t, c);                                                      // the near beam
  };
  hog(-.2, .22, .15); hog(.2, .22, .15); hog(0, .3, .17);
};

// Watchtower: timber legs carrying a team-coloured lookout cabin with a dark roof and a searchlight that sweeps.
const watchtower = (g, { s, c, dk, w, ph, run }) => {
  footing(g, s, -.24, .24, .07);
  for (const [x0, x1] of [[-.18, -.1], [.18, .1]]) stroke(g, s, x0, .22, x1, -.08, Math.max(2.5, s * .035), WOOD);   // legs
  stroke(g, s, -.15, .14, .14, .0, 2, WOOD); stroke(g, s, .15, .14, -.14, .0, 2, WOOD);                           // cross braces
  const a = run ? Math.sin(w * .8 + ph) * .45 : .2;
  g.save(); g.translate(.12 * s, -.15 * s); g.rotate(a);
  poly(g, s, [[0, 0], [.34, -.06], [.34, .06]], 'rgba(255,245,190,.3)'); g.restore();                            // the beam
  box(g, s, -.16, -.2, .3, .14, 3, c);                                                                          // the cabin
  box(g, s, -.1, -.17, .16, .045, 1, INK);                                                                      // its window slot
  poly(g, s, [[-.21, -.2], [-.01, -.3], [.19, -.2]], dk);                                                       // its roof
  disc(g, s, .14, -.14, .03, '#fff3b0');
};

export const SPRITES = {
  engineer, flame_trooper: flameTrooper, royal_guard: royalGuard, shock_trooper: shockTrooper, fanatic, k9_team: k9Team,
  bridge_layer: bridgeLayer, decoy_tank: decoyTank, smoke_carrier: smokeCarrier, emp_truck: empTruck, tank_destroyer: tankDestroyer,
  technical: VEHICLES.SPRITES.technical, remote_technical: remoteTechnical, missile_tank: missileTank, salvager, broadcast_truck: broadcastTruck,
  airship: (g, o) => { g.save(); g.scale(.95, .95); airship(g, o); g.restore(); }, loiter_drone: loiterDrone,
  q_ship: (g, o) => { g.save(); g.scale(.88, .88); qShip(g, o); g.restore(); },
  coastal_battery: coastalBattery, barrage_balloon: barrageBalloon, tank_trap: tankTrap, watchtower,
};

// ---- shadows ------------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const air = (rx, ry) => (g, { s, alt = 0 }) => { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, s * (.25 + alt * .35), rx * s, ry * s, 0, 0, 7); g.fill(); };
export const SHADOWS = {
  engineer: ground(.2, .04, .3), flame_trooper: ground(.22, .04, .3), royal_guard: ground(.2, .04, .3), shock_trooper: ground(.2, .04, .3), fanatic: ground(.2, .04, .3), k9_team: ground(.3, .045, .3, .05),
  bridge_layer: ground(.4, .05, .285), decoy_tank: ground(.36, .05, .285), smoke_carrier: ground(.4, .05, .285), emp_truck: ground(.4, .05, .285),
  tank_destroyer: ground(.38, .05, .285), technical: ground(.38, .05, .285), remote_technical: ground(.38, .05, .285), missile_tank: ground(.4, .05, .285), salvager: ground(.36, .05, .285), broadcast_truck: ground(.4, .05, .285),
  airship: air(.38, .05), loiter_drone: air(.2, .04), q_ship: () => {},
  coastal_battery: footShadow(-.38, .38, .05), barrage_balloon: footShadow(-.24, .2), tank_trap: ground(.4, .05, .3), watchtower: footShadow(-.24, .24, .06),
};
