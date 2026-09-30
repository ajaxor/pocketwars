// Buildings drawn on property tiles (terrain.json -> render.building). Every building is flat-shaded and seen from the
// front-left and above with exaggerated depth: a lit front face in the owner's colour, a darker right side, a lighter
// roof, and a soft shadow on the ground to the lower right. Each kind has its own silhouette so they read at a glance:
//   city      three blocks of different heights
//   hq        a stepped tower with a flag and a star
//   factory   a wide hall with a sawtooth roof, a smokestack and a garage door
//   barracks  a low hut with a brown gabled roof, a star over the door and sandbags
//   airfield  a tapering runway, an arched hangar and a control tower
// Each function draws into the square (px, py, S) and takes the owner's colour. Themes never change buildings.

import { luma, shade } from './color.js';

const SHADOW = 'rgba(0,0,0,.2)';
const DX = .9, DY = -.7;          // the depth direction of every box: up and to the right, per unit of depth

function kit(g, px, py, S) {
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
    const dx = .16 * DX, dy = .16 * DY;
    k.boxShadow(.16, .56, .5, .3, .16);
    k.poly([[.66, .56], [.66 + dx, .56 + dy], [.66 + dx, .86 + dy], [.66, .86]], shade(owner, -.3));          // right wall
    k.poly([[.41, .36], [.41 + dx, .36 + dy], [.66 + dx, .56 + dy], [.66, .56]], '#6b4a2c');                   // roof slope
    k.rect(.16, .56, .5, .3, owner);
    k.poly([[.16, .56], [.66, .56], [.41, .36]], owner);                                                        // gable
    k.line([[.14, .58], [.41, .34], [.68, .58]], '#4a3320', .045);                                              // roof edge
    k.rect(.34, .68, .14, .18, '#3a2a1c');
    k.star(.41, .5, .06, '#ffe45c');
    for (const [cx, cy] of [[.74, .86], [.84, .86], [.79, .8]]) {                                               // sandbags
      g.fillStyle = '#b39b6d'; g.beginPath(); g.ellipse(k.X(cx), k.Y(cy), S * .058, S * .036, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(k.X(cx), k.Y(cy + .012), S * .05, S * .02, 0, 0, Math.PI); g.fill();
    }
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
};
