// Experimental concept units, Engineer Works group: immobile static defences. Same conventions as concept-art.js.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
import { box, disc, oval, poly, stroke, mirror, mix, GLASS, INK, STEEL } from '../src/render/parts.js';

const CONCRETE = '#a9a79e', CONC_DK = '#807e77', SAND = '#c9b27c', SAND_DK = '#a38d58', ORANGE = '#ff9a2e', RED = '#d4442e';

// A static unit sits on a poured pad so it reads as a fixture, not a vehicle.
const pad = (g, s, x0 = -.42, x1 = .42) => {
  box(g, s, x0, .24, x1 - x0, .08, 2, CONC_DK);
  box(g, s, x0 + .02, .24, x1 - x0 - .04, .03, 1, mix(CONCRETE, '#ffffff', .15));
};
const sandbag = (g, s, x, y, w = .13, h = .07) => {
  box(g, s, x, y, w, h, h * s * .5, SAND); box(g, s, x + .01, y + h * .55, w - .02, h * .4, h * s * .3, SAND_DK);
};
const glint = (g, s, x, y, w, ph, run, period = 3.2) => {
  const k = run ? Math.max(0, Math.sin(w * period + ph)) ** 6 : 0;
  if (k > .02) { disc(g, s, x, y, .028 * k + .01, `rgba(255,230,140,${(.9 * k).toFixed(2)})`); }
};

// Gun turret: a squat concrete pillbox with a firing slit and a machine gun that sweeps a few degrees.
const gunTurret0 = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.34, .34);
  poly(g, s, [[-.3, .24], [-.3, .02], [-.2, -.1], [.2, -.1], [.3, .02], [.3, .24]], CONCRETE);               // bunker body
  poly(g, s, [[-.3, .24], [-.3, .02], [-.2, -.1], [-.12, -.1], [-.17, .24]], mix(CONCRETE, '#ffffff', .18)); // lit rear plane
  poly(g, s, [[.3, .24], [.3, .02], [.2, -.1], [.12, -.1], [.17, .24]], CONC_DK);                            // shaded front plane
  box(g, s, -.3, .1, .6, .05, 0, c);                                                                          // team stripe
  box(g, s, -.04, .02, .34, .06, 2, INK);                                                                     // firing slit
  oval(g, s, -.03, -.1, .17, .06, mix(c, dk, .25));                                                           // armoured cupola cap
  box(g, s, -.1, -.19, .14, .08, 3, c);                                                                       // turret ring
  const sw = run ? Math.sin(w * 1.1 + ph) * .1 : 0;
  g.save(); g.translate(.0, -.14 * s); g.rotate(sw);
  box(g, s, -.03, -.03, .24, .045, 1, INK); box(g, s, .2, -.045, .08, .02, 0, STEEL);                         // MG barrel with a muzzle brake
  g.restore();
  glint(g, s, .3 + Math.cos(sw) * .0, -.14 + sw * .3, w, ph, run);
  sandbag(g, s, .3, .18, .12, .06); sandbag(g, s, .33, .12, .09, .06);
};

const gunTurret = (g, o) => { g.save(); g.translate(o.s * .04, 0); gunTurret0(g, o); g.restore(); };

// Cannon turret: a reinforced stepped base under a heavy rounded turret and a long cannon that recoils.
const cannonTurret = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.44, .44);
  poly(g, s, [[-.4, .24], [-.34, .0], [.34, .0], [.4, .24]], CONCRETE);                                       // sloped reinforced base
  poly(g, s, [[-.4, .24], [-.34, .0], [-.2, .0], [-.24, .24]], mix(CONCRETE, '#ffffff', .15));
  for (const x of [-.22, .0, .22]) box(g, s, x - .005, .04, .01, .2, 0, CONC_DK);                              // reinforcement ribs
  box(g, s, -.38, .15, .76, .045, 0, dk);                                                                     // armour band
  box(g, s, -.3, -.06, .6, .08, 2, mix(c, dk, .5));                                                           // turret ring
  poly(g, s, [[-.28, -.05], [-.22, -.2], [.1, -.22], [.22, -.1], [.2, -.05]], c);                              // heavy turret
  poly(g, s, [[-.22, -.2], [.1, -.22], [.22, -.1], [-.28, -.05]].map(([x, y]) => [x, y]), mix(c, '#ffffff', .12));
  poly(g, s, [[-.28, -.05], [.2, -.05], [.22, -.1], [-.26, -.1]], dk);
  box(g, s, -.12, -.27, .1, .06, 2, dk); box(g, s, -.09, -.26, .05, .03, 1, GLASS);                           // hatch / sight
  const rec = run ? Math.max(0, Math.sin(w * 1.3 + ph)) ** 8 * .035 : 0;
  box(g, s, .14 - rec, -.17, .1, .1, 2, dk);                                                                  // mantlet
  box(g, s, .2 - rec, -.145, .26, .05, 1, INK);                                                               // barrel
  box(g, s, .43 - rec, -.155, .05, .07, 1, STEEL);                                                            // muzzle brake
  glint(g, s, .5, -.12, w, ph, run && rec > .004 ? 1 : 0, 1.3);
};

// SAM site: a swivel pad carrying a four-tube launcher tipped skyward, plus a spinning radar dish on a mast.
const samSite = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.42, .42);
  box(g, s, -.1, .1, .32, .14, 3, dk); box(g, s, -.1, .1, .32, .04, 1, c);                                     // launcher plinth
  disc(g, s, .05, .08, .06, STEEL);                                                                            // pivot
  g.save(); g.translate(.05 * s, .08 * s); g.rotate(-.8);
  box(g, s, -.08, -.1, .4, .2, 2, c);
  for (const y of [-.075, .02]) {                                                                              // missile tubes
    box(g, s, -.04, y, .34, .06, 2, dk);
    box(g, s, .3, y + .005, .05, .05, 1, INK);
    poly(g, s, [[.27, y + .01], [.36, y + .03], [.27, y + .05]], mix(RED, '#ffffff', .2));                      // warhead tip
  }
  g.restore();
  // radar mast and dish
  box(g, s, -.31, -.12, .04, .36, 1, STEEL); box(g, s, -.36, .2, .14, .06, 2, dk);
  const a = run ? w * 2.2 + ph : .6, sx = Math.cos(a);                                                         // dish turns: width follows heading
  g.save(); g.translate(-.29 * s, -.14 * s); g.scale(Math.max(.12, Math.abs(sx)), 1);
  oval(g, s, 0, 0, .18, .06, sx >= 0 ? mix('#e8e8ee', c, .1) : mix('#b8b8c2', dk, .2)); oval(g, s, 0, -.014, .12, .025, '#ffffff');
  g.restore();
  stroke(g, s, -.29, -.14, -.29, -.19, 2, STEEL);
  const blink = run ? Math.sin(w * 5 + ph) > .3 : true;
  if (blink) disc(g, s, -.29, -.2, .022, RED);
};

// Artillery emplacement: a sandbagged pit with a howitzer pointing up and out; the barrel slides back when it fires.
const artilleryEmplacement = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.46, .44);
  poly(g, s, [[-.46, .24], [-.4, .1], [.4, .1], [.44, .24]], SAND_DK);                                         // earth berm
  const rec = run ? Math.max(0, Math.sin(w * 1.0 + ph)) ** 8 * .04 : 0;
  g.save(); g.translate(-.06 * s, -.02 * s); g.rotate(-.55);
  box(g, s, -.1 - rec, -.045, .6, .09, 2, INK);                                                                // long barrel
  box(g, s, .34 - rec, -.06, .08, .12, 1, STEEL);                                                              // muzzle brake
  box(g, s, -.04 - rec, -.075, .2, .15, 3, dk);                                                                // recoil sleeve
  g.restore();
  glint(g, s, .33 + rec * 1.5, -.35, w, ph, run && rec > .004 ? 1 : 0, 1.0);
  poly(g, s, [[-.12, .12], [-.12, -.12], [-.03, -.2], [-.01, .12]], c);                                        // gun shield
  poly(g, s, [[-.12, -.12], [-.03, -.2], [-.02, -.16], [-.12, -.08]], mix(c, '#ffffff', .2));
  disc(g, s, -.14, .12, .1, INK); disc(g, s, -.14, .12, .045, '#8a8a8a');                                      // buried wheel
  for (let i = 0; i < 4; i++) sandbag(g, s, -.46 + i * .115, .17, .13, .07);                                   // front and back sandbag wall
  for (let i = 0; i < 3; i++) sandbag(g, s, -.4 + i * .115 + .055, .1, .13, .07);
  for (let i = 0; i < 4; i++) sandbag(g, s, .0 + i * .115, .17, .13, .07);
  for (let i = 0; i < 3; i++) sandbag(g, s, .06 + i * .115 + .055, .1, .13, .07);
  box(g, s, .3, .03, .1, .07, 2, '#5b6b45'); box(g, s, .3, .03, .1, .025, 1, c);                                // ammo crate
};

// Wall: stacked, sloped concrete blocks with a hazard stripe in team colour and a chipped, battered top.
const wall = (g, { s, c, dk }) => {
  pad(g, s, -.46, .46);
  const lit = mix(CONCRETE, '#ffffff', .14);
  const blocks = (y, h, n, off) => {                                                                          // a course of big blocks
    const bw = .92 / n;
    for (let i = 0; i < n; i++) {
      const x = -.46 + off + i * bw, x1 = Math.min(x + bw, .46), x0 = Math.max(x, -.46);
      box(g, s, x0 + .008, y, x1 - x0 - .016, h - .012, 2, i % 2 ? CONCRETE : lit);
      box(g, s, x0 + .008, y + h - .05, x1 - x0 - .016, .038, 2, CONC_DK);
    }
  };
  blocks(.12, .12, 3, 0); blocks(-.01, .13, 3, -.15);
  poly(g, s, [[-.46, -.01], [-.36, -.2], [.36, -.2], [.46, -.01]], lit);                                       // sloped barrier cap
  g.save(); g.beginPath(); g.moveTo(-.43 * s, -.08 * s); g.lineTo(-.38 * s, -.2 * s); g.lineTo(.38 * s, -.2 * s); g.lineTo(.43 * s, -.08 * s); g.closePath(); g.clip();   // hazard stripe in team colour
  box(g, s, -.5, -.17, 1, .09, 0, dk);
  for (let i = -2; i < 8; i++) { const x = -.5 + i * .17; poly(g, s, [[x, -.08], [x + .085, -.08], [x + .17, -.17], [x + .085, -.17]], c); }
  g.restore();
  stroke(g, s, -.3, .17, -.26, .22, 1, CONC_DK); stroke(g, s, .2, .03, .24, .08, 1, CONC_DK);
};

export const SPRITES = {
  gun_turret: gunTurret, cannon_turret: cannonTurret, sam_site: samSite, artillery_emplacement: artilleryEmplacement, wall,
};

// ---- shadows ----------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };

export const SHADOWS = {
  gun_turret: ground(.38, .05, .325, .04), cannon_turret: ground(.45, .05, .325), sam_site: ground(.44, .05, .325),
  artillery_emplacement: ground(.47, .05, .325), wall: ground(.47, .05, .325),
};
