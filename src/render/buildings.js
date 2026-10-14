// Buildings drawn on property tiles (terrain.json -> render.building). Every building is flat-shaded and seen from the
// front-left and above with exaggerated depth: a lit front face in the owner's colour, a darker right side, a lighter
// roof, and a soft shadow on the ground to the lower right. Each kind has its own silhouette so they read at a glance:
//   city      three blocks of different heights
//   hq        a stepped tower with a flag and a star
//   factory   a wide hall with a sawtooth roof, a smokestack and a garage door
//   airfield  a tapering runway, an arched hangar and a control tower
//   shipyard  a factory-like hall (sawtooth roof), a slipway door, an anchor on its front and a crane with a grab out of the roof
//   garage    a low hall with two roll-up doors and a tyre stack          chemical_plant  two round tanks, a flare stack and a pipe
//   support_factory  a hall with a red cross panel and a supply crate      artillery_range  a low berm with a long gun barrel and a target post
//   agency    a tall dark tower with a dish and an antenna                 harbor  a warehouse on a pier with a bollard and a small crane
//   sub_pen   a concrete block with a dark arched pen and a conning tower  airbase  a long runway, a big hangar, a radar dome and a jet
//   hover_lab  a hall with a glass dome and a glowing pad                  stealth_lab  a dark faceted bunker with a slit and a dish
//   heavy_lab  a squat armoured block with a press and a gear              missile_lab  a hall with a gantry and a missile on its pad
// Each function draws into the square (px, py, S) and takes the owner's colour. Themes never change buildings.

import { luma, shade } from './color.js';

const SHADOW = 'rgba(0,0,0,.2)';
const RED = '#d4442e';
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
    k.star(.46, .35, .075, '#ffffff');
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
    const pts = [...front, ...back].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const q of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of [...pts].reverse()) { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    k.poly([...lo.slice(0, -1), ...up.slice(0, -1)], shade(owner, .18));                  // the roof: the hull of the front arch and the same arch pushed back, so its top is a clean straight-edged barrel
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
    k.rect(.14, .66, .26, .2, '#2b2d33');                             // a closed door with slats, like the factory's
    for (let i = 1; i < 4; i++) k.rect(.14, .66 + i * .05, .26, .012, '#4a4d55');
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

  garage(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.06, .5, .72, .36, .12);
    k.box(.06, .5, .72, .36, .12, owner);
    k.rect(.06, .5, .72, .05, shade(owner, -.18));                     // a flat roof edge
    for (const x of [.14, .46]) {                                      // two roll-up doors, half open
      k.rect(x, .6, .24, .26, '#2b2d33');
      k.rect(x, .6, .24, .08, '#9aa0ab');
      for (let i = 0; i < 2; i++) k.rect(x, .6 + i * .035, .24, .01, '#6f7580');
    }
    for (let i = 0; i < 3; i++) { g.fillStyle = '#23252b'; g.beginPath(); g.ellipse(k.X(.88), k.Y(.84 - i * .06), .07 * S, .03 * S, 0, 0, 7); g.fill(); }   // tyre stack
    k.rect(.52, .38, .2, .1, '#f3c13a');                               // a rooftop sign
  },

  chemical_plant(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    const tank = (cx, top, w, h, c) => {
      k.poly([[cx - w / 2 + .03, top + h + .03], [cx + w / 2 + .12, top + h + .03], [cx + w / 2 + .12, top + h + .08], [cx - w / 2 + .03, top + h + .08]], SHADOW);
      g.fillStyle = shade(c, -.3); g.fillRect(k.X(cx), k.Y(top), (w / 2) * S, h * S);
      g.fillStyle = c; g.fillRect(k.X(cx - w / 2), k.Y(top), w * .62 * S, h * S);
      g.fillStyle = shade(c, .25); g.beginPath(); g.ellipse(k.X(cx), k.Y(top), (w / 2) * S, .045 * S, 0, 0, 7); g.fill();
      g.fillStyle = shade(c, -.3); g.beginPath(); g.ellipse(k.X(cx), k.Y(top + h), (w / 2) * S, .045 * S, 0, 0, Math.PI); g.fill();
    };
    k.line([[.78, .28], [.78, .86]], '#565a63', .045);                 // flare stack, behind the tanks
    k.poly([[.78, .08], [.84, .2], [.78, .26], [.72, .2]], '#ff9c2e'); k.poly([[.78, .13], [.81, .2], [.78, .24], [.75, .2]], '#ffe27a');
    tank(.24, .42, .3, .44, owner);
    tank(.56, .52, .26, .34, shade(owner, .12));
    k.line([[.3, .74], [.5, .74]], '#3a3d44', .035);                   // pipe between the tanks
    k.rect(.66, .78, .26, .08, '#565a63');
  },

  support_factory(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.08, .46, .6, .4, .12);
    k.box(.08, .46, .6, .4, .12, owner);
    k.rect(.08, .46, .6, .05, shade(owner, -.18));
    k.rect(.2, .54, .22, .22, '#f1f1ec');                              // the cross panel
    k.rect(.28, .56, .06, .18, RED); k.rect(.22, .62, .18, .06, RED);
    k.rect(.48, .62, .14, .24, '#2b2d33');                             // a bay door
    k.boxShadow(.72, .7, .11, .16, .05); k.box(.72, .7, .11, .16, .05, '#b9915a');   // a supply crate
    k.rect(.72, .76, .11, .02, '#8a6a3a');
  },

  artillery_range(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.poly([[.04, .9], [.88, .9], [.8, .66], [.14, .66]], '#8a7a56');                   // a sand berm
    k.poly([[.14, .66], [.8, .66], [.82, .72], [.1, .72]], '#a89870');
    k.boxShadow(.12, .56, .46, .3, .1); k.box(.12, .56, .46, .3, .1, owner);            // the gun house
    k.rect(.24, .72, .2, .14, '#2b2d33');
    k.line([[.56, .6], [.96, .2]], '#3a3d44', .09);                                     // a long barrel raised toward the upper right
    k.line([[.56, .6], [.96, .2]], '#69707c', .05);
    k.rect(.72, .74, .06, .12, '#b9915a'); k.rect(.8, .78, .06, .08, '#b9915a');         // shells
  },

  agency(g, px, py, S, owner) {
    const k = kit(g, px, py, S), dark = shade(owner, -.45);
    k.boxShadow(.2, .3, .38, .58, .12);
    k.box(.2, .3, .38, .58, .12, dark);
    for (let i = 0; i < 4; i++) k.rect(.26, .38 + i * .12, .26, .035, 'rgba(160,230,255,.7)');   // dark glass bands
    k.rect(.32, .76, .14, .12, '#14161a');
    k.box(.06, .62, .14, .26, .06, owner);                                              // a low wing
    k.line([[.52, .3], [.52, .12]], '#222', .025);
    g.fillStyle = '#c9ccd2'; g.beginPath(); g.ellipse(k.X(.38), k.Y(.28), .14 * S, .05 * S, -.3, 0, 7); g.fill();   // a dish on the roof
    g.fillStyle = '#7a808c'; g.beginPath(); g.ellipse(k.X(.38), k.Y(.28), .08 * S, .028 * S, -.3, 0, 7); g.fill();
    k.rect(.51, .1, .03, .03, RED);
  },

  harbor(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.poly([[.04, .86], [.98, .86], [.98, .96], [.04, .96]], '#8a6a46');               // the pier planks along the front
    for (let i = 0; i < 6; i++) k.rect(.1 + i * .15, .86, .015, .1, '#5e4630');
    k.boxShadow(.08, .5, .5, .36, .12);
    k.box(.08, .5, .5, .36, .12, owner);                                                // a warehouse
    k.rect(.08, .5, .5, .05, shade(owner, -.18));
    k.rect(.2, .62, .26, .24, '#2b2d33');
    k.line([[.8, .86], [.8, .34], [.58, .34]], '#565a63', .04);                         // a small crane
    k.line([[.6, .34], [.6, .5]], '#20232a', .012); k.rect(.57, .5, .06, .04, '#ffd24a');
    for (const x of [.64, .92]) k.rect(x, .8, .04, .07, '#2a2a35');                    // bollards
  },

  sub_pen(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.06, .42, .7, .44, .12);
    k.box(.06, .42, .7, .44, .12, owner);
    k.rect(.06, .42, .7, .06, shade(owner, .1));
    g.fillStyle = '#14161a'; g.beginPath(); g.moveTo(k.X(.2), k.Y(.86)); g.lineTo(k.X(.2), k.Y(.68)); g.arc(k.X(.46), k.Y(.68), .26 * S, Math.PI, 0); g.lineTo(k.X(.72), k.Y(.86)); g.closePath(); g.fill();   // the pen
    k.poly([[.28, .86], [.28, .74], [.36, .66], [.58, .66], [.64, .74], [.64, .86]], '#3b4250');                         // the sub inside
    k.rect(.4, .56, .1, .12, '#3b4250'); k.line([[.45, .56], [.45, .5]], '#222', .02);                                  // its conning tower and periscope
    k.rect(.64, .34, .08, .08, '#565a63');
  },

  airbase(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.poly([[.1, .66], [.9, .66], [1, .94], [0, .94]], '#585d66');                      // a wider runway
    for (let i = 0; i < 4; i++) k.rect(.12 + i * .21, .8, .11, .03, '#e8e8e8');
    k.boxShadow(.04, .36, .46, .3, .14); k.box(.04, .36, .46, .3, .14, owner);          // a big flat hangar
    k.rect(.04, .36, .46, .05, shade(owner, -.18));
    k.rect(.12, .46, .3, .2, '#2b2d33');
    g.fillStyle = '#e8e8e8'; g.beginPath(); g.arc(k.X(.72), k.Y(.34), .09 * S, Math.PI, 0); g.fill();   // a radar dome
    k.line([[.72, .34], [.72, .52]], '#565a63', .05);
    k.poly([[.6, .78], [.92, .74], [.74, .7], [.7, .6], [.66, .7]], '#c9ccd2');         // a jet parked on the apron
  },

  hover_lab(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.06, .56, .64, .3, .12); k.box(.06, .56, .64, .3, .12, owner);
    k.rect(.46, .66, .16, .2, '#2b2d33');
    g.fillStyle = '#bfe0f2'; g.beginPath(); g.arc(k.X(.3), k.Y(.56), .2 * S, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(k.X(.3), k.Y(.56), .2 * S, Math.PI * 1.1, Math.PI * 1.4); g.lineTo(k.X(.3), k.Y(.56)); g.fill();
    g.fillStyle = '#5fd0ff'; g.beginPath(); g.ellipse(k.X(.84), k.Y(.86), .14 * S, .05 * S, 0, 0, 7); g.fill();       // the glowing pad
    g.fillStyle = '#dff6ff'; g.beginPath(); g.ellipse(k.X(.84), k.Y(.86), .08 * S, .028 * S, 0, 0, 7); g.fill();
  },

  stealth_lab(g, px, py, S, owner) {
    const k = kit(g, px, py, S), d = shade(owner, -.55);
    k.poly([[.1, .9], [.84, .9], [.92, .8], [.2, .8]], SHADOW);
    k.poly([[.08, .88], [.08, .6], [.3, .44], [.66, .44], [.86, .6], [.86, .88]], d);
    k.poly([[.08, .6], [.3, .44], [.66, .44], [.86, .6]], shade(owner, -.25));
    k.poly([[.3, .44], [.66, .44], [.58, .6], [.38, .6]], shade(owner, -.4));
    k.rect(.3, .7, .4, .04, shade(owner, .35));
    k.rect(.14, .66, .1, .16, owner);                                                   // a panel in the owner's colour
    k.line([[.5, .44], [.5, .26]], '#222', .025);
    g.fillStyle = '#c9ccd2'; g.beginPath(); g.arc(k.X(.5), k.Y(.24), .05 * S, 0, 7); g.fill();
  },

  heavy_lab(g, px, py, S, owner) {
    const k = kit(g, px, py, S), steel = shade(owner, -.35);
    k.boxShadow(.06, .48, .66, .38, .12); k.box(.06, .48, .66, .38, .12, owner);        // a squat armoured block
    k.rect(.06, .48, .66, .06, shade(owner, -.2));
    for (const x of [.06, .66]) k.rect(x, .48, .06, .38, steel);                        // corner plates
    k.box(.3, .22, .24, .26, .1, '#565a63');                                            // a press head on the roof
    k.rect(.38, .46, .08, .1, '#3a3d44');
    g.fillStyle = '#9aa0ab'; g.beginPath(); g.arc(k.X(.54), k.Y(.7), .12 * S, 0, 7); g.fill();        // a gear on the front
    g.fillStyle = owner; g.beginPath(); g.arc(k.X(.54), k.Y(.7), .05 * S, 0, 7); g.fill();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; k.rect(.54 + Math.cos(a) * .125 - .02, .7 + Math.sin(a) * .125 - .02, .04, .04, '#9aa0ab'); }
  },

  missile_lab(g, px, py, S, owner) {
    const k = kit(g, px, py, S);
    k.boxShadow(.06, .6, .52, .26, .12); k.box(.06, .6, .52, .26, .12, owner);
    k.rect(.16, .68, .16, .18, '#2b2d33');
    k.poly([[.7, .86], [.88, .86], [.92, .91], [.72, .91]], SHADOW);
    k.line([[.8, .86], [.8, .2]], '#565a63', .05);                                      // a gantry tower
    k.line([[.68, .3], [.8, .3]], '#565a63', .02); k.line([[.68, .5], [.8, .5]], '#565a63', .02);
    k.poly([[.74, .84], [.74, .36], [.78, .24], [.82, .36], [.82, .84]], '#f1f1ec');    // the missile
    k.poly([[.74, .36], [.78, .24], [.82, .36]], RED);
    k.poly([[.74, .84], [.7, .9], [.74, .76]], RED); k.poly([[.82, .84], [.86, .9], [.82, .76]], RED);
  },
};
