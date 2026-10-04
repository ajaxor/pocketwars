// Pocket Wars unit art: simple flat shapes, no outlines, one sprite and one shadow per unit.
//   SPRITES[name](g, { s, c, dk, w, ph, run, b, j })   draws the unit, centred on (0, 0) in a tile of size s
//   SHADOWS[name](g, { s, alt, w, ph, run })            draws the ground shadow, shaped like the unit
// `render.sprite` in data/units.json selects the name. Built from the shared parts in parts.js; browser-safe. The game
// (unit-sprites.js), the gallery page and the sprite lab all run this same file.
//
// Params: c / dk = faction colour / dark colour, w = animation clock (s), ph = per-unit phase offset,
// run = 1 while animating (0 when the unit has acted), b / j = bob / jitter in pixels.
// Coordinates are fractions of the tile size s; +x is forward, +y is down.

import { RED, GLASS, INK, STEEL, SKIN, OLIVE, FOAM, UNDER_SHADE, LINE, mix, box, disc, oval, poly, stroke, mirror, both, wheel, treads, skyClip, seaClip,
  propeller, afloat, hullPath, deckAt, turret } from './parts.js';
import * as LIB from './parts.js';
import * as ART_INFANTRY from './art-infantry.js';
import * as ART_AIR from './art-air.js';
import * as ART_SHIPS from './art-ships.js';
import * as ART_CYCLE from './art-cycle.js';

// Units whose art lives in a group module (art-infantry.js, art-air.js, art-ships.js): only the ones the game has are taken, so the
// concept-only sprites in those files stay out of the game's tables. Add a name here when its unit moves into data/units.json.
const pick = (table, names) => Object.fromEntries(names.map((n) => { if (!table[n]) throw new Error(`no art for "${n}"`); return [n, table[n]]; }));
const INFANTRY_ART = ['commando', 'mechanic', 'medic', 'mortar_team', 'rpg_trooper', 'spy', 'conscript', 'diver', 'diver_swim'];
const AIR_ART = ['stealth_copter', 'stealth_fighter', 'torpedo_bomber', 'radar_plane', 'vintage_fighter', 'vintage_bomber'];
const SHIP_ART = ['gun_boat'];

// ---- the marine's own parts, shared by the marine on land and the one riding a dinghy ----------------------------------------------
// Drawn in the soldier's coordinates (head centred on (0, -.2 + bb)); callers translate for a different seat.
/** A flat-topped utility cover with a short visor, in the team's dark colour, and a scarf that flutters. */
const marineCover = (g, s, { c, dk, w, ph, run }, bb) => {
  const fl = run ? Math.sin(w * 9 + ph) * .03 : 0;
  poly(g, s, [[-.102, -.225 + bb], [-.122, -.3 + bb], [.122, -.3 + bb], [.102, -.225 + bb]], dk);   // crown, wider at the top
  oval(g, s, 0, -.3 + bb, .122, .026, mix(dk, '#ffffff', .22));                                      // the flat top, seen from a little above
  poly(g, s, [[-.104, -.26 + bb], [.104, -.26 + bb], [.102, -.245 + bb], [-.102, -.245 + bb]], mix(dk, '#000000', .25));   // band
  oval(g, s, .015, -.222 + bb, .105, .022, mix(dk, '#000000', .15));                                  // the visor, in front of the face (the cap looks toward the camera)
  const sc = mix(c, '#ffffff', .3);   // a little lighter than the shirt so it shows
  poly(g, s, [[-.1, -.1 + bb], [.1, -.1 + bb], [0, .0 + bb]], sc); poly(g, s, [[-.1, -.1 + bb], [-.2, -.06 + fl + bb], [-.19, -.13 + fl + bb]], sc);
};
/** Assault rifle: the rifle line with a curved magazine under the receiver and a stock. `sw` = swing, `bb` = bob (tile fractions). */
const marineRifle = (g, s, bb, sw) => {
  stroke(g, s, -.1, .04 + bb, .26, -.12 + bb + sw, Math.max(2, s * .05), INK);
  const m = bb + sw * .5;
  poly(g, s, [[.0, -.005 + m], [.055, -.03 + m], [.1, .09 + m], [.05, .1 + m]], '#3a3a44');
  box(g, s, -.17, .0 + m, .1, .045, 2, '#4a3a2a');
};

// ---- foot units: one body, head and walk cycle shared by soldier, mech and sniper; only the pack and weapon differ ----------
const trooper = (kind) => (g, { s, c, dk, w, ph, run, moving, b }) => {
  const walk = run && moving ? 1 : 0;                                                          // legs only step while the unit moves
  const l = Math.sin(w * 8 + ph) * s * .05 * walk, sw = Math.sin(w * 8 + ph) * s * .02 * walk;
  LIB.legs(g, s, l, dk);
  if (kind === 'mech') box(g, s, -.24, -.1 + b / s, .09, .22, 3, dk);                         // rocket pack
  else if (kind === 'sniper') box(g, s, -.24, -.08 + b / s, .09, .2, 3, mix(c, '#56643a', .6)); // ghillie-covered pack
  LIB.torso(g, s, b / s, c);
  LIB.head(g, s, b / s);
  if (kind === 'marine') {
    marineCover(g, s, { c, dk, w, ph, run }, b / s);
  } else {
    LIB.dome(g, s, b / s, .11, dk); g.fillRect(-s * .13, -s * .22 + b, s * .26, s * .03);
  }
  if (kind === 'mech') {          // bazooka on the shoulder, tube clear of the body
    stroke(g, s, -.2, .04 + b / s, .3, -.2 + b / s + sw / s, Math.max(4, s * .11), OLIVE);
    disc(g, s, .3, -.2 + b / s + sw / s, .055, '#666');
  } else if (kind === 'sniper') { // standing, long rifle with a big, clearly visible scope
    const sy = b / s + sw / s * .5;
    stroke(g, s, -.12, .06 + b / s, .42, -.07 + sy, Math.max(2.2, s * .045), INK);
    g.save(); g.translate(s * .06, (-.05 + sy) * s); g.rotate(-.24);
    box(g, s, -.1, -.04, .2, .075, 3, '#1b1b22');                                             // scope tube
    box(g, s, -.115, -.05, .04, .095, 2, '#3a3a44'); box(g, s, .075, -.055, .05, .105, 2, '#3a3a44'); // eyepiece and objective bells
    disc(g, s, .125, -.0025, .032, '#7fd0ff'); disc(g, s, .132, -.012, .012, '#ffffff');         // bright lens
    box(g, s, -.05, .035, .03, .04, 1, STEEL); box(g, s, .03, .035, .03, .04, 1, STEEL);        // mounts
    g.restore();
  } else {                        // rifle
    if (kind === 'marine') marineRifle(g, s, b / s, sw / s);
    else stroke(g, s, -.1, .04 + b / s, .26, -.12 + b / s + sw / s, Math.max(2, s * .05), INK);
  }
};

const tank = (heavy) => (g, { s, c, dk, w, run, j }) => {
  const h = heavy;
  treads(g, s, -.34, .34, .08 + j / s, .19, w, run);
  box(g, s, -.3, -(h ? .1 : .06) + j / s, .6, h ? .22 : .17, 4, c);
  box(g, s, -(h ? .17 : .13), -(h ? .24 : .17) + j / s, h ? .34 : .26, h ? .17 : .14, 3, dk);
  g.fillStyle = INK; g.fillRect(s * .12, (-(h ? .2 : .13) + j / s) * s, s * (h ? .3 : .24), s * .045); if (h) g.fillRect(s * .12, (-.13 + j / s) * s, s * .3, s * .045);
};

const recon = (g, { s, c, dk, w, run, j }) => {
  box(g, s, -.3, -.02 + j / s, .6, .2, 4, c);
  box(g, s, -.02, -.14 + j / s, .22, .13, 2, dk); box(g, s, .02, -.12 + j / s, .14, .08, 1, GLASS);
  g.fillStyle = INK; g.fillRect(-s * .26, -s * .13 + j, s * .2, s * .04); g.fillRect(-s * .2, -s * .1 + j, s * .03, s * .09);
  wheel(g, s, -.19, .2, .08, w, run, 10); wheel(g, s, .19, .2, .08, w, run, 10);
};

// Rocket launcher: a truck carrying a raised pod of tubes, tipped skyward, a pair of rockets showing at the muzzle.
const rocketLauncher = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  box(g, s, -.36, .03 + jj, .72, .14, 3, dk);
  box(g, s, .17, -.08 + jj, .19, .17, 3, c); box(g, s, .22, -.05 + jj, .12, .07, 2, GLASS);   // cab
  box(g, s, -.32, -.02 + jj, .44, .06, 2, c);                                                // flatbed
  const rec = Math.max(0, Math.sin(w * 1.4 + ph)) * .018 * run;                              // the pod rocks back as if firing
  g.save(); g.translate(-.2 * s, -.02 * s + j); g.rotate(-.62);   // the pod pivots well back on the bed, clear of the cab
  box(g, s, -.05 - rec, -.1, .46, .2, 3, dk);                                                // the pod
  box(g, s, -.02 - rec, -.075, .4, .05, 1, c); box(g, s, -.02 - rec, .025, .4, .05, 1, c);   // two rows of tubes
  box(g, s, .34 - rec, -.075, .12, .045, 1, STEEL); box(g, s, .34 - rec, .03, .12, .045, 1, STEEL);   // the rockets
  poly(g, s, [[.46 - rec, -.075], [.52 - rec, -.052], [.46 - rec, -.03]], RED); poly(g, s, [[.46 - rec, .03], [.52 - rec, .052], [.46 - rec, .075]], RED);
  g.restore();
  box(g, s, -.225, -.0 + jj, .05, .05, 1, '#3b3b3b');                                        // the pivot
  wheel(g, s, -.25, .2, .085, w, run, 10); wheel(g, s, -.04, .2, .085, w, run, 10); wheel(g, s, .26, .2, .085, w, run, 10);
};

const artillery = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s, bell = c === dk ? c : mix(c, dk, .5);
  poly(g, s, [[-.16, .1 + jj], [-.35, .27], [-.3, .29], [-.1, .16 + jj]], dk);              // trail leg with spade
  box(g, s, -.36, .255, .07, .04, 1, INK);
  wheel(g, s, -.14, .21, .08, w, run, 6); wheel(g, s, .12, .21, .08, w, run, 6);
  disc(g, s, -.14, .21, .03, '#8a8a8a'); disc(g, s, .12, .21, .03, '#8a8a8a');               // hubs
  box(g, s, -.22, .0 + jj, .4, .16, 3, c);                                                   // carriage
  box(g, s, -.2, -.05 + jj, .12, .07, 2, '#7a6a48'); box(g, s, -.19, -.035 + jj, .1, .012, 0, '#54482f'); // ammo crate
  g.save(); g.translate(-s * .02, s * .03 + j); g.rotate(-.5 + Math.sin(w * 1.5 + ph) * .12 * run);
  const kick = Math.max(0, Math.sin(w * 1.5 + ph)) * .02 * run;                              // slight recoil
  g.translate(-kick * s, 0);
  box(g, s, -.04, -.06, .07, .12, 2, dk);                                                    // breech block
  box(g, s, .0, -.05, .17, .1, 2, bell);                                                     // recoil sleeve
  box(g, s, .17, -.03, .24, .06, 1, dk);                                                     // barrel
  box(g, s, .39, -.045, .05, .09, 1, INK);                                                   // muzzle brake
  g.restore();
  box(g, s, -.02, -.1 + jj, .04, .2, 2, '#3b3b3b');                                          // gun shield
};

const flak = (g, { s, c, dk, w, ph, run, j }) => {
  const jj = j / s;
  treads(g, s, -.32, .32, .1 + jj, .17, w, run);
  box(g, s, -.28, -.02 + jj, .56, .15, 4, c);
  // gun mount: a wedge whose front face is raked up and forward, so it reads as aimed at the sky
  poly(g, s, [[-.2, -.02 + jj], [-.22, -.15 + jj], [-.1, -.2 + jj], [.05, -.2 + jj], [.17, -.02 + jj]], dk);
  poly(g, s, [[-.1, -.2 + jj], [.05, -.2 + jj], [.17, -.02 + jj], [.1, -.02 + jj]], mix(c, dk, .35));   // lit slope
  g.save(); g.translate(s * .0, -s * .13 + j); g.rotate(-.95 + Math.sin(w * 2 + ph) * .12 * run);
  g.fillStyle = INK; g.fillRect(0, -s * .055, s * .36, s * .04); g.fillRect(0, s * .015, s * .36, s * .04); g.restore();
};

// ---- aircraft (plan view, facing right) ----------------------------------------------------------------------
const copter = (g, { s, c, dk, w, run }) => {
  stroke(g, s, -.2, .25, .2, .25, 2, INK); stroke(g, s, -.1, .1, -.1, .25, 2, INK); stroke(g, s, .1, .1, .1, .25, 2, INK);   // the skid is centred under the body
  box(g, s, -.44, -.04, .34, .06, 1, dk); box(g, s, -.46, -.16, .05, .22, 1, dk);
  oval(g, s, 0, 0, .24, .15, c); oval(g, s, .12, -.02, .1, .09, GLASS);                       // one cockpit
  g.fillStyle = INK; g.fillRect(s * .22, s * .05, s * .13, s * .03);
  const rl = (run ? Math.abs(Math.cos(w * 22)) : .6) * s * .36 + s * .05;
  stroke(g, s, -rl / s, -.19, rl / s, -.19, 2.5, INK); g.fillStyle = INK; g.fillRect(-s * .02, -s * .21, s * .04, s * .08);
};

// Transport copter: a Chinook-style tandem-rotor lifter. A long body with a raised pylon at each end carrying a rotor (the rear one
// the taller), a ramp at the tail, and two separate landing gear (a nose wheel leg and a main wheel leg).
const transportCopter = (g, { s, c, dk, w, run }) => {
  const leg = (x) => { stroke(g, s, x, .1, x, .22, 2.2, INK); disc(g, s, x, .25, .045, INK); disc(g, s, x, .25, .018, STEEL); };
  leg(.22); leg(-.2);                                                                         // two landing gears, each with its own wheel
  // one piece: the fuselage outline itself rises into a tall tower at the tail and a lower hump over the cockpit
  const body = [[-.47, .1], [-.47, .0], [-.44, -.1], [-.42, -.29], [-.31, -.29], [-.28, -.1], [-.27, -.05], [.1, -.05], [.13, -.12], [.15, -.2], [.25, -.2], [.28, -.1], [.3, -.06], [.4, -.03], [.45, .05], [.43, .13], [.3, .16], [-.4, .16]];
  g.save(); g.lineJoin = 'round'; g.lineWidth = Math.max(4, s * .06); g.strokeStyle = c;
  g.beginPath(); body.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); g.stroke(); g.restore();   // rounds the corners
  poly(g, s, body, c);
  box(g, s, -.48, .02, .08, .12, 2, dk);                                                      // tail ramp
  box(g, s, .31, -.01, .11, .08, 3, GLASS);                                                   // cockpit windows
  g.fillStyle = INK; for (let i = 0; i < 4; i++) g.fillRect(s * (-.2 + i * .1), s * .03, s * .055, s * .05);   // troop windows
  const bl = (hub, y, ph) => {
    const rl = (run ? Math.abs(Math.cos(w * 20 + ph)) : .6) * s * .22 + s * .05;
    stroke(g, s, hub - rl / s, y, hub + rl / s, y, 2.5, INK); g.fillStyle = INK; g.fillRect((hub - .02) * s, (y - .03) * s, s * .04, s * .06);
  };
  bl(-.365, -.32, 0); bl(.2, -.23, 1.3);
};

// Fighter and bomber are drawn in a 3/4 view from above and slightly ahead: the near wing sweeps down toward the viewer,
// the far wing is shorter and darker behind the fuselage, and the tail fin stands up.
const fighter = (g, { s, c, dk, w, run }) => {
  const fl = (run ? .6 + .4 * Math.sin(w * 40) : .3) * s * .1, far = mix(c, dk, .6), near = mix(c, dk, .3);
  poly(g, s, [[-.36, -.02], [-.36 - fl / s, .01], [-.36, .04]], '#ff9a2e');                   // afterburner
  poly(g, s, [[.0, -.05], [-.14, -.2], [-.22, -.2], [-.2, -.05]], far);                       // far wing
  poly(g, s, [[-.3, -.05], [-.37, -.12], [-.41, -.12], [-.38, -.04]], far);                   // far tailplane
  poly(g, s, [[-.14, -.05], [-.25, -.17], [-.33, -.17], [-.34, -.05]], mix(c, dk, .15));      // tail fin (side face, lit like the body)
  poly(g, s, [[-.25, -.17], [-.33, -.17], [-.335, -.14], [-.26, -.14]], mix(c, dk, .5));      // fin cap, turned away from the light
  poly(g, s, [[.44, .01], [.2, -.06], [-.05, -.075], [-.36, -.06], [-.36, .05], [-.05, .075], [.2, .05]], c);   // fuselage
  poly(g, s, [[.4, .02], [.2, .05], [-.05, .075], [-.36, .05], [-.36, .035], [-.05, .05], [.2, .03]], mix(c, dk, .45)); // belly shade
  oval(g, s, .13, -.06, .075, .035, GLASS);                                                   // canopy
  poly(g, s, [[.1, .04], [-.1, .3], [-.22, .3], [-.2, .04]], near);                           // near wing
  poly(g, s, [[-.27, .04], [-.37, .14], [-.43, .14], [-.38, .04]], near);                     // near tailplane
  box(g, s, -.38, -.03, .04, .08, 1, INK);                                                    // nozzle
  poly(g, s, [[.2, .0], [.28, .01], [.2, .04]], INK);                                         // intake
};

// transport-style bomber: long fuselage, swept high wings, four engines, T-tail
const bomber = (g, { s, c, dk, w, run }) => {
  const far = mix(c, dk, .6), near = mix(c, dk, .3);
  poly(g, s, [[.08, -.06], [-.06, -.21], [-.18, -.21], [-.14, -.06]], far);                   // far wing
  box(g, s, -.1, -.15, .13, .05, 2, '#2a2a2a');                                               // far engine
  poly(g, s, [[-.33, -.06], [-.4, -.13], [-.46, -.13], [-.44, -.05]], far);                   // far tailplane
  poly(g, s, [[-.24, -.07], [-.36, -.19], [-.45, -.19], [-.45, -.06]], mix(c, dk, .15));      // tail fin (side face, lit like the body)
  poly(g, s, [[-.36, -.19], [-.45, -.19], [-.45, -.16], [-.365, -.16]], mix(c, dk, .5));      // fin cap, turned away from the light
  box(g, s, -.46, -.08, .92, .16, s * .08, c);                                                // fuselage
  box(g, s, -.42, .035, .82, .04, 2, mix(c, dk, .45));                                        // belly shade
  box(g, s, .3, -.06, .11, .05, 2, GLASS);                                                    // cockpit windows
  poly(g, s, [[.12, .06], [-.1, .32], [-.26, .32], [-.16, .06]], near);                       // near wing
  poly(g, s, [[-.32, .06], [-.4, .16], [-.46, .16], [-.44, .06]], near);                      // near tailplane
  for (const [ey, ex] of [[.16, -.09], [.27, -.19]]) {                                        // near engines, hung under the wing
    box(g, s, ex, ey - .035, .17, .07, 3, '#333'); box(g, s, ex + .155, ey - .03, .03, .06, 2, '#666');
    const a = Math.sin(w * 25) * run; stroke(g, s, ex + .195, ey - a * .04, ex + .195, ey + a * .04, 1.5, '#ddd');
  }
};

// ---- ships (side view, bow to the right) -----------------------------------------------------------------------------
// Kept plain. Shading is just the waterline: the hull and everything on it are the faction's light colour above the water and its
// dark colour below it, so as the ship bobs the dark part grows and shrinks (the sprite is drawn twice, clipped above and below a
// FIXED waterline). Structures are the hull's own colour; turrets are dark blocks like a tank's. The SILHOUETTE tells the ships
// apart: the destroyer is small and low with one raised gun; the cruiser is a little bigger, stepped, with a forward gun and aft
// flak; the battleship is the longest, its deck sweeping up at the bow, with two armoured turrets (the forward one tilted to the
// slope); the submarine is a low cigar with a fin, and dived only its periscope shows. Ships cast no shadow; foam curls at both ends.
// Below the waterline a ship is drawn in a shade between its light colour and its dark one (UNDER_SHADE): lighter than the full dark colour.

const battleship = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s + .05, H = { x0: -.47, x1: .47, deck: .0, keel: .3, rise: .2, sweep: .6 };
  afloat(g, s, w, run, -.47, .47, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.47 - .02, .28, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      poly(g, s, [[-.1, -.34], [-.04, -.34], [-.01, 0], [-.13, 0]], c);                             // bridge: a mast tapering thicker toward the deck
      box(g, s, -.2, -.14, .26, .06, 2, c); box(g, s, -.16, -.26, .18, .06, 2, c);                  // two tiers of wings, centred on the mast
      box(g, s, .07, -.13, .06, .13, 2, c);                                                         // funnel
      const f = deckAt(H, .22);
      turret(g, s, .22, f.y + .02, .26, .2, { ang: f.ang, elev: .52, n: 2, dk });                                   // forward turret: level block, barrels raised 30 degrees
      turret(g, s, -.27, H.deck, .22, .18, { n: 2, dk, dir: -1, elev: .52 });                               // aft turret: level block, barrels astern at 30 degrees
    }
    g.restore();
  });
};

const cruiser = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s + .04, D = .02, H = { x0: -.45, x1: .45, deck: D, keel: .34, rise: .04, sweep: .2 };
  afloat(g, s, w, run, -.45, .45, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.45 - .02, .32, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      box(g, s, .06, D - .05, .36, .06, 2, c);                                                      // raised forecastle
      turret(g, s, .27, D - .05, .13, .14, { dk });                                                 // the deck gun, forward
      box(g, s, -.085, D - .28, .1, .28, 2, c); box(g, s, -.15, D - .19, .22, .08, 2, c);          // plus-shaped bridge
      // the flak mount is the flak unit's wedge, half size: raked up and forward so it reads as aimed at the sky
      const mount = (x, y) => [[-.2, -.02], [-.22, -.15], [-.1, -.2], [.05, -.2], [.17, -.02]].map(([a, b]) => [x + a * .55, y + b * .55]);
      poly(g, s, mount(-.3, D), mix(dk, '#ffffff', .5));
      poly(g, s, [[-.1, -.2], [.05, -.2], [.17, -.02], [.1, -.02]].map(([a, b]) => [-.3 + a * .55, D + b * .55]), mix(c, dk, .35));   // lit slope
      const aim = -.95 + Math.sin(w * 2.5) * .12 * run;
      g.save(); g.translate(-.3 * s, (D - .075) * s); g.rotate(aim);
      g.fillStyle = INK; g.fillRect(0, -s * .035, s * .26, s * .026); g.fillRect(0, s * .005, s * .26, s * .026);
      g.fillStyle = '#ffd24a'; g.fillRect(s * .24, -s * .035, s * .03, s * .026); g.fillRect(s * .24, s * .005, s * .03, s * .026);
      g.restore();
    }
    g.restore();
  });
};

const destroyer = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s, D = .04, H = { x0: -.38, x1: .4, deck: D, keel: .34, rise: .03, sweep: .16 };
  afloat(g, s, w, run, -.38, .4, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.38 - .02, .32, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      poly(g, s, [[-.19, D], [-.15, D - .1], [.08, D - .1], [.12, D]], c);                                      // bridge: a trapezoid base,
      box(g, s, -.18, D - .125, .3, .03, 2, c);                                                       // a balcony ledge, wider than the levels either side,
      poly(g, s, [[-.13, D - .125], [-.1, D - .22], [.0, D - .22], [.04, D - .125]], c);              // and a narrower pilot house on top
      box(g, s, .14, D - .05, .1, .05, 2, c);                                                        // the gun sits on a raised mount
      turret(g, s, .19, D - .05, .12, .13, { dk, bar: .035 });
    }
    g.restore();
  });
};

const submarine = (g, { s, c, dk, w, run, b, submerged }) => {
  const LN = .1;
  const d = Math.max(0, Math.min(1, Number(submerged) || 0));   // 0 surfaced .. 1 dived: the renderer eases it so a dive is seen
  const dip = .22 * d;                       // dived: the whole boat sinks until only the periscope shows
  const bb = b * (.6 - .3 * d) / s + .03 * (1 - d);   // rides low
  const p = .8 + .2 * Math.sin(w * 4) * run;
  const boat = (light) => {                              // the same drawing above (light) and below (dark) the waterline
    const col = light ? c : dk;
    g.save(); g.translate(0, (dip + bb) * s);
    box(g, s, -.44, -.05, .88, .27, s * .13, col);                                           // round hull
    propeller(g, s, -.49, .085, w, run, col, !light);                                         // on the middle of the stern
    box(g, s, -.06, -.17, .17, .16, 3, col);                                                  // conning tower
    if (light) { stroke(g, s, .07, -.17, .07, -.28, 2, INK); stroke(g, s, .07, -.28, .13, -.28, 2, INK); }   // periscope
    g.restore();
  };
  g.save(); skyClip(g, s, LN); boat(true); g.restore();
  g.save(); seaClip(g, s, LN); boat(false); g.restore();
  if (d < .5) {
    g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(-.44 * s, (LN - .012) * s, .88 * s, .026 * s);
    oval(g, s, .44, LN + .005, .06 * p, .026, FOAM); oval(g, s, -.44, LN + .005, .06 * p, .026, FOAM);
    return;
  }
  // dived: the foam gathers round the periscope (a ring at its base and a small V trailing behind), not round the hull
  oval(g, s, .07, LN, .1 * p, .03, FOAM);
  oval(g, s, .07, LN, .05 * p, .014, 'rgba(255,255,255,.8)');
  poly(g, s, [[.07, LN - .005], [-.1 - .03 * p, LN + .012], [-.1 - .03 * p, LN - .012]], 'rgba(255,255,255,.45)');
};

// stealth bomber (planned unit, not in the game yet): flying wing
// Marine afloat: a soldier in a life vest riding a small rubber dinghy (drawn in place of the marine while it is on water).
const dinghy = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s, tube = '#5b616c', under = mix(tube, '#000000', .35);
  afloat(g, s, w, run, -.3, .32, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) { box(g, s, -.3, .02, .62, .22, 8, under); propeller(g, s, -.33, .17, w, run, under); }
    else {
      box(g, s, -.26, -.06, .12, .1, 3, '#3a3f48');                                           // outboard motor
      // the marine sits in it: the same body, cover, scarf and assault rifle as on land, a little lower
      const sw = Math.sin(w * 4) * .008 * run;
      g.save(); g.translate(.03 * s, .0);
      box(g, s, -.16, -.12, .32, .22, 4, c);
      disc(g, s, 0, -.2, .09, SKIN);
      marineCover(g, s, { c, dk, w, ph: 0, run }, 0);
      marineRifle(g, s, 0, sw);
      g.restore();
      box(g, s, -.3, -.02, .62, .17, 8, tube);                                                // the rubber tube, in front of the rider
    }
    g.restore();
  }, .14);
};

// Stealth tank: a faceted, low-slung wedge on real tracks, with a thin armour skirt covering only the top of them, resting on the ground like
// the other tanks.
const stealthTank = (g, { s, c, dk, w, run, j }) => {
  const y = (v) => v + j / s + .075;
  g.save();
  treads(g, s, -.38, .42, y(.05), .16, w, run);                                                           // the tracks, visible under the skirt
  const hull = [[-.4, y(.06)], [-.3, y(-.06)], [-.1, y(-.15)], [.1, y(-.15)], [.34, y(-.04)], [.46, y(.04)], [.44, y(.08)]];
  poly(g, s, hull, mix(c, dk, .3));                                                                       // the silhouette
  poly(g, s, [[-.3, y(-.06)], [-.1, y(-.15)], [.1, y(-.15)], [.34, y(-.04)], [.14, y(-.02)], [.04, y(-.06)]], mix(c, '#ffffff', .12));   // lit top planes
  g.fillStyle = INK; g.fillRect(s * .2, y(-.105) * s, s * .24, s * .048);                                  // the gun: higher up the nose, long, a little thick, and clear of the tile edge
  poly(g, s, [[-.41, y(.1)], [-.36, y(.05)], [.3, y(.05)], [.44, y(.09)], [.42, y(.12)], [-.4, y(.12)]], dk);   // a thin side skirt over the top of the tracks
  g.restore();
};

const stealthTop = [[.42, 0], [-.2, -.36], [-.27, -.33], [-.12, -.2], [-.24, -.12], [-.14, -.03], [-.2, 0]];   // plan outline: used for the shadow
// The original flying-wing plan view, tilted into the same 3/4 view as the other aircraft (the plan squashed so the near half sweeps toward
// the viewer and the far half sits behind the body, darker).
const stealth = (g, { s, c, dk }) => {
  g.save(); g.translate(0, s * .03); g.scale(1, .72);
  poly(g, s, stealthTop, mix(c, dk, .7));                                                                  // far half
  poly(g, s, stealthTop.map(([x, y]) => [x, -y]), mix(c, dk, .25));                              // near half, lighter
  poly(g, s, [[.42, 0], [.02, -.14], [-.16, -.1], [-.16, .1], [.02, .14]], c);                             // the lit centre body
  poly(g, s, [[.34, 0], [.24, -.04], [.24, .04]], GLASS);                                                  // flush canopy
  g.restore();
};

// ships are drawn long (bow wake and all) and scaled to fit inside their tile
const shrunk = (draw, k) => (g, o) => { g.save(); g.scale(k, k); draw(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); };

export const SPRITES = {
  ...pick(ART_INFANTRY.SPRITES, INFANTRY_ART), ...pick(ART_AIR.SPRITES, AIR_ART), ...pick(ART_SHIPS.SPRITES, SHIP_ART), ...ART_CYCLE.SPRITES,
  soldier: trooper('soldier'), marine: trooper('marine'), dinghy: (g, o) => { g.save(); g.scale(.9, .9); dinghy(g, o); g.restore(); }, mech: trooper('mech'), sniper: trooper('sniper'),
  recon, tank: tank(false), stealth_tank: stealthTank, heavy_tank: tank(true), artillery, rocket_launcher: rocketLauncher, flak, copter, transport_copter: (g, o) => { g.save(); g.scale(.85, .85); transportCopter(g, o); g.restore(); },   // drawn long, scaled to sit inside its tile
   fighter, bomber, stealth_bomber: stealth,
  destroyer: shrunk(destroyer, .88), submarine: shrunk(submarine, .88), cruiser: shrunk(cruiser, .86), battleship: shrunk(battleship, .86),
};

// ---- shadows: each shape matches its unit's footprint ---------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
const airShadow = (outline) => (g, { s, alt = 0 }) => {
  g.save(); g.translate(0, s * (.25 + alt * .35)); g.scale(s, s * .3);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); outline.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.restore();
};

export const SHADOWS = {
  ...pick(ART_INFANTRY.SHADOWS, INFANTRY_ART), ...pick(ART_AIR.SHADOWS, AIR_ART), ...pick(ART_SHIPS.SHADOWS, SHIP_ART), ...ART_CYCLE.SHADOWS,
  soldier: ground(.17, .04, .3), marine: ground(.17, .04, .3), mech: ground(.19, .04, .3), sniper: ground(.2, .04, .3),
  recon: ground(.3, .05, .285), stealth_tank: ground(.34, .05, .285), tank: ground(.36, .05, .275), heavy_tank: ground(.36, .05, .275),
  artillery: ground(.29, .045, .285, -.01), rocket_launcher: ground(.35, .05, .285), flak: ground(.32, .05, .275),
  copter: airShadow(mirror([[.34, .0], [.2, -.1], [-.1, -.13], [-.2, -.04], [-.46, -.03], [-.46, 0]])),
  transport_copter: airShadow(mirror([[.46, 0], [.4, -.08], [-.4, -.09], [-.48, -.04], [-.48, 0]]).map(([x, y]) => [x * .85, y * .85])),
  fighter: airShadow(mirror([[.42, 0], [.05, -.07], [-.2, -.32], [-.27, -.32], [-.29, -.08], [-.38, -.14], [-.34, -.03], [-.32, 0]])),
  bomber: airShadow(mirror([[.46, 0], [.4, -.05], [.1, -.07], [-.08, -.36], [-.2, -.36], [-.14, -.07], [-.3, -.06], [-.4, -.17], [-.46, -.17], [-.43, -.03], [-.46, 0]])),
  stealth_bomber: airShadow(mirror(stealthTop)),
  // ships sit in the water and cast no shadow (their foam is part of the sprite)
  dinghy: none, destroyer: none, submarine: none, cruiser: none, battleship: none,
};

// The shared parts library (parts.js), re-exported under the old name for the experimental concept sprites in gallery/concept-art*.js.
export const PARTS = { ...LIB };
