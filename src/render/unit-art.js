// Pocket Wars unit art: simple flat shapes, no outlines, one sprite and one shadow per unit.
//   SPRITES[name](g, { s, c, dk, w, ph, run, b, j })   draws the unit, centred on (0, 0) in a tile of size s
//   SHADOWS[name](g, { s, alt, w, ph, run })            draws the ground shadow, shaped like the unit
// `render.sprite` in data/units.json selects the name. Self-contained and browser-safe (no imports); the game
// (unit-sprites.js), the gallery page and the sprite lab all run this same file.
//
// Params: c / dk = faction colour / dark colour, w = animation clock (s), ph = per-unit phase offset,
// run = 1 while animating (0 when the unit has acted), b / j = bob / jitter in pixels.
// Coordinates are fractions of the tile size s; +x is forward, +y is down.

const RED = '#d4442e', GLASS = '#cfe6f5', INK = '#222', STEEL = '#9a9a9a', SKIN = '#f1c99b', OLIVE = '#4b5238';
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); };

const box = (g, s, x, y, w, h, r, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x * s, y * s, w * s, h * s, r); g.fill(); };
const disc = (g, s, x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x * s, y * s, r * s, 0, 7); g.fill(); };
const oval = (g, s, x, y, rx, ry, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const poly = (g, s, pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); g.fill(); };
const stroke = (g, s, x1, y1, x2, y2, width, col) => { g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1 * s, y1 * s); g.lineTo(x2 * s, y2 * s); g.stroke(); };
const mirror = (top) => top.concat(top.slice(1, -1).reverse().map(([x, y]) => [x, -y]));
const both = (pts, fn) => { fn(pts); fn(pts.map(([x, y]) => [x, -y])); };

const wheel = (g, s, x, y, r, w, run, speed) => {
  disc(g, s, x, y, r, INK);
  stroke(g, s, x, y, x + Math.cos(w * speed * run) * r * .9, y + Math.sin(w * speed * run) * r * .9, 1.5, '#aaa');
};
const treads = (g, s, x0, x1, y, h, w, run, j) => {
  box(g, s, x0, y, x1 - x0, h, h * s * .5, '#2b2b2b');   // a full pill: the radius follows the tread's height, so it stays round at any size
  g.fillStyle = STEEL; const off = (w * s * .3 * run) % (s * .12);
  for (let i = 0; i < 6; i++) { const x = x0 * s + s * .02 + i * s * .12 + off; if (x < x1 * s - s * .05) g.fillRect(x, (y + h * .4) * s, s * .05, s * .04); }
};

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
  g.fillStyle = dk; g.fillRect(-s * .14, s * .12, s * .1, s * .17 + l); g.fillRect(s * .04, s * .12, s * .1, s * .17 - l);
  if (kind === 'mech') box(g, s, -.24, -.1 + b / s, .09, .22, 3, dk);                         // rocket pack
  else if (kind === 'sniper') box(g, s, -.24, -.08 + b / s, .09, .2, 3, mix(c, '#56643a', .6)); // ghillie-covered pack
  box(g, s, -.16, -.12 + b / s, .32, .28, 4, c);
  disc(g, s, 0, -.2 + b / s, .09, SKIN);
  if (kind === 'marine') {
    marineCover(g, s, { c, dk, w, ph, run }, b / s);
  } else {
    g.fillStyle = dk; g.beginPath(); g.arc(0, -s * .21 + b, s * .11, Math.PI, 0); g.fill(); g.fillRect(-s * .13, -s * .22 + b, s * .26, s * .03);
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
const UNDER_SHADE = .45;
const FOAM = 'rgba(255,255,255,.6)';
const LINE = .14;                                   // the waterline, in tile fractions (fixed: only the ship moves)
const skyClip = (g, s, line) => { g.beginPath(); g.rect(-s, -s * 1.5, s * 2, (line + 1.5) * s); g.clip(); };
const seaClip = (g, s, line) => { g.beginPath(); g.rect(-s, line * s, s * 2, s * 2); g.clip(); };
/** A propeller at (x, y) on the stern, the hull's own colour `col` (dark under water): a blurred blade whose length
 *  flickers as it turns, and (`bubbles`) a stream of bubbles astern. Draw it inside the ship's own transform so it bobs with it. */
const propeller = (g, s, x, y, w, run, col, bubbles = true) => {
  const blade = col, a = run ? w * 17 : .5, len = .08 * (.35 + .65 * Math.abs(Math.cos(a)));
  oval(g, s, x, y, .018, len, blade);
  oval(g, s, x, y, .018, .018, blade);
  if (!run || !bubbles) return;
  for (let i = 0; i < 3; i++) {
    const f = (w * 1.6 + i / 3) % 1;                          // each bubble drifts back and fades
    oval(g, s, x - .03 - f * .17, y + Math.sin(w * 16 + i * 2.1) * .03, .016 * (1 - f * .5), .016 * (1 - f * .5), `rgba(190,215,245,${(.6 * (1 - f)).toFixed(2)})`);
  }
};
/** Run `draw(light)` above the waterline (light = true) and again below it (false), then lay foam along the waterline and curl it at both ends. */
const afloat = (g, s, w, run, x0, x1, draw, line = LINE) => {
  g.save(); skyClip(g, s, line); draw(true); g.restore();
  g.save(); seaClip(g, s, line); draw(false); g.restore();
  const p = .8 + .2 * Math.sin(w * 4) * run, q = .8 + .2 * Math.sin(w * 4 + 2) * run;
  g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x0 * s, (line - .012) * s, (x1 - x0) * s, .026 * s);
  oval(g, s, x1 + .005, line + .005, .065 * p, .028, FOAM); oval(g, s, x1 - .07, line + .02, .05 * p, .018, 'rgba(255,255,255,.35)');   // bow
  oval(g, s, x0 - .005, line + .005, .065 * q, .028, FOAM); oval(g, s, x0 + .07, line + .02, .05 * q, .018, 'rgba(255,255,255,.35)');   // stern
};
/** Hull outline: deck at y = deck, keel at y = keel (below the waterline), stern at x0, bow at x1; `rise` sweeps the bow's deck up. */
const hullPath = (g, s, { x0, x1, deck, keel, rise = 0, sweep = .2 }) => {
  g.beginPath(); g.moveTo(x0 * s, deck * s); g.lineTo((x1 - sweep) * s, deck * s);
  if (rise) g.quadraticCurveTo((x1 - sweep * .55) * s, deck * s, x1 * s, (deck - rise) * s); else g.lineTo(x1 * s, (deck - .02) * s);
  g.lineTo((x1 - .1) * s, keel * s); g.lineTo((x0 + .06) * s, keel * s); g.lineTo(x0 * s, (keel - .07) * s); g.closePath();
};
/** The deck's height and slope (radians, negative = rising) at x on a hull with a swept-up bow. */
const deckAt = ({ x1, deck, rise = 0, sweep = .2 }, x) => {
  const x0 = x1 - sweep, xc = x1 - sweep * .55;
  if (!rise || x <= x0) return { y: deck, ang: 0 };
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const t = (lo + hi) / 2; ((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xc + t * t * x1 < x ? (lo = t) : (hi = t)); }
  const t = lo;
  return { y: deck - t * t * rise, ang: Math.atan2(-2 * t * rise, 2 * (1 - t) * (xc - x0) + 2 * t * (x1 - xc)) };
};
/** An armoured turret like a tank's: a rounded block, lighter than the dark hull, with barrels out of its front. The block is tilted by `ang`
 *  (to sit on a slope); the barrels are raised `elev` radians on their own, and `dir` -1 points them aft. */
const turret = (g, s, x, y, w, len, { ang = 0, elev = 0, n = 1, dk = '#3a3d45', bar = .04, dir = 1 } = {}) => {
  dk = mix(dk, '#ffffff', .5);                                    // lighter than the underwater hull, so it never reads as part of it
  g.save(); g.translate(x * s, y * s); g.rotate(ang);
  box(g, s, -w * .5, -w * .5, w, w * .5, 4, dk);
  g.translate(dir * w * .3 * s, -w * .38 * s); g.rotate(dir > 0 ? -elev : elev);
  g.fillStyle = INK;
  for (let i = 0; i < n; i++) g.fillRect(dir > 0 ? 0 : -len * s, (-bar * .5 + (i - (n - 1) / 2) * bar * 1.4) * s, len * s, bar * s);
  g.restore();
};

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
      box(g, s, -.1, D - .175, .13, .025, 1, GLASS);
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
      box(g, s, -.14, D - .18, .22, .18, 3, c); box(g, s, -.11, D - .15, .16, .03, 1, GLASS);       // bridge
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

const stealthTop = [[.42, 0], [-.2, -.36], [-.27, -.33], [-.12, -.2], [-.24, -.12], [-.14, -.03], [-.2, 0]];
const stealth = (g, { s, c, dk }) => {
  poly(g, s, mirror(stealthTop), mix(c, dk, .35));
  poly(g, s, mirror([[.42, 0], [.02, -.14], [-.16, -.1], [-.16, 0]]), c);
  poly(g, s, mirror([[.34, 0], [.24, -.03]]).concat([[.24, .03]]).slice(0, 3), GLASS);
};

// ships are drawn long (bow wake and all) and scaled to fit inside their tile
const shrunk = (draw, k) => (g, o) => { g.save(); g.scale(k, k); draw(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); };

export const SPRITES = {
  soldier: trooper('soldier'), marine: trooper('marine'), dinghy: (g, o) => { g.save(); g.scale(.9, .9); dinghy(g, o); g.restore(); }, mech: trooper('mech'), sniper: trooper('sniper'),
  recon, tank: tank(false), heavy_tank: tank(true), artillery, rocket_launcher: rocketLauncher, flak, copter, transport_copter: (g, o) => { g.save(); g.scale(.85, .85); transportCopter(g, o); g.restore(); },   // drawn long, scaled to sit inside its tile
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
  soldier: ground(.17, .04, .3), marine: ground(.17, .04, .3), mech: ground(.19, .04, .3), sniper: ground(.2, .04, .3),
  recon: ground(.3, .05, .285), tank: ground(.36, .05, .275), heavy_tank: ground(.36, .05, .275),
  artillery: ground(.29, .045, .285, -.01), rocket_launcher: ground(.35, .05, .285), flak: ground(.32, .05, .275),
  copter: airShadow(mirror([[.34, .0], [.2, -.1], [-.1, -.13], [-.2, -.04], [-.46, -.03], [-.46, 0]])),
  transport_copter: airShadow(mirror([[.46, 0], [.4, -.08], [-.4, -.09], [-.48, -.04], [-.48, 0]]).map(([x, y]) => [x * .85, y * .85])),
  fighter: airShadow(mirror([[.42, 0], [.05, -.07], [-.2, -.32], [-.27, -.32], [-.29, -.08], [-.38, -.14], [-.34, -.03], [-.32, 0]])),
  bomber: airShadow(mirror([[.46, 0], [.4, -.05], [.1, -.07], [-.08, -.36], [-.2, -.36], [-.14, -.07], [-.3, -.06], [-.4, -.17], [-.46, -.17], [-.43, -.03], [-.46, 0]])),
  stealth_bomber: airShadow(mirror(stealthTop)),
  // ships sit in the water and cast no shadow (their foam is part of the sprite)
  dinghy: none, destroyer: none, submarine: none, cruiser: none, battleship: none,
};

// The drawing helpers, shared with the experimental concept sprites in gallery/concept-art.js (not used by the game itself).
export const PARTS = { box, disc, oval, poly, stroke, mirror, both, wheel, treads, mix, afloat, hullPath, propeller, skyClip, seaClip, GLASS, INK, STEEL, SKIN, OLIVE, FOAM, UNDER_SHADE };
