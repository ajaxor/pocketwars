// Support art: the supply truck, the hover tank, the mine layer and the sea mine. unit-art.js takes them by name.
//   SPRITES[name](g, { s, c, dk, w, ph, run, moving, b, j })   SHADOWS[name](g, { s, alt, w, ph, run })
import { box, disc, oval, poly, stroke, wheel, mix, afloat, hullPath, propeller, hoverTubes, GLASS, INK, STEEL, UNDER_SHADE, ground } from './parts.js';

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

// Hover craft ride on tubing under the hull (see hoverTubes) and sit well above the ground: the lift is drawn here (altitude 0 in the data).
export const hoverLift = (w, ph, run) => -.075 + (run ? Math.sin(w * .9 + ph) * .028 : 0);

const hoverTank = (g, { s, c, dk, w, ph, run }) => {
  const h = hoverLift(w, ph, run);
  g.save(); g.translate(0, h * s);
  hoverTubes(g, s, -.28, .28, .22, w, run, { ground: .285 - h });
  poly(g, s, [[-.36, .19], [-.41, .07], [-.3, -.04], [.2, -.04], [.34, .04], [.43, .11], [.36, .19]], c);   // faceted wedge hull
  poly(g, s, [[-.13, -.04], [-.07, -.17], [.12, -.19], [.24, -.1], [.2, -.04]], dk);           // angular turret
  const rec = Math.max(0, Math.sin(w * 1.6 + ph)) * .012 * run;
  g.fillStyle = INK; g.fillRect((.16 - rec) * s, -.12 * s, s * .28, s * .04);                // gun
  g.restore();
};

// Mine layer: a low work boat; mines in a rack on its stern deck, one of them just rolled off the ramp.
const mine = (g, s, x, y, r, c) => {                                                       // like the sea mine: one colour, six even spikes (top and bottom included) round a ball
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; stroke(g, s, x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, 3.5, c); }
  disc(g, s, x, y, r, c);
};
const mineLayer = (g, { s, c, dk, w, run, b }) => {
  const bb = b / s, D = .05, H = { x0: -.4, x1: .42, deck: D, keel: .3, rise: .02, sweep: .18 };
  afloat(g, s, w, run, -.4, .42, (light) => {
    g.save(); g.translate(0, bb * s);
    if (!light) propeller(g, s, -.42, .27, w, run, dk);
    hullPath(g, s, H); g.fillStyle = light ? c : dk; g.fill();
    if (light) {
      box(g, s, .08, D - .17, .22, .17, 3, c);                                                  // wheelhouse, forward
      box(g, s, .09, D - .21, .07, .05, 1, c);                                       // crane pedestal on the wheelhouse roof
      const sway = run ? Math.sin(w * 2 + 1) * .006 : 0;                                         // a small crane: a boom reaching aft over the mine rack, a cable and a hook
      stroke(g, s, .125, D - .2, -.04, D - .33, 4, c); stroke(g, s, -.04, D - .33, -.04 + sway, D - .24, 1, STEEL); disc(g, s, -.04 + sway, D - .235, .02, INK);
      mine(g, s, -.2, D - .1, .06, c);                                                       // a single mine, on the deck aft
    }
    g.restore();
  });
};

// Sea mine: one colour (a darker shade of it below the waterline), a spiked ball centred on the tile.
const seaMine = (g, { s, c, dk, w, run, b }) => {
  const cy = 0;
  afloat(g, s, w, run, -.17, .17, (light) => {
    const col = light ? c : dk;
    g.save(); g.translate(0, b * .8);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; stroke(g, s, Math.cos(a) * .15, cy + Math.sin(a) * .15, Math.cos(a) * .24, cy + Math.sin(a) * .24, 4, col); }
    disc(g, s, 0, cy, .165, col);
    if (!light) for (let i = 0; i < 4; i++) oval(g, s, 0, .3 + i * .045, i % 2 ? .008 : .016, .02, dk);   // anchor chain: links hanging from the bottom spike
    g.restore();
  }, 0);                                                                                      // waterline through the ball's centre
};


export const SPRITES = {
  supply_truck: supplyTruck,
  hover_tank: hoverTank,
  mine_layer: (g, o) => { g.save(); g.scale(.88, .88); mineLayer(g, { ...o, dk: mix(o.c, o.dk, UNDER_SHADE) }); g.restore(); },
  sea_mine: (g, o) => { g.save(); g.scale(.9, .9); seaMine(g, { ...o, dk: mix(o.c, o.dk, .75) }); g.restore(); },
};

const none = () => {};
export const SHADOWS = { supply_truck: ground(.35, .05, .285), hover_tank: ground(.38, .05, .295), mine_layer: none, sea_mine: none };
