// Experimental concept units: sprites only. NOTHING here is in the game; the units are described in concepts.json and shown in the
// gallery's "Experimental" section. Same conventions as src/render/unit-art.js (which supplies the drawing helpers):
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
//   SHADOWS[name](g, { s, alt, w, ph, run })
import { box, disc, oval, poly, stroke, mirror, wheel, treads, mix, afloat, hullPath, propeller, skyClip, seaClip, GLASS, INK, STEEL, SKIN, UNDER_SHADE, walkerLeg, pillarLeg, antigrav, hoverTubes, sheen, bubbles, GLOW } from '../src/render/parts.js';
import * as INFANTRY from '../src/render/art-infantry.js';
import * as STATIC from './concept-art-static.js';
import * as AIR from '../src/render/art-air.js';
import * as SHIPS from '../src/render/art-ships.js';
import * as VEHICLES from './concept-art-vehicles.js';
import * as FLEET from './concept-art-fleet.js';
import * as MECHS from './concept-art-mechs.js';

const BRASS = '#d9b44a', RED = '#d4442e', GREEN = '#46b86a', ORANGE = '#ff9a2e', PANEL = '#2f5fa8';

// ---- War Factory ----------------------------------------------------------------------------------------------------------
// Supply truck: a dark box body for the cargo, a faction-coloured cab and chassis with a window, three wheels.
const supplyTruck = (g, { s, c, dk, w, run, j }) => {
  const jj = j / s;
  box(g, s, -.36, .02 + jj, .72, .15, 3, c);                                                 // chassis
  box(g, s, -.36, -.2 + jj, .5, .24, 3, dk);                                                 // cargo box
  box(g, s, -.36, -.2 + jj, .5, .04, 2, mix(dk, '#ffffff', .18));                            // roof edge of the box
  box(g, s, .16, -.1 + jj, .2, .19, 3, c);                                                   // cab
  poly(g, s, [[.2, -.07 + jj], [.3, -.07 + jj], [.33, -.01 + jj], [.2, -.01 + jj]], GLASS);  // cab window
  wheel(g, s, -.25, .2, .085, w, run, 10); wheel(g, s, -.04, .2, .085, w, run, 10); wheel(g, s, .26, .2, .085, w, run, 10);
};

// ---- Hover Lab --------------------------------------------------------------------------------------------------------------
// Hover craft ride on tubing under the hull: a manifold pipe with nozzles that fire rings of force at the ground on a fast interval. The craft sits
// well above the ground (altitude 0 in the data: the lift is drawn here) and rocks up and down deeply but slowly, about a third as fast as the waves.
const hoverLift = (w, ph, run) => -.075 + (run ? Math.sin(w * .9 + ph) * .028 : 0);

const hoverScout = (g, { s, c, dk, w, ph, run }) => {
  const h = hoverLift(w, ph, run);
  g.save(); g.translate(0, h * s);
  hoverTubes(g, s, -.22, .24, .21, w, run, { ground: .285 - h });
  poly(g, s, [[-.32, .17], [-.3, .02], [-.1, -.05], [.14, -.05], [.4, .07], [.36, .17]], c);   // low wedge hull
  poly(g, s, [[.14, -.05], [.4, .07], [.3, .07], [.1, -.0]], mix(c, dk, .4));
  oval(g, s, .06, -.06, .1, .055, GLASS);                                                    // bubble canopy
  g.restore();
};

const hoverTank = (g, { s, c, dk, w, ph, run }) => {
  const h = hoverLift(w, ph, run);
  g.save(); g.translate(0, h * s);
  hoverTubes(g, s, -.28, .28, .22, w, run, { ground: .285 - h });
  box(g, s, -.36, -.02, .72, .2, 5, c);                                                      // wide hull
  poly(g, s, [[.36, .0], [.4, .1], [.36, .17]], c);                                          // sloped nose
  box(g, s, -.1, -.17, .28, .16, 4, dk);                                                     // turret
  const rec = Math.max(0, Math.sin(w * 1.6 + ph)) * .012 * run;
  g.fillStyle = INK; g.fillRect((.16 - rec) * s, -.12 * s, s * .28, s * .04);                // gun
  g.restore();
};

const hoverCarrier = (g, { s, c, dk, w, ph, run }) => {
  const h = hoverLift(w, ph, run);
  g.save(); g.translate(0, h * s);
  hoverTubes(g, s, -.32, .32, .23, w, run, { ground: .285 - h });
  box(g, s, -.4, -.14, .8, .33, 6, c);                                                       // long box hull
  poly(g, s, [[.4, -.1], [.4, .19], [.28, .19], [.28, -.1]], dk);                            // bow ramp, folded up
  box(g, s, .3, -.07, .06, .22, 1, mix(dk, '#ffffff', .2));
  box(g, s, .05, -.2, .13, .07, 2, dk);                                                      // cockpit bump
  g.restore();
};

// ---- Mech Factory -----------------------------------------------------------------------------------------------------------
// The walkers live in concept-art-mechs.js.

// ---- Stealth Lab ------------------------------------------------------------------------------------------------------------
// Cloaked units: faceted, dull, a little see-through, with a bright glint that sweeps across them (the cloak shimmering).

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

// Abyss sub: a deep diver. Round pressure hull, a small sail and a manipulator arm; always drawn under water.
const abyssSub = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s * .6, col = mix(c, dk, .45);
  g.save(); g.translate(0, bb * s);
  propeller(g, s, -.43, .0, w, run, dk, false);
  poly(g, s, [[-.4, -.08], [-.5, -.17], [-.45, -.17], [-.34, -.08]], dk);                    // tail fin
  oval(g, s, 0, 0, .39, .19, col);                                                           // round pressure hull
  box(g, s, -.1, -.22, .14, .07, 2, col);                                                     // small sail
  stroke(g, s, .12, .15, .24, .26, 3, dk); stroke(g, s, .24, .26, .33, .2, 3, dk);            // manipulator arm
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
      box(g, s, .08, D - .17, .22, .17, 3, c);                                                  // wheelhouse, forward
      box(g, s, .09, D - .21, .07, .05, 1, mix(c, dk, .4));                                       // crane pedestal on the wheelhouse roof
      const sway = run ? Math.sin(w * 2 + 1) * .006 : 0;                                         // a small crane: a boom reaching aft over the mine rack, a cable and a hook
      stroke(g, s, .125, D - .2, -.04, D - .33, 4, INK); stroke(g, s, -.04, D - .33, -.04 + sway, D - .24, 1, STEEL); disc(g, s, -.04 + sway, D - .235, .02, INK);
      for (let i = 0; i < 3; i++) mine(g, s, -.3 + i * .12, D - .1, .045, INK);               // the mines, in a rack
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

const OWN_SPRITES = {
  supply_truck: supplyTruck,
  hover_scout: hoverScout, hover_tank: hoverTank, hover_carrier: hoverCarrier,
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

const OWN_SHADOWS = {
  supply_truck: ground(.35, .05, .285),
  hover_scout: ground(.34, .045, .295), hover_tank: ground(.38, .05, .295), hover_carrier: ground(.42, .05, .295),
  troop_glider: airShadow(mirror([[.42, 0], [.1, -.08], [-.06, -.4], [-.2, -.4], [-.2, -.07], [-.4, -.12], [-.42, 0]]), .92),
  scout_glider: airShadow(mirror([[.3, 0], [-.38, -.3], [-.3, 0]])),
  drop_pod: airShadow(mirror([[.17, 0], [.15, -.14], [.07, -.26], [-.07, -.26], [-.15, -.14], [-.17, 0]])), shuttle: airShadow(mirror([[.46, 0], [.4, -.07], [.0, -.07], [-.1, -.36], [-.3, -.36], [-.3, -.05], [-.38, -.05], [-.38, 0]]), .95),
  satellite: airShadow(bar(.46)),
  abyss_sub: none, mine_layer: none, torpedo_drone: none,
  swarm_drones: airShadow(mirror([[.3, 0], [.15, -.08], [-.2, -.08], [-.3, 0]])), repair_drone: airShadow(bar(.3)),
};

// the new concept groups live in their own files (infantry, static defences, gadgets, aircraft, ships, vehicles, fleet, mechs)
export const SPRITES = { ...OWN_SPRITES, ...INFANTRY.SPRITES, ...STATIC.SPRITES, ...AIR.SPRITES, ...SHIPS.SPRITES, ...VEHICLES.SPRITES, ...FLEET.SPRITES, ...MECHS.SPRITES };
export const SHADOWS = { ...OWN_SHADOWS, ...INFANTRY.SHADOWS, ...STATIC.SHADOWS, ...AIR.SHADOWS, ...SHIPS.SHADOWS, ...VEHICLES.SHADOWS, ...FLEET.SHADOWS, ...MECHS.SHADOWS };
