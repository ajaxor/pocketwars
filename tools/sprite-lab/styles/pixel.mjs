// Style B — Pixel art. Every unit is drawn on a 32x32 grid, then an automatic 1px dark outline is added
// around the silhouette, then the result is scaled up with nearest-neighbour. Chunky, readable, retro.
import { lighten, darken, mix } from '../lib.mjs';

export const meta = { id: 'pixel', name: 'Pixel art', blurb: '32×32 grid, auto-outlined, nearest-neighbour scaled' };

const G = 32;
const K = '#15131c'; // outline
const SKIN = '#f2c79c', SKIN_D = '#d9a577', BOOT = '#3a2f28', BROWN = '#7a5230';
const GLASS = '#bfe4f7', GLASS_D = '#7fb4d6';
const STEEL = '#a4a9b3', STEEL_D = '#5d616c', TREAD = '#2b2b33', TREAD_L = '#4b4b57';
const OLIVE = '#5f6a44', OLIVE_D = '#434b30', FLAME = '#ffb23e', FLAME_D = '#ff6a2b';

function paint(id, pal, make) {
  const cv = make(G, G);
  const p = cv.getContext('2d');
  const R = (x, y, w, h, col) => { p.fillStyle = col; p.fillRect(x, y, w, h); };
  const P = (x, y, col) => R(x, y, 1, 1, col);
  const E = (cx, cy, rx, ry, col) => {
    p.fillStyle = col;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) p.fillRect(x, y, 1, 1);
    }
  };
  const L = (x0, y0, x1, y1, col, th = 1) => {
    p.fillStyle = col; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) { p.fillRect(x, y, th, th); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
  };
  const POLY = (pts, col) => {
    p.fillStyle = col; const ys = pts.map((q) => q[1]); const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y < y1; y++) {
      const yc = y + .5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) p.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
    }
  };
  const { c, dk, lt } = pal;
  const wheelsRow = (x0, x1, y) => { for (let x = x0; x <= x1; x += 4) { E(x, y, 2, 2, STEEL_D); P(x, y, STEEL); } };
  const treads = (x, w) => { R(x, 21, w, 6, TREAD); R(x + 1, 21, w - 2, 1, TREAD_L); wheelsRow(x + 3, x + w - 3, 24); };

  const draw = {
    infantry() {
      R(12, 20, 3, 6, dk); R(17, 20, 3, 6, dk); R(11, 25, 4, 2, BOOT); R(17, 25, 5, 2, BOOT);
      R(12, 12, 9, 9, c); R(12, 12, 2, 8, lt); R(12, 18, 9, 1, dk);
      R(15, 11, 3, 1, SKIN_D); R(14, 7, 5, 4, SKIN); R(14, 10, 5, 1, SKIN_D); P(17, 8, '#1b1b1b');
      R(13, 3, 7, 3, dk); R(14, 3, 4, 1, lighten(dk, .4)); R(13, 6, 8, 1, dk);
      L(12, 17, 27, 12, '#3a3a3a'); R(11, 17, 4, 2, BROWN);
      R(18, 15, 4, 2, c); P(22, 15, SKIN);
    },
    mech() {
      R(11, 20, 4, 6, dk); R(17, 20, 4, 6, dk); R(10, 25, 5, 2, BOOT); R(17, 25, 5, 2, BOOT);
      R(10, 11, 12, 10, c); R(10, 11, 12, 3, dk); R(10, 12, 2, 7, lt); R(10, 18, 12, 1, dk);
      R(7, 12, 3, 8, dk); P(8, 14, STEEL_D);
      R(13, 3, 7, 7, dk); R(14, 3, 4, 1, lighten(dk, .4)); R(16, 5, 4, 2, GLASS); P(19, 5, '#fff'); R(14, 8, 6, 2, SKIN_D);
      R(8, 11, 19, 4, OLIVE); R(8, 11, 19, 1, lighten(OLIVE, .3)); R(6, 11, 3, 4, STEEL_D); R(26, 10, 2, 6, STEEL); R(15, 11, 1, 4, OLIVE_D); R(20, 11, 1, 4, OLIVE_D);
      R(15, 15, 5, 2, c); P(20, 15, SKIN); R(10, 15, 2, 5, dk);
    },
    sniper() {
      const cloth = mix(c, OLIVE, .5);
      R(12, 20, 3, 6, OLIVE_D); R(17, 20, 3, 6, OLIVE_D); R(11, 25, 4, 2, BOOT); R(17, 25, 5, 2, BOOT);
      R(12, 12, 9, 9, cloth); R(12, 12, 2, 8, lighten(cloth, .25)); R(12, 18, 9, 1, OLIVE_D);
      R(13, 11, 7, 2, c); P(19, 13, dk);
      R(14, 7, 5, 4, SKIN); R(14, 10, 5, 1, SKIN_D); P(17, 8, '#1b1b1b');
      R(11, 6, 11, 1, OLIVE_D); R(13, 3, 7, 3, OLIVE); R(14, 3, 4, 1, lighten(OLIVE, .3)); R(13, 5, 7, 1, c);
      L(7, 18, 30, 12, '#2f2f36'); R(5, 17, 5, 3, BROWN); R(16, 14, 4, 2, '#111'); P(19, 14, '#7fd0ff');
      R(17, 15, 4, 2, cloth); P(21, 15, SKIN);
    },
    recon() {
      E(9, 23, 3.6, 3.6, TREAD); P(9, 23, STEEL); E(23, 23, 3.6, 3.6, TREAD); P(23, 23, STEEL);
      R(4, 17, 25, 6, c); R(4, 21, 25, 2, dk); R(4, 17, 25, 1, lt); R(21, 15, 8, 3, c); R(21, 15, 8, 1, lt);
      R(12, 12, 9, 5, dk); POLY([[17, 12.5], [21, 15], [21, 17], [17, 17]], GLASS); R(13, 13, 3, 4, mix(dk, '#000', .3));
      R(7, 9, 1, 8, STEEL_D); R(6, 8, 10, 2, STEEL_D); R(15, 8, 4, 1, K);
      P(28, 18, FLAME); R(28, 20, 2, 2, STEEL);
    },
    tank() {
      treads(4, 25);
      R(5, 15, 23, 7, c); R(27, 17, 2, 4, c); R(5, 19, 24, 2, dk); R(6, 16, 20, 1, lt);
      R(11, 9, 11, 7, dk); R(12, 9, 9, 1, lighten(dk, .4)); R(14, 7, 5, 2, dk); R(15, 7, 3, 1, lighten(dk, .3));
      R(22, 11, 8, 3, STEEL_D); R(22, 11, 8, 1, STEEL); R(29, 10, 2, 5, STEEL);
    },
    heavy_tank() {
      treads(3, 27);
      R(4, 13, 25, 8, c); R(4, 15, 25, 1, lt); R(3, 19, 27, 3, dk); R(4, 14, 25, 1, lt);
      R(9, 6, 15, 8, dk); R(10, 6, 13, 1, lighten(dk, .4)); R(12, 4, 5, 2, dk); R(13, 4, 3, 1, lighten(dk, .3));
      R(24, 7, 6, 2, STEEL_D); R(24, 11, 6, 2, STEEL_D); R(29, 6, 2, 4, STEEL); R(29, 10, 2, 4, STEEL);
      R(20, 8, 2, 4, c);
    },
    artillery() {
      // trail leg, carriage, big wheel in front of it, shield, long raised barrel
      R(3, 24, 10, 2, dk); R(2, 25, 3, 2, TREAD);
      R(8, 17, 15, 4, c); R(8, 17, 15, 1, lt); R(8, 20, 15, 1, dk);
      L(13, 16, 27, 8, STEEL_D, 3); L(13, 15, 27, 7, STEEL, 1); R(26, 5, 4, 5, STEEL); R(27, 6, 2, 3, STEEL_D);
      R(11, 14, 6, 5, dk); R(11, 14, 6, 1, lighten(dk, .4));
      R(19, 12, 3, 8, dk); R(19, 12, 3, 1, lighten(dk, .4));
      E(16, 22.5, 4.5, 4.5, TREAD); E(16, 22.5, 2.5, 2.5, STEEL_D); P(16, 22, STEEL); P(15, 22, STEEL);
    },
    flak() {
      treads(5, 23);
      R(6, 16, 21, 6, c); R(6, 19, 21, 3, dk); R(7, 17, 19, 1, lt);
      R(10, 11, 11, 6, dk); R(11, 11, 9, 1, lighten(dk, .4));
      L(15, 12, 27, 3, STEEL_D, 2); L(19, 13, 30, 5, STEEL_D, 2); R(26, 1, 3, 3, STEEL); R(29, 3, 3, 3, STEEL);
      R(8, 6, 1, 10, STEEL_D); E(8, 6, 3.5, 1.5, STEEL); P(8, 5, '#fff');
    },
    copter() {
      R(9, 25, 18, 1, STEEL_D); R(12, 22, 1, 3, STEEL_D); R(21, 22, 1, 3, STEEL_D);
      R(3, 15, 11, 3, c); R(3, 17, 11, 1, dk); POLY([[2, 9], [5, 9], [6, 18], [3, 18]], dk); R(1, 12, 1, 4, STEEL);
      E(17, 17, 8.5, 5.5, c); R(10, 19, 15, 3, dk); E(14, 14.5, 3.5, 1.5, lt);
      E(23, 16.5, 3.6, 3.2, GLASS); P(22, 15, '#fff'); R(24, 19, 5, 1, K);
      R(16, 9, 2, 3, dk); R(3, 8, 28, 1, STEEL_D); R(14, 8, 6, 2, STEEL);
    },
    fighter() {
      POLY([[12, 13], [17, 13], [11, 9], [7, 9]], darken(dk, .25));
      POLY([[4, 15], [7, 15], [12, 14], [7, 6], [3, 6]], dk);
      POLY([[3, 16], [7, 13], [20, 13], [31, 16], [20, 19], [7, 19]], c);
      R(8, 14, 13, 1, lt);
      POLY([[13, 18], [23, 18], [13, 25], [8, 25]], dk); R(9, 25, 4, 1, K);
      POLY([[19, 13], [24, 13], [27, 15], [19, 15]], GLASS); P(21, 13, '#fff');
      R(16, 16, 4, 2, dk); R(1, 15, 3, 2, FLAME); P(0, 16, FLAME_D);
    },
    bomber() {
      // long fuselage, swept far wing above, broad near wing below with an engine nacelle, tall tail
      POLY([[13, 14], [21, 14], [17, 8], [10, 8]], darken(c, .3)); R(11, 9, 3, 2, STEEL_D);
      POLY([[2, 17], [3, 14], [9, 14], [8, 7], [4, 3], [2, 3]], dk);
      POLY([[2, 18], [5, 13], [23, 13], [30, 15], [30, 18], [24, 20], [5, 20]], c);
      R(3, 18, 27, 2, dk); R(6, 14, 20, 1, lt); R(14, 15, 7, 2, mix(c, '#000', .18));
      POLY([[25, 13], [29, 14], [30, 16], [25, 16]], GLASS); P(27, 14, '#fff');
      POLY([[10, 19], [24, 19], [21, 25], [6, 25]], mix(c, '#000', .08)); R(9, 20, 13, 1, lt);
      R(11, 21, 7, 3, STEEL_D); R(11, 21, 7, 1, STEEL); R(18, 20, 1, 5, '#e8e8e8');
    },
  };
  draw[id]();

  // 1px outline around the silhouette (4-neighbourhood), drawn into a fresh canvas.
  const src = p.getImageData(0, 0, G, G).data;
  const out = make(G, G); const o = out.getContext('2d');
  const a = (x, y) => (x < 0 || y < 0 || x >= G || y >= G ? 0 : src[(y * G + x) * 4 + 3]);
  o.fillStyle = K;
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) o.fillRect(x, y, 1, 1);
  }
  o.drawImage(cv, 0, 0);
  return out;
}

const shadowW = { infantry: .2, mech: .22, sniper: .2, recon: .34, tank: .36, heavy_tank: .4, artillery: .3, flak: .34, copter: .28, fighter: .3, bomber: .4 };

export function draw(g, id, o) {
  const { s, c, dk, alt = 0, make } = o;
  const pal = { c, dk, lt: lighten(c, .35) };
  const k = Math.max(1, Math.floor(s * .97 / G));
  const size = k * G;
  const spr = paint(id, pal, make);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, (27 - 16) * k + k * .6, s * (shadowW[id] || .3), k * 1.4, 0, 0, 7); g.fill();
  g.save(); if (alt) g.translate(0, -s * alt);
  g.imageSmoothingEnabled = false;
  g.drawImage(spr, -size / 2, -size / 2, size, size);
  g.restore();
}
