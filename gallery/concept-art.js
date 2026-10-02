// Experimental concept units: sprites only. NOTHING here is in the game; the units are described in concepts.json and shown in the
// gallery's "Experimental" section. Same conventions as src/render/unit-art.js (which supplies the drawing helpers):
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
//   SHADOWS[name](g, { s, alt, w, ph, run })
import { PARTS } from '../src/render/unit-art.js';

const { box, disc, oval, poly, stroke, mirror, wheel, treads, mix, afloat, hullPath, propeller, skyClip, seaClip, GLASS, INK, STEEL, SKIN, UNDER_SHADE } = PARTS;
const BRASS = '#d9b44a', RED = '#d4442e', GREEN = '#46b86a', ORANGE = '#ff9a2e', PANEL = '#2f5fa8';

// ---- War Factory ----------------------------------------------------------------------------------------------------------
// Supply truck: a box body with a stack of shells painted on the side, a cab, three wheels.
const supplyTruck = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  box(g, s, -.36, .02 + jj, .72, .15, 3, dk);                                                // chassis
  box(g, s, -.36, -.2 + jj, .5, .24, 3, c);                                                  // cargo box
  box(g, s, -.36, -.03 + jj, .5, .04, 0, dk);                                                // skirt line
  for (let i = 0; i < 3; i++) {                                                              // shells stencilled on the box
    const x = -.28 + i * .12;
    box(g, s, x, -.14 + jj, .07, .13, 2, BRASS); poly(g, s, [[x, -.14 + jj], [x + .035, -.2 + jj], [x + .07, -.14 + jj]], RED);
  }
  box(g, s, .16, -.1 + jj, .2, .19, 3, dk); box(g, s, .21, -.07 + jj, .13, .08, 2, GLASS);   // cab and its window
  wheel(g, s, -.25, .2, .085, w, run, 10); wheel(g, s, -.04, .2, .085, w, run, 10); wheel(g, s, .26, .2, .085, w, run, 10);
};

// Rocket battery: a truck carrying a raised pod of tubes, tipped skyward, a pair of rockets showing at the muzzle.
const rocketBattery = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  box(g, s, -.36, .03 + jj, .72, .14, 3, dk);
  box(g, s, .17, -.08 + jj, .19, .17, 3, c); box(g, s, .22, -.05 + jj, .12, .07, 2, GLASS);   // cab
  box(g, s, -.32, -.02 + jj, .44, .06, 2, c);                                                // flatbed
  const rec = Math.max(0, Math.sin(w * 1.4 + ph)) * .018 * run;                              // the pod rocks back as if firing
  g.save(); g.translate(-.1 * s, -.02 * s + j); g.rotate(-.62);
  box(g, s, -.05 - rec, -.1, .46, .2, 3, dk);                                                // the pod
  box(g, s, -.02 - rec, -.075, .4, .05, 1, c); box(g, s, -.02 - rec, .025, .4, .05, 1, c);   // two rows of tubes
  box(g, s, .34 - rec, -.075, .12, .045, 1, STEEL); box(g, s, .34 - rec, .03, .12, .045, 1, STEEL);   // the rockets
  poly(g, s, [[.46 - rec, -.075], [.52 - rec, -.052], [.46 - rec, -.03]], RED); poly(g, s, [[.46 - rec, .03], [.52 - rec, .052], [.46 - rec, .075]], RED);
  g.restore();
  box(g, s, -.12, -.0 + jj, .05, .05, 1, '#3b3b3b');                                         // the pivot
  wheel(g, s, -.25, .2, .085, w, run, 10); wheel(g, s, -.04, .2, .085, w, run, 10); wheel(g, s, .26, .2, .085, w, run, 10);
};

// ---- Hover Lab --------------------------------------------------------------------------------------------------------------
// A hovercraft rides on an air cushion: a dark flexible skirt along the bottom, puffs of dust or spray blowing out under it, and a
// ducted fan at the back. The three hulls differ in size, not in how they hover.
const skirt = (g, s, x0, x1, y, w, run) => {
  box(g, s, x0, y, x1 - x0, .075, .035 * s, '#2b2f36');
  for (let i = 0; i < 5; i++) {                                                              // dust blowing out from under the skirt
    const f = (w * 1.3 + i * .21) % 1, x = x0 + (i / 4) * (x1 - x0) + (i % 2 ? 0 : -.01);
    oval(g, s, x - f * .05, y + .085 - f * .02, .035 * (1 - f * .4), .016, `rgba(255,255,255,${(run ? .38 * (1 - f) : .2).toFixed(2)})`);
  }
};
const fan = (g, s, x, y, r, w, run, col) => {                                                // a ducted fan seen from the side: a ring and a flickering blade
  box(g, s, x - .035, y - r, .07, r * 2, 2, col);
  const l = (run ? Math.abs(Math.cos(w * 24)) : .6) * r * .9 + r * .1;
  stroke(g, s, x, y - l, x, y + l, 2.5, INK);
};

const hoverScout = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  skirt(g, s, -.3, .34, .17 + jj, w, run);
  poly(g, s, [[-.32, .17 + jj], [-.3, .02 + jj], [-.1, -.05 + jj], [.14, -.05 + jj], [.4, .07 + jj], [.36, .17 + jj]], c);   // low wedge hull
  poly(g, s, [[.14, -.05 + jj], [.4, .07 + jj], [.3, .07 + jj], [.1, -.0 + jj]], mix(c, dk, .4));
  oval(g, s, .06, -.06 + jj, .1, .055, GLASS);                                               // bubble canopy
  box(g, s, -.12, -.2 + jj, .03, .14, 1, STEEL); disc(g, s, -.105, -.21 + jj, .03, dk);      // mast with a small sensor dish
  fan(g, s, -.36, -.0 + jj, .12, w, run, dk);
};

const hoverTank = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  skirt(g, s, -.36, .36, .17 + jj, w, run);
  box(g, s, -.36, -.02 + jj, .72, .2, 5, c);                                                 // wide hull
  poly(g, s, [[.36, .0 + jj], [.4, .1 + jj], [.36, .17 + jj]], c);                           // sloped nose
  box(g, s, -.1, -.17 + jj, .28, .16, 4, dk);                                                // turret
  const rec = Math.max(0, Math.sin(w * 1.6 + ph)) * .012 * run;
  g.fillStyle = INK; g.fillRect((.16 - rec) * s, (-.12 + jj) * s, s * .28, s * .04);         // gun
  box(g, s, -.02, -.2 + jj, .08, .05, 1, GLASS);                                             // commander's hatch
  fan(g, s, -.4, .03 + jj, .12, w, run, dk); fan(g, s, -.4, .12 + jj, .06, w, run, dk);
};

const hoverCarrier = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  skirt(g, s, -.4, .4, .18 + jj, w, run);
  box(g, s, -.4, -.14 + jj, .8, .33, 6, c);                                                  // long box hull
  poly(g, s, [[.4, -.1 + jj], [.4, .19 + jj], [.28, .19 + jj], [.28, -.1 + jj]], dk);       // bow ramp, folded up
  box(g, s, .3, -.07 + jj, .06, .22, 1, mix(dk, '#ffffff', .2));
  for (let i = 0; i < 4; i++) box(g, s, -.3 + i * .15, -.06 + jj, .09, .09, 2, GLASS);       // troop windows
  box(g, s, -.4, -.14 + jj, .8, .04, 2, dk);                                                 // roofline stripe
  box(g, s, .05, -.2 + jj, .13, .07, 2, dk); box(g, s, .08, -.19 + jj, .08, .04, 1, GLASS); // cockpit bump
  fan(g, s, -.44, .0 + jj, .15, w, run, dk);
};

// ---- Mech Factory -----------------------------------------------------------------------------------------------------------
// Legged walkers. A leg swings from the hip to a foot that lifts and plants; they only step while the unit is moving.
const leg = (g, s, hx, hy, ph, w, walk, thick, col, len = .17) => {
  const a = w * 6 + ph, fx = hx + Math.sin(a) * .08 * walk, lift = Math.max(0, Math.cos(a)) * .05 * walk;
  const fy = .27 - lift, kx = hx + .09 + Math.sin(a) * .03 * walk, ky = hy + (fy - hy) * .45;
  stroke(g, s, hx, hy, kx, ky, thick, col); stroke(g, s, kx, ky, fx, fy - .02, thick * .9, col);
  box(g, s, fx - .05, fy - .035, .12, .06, 2, INK);
  void len;
};
const strider = (g, { s, c, dk, w, run, moving, b }) => {
  const walk = run && moving ? 1 : 0, bb = b / s;
  leg(g, s, -.1, -.0 + bb, 0, w, walk, 7, dk); leg(g, s, .06, -.0 + bb, Math.PI, w, walk, 7, mix(dk, '#ffffff', .15));
  box(g, s, -.26, -.2 + bb, .46, .24, 5, c);                                                 // torso
  box(g, s, -.28, -.16 + bb, .1, .16, 3, dk);                                                // backpack
  box(g, s, .06, -.17 + bb, .17, .09, 3, GLASS);                                             // cockpit slit
  box(g, s, .12, -.07 + bb, .31, .06, 2, INK); box(g, s, .1, -.1 + bb, .12, .12, 2, dk);     // cannon in its mantlet
  box(g, s, .41, -.085 + bb, .05, .09, 1, STEEL);
};

const titan = (g, { s, c, dk, w, run, moving, b }) => {
  const walk = run && moving ? 1 : 0, bb = b / s;
  leg(g, s, -.14, .02 + bb, 0, w, walk, 11, dk); leg(g, s, .1, .02 + bb, Math.PI, w, walk, 11, mix(dk, '#ffffff', .15));
  box(g, s, -.3, -.28 + bb, .6, .34, 6, c);                                                  // huge torso
  box(g, s, -.3, -.04 + bb, .6, .06, 2, dk);                                                 // belt
  box(g, s, -.34, -.38 + bb, .24, .16, 3, dk);                                               // shoulder armour
  box(g, s, -.04, -.4 + bb, .17, .13, 4, dk); box(g, s, .02, -.37 + bb, .1, .045, 1, GLASS); // head
  const glow = run ? .6 + .4 * Math.sin(w * 6) : .5;
  oval(g, s, -.34, -.1 + bb, .035, .08, `rgba(255,150,40,${glow.toFixed(2)})`);              // reactor vent
  box(g, s, .08, -.25 + bb, .38, .075, 2, INK); box(g, s, .08, -.15 + bb, .38, .075, 2, INK); // twin cannons
  box(g, s, .06, -.27 + bb, .1, .21, 2, dk);
  box(g, s, .44, -.26 + bb, .05, .1, 1, STEEL); box(g, s, .44, -.16 + bb, .05, .1, 1, STEEL);
};

// ---- Stealth Lab ------------------------------------------------------------------------------------------------------------
// Cloaked units: faceted, dull, a little see-through, with a bright glint that sweeps across them (the cloak shimmering).
const shimmer = (g, s, w, run, clipPts, x0 = -.4, x1 = .4) => {
  const k = run ? ((w * .5) % 1) : .35, x = x0 + (x1 - x0) * k;
  g.save(); g.beginPath(); clipPts.forEach(([px, py], i) => (i ? g.lineTo(px * s, py * s) : g.moveTo(px * s, py * s))); g.closePath(); g.clip();
  poly(g, s, [[x - .02, -.4], [x + .06, -.4], [x + .0, .4], [x - .08, .4]], 'rgba(255,255,255,.28)');
  g.restore();
};

const phantomTank = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  g.save(); g.globalAlpha = .88;
  treads(g, s, -.34, .34, .1 + jj, .17, w, run);
  const hull = [[-.34, .1 + jj], [-.3, -.02 + jj], [-.12, -.12 + jj], [.14, -.12 + jj], [.36, .0 + jj], [.4, .1 + jj]];
  poly(g, s, hull, mix(c, dk, .35));
  poly(g, s, [[-.12, -.12 + jj], [.14, -.12 + jj], [.36, .0 + jj], [-.3, -.02 + jj]], mix(c, '#ffffff', .12));   // the lit top plane
  poly(g, s, [[-.3, -.02 + jj], [.36, .0 + jj], [.4, .1 + jj], [-.34, .1 + jj]], dk);        // the dark side plane
  box(g, s, .08, -.09 + jj, .1, .03, 1, GLASS);                                              // a slit sensor
  g.fillStyle = INK; g.fillRect(s * .3, (-.04 + jj) * s, s * .17, s * .035);                 // gun, barely out of the nose
  shimmer(g, s, w, run, hull);
  g.restore();
};

const stealthCopter = (g, { s, c, dk, w, run }) => {
  const body = [[.42, .04], [.2, -.1], [-.08, -.14], [-.3, -.04], [-.46, -.1], [-.5, -.1], [-.4, .04], [-.2, .11], [.2, .11]];
  g.save(); g.globalAlpha = .9;
  poly(g, s, [[-.4, -.04], [-.52, -.2], [-.47, -.2], [-.34, -.06]], dk);                      // canted tail fin
  poly(g, s, body, mix(c, dk, .3));
  poly(g, s, [[-.08, -.14], [.2, -.1], [.42, .04], [-.3, -.04]], mix(c, '#ffffff', .12));    // lit top plane
  poly(g, s, [[.3, .0], [.17, -.05], [.08, -.02], [.22, .03]], GLASS);                        // slit canopy
  const rl = (run ? Math.abs(Math.cos(w * 22)) : .6) * s * .34 + s * .05;                     // pale rotor blur
  stroke(g, s, -rl / s, -.19, rl / s, -.19, 2.5, 'rgba(34,34,34,.6)'); g.fillStyle = INK; g.fillRect(-s * .02, -s * .2, s * .04, s * .07);
  shimmer(g, s, w, run, body, -.5, .45);
  g.restore();
};

// Spy: a long dark coat, a wide-brimmed hat pulled low and a briefcase; the cloak makes him a little see-through.
const spy = (g, { s, c, dk, w, ph, run, moving, b }) => {
  const walk = run && moving ? 1 : 0, l = Math.sin(w * 8 + ph) * s * .05 * walk, bb = b / s;
  g.save(); g.globalAlpha = .9;
  g.fillStyle = INK; g.fillRect(-s * .12, s * .14, s * .09, s * .15 + l); g.fillRect(s * .03, s * .14, s * .09, s * .15 - l);   // legs
  poly(g, s, [[-.17, -.12 + bb], [.17, -.12 + bb], [.21, .2], [-.21, .2]], mix(c, dk, .55));   // long coat
  poly(g, s, [[-.02, -.1 + bb], [.1, -.1 + bb], [.1, .2], [.0, .2]], mix(c, '#ffffff', .1));   // coat's open front
  box(g, s, -.17, -.02 + bb, .34, .035, 1, dk);                                              // belt
  disc(g, s, 0, -.2 + bb, .085, SKIN);
  box(g, s, -.07, -.215 + bb, .15, .035, 1, '#1b1b22');                                      // eye mask
  oval(g, s, .01, -.24 + bb, .17, .03, '#23242c'); box(g, s, -.08, -.33 + bb, .17, .1, 3, '#23242c'); box(g, s, -.08, -.255 + bb, .17, .02, 0, c);   // fedora
  box(g, s, .15, .05 + bb, .13, .1, 2, '#6b4a2b'); box(g, s, .19, .03 + bb, .05, .03, 1, '#3a2a18');   // briefcase
  g.restore();
};

// ---- Glider Field -----------------------------------------------------------------------------------------------------------
// Unpowered aircraft, drawn like the fighter and bomber (3/4 view: the near wing sweeps toward the viewer). Canvas-coloured wings.
const sail = (c) => mix(c, '#efe3c4', .6);
const troopGlider = (g, { s, c, dk }) => {
  const far = mix(sail(c), dk, .4), near = sail(c);
  poly(g, s, [[.1, -.04], [.0, -.22], [-.12, -.22], [-.1, -.04]], far);                       // far wing
  poly(g, s, [[-.3, -.05], [-.36, -.13], [-.43, -.13], [-.4, -.04]], far);                    // far tailplane
  poly(g, s, [[-.18, -.05], [-.3, -.2], [-.4, -.2], [-.4, -.05]], mix(c, dk, .15));           // tail fin
  box(g, s, -.42, -.1, .84, .17, s * .06, c);                                                // plump fuselage
  poly(g, s, [[.42, -.02], [.34, -.1], [.24, -.1], [.2, .07], [.42, .07]], GLASS);            // glazed nose
  for (let i = 0; i < 3; i++) box(g, s, -.28 + i * .1, -.05, .06, .05, 1, INK);               // troop windows
  box(g, s, -.42, .04, .84, .03, 1, mix(c, dk, .45));                                        // belly shade
  poly(g, s, [[.14, .07], [-.06, .34], [-.2, .34], [-.2, .07]], near);                        // near wing: long, straight, canvas
  stroke(g, s, -.02, .07, -.05, .3, 1.2, dk);                                                // a rib
  poly(g, s, [[-.28, .06], [-.36, .16], [-.44, .16], [-.4, .06]], near);                      // near tailplane
  box(g, s, -.1, .06, .3, .025, 1, dk); box(g, s, .0, .06, .02, .06, 0, dk);                 // landing skid
};

const scoutGlider = (g, { s, c, dk, w, run }) => {
  const sway = run ? Math.sin(w * 2.2) * .012 : 0;
  g.save(); g.translate(0, sway * s);
  poly(g, s, [[.3, -.04], [-.38, -.3], [-.3, -.04], [-.38, .22]].map(([x, y]) => [x, y - .02]), sail(c));        // a delta kite
  poly(g, s, [[.3, -.06], [-.38, -.32], [-.34, -.22], [.04, -.08]], mix(sail(c), '#ffffff', .25));   // lit upper half
  poly(g, s, [[.3, -.06], [-.38, .2], [-.3, -.06]], mix(c, dk, .25));                         // faction-coloured lower panel
  stroke(g, s, .3, -.06, -.3, -.06, 2, dk);                                                  // keel pole
  stroke(g, s, -.02, -.07, -.05, .13, 1.4, STEEL); stroke(g, s, -.12, -.07, -.1, .13, 1.4, STEEL);   // hang straps
  box(g, s, -.14, .1, .15, .075, 3, c);                                                      // the pilot, prone in a harness
  disc(g, s, .03, .12, .04, SKIN); box(g, s, .0, .085, .05, .025, 1, dk);                    // head and helmet
  g.restore();
};

// ---- Space Port -------------------------------------------------------------------------------------------------------------
const dropPod = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  const fl = run ? .6 + .4 * Math.sin(w * 30) : .4;
  for (const x of [-.14, .14]) { stroke(g, s, x * .8, .12 + jj, x * 1.6, .27, 3, INK); box(g, s, x * 1.6 - .04, .26, .08, .03, 1, INK); }   // landing legs
  poly(g, s, [[-.05, .2 + jj], [.05, .2 + jj], [.0, .2 + jj + .09 * fl]], ORANGE);           // retro-rocket flame
  oval(g, s, 0, -.04 + jj, .17, .27, c);                                                     // egg-shaped capsule
  oval(g, s, .06, -.1 + jj, .075, .1, GLASS);                                                // window
  box(g, s, -.17, .0 + jj, .34, .045, 1, dk);                                                // band
  poly(g, s, [[-.1, .17 + jj], [.1, .17 + jj], [.07, .24 + jj], [-.07, .24 + jj]], '#3a3d45');   // scorched heat shield
  box(g, s, -.22, -.13 + jj, .045, .16, 2, dk); box(g, s, .175, -.13 + jj, .045, .16, 2, dk);   // thrusters on the sides
  box(g, s, -.04, -.31 + jj, .08, .05, 2, STEEL);                                            // parachute canister
};

const shuttle = (g, { s, c, dk, w, run }) => {
  const fl = (run ? .6 + .4 * Math.sin(w * 40) : .3) * s * .08;
  const hull = mix('#ffffff', c, .12), tile = '#3a3d45';
  for (const y of [-.035, .0, .035]) poly(g, s, [[-.38, y - .012], [-.38 - fl / s, y], [-.38, y + .012]], ORANGE);   // engine plumes
  poly(g, s, [[.0, -.05], [-.12, -.2], [-.2, -.2], [-.18, -.05]], mix(c, dk, .6));            // far wing
  poly(g, s, [[-.14, -.05], [-.26, -.2], [-.36, -.2], [-.36, -.05]], hull);                   // tail fin
  poly(g, s, [[-.26, -.2], [-.36, -.2], [-.36, -.17], [-.27, -.17]], c);
  box(g, s, -.38, -.07, .84, .14, s * .07, hull);                                            // round-bodied fuselage
  poly(g, s, [[.46, .0], [.4, -.07], [.28, -.07], [.28, .07], [.4, .07]], tile);             // heat-tiled nose
  box(g, s, .22, -.07, .1, .035, 1, GLASS);                                                  // flight deck windows
  box(g, s, -.38, .03, .8, .04, 2, tile);                                                    // black belly tiles
  poly(g, s, [[.16, .06], [-.08, .34], [-.3, .34], [-.3, .06]], hull);                        // near delta wing
  poly(g, s, [[.16, .06], [-.08, .34], [-.02, .34], [.2, .06]], c);                           // faction-coloured leading edge
  for (const y of [-.035, .0, .035]) box(g, s, -.4, y - .014, .04, .028, 1, '#2a2a2a');       // nozzles
};

const satellite = (g, { s, c, dk, w, run }) => {
  const sway = run ? Math.sin(w * 1.2) * .015 : 0;
  g.save(); g.rotate(sway);
  for (const dir of [-1, 1]) {                                                               // solar wings with a cell grid
    const x0 = dir * .09, x1 = dir * .46;
    box(g, s, Math.min(x0, x1), -.1, .37, .2, 1, '#243f73');
    g.strokeStyle = '#6f95d6'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const x = (x0 + (x1 - x0) * i / 4) * s; g.beginPath(); g.moveTo(x, -.1 * s); g.lineTo(x, .1 * s); g.stroke(); }
    g.beginPath(); g.moveTo(Math.min(x0, x1) * s, 0); g.lineTo(Math.max(x0, x1) * s, 0); g.stroke();
    box(g, s, Math.min(x0, x1), -.1, .37, .028, 1, c);                                       // faction-coloured frame
  }
  box(g, s, -.11, -.14, .22, .28, 3, '#d6bf72');                                             // gold-foil bus
  box(g, s, -.11, -.14, .22, .06, 2, c); box(g, s, -.11, .08, .22, .06, 2, dk);
  stroke(g, s, 0, -.14, 0, -.26, 1.6, STEEL); oval(g, s, .0, -.28, .08, .035, '#e8e8ee');    // dish
  const pulse = run ? .5 + .5 * Math.sin(w * 6) : .4;
  disc(g, s, 0, .0, .045, '#2a2a30'); disc(g, s, 0, .0, .028 + pulse * .01, `rgba(255,70,50,${(.6 + .4 * pulse).toFixed(2)})`);   // the weapon lens
  g.restore();
};

// ---- Underwater Lab ---------------------------------------------------------------------------------------------------------
const bubbles = (g, s, w, run, x, y, n = 3) => {
  if (!run) return;
  for (let i = 0; i < n; i++) { const f = (w * 1.1 + i / n) % 1; oval(g, s, x + Math.sin(w * 5 + i * 2) * .02, y - f * .25, .014, .014, `rgba(200,225,250,${(.65 * (1 - f)).toFixed(2)})`); }
};

// Abyss sub: a deep diver. Round pressure hull, a big viewport throwing a cone of light, a claw arm; always drawn under water.
const abyssSub = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .45);
  g.save(); g.translate(0, bb * s);
  const beam = run ? .2 + .06 * Math.sin(w * 3) : .18;
  poly(g, s, [[.34, -.03], [.5, -.09], [.5, .07]], `rgba(255,240,150,${beam.toFixed(2)})`);   // the searchlight's cone
  propeller(g, s, -.43, .0, w, run, dk, false);
  poly(g, s, [[-.4, -.08], [-.5, -.17], [-.45, -.17], [-.34, -.08]], dk);                    // tail fin
  oval(g, s, 0, 0, .39, .19, col);                                                           // round pressure hull
  oval(g, s, -.02, -.09, .3, .06, mix(col, '#ffffff', .15));                                 // lit upper curve
  disc(g, s, .22, -.01, .1, '#1c2733'); disc(g, s, .22, -.01, .075, '#79d3ff'); disc(g, s, .2, -.035, .022, '#ffffff');   // the viewport
  poly(g, s, [[.3, .01], [.36, -.02], [.36, .03]], '#fff3a8');                                // lamp
  box(g, s, -.1, -.22, .14, .07, 2, col);                                                     // small sail
  stroke(g, s, .12, .15, .24, .26, 3, dk); stroke(g, s, .24, .26, .33, .2, 3, dk);            // manipulator arm
  stroke(g, s, .33, .2, .37, .24, 2, STEEL); stroke(g, s, .33, .2, .39, .17, 2, STEEL);       // claw
  disc(g, s, -.12, .17, .03, STEEL);                                                         // thruster pod
  g.restore();
  bubbles(g, s, w, run, -.2, -.12);
};

// Mine layer: a low work boat; mines in a rack on its stern deck, one of them just rolled off the ramp.
const mine = (g, s, x, y, r, c) => {
  g.save(); g.translate(x * s, y * s);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; stroke(g, s, Math.cos(a) * r * .8, Math.sin(a) * r * .8, Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 2, INK); }
  g.restore();
  disc(g, s, x, y, r, c);
  disc(g, s, x - r * .3, y - r * .3, r * .28, '#8d96a6');
};
const mineLayer = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s, D = .05, H = { x0: -.4, x1: .42, deck: D, keel: .3, rise: .02, sweep: .18 };
  afloat(g, s, w, run, -.4, .42, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.42, .27, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      box(g, s, .08, D - .17, .22, .17, 3, c); box(g, s, .11, D - .14, .16, .03, 1, GLASS);    // wheelhouse, forward
      stroke(g, s, .2, D - .17, .2, D - .26, 1.6, INK);                                       // mast
      box(g, s, -.36, D - .035, .4, .035, 1, dk);                                             // rail along the stern deck
      for (let i = 0; i < 3; i++) mine(g, s, -.3 + i * .12, D - .1, .045, INK);               // the mines, in a rack
      box(g, s, -.14, D - .22, .035, .15, 1, dk); box(g, s, -.14, D - .22, .12, .03, 1, dk);  // a derrick over the rack
      mine(g, s, -.44, D + .1, .05, '#2d3138');                                               // one just dropped astern
    }
    g.restore();
  });
};

// Torpedo drone: a small unmanned torpedo that runs on the surface, a red warhead in front, a trail of bubbles behind.
const torpedoDrone = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s * .5;
  afloat(g, s, w, run, -.4, .4, (light) => {
    const col = light ? c : dk;
    g.save(); g.translate(0, bb * s + .01 * s);
    oval(g, s, 0, .08, .38, .1, col);                                                         // torpedo body
    poly(g, s, [[.28, .0], [.42, .08], [.28, .16]], light ? RED : mix(RED, '#000000', .4));   // the warhead
    box(g, s, -.1, .05, .22, .03, 1, light ? dk : '#222');                                   // band
    poly(g, s, [[-.3, .03], [-.4, -.07], [-.34, -.07], [-.22, .03]], dk);                    // fin
    propeller(g, s, -.41, .08, w, run, dk, false);
    if (light) { stroke(g, s, -.02, .0, -.02, -.16, 1.6, INK); disc(g, s, -.02, -.17, .02, RED); }   // whip antenna with a blinking tip
    g.restore();
  }, .14);
  bubbles(g, s, w, run, -.46, .24, 4);
};

// ---- Drone Bay --------------------------------------------------------------------------------------------------------------
// A quadcopter: body, four rotor discs (a blur of one blade) and a camera eye.
const quad = (g, s, x, y, k, c, dk, w, run, ph, eye = RED) => {
  const bob = run ? Math.sin(w * 4 + ph) * .012 : 0;
  g.save(); g.translate(x * s, (y + bob) * s); g.scale(k, k);
  for (const dx of [-.2, .2]) {
    stroke(g, s, 0, 0, dx, -.05, 2, dk);
    const l = (run ? Math.abs(Math.cos(w * 26 + ph + dx * 9)) : .6) * .13 + .03;
    stroke(g, s, dx - l, -.06, dx + l, -.06, 2, INK); box(g, s, dx - .008, -.07, .016, .025, 0, INK);
  }
  box(g, s, -.1, -.04, .2, .09, 4, c); box(g, s, -.06, .0, .12, .04, 2, dk);
  disc(g, s, .1, .02, .035, '#15161c'); disc(g, s, .1, .02, .018, eye);
  g.restore();
};
const swarmDrones = (g, { s, c, dk, w, run }) => {
  quad(g, s, .06, .1, .95, c, dk, w, run, 0);
  quad(g, s, -.2, -.12, .7, c, dk, w, run, 1.7);
  quad(g, s, -.1, .27, .6, c, dk, w, run, 3.1);
  quad(g, s, .22, -.22, .52, c, dk, w, run, 4.2);
};
const repairDrone = (g, { s, c, dk, w, run }) => {
  const bob = run ? Math.sin(w * 4) * .012 : 0, t = run ? w : 0;
  g.save(); g.translate(0, bob * s);
  for (const dx of [-.26, .26]) {
    stroke(g, s, 0, -.02, dx, -.1, 3, dk);
    const l = (run ? Math.abs(Math.cos(w * 26 + dx * 8)) : .6) * .15 + .03;
    stroke(g, s, dx - l, -.11, dx + l, -.11, 3, INK); box(g, s, dx - .01, -.125, .02, .03, 0, INK);
  }
  box(g, s, -.17, -.08, .34, .2, 6, c);                                                      // body
  box(g, s, -.05, -.06, .1, .035, 1, '#ffffff'); box(g, s, -.017, -.075, .035, .1, 1, '#ffffff');   // white cross...
  box(g, s, -.045, -.055, .09, .025, 0, GREEN); box(g, s, -.012, -.07, .025, .09, 0, GREEN);          // ...with a green one on it
  box(g, s, -.17, .06, .34, .04, 2, dk);
  disc(g, s, .13, .0, .035, '#15161c'); disc(g, s, .13, .0, .018, GREEN);                    // camera eye
  stroke(g, s, .06, .12, .12, .22, 3, STEEL); stroke(g, s, .12, .22, .2, .2, 3, STEEL);      // arm with a wrench head
  disc(g, s, .2, .2, .035, STEEL); disc(g, s, .2, .2, .018, '#16161b'); box(g, s, .22, .19, .07, .02, 1, STEEL);
  if (run) for (let i = 0; i < 3; i++) { const f = (t * 3 + i / 3) % 1; disc(g, s, .24 + (i - 1) * .03, .25 + f * .06, .012 * (1 - f), `rgba(255,214,90,${(1 - f).toFixed(2)})`); }   // sparks
  g.restore();
};

export const SPRITES = {
  supply_truck: supplyTruck, rocket_battery: rocketBattery,
  hover_scout: hoverScout, hover_tank: hoverTank, hover_carrier: hoverCarrier,
  strider, titan,
  phantom_tank: phantomTank, stealth_copter: (g, o) => { g.save(); g.scale(.9, .9); stealthCopter(g, o); g.restore(); }, spy,
  troop_glider: (g, o) => { g.save(); g.scale(.92, .92); troopGlider(g, o); g.restore(); }, scout_glider: scoutGlider,
  drop_pod: dropPod, shuttle: (g, o) => { g.save(); g.scale(.95, .95); shuttle(g, o); g.restore(); }, satellite,
  abyss_sub: (g, o) => { g.save(); g.scale(.95, .95); abyssSub(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
  mine_layer: (g, o) => { g.save(); g.scale(.88, .88); mineLayer(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
  torpedo_drone: (g, o) => { g.save(); g.scale(.9, .9); torpedoDrone(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
  swarm_drones: swarmDrones, repair_drone: repairDrone,
};

// ---- shadows ----------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
/** A shadow thrown below a flying (or hovering) unit: the outline flattened and dropped. */
const airShadow = (outline, k = 1) => (g, { s, alt = 0 }) => {
  g.save(); g.translate(0, s * (.25 + alt * .35)); g.scale(s * k, s * .3 * k);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); outline.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.restore();
};
const bar = (hw) => mirror([[hw, 0], [hw * .8, -.07], [-hw * .8, -.07], [-hw, 0]]);

export const SHADOWS = {
  supply_truck: ground(.35, .05, .285), rocket_battery: ground(.35, .05, .285),
  hover_scout: ground(.34, .045, .29), hover_tank: ground(.38, .05, .29), hover_carrier: ground(.42, .05, .29),
  strider: ground(.24, .045, .295), titan: ground(.34, .055, .295),
  phantom_tank: ground(.34, .05, .275), stealth_copter: airShadow(mirror([[.4, .0], [.2, -.1], [-.1, -.12], [-.4, -.06], [-.45, 0]]), .9), spy: ground(.18, .04, .3),
  troop_glider: airShadow(mirror([[.42, 0], [.1, -.08], [-.06, -.4], [-.2, -.4], [-.2, -.07], [-.4, -.12], [-.42, 0]]), .92),
  scout_glider: airShadow(mirror([[.3, 0], [-.38, -.3], [-.3, 0]])),
  drop_pod: ground(.2, .045, .29), shuttle: airShadow(mirror([[.46, 0], [.4, -.07], [.0, -.07], [-.1, -.36], [-.3, -.36], [-.3, -.05], [-.38, -.05], [-.38, 0]]), .95),
  satellite: airShadow(bar(.46)),
  abyss_sub: none, mine_layer: none, torpedo_drone: none,
  swarm_drones: airShadow(mirror([[.3, 0], [.15, -.08], [-.2, -.08], [-.3, 0]])), repair_drone: airShadow(bar(.3)),
};
