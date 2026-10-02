// Buildings drawn on property tiles (terrain.json -> render.building). Every building is flat-shaded and seen from the
// front-left and above with exaggerated depth: a lit front face in the owner's colour, a darker right side, a lighter
// roof, and a soft shadow on the ground to the lower right. Each kind has its own silhouette so they read at a glance:
//   city      three blocks of different heights
//   hq        a stepped tower with a flag and a star
//   factory   a wide hall with a sawtooth roof, a smokestack and a garage door
//   barracks  two squarish canvas tents side by side (gabled roofs, open doors) and a flag out front
//   airfield  a tapering runway, an arched hangar and a control tower
//   shipyard  a factory-like hall (sawtooth roof), a slipway door, an anchor on its front and a crane with a grab out of the roof
// Each function draws into the square (px, py, S) and takes the owner's colour. Themes never change buildings.

import { luma, shade } from './color.js';

const SHADOW = 'rgba(0,0,0,.2)';
const DX = .9, DY = -.7;          // the depth direction of every box: up and to the right, per unit of depth

export function kit(g, px, py, S) {
  const X = (a) => px + a * S;
  const Y = (b) => py + b * S;
  const poly = (pts, fill) => {
    g.beginPath();
    pts.forEach(([a, b], i) => (i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b))));
    g.closePath(); g.fillStyle = fill; g.fill();
  };
  const rect = (x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(X(x), Y(y), w * S, h * S); };
  const line = (pts, color, w) => {
    g.strokeStyle = color; g.lineWidth = Math.max(1, w * S); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b)))); g.stroke();
  };
  // Ground shadow of a box whose front face has its top-left at (x, y): the light comes from the upper left.
  const boxShadow = (x, y, w, h, d) => {
    const dx = d * DX, dy = d * DY, b = y + h;
    poly([[x + .03, b], [x + w, b], [x + w + dx, b + dy], [x + w + dx + .11, b + dy + .05], [x + w + .11, b + .05], [x + .03, b + .05]], SHADOW);
  };
  // A box: right side, roof, then the front face on top.
  const box = (x, y, w, h, d, c) => {
    const dx = d * DX, dy = d * DY;
    poly([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], shade(c, -.3));
    poly([[x, y], [x + dx, y + dy], [x + w + dx, y + dy], [x + w, y]], shade(c, .25));
    rect(x, y, w, h, c);
  };
  // A grid of windows on a front face; dark on pale buildings so they still show.
  const windows = (x, y, w, h, cols, rows, c) => {
    const col = luma(c) > .62 ? 'rgba(35,50,80,.55)' : 'rgba(255,255,255,.6)';
    const mw = w / (cols * 2 + 1), mh = h / (rows * 2 + 1);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) rect(x + mw * (1 + 2 * i), y + mh * (1 + 2 * j), mw, mh, col);
  };
  const star = (cx, cy, r, fill) => {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * .42 : r; pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
    poly(pts, fill);
  };
  return { X, Y, poly, rect, line, boxShadow, box, windows, star };
}

export const BUILDINGS = {
  city(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.14, .34, .2, .54, .1); k.boxShadow(.5, .5, .24, .38, .1); k.boxShadow(.32, .68, .2, .2, .08);
    k.box(.14, .34, .2, .54, .1, owner); k.windows(.14, .34, .2, .54, 2, 4, owner);
    k.box(.5, .5, .24, .38, .1, owner); k.windows(.5, .5, .24, .38, 2, 3, owner);
    k.box(.32, .68, .2, .2, .08, owner); k.windows(.32, .68, .2, .2, 2, 1, owner);
  },

  hq(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.12, .5, .64, .38, .14);
    k.box(.12, .5, .64, .38, .14, owner);
    k.windows(.12, .5, .64, .2, 5, 1, owner);
    k.rect(.4, .7, .16, .18, '#2a2a35');
    k.box(.3, .25, .32, .2, .1, owner);
    k.star(.46, .35, .075, '#ffe45c');
    k.line([[.46, .19], [.46, .03]], '#222', .03);
    k.poly([[.46, .03], [.68, .09], [.46, .15]], owner);
  },

  factory(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.66, .2, .09, .34, .04); k.boxShadow(.08, .52, .7, .34, .12);
    k.box(.66, .2, .09, .34, .04, '#565a63');                         // smokestack, behind the hall
    k.rect(.65, .2, .11, .04, '#3a3d44');
    for (const [cx, cy, r, a] of [[.72, .12, .055, .55], [.8, .06, .042, .4]]) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(k.X(cx), k.Y(cy), r * S, 0, 7); g.fill(); }
    k.box(.08, .52, .7, .34, .12, owner);
    for (let i = 0; i < 3; i++) {                                     // sawtooth roof
      const x0 = .08 + i * .7 / 3, w = .7 / 3;
      k.poly([[x0, .52], [x0 + w, .52], [x0 + w, .38]], shade(owner, -.12));
      k.poly([[x0, .52], [x0 + w, .38], [x0 + w, .4], [x0 + .02, .52]], '#cfe6f5');
    }
    k.rect(.26, .66, .3, .2, '#2b2d33');                              // garage door with slats
    for (let i = 1; i < 4; i++) k.rect(.26, .66 + i * .05, .3, .012, '#4a4d55');
    k.rect(.12, .6, .08, .07, luma(owner) > .62 ? 'rgba(35,50,80,.55)' : 'rgba(255,255,255,.6)');
    k.rect(.62, .6, .08, .07, luma(owner) > .62 ? 'rgba(35,50,80,.55)' : 'rgba(255,255,255,.6)');
  },

  barracks(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    const d = .1, dx = d * DX, dy = d * DY;
    // Two squarish canvas tents side by side, each a wall with a gabled roof running back, seen from the front-left.
    // The left tent sits a little further back so the pair has depth; the flag stands out front.
    const tent = (l, r, lift) => {
      const m = (l + r) / 2, base = .88 - lift, wall = base - .2, apex = wall - .13;
      k.poly([[l + .02, base], [r, base], [r + dx, base + dy], [r + dx + .07, base + dy + .04], [r + .07, base + .04], [l + .02, base + .04]], SHADOW);
      k.poly([[r, wall], [r + dx, wall + dy], [r + dx, base + dy], [r, base]], shade(owner, -.3));                    // right wall
      k.poly([[r, wall], [m, apex], [m + dx, apex + dy], [r + dx, wall + dy]], shade(owner, -.14));                    // right roof slope
      k.poly([[l, base], [r, base], [r, wall], [m, apex], [l, wall]], owner);                                          // front: wall and gable
      k.poly([[m, apex], [m + dx, apex + dy], [m + dx + .02, apex + dy], [m + .02, apex]], shade(owner, .3));          // ridge highlight
      k.poly([[m - .06, base], [m - .06, wall + .05], [m, wall + .01], [m + .06, wall + .05], [m + .06, base]], '#2a2a35');   // open door
      k.poly([[m - .06, wall + .05], [m, wall + .01], [m - .015, wall + .09]], shade(owner, -.25));                   // tied-back flaps
      k.poly([[m + .06, wall + .05], [m, wall + .01], [m + .015, wall + .09]], shade(owner, -.35));
      k.line([[r + .02, wall + .02], [r + .02 + dx * .6, wall + .02 + dy * .6]], shade(owner, -.45), .012);            // guy ropes on the side
      k.line([[r + .02, base - .07], [r + .02 + dx * .6, base - .07 + dy * .6]], shade(owner, -.45), .012);
    };
    tent(.03, .37, .05);
    tent(.4, .74, 0);
    k.line([[.9, .93], [.9, .32]], '#2a2a35', .03);                                                                   // flagpole out front
    k.poly([[.9, .33], [.99, .36], [.9, .43]], owner);
    k.star(.94, .375, .022, '#ffe45c');
  },

  airfield(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.poly([[.16, .66], [.84, .66], [.98, .94], [.02, .94]], '#585d66');                                        // runway, narrowing away from us
    for (let i = 0; i < 4; i++) { const x = .14 + i * .2; k.rect(x, .785, .11, .03, '#e8e8e8'); }
    const dx = .2 * DX, dy = .2 * DY;
    k.poly([[.12, .62], [.5, .62], [.5 + dx, .62 + dy], [.5 + dx + .1, .62 + dy + .05], [.6, .67], [.12, .67]], SHADOW);   // hangar shadow
    k.boxShadow(.68, .34, .09, .3, .06);
    // arched hangar: right wall, curved roof, then the arch front
    const cx = .3, cy = .5, r = .2, front = [], back = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI - i * Math.PI / 12; front.push([cx + Math.cos(a) * r, cy - Math.sin(a) * r]); back.push([cx + Math.cos(a) * r + dx, cy - Math.sin(a) * r + dy]); }
    k.poly([[.5, .62], [.5 + dx, .62 + dy], [.5 + dx, cy + dy], [.5, cy]], shade(owner, -.3));
    k.poly([...front, ...back.reverse()], shade(owner, .18));
    g.fillStyle = owner; g.beginPath(); g.moveTo(k.X(.1), k.Y(.62)); g.lineTo(k.X(.1), k.Y(cy)); g.arc(k.X(cx), k.Y(cy), r * S, Math.PI, 0); g.lineTo(k.X(.5), k.Y(.62)); g.closePath(); g.fill();
    g.fillStyle = '#2b2d33'; g.beginPath(); g.moveTo(k.X(.21), k.Y(.62)); g.lineTo(k.X(.21), k.Y(.53)); g.arc(k.X(.3), k.Y(.53), .09 * S, Math.PI, 0); g.lineTo(k.X(.39), k.Y(.62)); g.closePath(); g.fill();
    // control tower
    k.box(.68, .34, .09, .3, .06, owner);
    k.box(.63, .22, .19, .12, .06, owner);
    k.rect(.65, .245, .15, .06, '#cfe6f5');
  },

  shipyard(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    const ink = luma(owner) > .62 ? '#2a3550' : '#ffffff';
    const steel = shade(owner, -.35);
    k.boxShadow(.08, .52, .7, .34, .12);
    k.box(.08, .52, .7, .34, .12, owner);                             // a hall like the factory's, with the same sawtooth roof
    for (let i = 0; i < 3; i++) {
      const x0 = .08 + i * .7 / 3, w = .7 / 3;
      k.poly([[x0, .52], [x0 + w, .52], [x0 + w, .38]], shade(owner, -.12));
      k.poly([[x0, .52], [x0 + w, .38], [x0 + w, .4], [x0 + .02, .52]], '#cfe6f5');
    }
    k.rect(.14, .66, .26, .2, '#2b2d33');                             // slipway door, with a strip of water showing
    k.rect(.14, .8, .26, .06, '#3d7ec7');
    for (let i = 1; i < 3; i++) k.rect(.14, .66 + i * .05, .26, .012, '#4a4d55');
    // anchor emblem on the front: ring, shank, stock and the two curved arms
    const cx = .6;
    g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(1, .026 * S);
    g.beginPath(); g.arc(k.X(cx), k.Y(.6), .02 * S, 0, 7); g.stroke();
    k.line([[cx, .62], [cx, .8]], ink, .026);
    k.line([[cx - .045, .655], [cx + .045, .655]], ink, .026);
    g.beginPath(); g.arc(k.X(cx), k.Y(.745), .075 * S, .12 * Math.PI, .88 * Math.PI); g.stroke();
    k.poly([[cx - .082, .77], [cx - .1, .73], [cx - .05, .745]], ink); k.poly([[cx + .082, .77], [cx + .1, .73], [cx + .05, .745]], ink);
    // crane out of the roof: a mast, a jib reaching left with a counterweight behind, and a grab on a cable
    k.line([[.66, .44], [.66, .07]], steel, .06);
    k.line([[.14, .07], [.8, .07]], steel, .035);                      // jib
    k.rect(.76, .05, .07, .07, '#565a63');                             // counterweight
    k.line([[.66, .05], [.24, .07]], '#3a3d44', .01);                  // stay
    k.line([[.2, .08], [.2, .27]], '#20232a', .014);                   // cable
    k.rect(.17, .26, .06, .045, '#ffd24a');                            // grab head
    k.line([[.18, .3], [.14, .38], [.17, .41]], '#20232a', .022);      // two claws, opening downward
    k.line([[.22, .3], [.26, .38], [.23, .41]], '#20232a', .022);
  },
};
