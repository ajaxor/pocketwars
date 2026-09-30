// Pocket Wars unit art: simple flat shapes, no outlines, one sprite and one shadow per unit.
//   SPRITES[name](g, { s, c, dk, w, ph, run, b, j })   draws the unit, centred on (0, 0) in a tile of size s
//   SHADOWS[name](g, { s, alt, w, ph, run })            draws the ground shadow, shaped like the unit
// `render.sprite` in data/units.json selects the name. Self-contained and browser-safe (no imports); the game
// (unit-sprites.js), the gallery page and the sprite lab all run this same file.
//
// Params: c / dk = faction colour / dark colour, w = animation clock (s), ph = per-unit phase offset,
// run = 1 while animating (0 when the unit has acted), b / j = bob / jitter in pixels.
// Coordinates are fractions of the tile size s; +x is forward, +y is down.

const GLASS = '#cfe6f5', INK = '#222', STEEL = '#9a9a9a', SKIN = '#f1c99b', OLIVE = '#4b5238';
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
  box(g, s, x0, y, x1 - x0, h, 5, '#2b2b2b');
  g.fillStyle = STEEL; const off = (w * s * .3 * run) % (s * .12);
  for (let i = 0; i < 6; i++) { const x = x0 * s + s * .02 + i * s * .12 + off; if (x < x1 * s - s * .05) g.fillRect(x, (y + h * .4) * s, s * .05, s * .04); }
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
  g.fillStyle = dk; g.beginPath(); g.arc(0, -s * .21 + b, s * .11, Math.PI, 0); g.fill(); g.fillRect(-s * .13, -s * .22 + b, s * .26, s * .03);
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
    stroke(g, s, -.1, .04 + b / s, .26, -.12 + b / s + sw / s, Math.max(2, s * .05), INK);
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
  stroke(g, s, -.12, .25, .22, .25, 2, INK); stroke(g, s, -.05, .1, -.05, .25, 2, INK); stroke(g, s, .14, .1, .14, .25, 2, INK);
  box(g, s, -.44, -.04, .34, .06, 1, dk); box(g, s, -.46, -.16, .05, .22, 1, dk);
  oval(g, s, 0, 0, .24, .15, c); oval(g, s, .12, -.02, .1, .09, GLASS);                       // one cockpit
  g.fillStyle = INK; g.fillRect(s * .22, s * .05, s * .13, s * .03);
  const rl = (run ? Math.abs(Math.cos(w * 22)) : .6) * s * .36 + s * .05;
  stroke(g, s, -rl / s, -.19, rl / s, -.19, 2.5, INK); g.fillStyle = INK; g.fillRect(-s * .02, -s * .21, s * .04, s * .08);
};

// Fighter and bomber are drawn in a 3/4 view from above and slightly ahead: the near wing sweeps down toward the viewer,
// the far wing is shorter and darker behind the fuselage, and the tail fin stands up.
const fighter = (g, { s, c, dk, w, run }) => {
  const fl = (run ? .6 + .4 * Math.sin(w * 40) : .3) * s * .1, far = mix(c, dk, .6), near = mix(c, dk, .3);
  poly(g, s, [[-.36, -.02], [-.36 - fl / s, .01], [-.36, .04]], '#ff9a2e');                   // afterburner
  poly(g, s, [[.0, -.05], [-.14, -.2], [-.22, -.2], [-.2, -.05]], far);                       // far wing
  poly(g, s, [[-.3, -.05], [-.37, -.12], [-.41, -.12], [-.38, -.04]], far);                   // far tailplane
  poly(g, s, [[-.16, -.05], [-.27, -.25], [-.34, -.25], [-.33, -.05]], dk);                   // tail fin
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
  poly(g, s, [[-.26, -.07], [-.36, -.28], [-.45, -.28], [-.44, -.06]], dk);                   // tail fin
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

// stealth bomber (planned unit, not in the game yet): flying wing
const stealthTop = [[.42, 0], [-.2, -.36], [-.27, -.33], [-.12, -.2], [-.24, -.12], [-.14, -.03], [-.2, 0]];
const stealth = (g, { s, c, dk }) => {
  poly(g, s, mirror(stealthTop), mix(c, dk, .35));
  poly(g, s, mirror([[.42, 0], [.02, -.14], [-.16, -.1], [-.16, 0]]), c);
  poly(g, s, mirror([[.34, 0], [.24, -.03]]).concat([[.24, .03]]).slice(0, 3), GLASS);
};

export const SPRITES = {
  soldier: trooper('soldier'), mech: trooper('mech'), sniper: trooper('sniper'),
  recon, tank: tank(false), heavy_tank: tank(true), artillery, flak, copter, fighter, bomber, stealth_bomber: stealth,
};

// ---- shadows: each shape matches its unit's footprint ---------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const airShadow = (outline) => (g, { s, alt = 0 }) => {
  g.save(); g.translate(0, s * (.25 + alt * .35)); g.scale(s, s * .3);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); outline.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.restore();
};

export const SHADOWS = {
  soldier: ground(.17, .04, .3), mech: ground(.19, .04, .3), sniper: ground(.2, .04, .3),
  recon: ground(.3, .05, .285), tank: ground(.36, .05, .275), heavy_tank: ground(.36, .05, .275),
  artillery: ground(.29, .045, .285, -.01), flak: ground(.32, .05, .275),
  copter: airShadow(mirror([[.34, .0], [.2, -.1], [-.1, -.13], [-.2, -.04], [-.46, -.03], [-.46, 0]])),
  fighter: airShadow(mirror([[.42, 0], [.05, -.07], [-.2, -.32], [-.27, -.32], [-.29, -.08], [-.38, -.14], [-.34, -.03], [-.32, 0]])),
  bomber: airShadow(mirror([[.46, 0], [.4, -.05], [.1, -.07], [-.08, -.36], [-.2, -.36], [-.14, -.07], [-.3, -.06], [-.4, -.17], [-.46, -.17], [-.43, -.03], [-.46, 0]])),
  stealth_bomber: airShadow(mirror(stealthTop)),
};
