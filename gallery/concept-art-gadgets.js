// Experimental concept units, group "gadgets": static defences and field devices. Sprites only; described in parts/gadgets.json.
// Same conventions as concept-art.js: SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j }) centred on (0, 0), +x forward, sizes are tile fractions.
import { PARTS } from '../src/render/unit-art.js';

const { box, disc, oval, poly, stroke, mirror, mix, afloat, GLASS, INK, STEEL, UNDER_SHADE } = PARTS;
const RED = '#d4442e', GREEN = '#46b86a', ORANGE = '#ff9a2e', YELLOW = '#ffd84a';
const rgba = (r, g_, b_, a) => `rgba(${r},${g_},${b_},${Math.max(0, a).toFixed(2)})`;

// A small concrete pad that static units sit on.
const pad = (g, s, x0, x1, y = .27) => {
  box(g, s, x0, y, x1 - x0, .06, 2, '#5d6068'); box(g, s, x0, y, x1 - x0, .02, 1, '#7b7f88');
};

// ---- Jammer -----------------------------------------------------------------------------------------------------------------
// A lattice mast on a pad, a turning dish and a whip antenna on top, and signal rings that pulse outward in the faction colour.
const jammer = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.3, .3);
  box(g, s, -.2, .12, .4, .16, 3, dk);                                                         // equipment cabin
  box(g, s, -.14, .16, .1, .08, 1, GLASS); box(g, s, .02, .15, .14, .1, 1, c);                 // window and a faction panel
  disc(g, s, .17, .17, .02, run && Math.sin(w * 5 + ph) > 0 ? RED : '#6b2a22');                // status lamp
  const top = -.2;
  poly(g, s, [[-.1, .12], [-.075, top], [-.045, top], [-.02, .12]], STEEL);                    // lattice mast: two legs and braces
  poly(g, s, [[.02, .12], [.045, top], [.075, top], [.1, .12]], STEEL);
  for (let i = 0; i < 4; i++) { const y = top + .05 + i * .065; stroke(g, s, -.08 + i * .008, y + .065, .08 - i * .008, y, 1.5, dk); stroke(g, s, -.08 + i * .008, y, .08 - i * .008, y + .065, 1.5, dk); }
  box(g, s, -.1, top - .02, .2, .03, 1, c);                                                    // head platform
  stroke(g, s, 0, top - .02, 0, top - .17, 2, INK); disc(g, s, 0, top - .18, .022, RED);       // whip antenna and its beacon
  const k = run ? Math.cos(w * 2.2) : .7;                                                      // the dish turns about the mast
  const dw = .05 + Math.abs(k) * .09, side = k >= 0 ? 1 : -1;
  stroke(g, s, 0, top - .02, side * .09, top - .1, 2, INK);
  oval(g, s, side * .09, top - .1, dw, .075, '#e6e8ee'); oval(g, s, side * .09 + side * dw * .2, top - .1, dw * .6, .05, '#9aa0ad'); disc(g, s, side * .09, top - .1, .014, RED);
  stroke(g, s, -.1, top - .02, -.2, top - .08, 2, INK); stroke(g, s, -.2, top - .05, -.2, top - .15, 2, STEEL);   // second small yagi
  stroke(g, s, -.24, top - .15, -.16, top - .15, 1.5, STEEL); stroke(g, s, -.23, top - .1, -.17, top - .1, 1.5, STEEL);
  for (let i = 0; i < 3; i++) {                                                                // pulsing rings, drawn as arcs that grow and fade
    const f = run ? (w * .7 + i / 3) % 1 : (i + .5) / 3, r = (.07 + f * .2) * s;
    g.strokeStyle = mix(c, '#ffffff', .45); g.globalAlpha = Math.min(1, (1 - f) * 1.3); g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, (top - .12) * s, r, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.beginPath(); g.arc(0, (top - .12) * s, r, -.4, .4); g.stroke(); g.beginPath(); g.arc(0, (top - .12) * s, r, Math.PI - .4, Math.PI + .4); g.stroke();
    g.globalAlpha = 1;
  }
};

// ---- Automated Factory ------------------------------------------------------------------------------------------------------
// A compact shed with a chimney, a gantry over the door and a robot arm that swings; a conveyor carries a tiny robot out of the right side.
const autoFactory = (g, { s, c, dk, w, ph, run }) => {
  pad(g, s, -.44, .44);
  box(g, s, -.4, -.06, .54, .33, 3, c);                                                        // main shed
  box(g, s, -.4, -.06, .54, .05, 2, dk);                                                       // roof edge
  for (let i = 0; i < 3; i++) box(g, s, -.34 + i * .16, .02, .1, .06, 1, GLASS);               // windows
  box(g, s, -.4, .17, .54, .04, 0, dk);
  box(g, s, -.36, -.17, .07, .12, 1, STEEL); box(g, s, -.35, -.2, .05, .04, 1, dk);            // chimney
  const glow = run ? .5 + .5 * Math.sin(w * 4 + ph) : .6;
  disc(g, s, -.325, -.24, .022, rgba(255, 90, 50, .5 + glow * .5));                            // chimney light
  box(g, s, -.1, -.15, .22, .1, 2, dk);                                                        // roof gantry housing
  stroke(g, s, -.08, -.05, -.08, -.15, 2, STEEL); stroke(g, s, .1, -.05, .1, -.15, 2, STEEL);
  box(g, s, -.1, -.17, .22, .03, 1, STEEL);                                                    // gantry rail
  const t = run ? w * 1.5 : .6, sx = Math.sin(t) * .06, a1 = -1.1 + Math.sin(t) * .5, a2 = .9 + Math.cos(t * 1.3) * .5;   // the robot arm
  const bx = .02 + sx, by = -.17, ex = bx + Math.cos(a1) * .12, ey = by - Math.sin(-a1) * .12 * -1;
  g.save(); g.translate(bx * s, by * s);
  stroke(g, s, 0, 0, Math.cos(a1) * .14, Math.sin(a1) * .14, 4, ORANGE);
  const e2x = Math.cos(a1) * .14, e2y = Math.sin(a1) * .14;
  stroke(g, s, e2x, e2y, e2x + Math.cos(a1 + a2) * .12, e2y + Math.sin(a1 + a2) * .12, 3.5, ORANGE);
  disc(g, s, 0, 0, .025, '#3b3d44'); disc(g, s, e2x, e2y, .02, '#3b3d44');
  g.restore(); void ex; void ey;
  box(g, s, .14, .18, .3, .06, 2, '#3b3d44');                                                  // conveyor
  for (let i = 0; i < 6; i++) { const x = .16 + ((i * .05 + (run ? w * .08 : 0)) % .3); disc(g, s, x, .21, .008, '#8d96a6'); }
  const rx = .27 + (run ? ((w * .15 + ph) % 1) * .1 : .04);                                    // the new robot rides out
  box(g, s, rx - .045, .08, .09, .09, 2, STEEL); box(g, s, rx - .03, .03, .06, .05, 2, STEEL);
  box(g, s, rx - .008, .045, .05, .014, 0, run ? RED : '#7a2c20'); box(g, s, rx - .03, .17, .06, .015, 0, dk);
  box(g, s, .14, -.06, .08, .06, 1, dk); stroke(g, s, .18, -.0, .18, .08, 2, '#3b3d44');       // overhead feed to the belt
};

// ---- Land mine --------------------------------------------------------------------------------------------------------------
// Half-buried: a dirt mound with a dark disc rising out of it, a pressure plate on top and a little blinking light.
const landMine = (g, { s, c, dk, w, ph, run }) => {
  oval(g, s, 0, .26, .27, .06, '#6b5338'); oval(g, s, -.02, .25, .22, .045, '#7f6446');         // churned earth
  g.save(); g.beginPath(); g.rect(-s, -s, s * 2, (.26 + 1) * s); g.clip();
  oval(g, s, 0, .26, .2, .15, '#3b4048');                                                      // the casing, sunk to its middle
  oval(g, s, 0, .26, .2, .15, 'rgba(0,0,0,0)');
  box(g, s, -.2, .2, .4, .06, 3, mix(c, dk, .3));                                              // faction band round the shell
  g.restore();
  oval(g, s, 0, .15, .13, .04, '#6e7480'); oval(g, s, 0, .135, .1, .028, '#989eac');           // pressure plate, a raised disc
  const on = run ? Math.sin(w * 6 + ph) > .2 : true;
  disc(g, s, .13, .19, .03, on ? 'rgba(255,60,40,.3)' : 'rgba(0,0,0,0)'); disc(g, s, .13, .19, .018, on ? RED : '#6b2a22');
  for (const x of [-.22, .21]) { oval(g, s, x, .25, .03, .014, '#8f7452'); }                   // pebbles of loose dirt
  stroke(g, s, -.17, .24, -.2, .21, 1.5, '#5a4630'); stroke(g, s, .17, .245, .22, .22, 1.5, '#5a4630');
};

// ---- Sea mine ---------------------------------------------------------------------------------------------------------------
// A spiked sphere, half under the waterline, bobbing on a short chain that runs down to its anchor.
const seaMine = (g, { s, c, dk, w, ph, run, b }) => {
  const bb = b / s * .8, cx = 0, cy = .15;
  afloat(g, s, w, run, -.17, .17, (light) => {
    const col = light ? mix(c, '#2b2f36', .45) : dk, horn = light ? STEEL : mix(STEEL, dk, .5);
    g.save(); g.translate(0, bb * s);
    if (!light) {
      for (let i = 0; i < 6; i++) disc(g, s, cx, .31 + i * .028, .016, i % 2 ? dk : mix(dk, '#ffffff', .2));   // chain
      box(g, s, -.07, .46, .14, .04, 2, mix(dk, '#000000', .3));                               // anchor block
    }
    for (let i = 0; i < 8; i++) {                                                              // the spikes (horns)
      const a = (i / 8) * Math.PI * 2 + .39;
      stroke(g, s, cx + Math.cos(a) * .15, cy + Math.sin(a) * .15, cx + Math.cos(a) * .24, cy + Math.sin(a) * .24, 4, horn);
      disc(g, s, cx + Math.cos(a) * .245, cy + Math.sin(a) * .245, .018, light ? RED : mix(RED, dk, .5));
    }
    disc(g, s, cx, cy, .165, col);
    if (light) { disc(g, s, cx - .06, cy - .06, .05, mix(col, '#ffffff', .25)); box(g, s, cx - .165, cy - .02, .33, .035, 0, mix(c, dk, .15)); }
    else box(g, s, cx - .165, cy - .02, .33, .035, 0, mix(c, dk, .5));
    g.restore();
  }, .17);
};

export const SPRITES = {
  jammer: (g, o) => { g.save(); g.translate(0, .06 * o.s); g.scale(.92, .92); jammer(g, o); g.restore(); },
  auto_factory: (g, o) => { g.save(); g.translate(0, .03 * o.s); g.scale(.98, .98); autoFactory(g, o); g.restore(); },
  land_mine: (g, o) => { g.save(); g.translate(0, -.05 * o.s); g.scale(1.25, 1.25); landMine(g, o); g.restore(); },
  sea_mine: (g, o) => { g.save(); g.translate(0, -.02 * o.s); g.scale(.9, .9); seaMine(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
};

const ground = (rx, ry, y, dx = 0) => (g, { s }) => { g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(dx * s, y * s, rx * s, ry * s, 0, 0, 7); g.fill(); };
const none = () => {};
export const SHADOWS = {
  jammer: ground(.3, .05, .35), auto_factory: ground(.46, .05, .33), land_mine: ground(.27, .05, .3), sea_mine: none,
};
void mirror;
