// Pocket Wars unit art: flat fills, no outlines, one sprite and one shadow per unit.
//   SPRITES[name](g, { s, c, dk, w, ph, run, b, j })   draws the unit
//   SHADOWS[name](g, { s, alt, w, ph, run })            draws the ground shadow, shaped like the unit
// `render.sprite` in data/units.json selects the name. Self-contained and browser-safe (no imports); the game
// (unit-sprites.js), the gallery page and the sprite lab all run this same file.
// Everything is drawn in a 100-unit tile space centred on (0, 0), facing right.

const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const lighten = (h, t) => mix(h, '#ffffff', t);
const darken = (h, t) => mix(h, '#000000', t);

// neutral colours shared by every faction
const N = {
  ink: '#222', tread: '#2b2b2b', pad: '#9a9a9a', steel: '#9a9fa8', steelD: '#565a64', glass: '#cfe6f5',
  skin: '#f1c99b', boot: '#2e2620', brown: '#7a5230', olive: '#4b5238', oliveL: '#6b7048', oliveD: '#3a4029', flame: '#ff9a2e', flameL: '#ffd35c',
};

function build() {

  // A painter bound to one canvas context: every method fills one flat shape.
  function painter(g) {
    const finish = (col) => { g.fillStyle = col; g.fill(); };
    return {
      rect(x, y, w, h, r, col) { g.beginPath(); g.roundRect(x, y, w, h, r); finish(col); },
      poly(pts, col) {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath();
        finish(col);
      },
      circ(x, y, r, col) { g.beginPath(); g.arc(x, y, r, 0, 7); finish(col); },
      ell(x, y, rx, ry, col, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), ry, rot, 0, 7); finish(col); },
      // half disc (dome / helmet): top half of a circle
      dome(x, y, r, col) { g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.closePath(); finish(col); },
      line(x0, y0, x1, y1, th, col) { g.strokeStyle = col; g.lineWidth = th; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); },
      flat(col) { g.fillStyle = col; g.fill(); },
    };
  }

  const wrap = (fn) => (g, p) => {
    g.save(); g.scale(p.s / 100, p.s / 100);
    const k = 100 / p.s;                    // px -> tile units (b and j arrive in pixels)
    fn(g, painter(g), { ...p, b: p.b * k, j: p.j * k });
    g.restore();
  };

  // ---- shared building blocks -------------------------------------------------------------------------
  const wheel = (U, g, x, y, r, w, run, spin = 10) => {
    U.circ(x, y, r, N.ink); U.circ(x, y, r * .5, '#b9b9b9'); U.circ(x, y, r * .18, N.steelD);
    const a = w * spin * run; g.strokeStyle = N.steelD; g.lineWidth = 1.3; g.beginPath();
    for (let i = 0; i < 3; i++) { const t = a + i * Math.PI / 3; g.moveTo(x - Math.cos(t) * r * .5, y - Math.sin(t) * r * .5); g.lineTo(x + Math.cos(t) * r * .5, y + Math.sin(t) * r * .5); }
    g.stroke();
  };
  // tank running gear: rounded track body, track pads that scroll, road wheels, drive sprocket + idler
  const tracks = (U, g, x0, x1, y0, hgt, w, run) => {
    U.rect(x0, y0, x1 - x0, hgt, hgt / 2, N.tread);
    const off = (w * 30 * run) % 12; g.fillStyle = N.pad;
    for (let x = x0 + 5 + off - 12; x < x1 - 8; x += 12) if (x > x0 + 4) { g.fillRect(x, y0 + .8, 5, 2.4); g.fillRect(x, y0 + hgt - 3.2, 5, 2.4); }
    const n = Math.round((x1 - x0 - 24) / 12) + 1;
    for (let i = 0; i < n; i++) { const x = x0 + 12 + i * ((x1 - x0 - 24) / Math.max(1, n - 1)); U.circ(x, y0 + hgt / 2, hgt * .3, '#5c5c5c'); U.circ(x, y0 + hgt / 2, hgt * .12, N.tread); }
    U.circ(x0 + hgt * .5, y0 + hgt / 2, hgt * .36, '#6e6e6e'); U.circ(x1 - hgt * .5, y0 + hgt / 2, hgt * .36, '#6e6e6e');
  };

  // ---- infantry family: shared body, head and walk cycle; a kit supplies the pack and the weapon ----------------
  const GHILLIE = (c) => mix(c, '#56643a', .6);
  const KIT = {
    // rifleman: backpack with bedroll, rifle held across the chest
    infantry: {
      pack(U, { dk, b }) { U.rect(-22, -9 + b, 10, 23, 3.5, dk); U.rect(-23, -13 + b, 12, 6, 3, N.oliveL); },
      weapon(g, U, { c, b, sw }) {
        U.line(-2, 2 + b, 15, 4 + b + sw * .5, 6.5, c);                                          // arm, under the rifle
        U.line(-12, 8 + b, -3, 4 + b, 6, N.brown);
        U.line(-9, 5 + b, 33, -9.5 + b + sw, 3.4, N.ink); U.rect(6, 0 + b, 3, 6, 1, N.ink);      // rifle stays fully visible
        U.circ(17, 1.6 + b + sw * .6, 3.2, N.skin);                                              // hand grips from below
      },
    },
    // mech: rocket pack and a bazooka resting on the shoulder
    mech: {
      pack(U, { dk, c, b }) {
        U.rect(-22, -9 + b, 10, 23, 3.5, dk); U.rect(-21, -15 + b, 3.6, 7, 1.4, N.steel); U.rect(-16, -15 + b, 3.6, 7, 1.4, N.steel); U.rect(-21, -2 + b, 9, 3, 1, c);
      },
      weapon(g, U, { c, b, sw }) {
        g.save(); g.translate(3, -6 + b); g.rotate(-.24 + sw * .01);
        U.rect(-30, -5, 64, 10, 5, N.olive); U.rect(-30, -5, 64, 3, 1.5, N.oliveL); U.rect(-9, -5, 3, 10, 0, N.oliveD); U.rect(13, -5, 3, 10, 0, N.oliveD);
        U.rect(-36, -6.5, 7, 13, 3, N.steelD); U.rect(32, -7.5, 7, 15, 3, N.steel); U.rect(4, -9, 9, 4, 1, N.ink);
        g.restore();
        U.line(-2, 1 + b, 15, 0 + b, 7, c); U.circ(17.5, -.5 + b, 3.4, N.skin);
      },
    },
    // sniper: ghillie-draped pack and a very long scoped rifle
    sniper: {
      pack(U, { c, b }) {
        const gh = GHILLIE(c), ghL = lighten(gh, .22);
        U.rect(-23, -9 + b, 12, 24, 4, gh);
        for (let i = 0; i < 3; i++) U.poly([[-23 + i * 4, -8 + b], [-21 + i * 4, -15 + b], [-19 + i * 4, -8 + b]], ghL);
        U.rect(-24, 4 + b, 4, 12, 1.5, ghL);
      },
      weapon(g, U, { c, b, sw }) {
        const sy = sw * .5;
        U.line(-2, 2 + b, 20, 3 + b + sy, 6.5, c);                                               // arm, under the rifle
        U.line(-13, 7.5 + b, -5, 4 + b, 6, N.brown);
        U.line(-10, 6 + b, 47, -14.4 + b + sy, 3, N.ink); U.rect(44, -17.8 + b + sy, 4, 6, 1.2, N.steelD);
        g.save(); g.translate(19, -9.4 + b + sy * .3); g.rotate(-.34);
        U.rect(-10.5, -2.6, 21, 5.2, 2.6, '#15151b'); U.circ(10.5, 0, 2.8, '#7fd0ff'); U.circ(-10.5, 0, 2.3, '#3a3a44'); U.rect(-4, 2.4, 3, 3, .8, N.steelD); U.rect(3, 2.4, 3, 3, .8, N.steelD);
        g.restore();
        U.line(38, -11 + b + sy, 42, -5.5 + b, 1.6, '#333'); U.line(39, -11 + b + sy, 36, -5.5 + b, 1.6, '#333');
        U.circ(22, -.6 + b + sy, 3.2, N.skin);                                                   // hand grips from below
      },
    },
  };
  const trooper = (kit) => wrap((g, U, { c, dk, w, ph, run, b }) => {
    const l = Math.sin(w * 8 + ph) * 5 * run, sw = Math.sin(w * 8 + ph) * 2 * run;
    U.rect(-15, 12, 11, 17 + l, 3, dk); U.rect(4, 12, 11, 17 - l, 3, dk);
    U.rect(-17, 25 + l, 14, 5, 2, N.boot); U.rect(3, 25 - l, 14, 5, 2, N.boot);
    kit.pack(U, { c, dk, b });
    U.rect(-14, -12 + b, 28, 28, 7, c);
    U.rect(-9, 3 + b, 7, 7, 1.5, dk); U.rect(2, 3 + b, 7, 7, 1.5, dk); U.rect(-14, 12 + b, 28, 4, 1, dk);
    U.circ(0, -20 + b, 9, N.skin); U.circ(4, -19 + b, 1.2, N.ink);
    U.dome(0, -21 + b, 11.5, dk); U.rect(-13.5, -22.5 + b, 27, 3.6, 1.6, dk); U.line(-8, -19 + b, -6, -12 + b, 1.6, dk);
    kit.weapon(g, U, { c, dk, b, sw });
  });

  const SPRITES = {
    // ---- the infantry family: one body and head, differing only in pack and weapon ----------------------
    infantry: trooper(KIT.infantry),
    mech: trooper(KIT.mech),
    sniper: trooper(KIT.sniper),

    // ---- recon: jeep with roll bar, pintle MG, spare tyre, fenders and lamps --------------------------
    recon: wrap((g, U, { c, dk, w, run, j }) => {
      U.rect(-32, -2 + j, 41, 22, 5, c); U.rect(4, 3 + j, 30, 17, 4, c); U.rect(-32, 12 + j, 66, 8, 4, dk);
      U.poly([[3, -16 + j], [9, -16 + j], [18, 3 + j], [3, 3 + j]], dk); U.poly([[5.5, -13.5 + j], [8.5, -13.5 + j], [14, 0 + j], [5.5, 0 + j]], N.glass);
      U.rect(-19, -17 + j, 3.2, 17, 1, dk); U.rect(-6, -17 + j, 3.2, 17, 1, dk); U.rect(-20, -19 + j, 18, 3.2, 1.6, dk);
      U.rect(-13, -22 + j, 3, 7, 1, N.ink); U.rect(-22, -26 + j, 22, 5.5, 2.5, N.steelD); U.line(0, -23.2 + j, 17, -23.2 + j, 2.8, N.ink); U.rect(-24, -22 + j, 6, 5, 1, N.olive);
      U.circ(-34, 5 + j, 7.5, N.ink); U.circ(-34, 5 + j, 3.2, '#666');
      U.rect(-2, 6 + j, 8, 6, 1.5, mix(c, '#000', .2));
      U.circ(33, 7 + j, 3.2, '#ffe27a'); U.rect(31, 14 + j, 6, 6, 2, N.steel);
      g.fillStyle = dk; g.beginPath(); g.arc(-20, 20, 11.5, Math.PI, 0); g.fill(); g.beginPath(); g.arc(20, 20, 11.5, Math.PI, 0); g.fill();
      wheel(U, g, -20, 20, 9, w, run); wheel(U, g, 20, 20, 9, w, run);
    }),

    // ---- tank: sloped glacis, side skirts, angular turret, commander MG, antenna ------------------------
    tank: wrap((g, U, { c, dk, w, ph, run, j }) => {
      tracks(U, g, -37, 37, 8 + j, 21, w, run);
      U.rect(-33, -6 + j, 64, 20, 5, c); U.poly([[28, -6 + j], [38, 5 + j], [38, 14 + j], [28, 14 + j]], c); U.rect(-33, -9 + j, 34, 5, 2, c);
      U.rect(-34, 4 + j, 66, 9, 3, dk); for (let i = 0; i < 5; i++) U.rect(-28 + i * 13, 5.5 + j, 1.6, 6, 0, mix(dk, '#000', .3));
      U.rect(-32, -3 + j, 60, 1.6, .8, lighten(c, .3));
      U.poly([[-18, -8 + j], [-14, -25 + j], [13, -25 + j], [21, -16 + j], [21, -8 + j]], dk);
      U.rect(19, -21 + j, 7, 11, 2, mix(dk, '#000', .2));
      U.circ(-4, -28 + j, 5, dk); U.rect(-9, -28 + j, 10, 3, 1, mix(dk, '#000', .25));
      U.line(-1, -30 + j, 11, -31 + j, 2, N.ink);
      const sx = Math.sin(w * 2 + ph) * 1.4 * run; U.line(-13, -24 + j, -15 + sx, -42 + j, 1.2, N.ink);
      U.rect(24, -20 + j, 22, 5.6, 1, N.ink); U.rect(41, -22 + j, 6, 10, 1.5, '#3a3a3a'); U.rect(31, -21.5 + j, 4, 8.6, 1, '#3a3a3a');
    }),

    // ---- heavy tank: wider hull, segmented skirts, reactive blocks, twin guns --------------------------
    heavy_tank: wrap((g, U, { c, dk, w, ph, run, j }) => {
      tracks(U, g, -40, 40, 6 + j, 24, w, run);
      U.rect(-36, -13 + j, 72, 26, 5, c); U.poly([[32, -13 + j], [42, 0 + j], [42, 14 + j], [32, 14 + j]], c);
      for (let i = 0; i < 6; i++) U.rect(-35 + i * 12, 1 + j, 11, 12, 2, dk);
      U.rect(-35, -10 + j, 68, 1.8, .9, lighten(c, .3));
      U.poly([[-25, -13 + j], [-20, -34 + j], [16, -34 + j], [27, -22 + j], [27, -13 + j]], dk);
      for (let i = 0; i < 3; i++) U.rect(3 + i * 7, -33 + j, 5.5, 8, 1, c);
      U.rect(-9, -39 + j, 10, 6, 3, dk); U.line(-4, -40 + j, 6, -41 + j, 2.2, N.ink);
      U.rect(-21, -38 + j, 6, 5, 1, N.steel);
      const sx = Math.sin(w * 2 + ph) * 1.4 * run; U.line(-18, -33 + j, -20 + sx, -45 + j, 1.2, N.ink);
      U.rect(26, -31 + j, 21, 5.5, 1, N.ink); U.rect(26, -20 + j, 21, 5.5, 1, N.ink);
      U.rect(42, -33 + j, 6, 9.5, 1.5, '#3a3a3a'); U.rect(42, -22 + j, 6, 9.5, 1.5, '#3a3a3a');
    }),

    // ---- artillery: towed howitzer, split trails, recoil sleeve, shield, wheel with fender --------------
    artillery: wrap((g, U, { c, dk, w, ph, run }) => {
      U.poly([[-6, 20], [-38, 29], [-41, 26], [-10, 14]], mix(dk, '#000', .2)); U.poly([[-4, 21], [-33, 29], [-36, 26], [-8, 16]], dk);
      U.rect(-44, 25, 7, 5, 1.5, N.ink);
      U.rect(-15, 5, 36, 15, 4, c); U.rect(-13, -1, 15, 9, 3, dk); U.rect(-13, 12, 33, 3, 1, dk);
      U.rect(-17, 9, 10, 8, 1.5, N.brown);
      g.save(); g.translate(-4, 5); g.rotate(-.55 + Math.sin(w * 1.5 + ph) * .12 * run);
      U.rect(-4, -5.5, 26, 11, 4, c); U.rect(0, -3.4, 50, 6.8, 2, dk); U.rect(18, -5, 3, 10, 1, N.steelD);
      U.rect(46, -6, 9, 12, 2, N.ink); U.rect(49, -4.5, 1.6, 9, 0, dk); U.rect(52, -4.5, 1.6, 9, 0, dk);
      g.restore();
      U.rect(15, -12, 6, 32, 2, dk);
      g.fillStyle = dk; g.beginPath(); g.arc(2, 22, 11.5, Math.PI, 0); g.fill();
      wheel(U, g, 2, 22, 9.5, w, run, 6);
    }),

    // ---- flak: self-propelled AA gun. Spinning search radar, twin recoiling cannon, tracking dome ------
    flak: wrap((g, U, { c, dk, w, ph, run, j }) => {
      tracks(U, g, -35, 35, 9 + j, 20, w, run);
      U.rect(-31, -4 + j, 62, 18, 5, c); U.poly([[27, -4 + j], [36, 6 + j], [36, 14 + j], [27, 14 + j]], c);
      U.rect(-32, 5 + j, 64, 8, 3, dk);
      U.rect(-22, -25 + j, 44, 22, 5, dk); U.rect(-20, -16 + j, 40, 3, 1, c); U.rect(-14, -29 + j, 13, 6, 2, mix(dk, '#000', .25));
      U.dome(14, -25 + j, 6.5, N.steel); U.rect(9, -25 + j, 11, 2, 0, N.steelD);
      U.rect(-30, -20 + j, 4, 17, 1, N.ink);
      const dw = Math.abs(Math.cos(w * 3 * run)) * 12 + 2; U.ell(-28, -24 + j, dw, 6.5, N.steel); U.ell(-28, -24 + j, Math.max(.5, dw - 3), 3.6, N.steelD); U.circ(-28, -24 + j, 1.6, N.ink);
      const rec = run ? Math.max(0, Math.sin(w * 18)) * -3.5 : 0;
      g.save(); g.translate(13, -16 + j); g.rotate(-.72 + Math.sin(w * 2 + ph) * .1 * run);
      U.rect(-4, -11, 12, 21, 3, dk);
      U.rect(4 + rec, -9, 30, 4.6, 1, N.ink); U.rect(4 + rec, 3.4, 30, 4.6, 1, N.ink);
      U.rect(28 + rec, -10.5, 8, 7.6, 1.5, '#3a3a3a'); U.rect(28 + rec, 2, 8, 7.6, 1.5, '#3a3a3a');
      g.restore();
    }),

    // ---- copter: attack helicopter. Slim fuselage, tandem canopy, stub wings with pods, skids, blurred rotor disc --
    copter: wrap((g, U, { c, dk, w, run }) => {
      g.translate(COPTER_FIT.dx, COPTER_FIT.dy); g.scale(COPTER_FIT.k, COPTER_FIT.k);
      // skids and struts
      U.line(-14, 21, 30, 21, 2.6, N.ink); U.line(30, 21, 35, 17, 2.2, N.ink); U.line(-3, 11, -6, 21, 2, N.ink); U.line(19, 11, 21, 21, 2, N.ink);
      // tail boom, fin, tailplane, tail rotor
      U.poly([[-14, -3], [-50, -1.5], [-50, 2.2], [-14, 6.5]], c);
      U.poly([[-50, -2], [-46, -16], [-40, -16], [-43, 1]], dk); U.rect(-49, 0, 13, 3, 1, dk);
      const ta = w * 40 * run; g.fillStyle = 'rgba(30,30,30,.22)'; g.beginPath(); g.arc(-47, -9, 8, 0, 7); g.fill();
      U.line(-47 - Math.cos(ta) * 8, -9 - Math.sin(ta) * 8, -47 + Math.cos(ta) * 8, -9 + Math.sin(ta) * 8, 2, N.ink);
      // fuselage, nose, engine cowlings
      U.ell(2, 1, 25, 10.5, c); U.poly([[18, -6], [41, 4.5], [33, 10.5], [14, 10.5]], c);
      U.rect(-14, -11, 22, 6, 3, dk); U.rect(-16, -9, 5, 3, 1.5, N.ink);
      U.rect(-8, 6, 24, 4, 2, dk);
      // single canopy
      U.poly([[12, -5], [19, -13], [30, -10.5], [38, 2], [14, 1]], N.glass);
      U.line(24, -11.5, 26, 0.5, 1.2, dk);
      // stub wing with rocket pod and missiles
      U.rect(-5, 9, 22, 3.5, 1.5, dk); U.rect(-2, 12, 16, 6, 3, N.steelD); U.rect(12, 13.2, 6, 3.6, 1.8, N.pad); U.circ(-1, 15, 2.2, N.ink);
      U.line(31, 10, 43, 12, 2.8, N.ink);                                                     // chin gun
      // rotor: mast, hub, blurred disc, blades
      U.rect(-2, -20, 4, 9, 1, N.ink); U.rect(-6, -22, 12, 3.2, 1.6, N.steelD);
      g.fillStyle = run ? 'rgba(30,30,30,.16)' : 'rgba(30,30,30,.05)'; g.beginPath(); g.ellipse(0, -21, 47, 4.6, 0, 0, 7); g.fill();
      const ra = w * 24 * run, rl = 46;
      U.line(-Math.cos(ra) * rl, -21 - Math.sin(ra) * 3.2, Math.cos(ra) * rl, -21 + Math.sin(ra) * 3.2, 2.6, '#333');
      U.line(-Math.sin(ra) * rl, -21 + Math.cos(ra) * 3.2, Math.sin(ra) * rl, -21 - Math.cos(ra) * 3.2, 2.6, '#333');
    }),

    // ---- fighter: modern twin-tail stealth fighter in plan view ---------------------------------------
    fighter: wrap((g, U, { c, dk, w, run }) => {
      fighterParts(g, U, c, dk, w, run);
    }),

    // ---- bomber: four-engine military transport-style jet in plan view: swept high wings, T-tail, cargo fuselage ----
    bomber: wrap((g, U, { c, dk, w, run }) => {
      g.scale(BOMBER_FIT[0], BOMBER_FIT[1]);
      const wingC = mix(c, dk, .3), wing = [[14, -7], [-4, -40], [-13, -40], [-16, -7]];
      for (const sy of [-1, 1]) {
        U.poly(wing.map(([x, y]) => [x, y * -sy]), wingC);                                                // wings
        U.poly([[-31, sy * 6], [-40, sy * 19], [-46, sy * 19], [-44, sy * 5]], wingC);                     // tailplanes
        U.line(-5, sy * 39.6, -12, sy * 39.6, 1.4, lighten(c, .4));                                        // wingtip edge
      }
      // engine nacelles: two per wing, hung forward of the leading edge
      for (const sy of [-1, 1]) for (const ey of [17, 30]) {
        const x0 = 14 - (ey - 7) * (18 / 33) + 6;                                                           // leading edge x at this span
        U.rect(x0 - 17, sy * ey - 2.9, 17, 5.8, 2.9, N.steel); U.rect(x0 - 17, sy * ey - 2.9, 17, 2, 1, lighten(N.steel, .3));
        U.rect(x0 - 2, sy * ey - 2.5, 3, 5, 1.5, N.ink);                                                   // intake lip
        U.rect(x0 - 20, sy * ey - 2, 4, 4, 1.5, N.steelD);                                               // exhaust cone
      }
      U.ell(0, 0, 47, 8, c);                                                                                // fuselage
      U.poly([[-30, -6], [-48, -1.8], [-48, 1.8], [-30, 6]], c);                                            // tail cone
      U.rect(-46, -1, 20, 2, 1, dk);                                                                        // tail fin (seen from above)
      U.rect(-20, -3.4, 30, 6.8, 2, dk);                                                                    // cargo / bomb-bay doors
      U.line(-5, -3.4, -5, 3.4, 1, c); U.line(-15, -3.4, -15, 3.4, 1, c);
      U.poly([[33, -3], [42, -1.6], [42, 1.6], [33, 3]], N.glass); U.line(37.5, -2.4, 37.5, 2.4, 1, dk);   // cockpit glazing
      U.rect(20, -1, 8, 2, 1, lighten(c, .3));                                                              // spine highlight
      const blink = run ? (Math.sin(w * 6) > 0) : true;                                                     // wingtip strobes, alternating
      U.circ(-8.5, -39.6, 1.9, blink ? '#ff5a4a' : dk); U.circ(-8.5, 39.6, 1.9, blink ? dk : '#7dffb0');
    }),

    // ---- stealth_bomber: flying-wing stealth bomber in plan view (planned unit, not in the game yet) --------
    stealth_bomber: wrap((g, U, { c, dk, w, run }) => {
      g.scale(STEALTH_FIT[0], STEALTH_FIT[1]);
      const wingPts = stealthOutline();
      U.poly(wingPts, mix(c, dk, .38));                                                          // outer wing
      U.poly(mirror([[35, 0], [8, -13], [-8, -20], [-18, -12], [-17, 0]]), c);                     // lighter centre section
      for (const sy of [-1, 1]) {
        U.poly([[12, sy * 7], [22, sy * 4.5], [22, sy * 9], [13, sy * 11]], N.ink);               // intake mouths
        U.poly([[-2, sy * 4], [-16, sy * 4], [-17, sy * 8], [-4, sy * 9]], mix(dk, '#000', .35));   // engine bays
        U.line(-10, sy * 27, -22, sy * 42, 1.6, lighten(c, .35));                                 // wingtip edge highlight
      }
      U.poly([[26, -3.5], [33, -1.5], [33, 1.5], [26, 3.5]], N.glass); U.line(29.5, -3, 29.5, 3, 1, dk);
      U.rect(-12, -1.2, 12, 2.4, 1.2, lighten(dk, .12));
    }),
  };

  // ---- aircraft geometry (shared by sprite and shadow) -----------------------------------------------------
  function mirror(top) { const bottom = top.slice(1, -1).reverse().map(([x, y]) => [x, -y]); return top.concat(bottom); }
  function fighterOutline() {
    return mirror([[42, 0], [31, -3.5], [22, -6], [12, -9], [-8, -31], [-19, -31], [-23, -11], [-27, -9], [-38, -19], [-43, -19], [-39, -8], [-40, -4], [-40, 0]]);
  }
  const STEALTH_FIT = [1.22, .78];
  const BOMBER_FIT = [.98, .84];
  function bomberOutline() {
    return mirror([[47, 0], [40, -5], [30, -7.5], [14, -8], [-4, -40], [-13, -40], [-16, -8], [-31, -7], [-40, -19], [-46, -19], [-45, -4], [-48, 0]]);
  }
  const COPTER_FIT = { k: .87, dx: 5, dy: 3 };
  function stealthOutline() {
    return mirror([[35, 0], [-22, -46], [-27, -44], [-9, -34], [-21, -27], [-7, -17], [-27, -8], [-17, 0]]);
  }
  function fighterParts(g, U, c, dk, w, run) {
    const fl = run ? (.7 + .3 * Math.sin(w * 40)) * 7.5 : 3.5;
    for (const sy of [-1, 1]) {
      U.poly([[-40, sy * 2], [-40 - fl, sy * 3.2], [-40, sy * 4.4]], N.flame); U.poly([[-40, sy * 2.8], [-40 - fl * .55, sy * 3.2], [-40, sy * 3.7]], N.flameL);
    }
    const wingC = mix(c, dk, .38), top = [[12, -9], [-8, -31], [-19, -31], [-23, -11]];
    U.poly(top, wingC); U.poly(top.map(([x, y]) => [x, -y]), wingC);                                        // wings
    for (const sy of [-1, 1]) {
      U.poly([[-27, sy * 9], [-38, sy * 19], [-43, sy * 19], [-39, sy * 8]], wingC);                       // tailplanes
      U.poly([[-24, sy * 5], [-37, sy * 7], [-37, sy * 4.4], [-24, sy * 3]], mix(dk, '#000', .15));   // canted fins
      U.poly([[-9, sy * 26], [-16, sy * 26.5], [-17, sy * 30], [-10, sy * 29.5]], c);                  // wingtip flashes
    }
    U.poly(mirror([[42, 0], [31, -3.5], [22, -6], [12, -9], [-8, -10], [-24, -9], [-27, -8], [-39, -6], [-40, -3], [-40, 0]]).map(([x, y]) => [x, y]), c); // fuselage
    for (const sy of [-1, 1]) U.poly([[15, sy * 5.6], [24, sy * 6.6], [24, sy * 9.6], [15, sy * 9]], N.ink);  // intakes
    U.ell(21, 0, 9.5, 3.4, N.glass); U.ell(23, -.8, 4, 1, '#fff');
    U.rect(-40, -4.8, 5, 3.6, 1, N.ink); U.rect(-40, 1.2, 5, 3.6, 1, N.ink);                              // nozzles
    U.rect(-12, -1, 20, 2, 1, lighten(c, .3));                                                             // spine stripe
  }

  // ---- shadows: each shape matches its unit's footprint ---------------------------------------------------
  const ground = (rx, ry, y, dx = 0) => (g, { s }) => {
    g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill();
  };
  const airShadow = (outline, sx = 1, alpha = .22) => (g, { s, alt = 0 }) => {
    const pts = outline();
    g.save(); g.translate(0, s * (.25 + alt * .35)); g.scale(s / 100 * sx, s / 100 * .3);
    g.fillStyle = `rgba(0,0,0,${alpha})`; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.restore();
  };
  const copterOutline = () => [[-50, -2], [-14, -3], [-6, -21], [6, -21], [16, -8], [42, 4], [33, 11], [-14, 7], [-50, 2], [-48, -2], [-6, 21], [6, 21], [-2, 18]].slice(0, 9);
  const SHADOWS = {
    infantry: ground(.2, .045, .295),
    mech: ground(.2, .045, .295),
    sniper: ground(.2, .045, .295),
    recon: ground(.36, .05, .29),
    tank: ground(.4, .05, .29),
    heavy_tank: ground(.44, .055, .3),
    artillery: ground(.36, .045, .295, -.01),
    flak: ground(.39, .05, .29),
    copter: airShadow(() => copterOutline().map(([x, y]) => [x * COPTER_FIT.k + COPTER_FIT.dx, y * COPTER_FIT.k]), 1),
    fighter: airShadow(fighterOutline),
    stealth_bomber: airShadow(() => stealthOutline().map(([x, y]) => [x * STEALTH_FIT[0], y * STEALTH_FIT[1]])),
    bomber: airShadow(() => bomberOutline().map(([x, y]) => [x * BOMBER_FIT[0], y * BOMBER_FIT[1]])),
  };
  return { SPRITES, SHADOWS };
}

export const { SPRITES, SHADOWS } = build();
