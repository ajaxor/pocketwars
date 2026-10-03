// Experimental concept units, Engineer Works group: immobile static defences, seen from the side like the units. Kept very plain: a pad,
// one or two solid shapes, and the one part that says what it does (barrel, tubes, dish, spikes). Same conventions as concept-art.js:
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })  centred on (0, 0), +x forward, +y down, sizes are fractions of the tile s
import { box, disc, oval, poly, stroke, mix, afloat, INK, STEEL, UNDER_SHADE } from '../src/render/parts.js';

const CONCRETE = '#a9a79e', CONC_DK = '#807e77', SAND_DK = '#a38d58', RED = '#d4442e';

const pad = (g, s, x0 = -.4, x1 = .4, col = CONC_DK) => box(g, s, x0, .25, x1 - x0, .07, 2, col);   // the poured pad every fixture stands on

// Turrets read like units: one team colour for the whole fixture (a darker shade for the pad), a near-black barrel.
// Gun turret: a squat bunker with a short machine gun that sweeps a little.
const gunTurret = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.34, .34, dk);
  poly(g, s, [[-.3, .25], [-.24, -.02], [.24, -.02], [.3, .25]], c);                         // bunker
  const sw = run ? Math.sin(w * 1.1 + ph) * .08 : 0;
  g.save(); g.translate(.1 * s, .04 * s); g.rotate(sw);
  box(g, s, 0, -.025, .3, .05, 1, INK);                                                       // the gun
  g.restore();
};

// Cannon turret: a bigger bunker under a block turret and a long cannon that recoils.
const cannonTurret = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.42, .42, dk);
  poly(g, s, [[-.38, .25], [-.3, .02], [.3, .02], [.38, .25]], c);                            // base
  box(g, s, -.3, -.15, .46, .17, 3, c);                                                       // turret
  const rec = run ? Math.max(0, Math.sin(w * 1.3 + ph)) ** 8 * .035 : 0;
  box(g, s, .14 - rec, -.1, .34, .06, 1, INK);                                                // the cannon
};

// SAM site: a plinth carrying a launcher tipped at the sky: two tubes.
const samSite = (g, { s, c, dk }) => {
  pad(g, s, -.34, .34, dk);
  box(g, s, -.2, .06, .4, .19, 3, c);                                                         // plinth
  g.save(); g.translate(0, .08 * s); g.rotate(-.85);
  box(g, s, -.08, -.1, .42, .2, 2, c);
  for (const y of [-.085, .02]) box(g, s, .34, y, .1, .07, 1, INK);                           // the tube mouths
  g.restore();
};

// Artillery emplacement: a berm and a gun shield, the barrel up and out; it slides back when it fires.
const artilleryEmplacement = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.44, .44, dk);
  poly(g, s, [[-.44, .25], [-.36, .08], [.36, .08], [.44, .25]], c);                          // berm
  const rec = run ? Math.max(0, Math.sin(w * 1.0 + ph)) ** 8 * .04 : 0;
  g.save(); g.translate(-.04 * s, .0); g.rotate(-.6);
  box(g, s, -.1 - rec, -.04, .6, .08, 1, INK);                                                // barrel
  g.restore();
  poly(g, s, [[-.12, .12], [-.12, -.1], [-.02, -.17], [.0, .12]], c);                         // gun shield
};

// Jammer: a mast with a dish on top and signal rings spreading from it.
const jammer = (g, { s, c, w, run }) => {
  pad(g, s, -.22, .22);
  box(g, s, -.025, -.16, .05, .41, 1, STEEL);                                                 // mast
  oval(g, s, 0, -.2, .12, .075, '#e6e8ee');                                                   // the dish
  for (let i = 0; i < 2; i++) {                                                               // rings that grow and fade
    const f = run ? (w * .7 + i / 2) % 1 : (i + .5) / 2, r = (.1 + f * .22) * s;
    g.strokeStyle = mix(c, '#ffffff', .45); g.globalAlpha = Math.min(1, (1 - f) * 1.3); g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, -.2 * s, r, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.globalAlpha = 1;
  }
};

// Automated factory: a plain shed with a dark door, a team stripe and a chimney.
const autoFactory = (g, { s, c, dk }) => {
  pad(g, s, -.42, .42);
  box(g, s, -.36, -.06, .72, .31, 3, c);                                                      // the shed
  box(g, s, -.36, -.06, .72, .05, 2, dk);                                                     // roof edge
  box(g, s, -.1, .08, .2, .17, 2, '#2b2d33');                                                 // door
  box(g, s, .2, -.18, .07, .12, 1, STEEL);                                                    // chimney
};

// Land mine: a flat dark disc half-buried in a mound, with one red light.
const landMine = (g, { s, c, w, ph, run }) => {
  oval(g, s, 0, .26, .27, .06, '#6b5338');                                                    // churned earth
  oval(g, s, 0, .24, .2, .1, '#3b4048');                                                      // the casing
  oval(g, s, 0, .2, .13, .04, mix(c, '#3b4048', .4));                                         // team-coloured plate
  disc(g, s, .06, .17, .022, run && Math.sin(w * 6 + ph) < -.2 ? '#6b2a22' : RED);            // the light
};

// Sea mine: one colour (a darker shade of it below the waterline), a spiked ball centred on the tile.
const seaMine = (g, { s, c, dk, w, run, b }) => {
  const cy = 0;
  afloat(g, s, w, run, -.17, .17, (light) => {
    const col = light ? c : dk;
    g.save(); g.translate(0, b * .8);
    if (!light) stroke(g, s, 0, .24, 0, .4, 2, dk);                                          // anchor chain
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; stroke(g, s, Math.cos(a) * .15, cy + Math.sin(a) * .15, Math.cos(a) * .24, cy + Math.sin(a) * .24, 4, col); }
    disc(g, s, 0, cy, .165, col);
    g.restore();
  }, 0);                                                                                      // waterline through the ball's centre
};

export const SPRITES = {
  gun_turret: (g, o) => { g.save(); g.translate(o.s * .04, 0); gunTurret(g, o); g.restore(); },
  cannon_turret: cannonTurret, sam_site: samSite, artillery_emplacement: artilleryEmplacement,
  jammer: (g, o) => { g.save(); g.translate(0, .06 * o.s); g.scale(.92, .92); jammer(g, o); g.restore(); },
  auto_factory: autoFactory,
  land_mine: (g, o) => { g.save(); g.translate(0, -.05 * o.s); g.scale(1.25, 1.25); landMine(g, o); g.restore(); },
  sea_mine: (g, o) => { g.save(); g.scale(.9, .9); seaMine(g, { ...o, dk: mix(o.c, o.dk, .75) }); g.restore(); },
};

// ---- shadows ----------------------------------------------------------------------------------------------------------------
const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
export const SHADOWS = {
  gun_turret: ground(.38, .05, .325, .04), cannon_turret: ground(.45, .05, .325), sam_site: ground(.4, .05, .325),
  artillery_emplacement: ground(.47, .05, .325), jammer: ground(.25, .05, .35), auto_factory: ground(.46, .05, .33), land_mine: ground(.27, .05, .3), sea_mine: none,
};
