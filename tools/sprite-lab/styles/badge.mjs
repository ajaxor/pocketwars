// Style D — Flat badge icons. Each unit is a simple cream-coloured glyph sitting on a rounded plate in the
// faction colour. Maximum legibility at small sizes and faction is unmistakable, at the cost of hiding the terrain
// under each unit and looking more "UI" than "battlefield".
import { lighten, darken, mix } from '../lib.mjs';

export const meta = { id: 'badge', name: 'Flat badge', blurb: 'cream glyph on a faction-coloured plate; built for tiny sizes' };

const INK = '#fff6e2';

export function draw(g, id, o) {
  const { s, c, dk, alt = 0, w = 0, run = 1 } = o;
  const u = s / 100;
  g.save(); g.scale(u, u);
  // plate
  const P = 39;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(-P + 1, -P + 6, P * 2, P * 2, 15); g.fill();
  g.fillStyle = dk; g.beginPath(); g.roundRect(-P, -P + 4, P * 2, P * 2, 15); g.fill();
  const gr = g.createLinearGradient(0, -P, 0, P); gr.addColorStop(0, lighten(c, .12)); gr.addColorStop(1, c);
  g.fillStyle = gr; g.beginPath(); g.roundRect(-P, -P, P * 2, P * 2 - 2, 15); g.fill();
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.roundRect(-P + 4, -P + 4, P * 2 - 8, 9, 5); g.fill();
  g.translate(0, 1);

  const F = () => { g.fillStyle = INK; g.fill(); };
  const R = (x, y, ww, hh, r = 2) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); F(); };
  const Cc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); F(); };
  const Pl = (pts) => { g.beginPath(); g.moveTo(...pts[0]); pts.slice(1).forEach((p) => g.lineTo(...p)); g.closePath(); F(); };
  const cut = (fn) => { g.fillStyle = dk; g.beginPath(); fn(); g.fill(); };  // "negative space" details in plate colour
  const line = (x0, y0, x1, y1, t, col = INK) => { g.strokeStyle = col; g.lineWidth = t; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const tracks = (x0, x1, y, hh) => { R(x0, y, x1 - x0, hh, hh / 2); const n = Math.round((x1 - x0) / 11); for (let i = 0; i < n; i++) cut(() => g.arc(x0 + hh / 2 + i * ((x1 - x0 - hh) / (n - 1)), y + hh / 2, hh * .26, 0, 7)); };

  const glyph = {
    infantry() {
      g.beginPath(); g.arc(0, -19, 10, Math.PI, 0); g.closePath(); F(); R(-11, -20, 22, 4, 2);
      R(-9, -14, 18, 9, 3); R(-13, -6, 26, 20, 6); R(-11, 12, 8, 14, 3); R(3, 12, 8, 14, 3);
      line(-6, 2, 25, -12, 4); cut(() => g.rect(-13, 7, 26, 2));
    },
    mech() {
      g.beginPath(); g.arc(0, -19, 11, Math.PI, 0); g.closePath(); F(); R(-11, -19, 22, 10, 4); cut(() => g.roundRect(-1, -17, 11, 4, 2));
      R(-15, -8, 30, 24, 7); R(-13, 12, 11, 14, 3); R(2, 12, 11, 14, 3);
      g.save(); g.translate(0, -3); g.rotate(-.3); R(-26, -6, 56, 12, 5); cut(() => g.rect(-6, -6, 3, 12)); cut(() => g.rect(14, -6, 3, 12)); g.restore();
    },
    sniper() {
      g.beginPath(); g.arc(0, -19, 10, Math.PI, 0); g.closePath(); F(); R(-20, -20, 40, 4, 2); R(-9, -14, 18, 9, 3); R(-13, -6, 26, 20, 6); R(-11, 12, 8, 14, 3); R(3, 12, 8, 14, 3);
      line(-14, 6, 40, -14, 3.4); R(2, -13, 14, 5, 2); cut(() => g.arc(20, -10, 2.2, 0, 7));
    },
    recon() {
      R(-34, -2, 68, 20, 7); Pl([[-6, -18], [10, -18], [22, -2], [-6, -2]]); cut(() => { g.moveTo(1, -15); g.lineTo(9, -15); g.lineTo(17, -4); g.lineTo(1, -4); g.closePath(); });
      line(-28, -22, -6, -22, 4); R(-22, -22, 4, 20, 1); Cc(-20, 20, 10); Cc(20, 20, 10); cut(() => g.arc(-20, 20, 4, 0, 7)); cut(() => g.arc(20, 20, 4, 0, 7));
    },
    tank() {
      tracks(-34, 34, 9, 20); R(-30, -8, 60, 18, 6); R(-14, -25, 30, 18, 7); R(-4, -32, 12, 8, 3); line(14, -16, 40, -16, 7); R(38, -21, 6, 10, 2);
    },
    heavy_tank() {
      tracks(-37, 37, 8, 22); R(-33, -11, 66, 23, 6); R(-19, -30, 40, 20, 7); R(-6, -37, 13, 8, 3); line(20, -25, 42, -25, 6); line(20, -14, 42, -14, 6);
      cut(() => g.rect(-33, 2, 66, 2.5));
    },
    artillery() {
      Pl([[-34, 26], [-6, 8], [2, 14], [-26, 28]]); R(-16, -2, 42, 17, 4); line(-4, -7, 38, -34, 10); R(-2, -14, 15, 14, 4); R(12, -14, 8, 26, 3);
      Cc(-1, 20, 11); cut(() => g.arc(-1, 20, 5, 0, 7)); Cc(-1, 20, 1.6);
    },
    flak() {
      tracks(-32, 32, 10, 18); R(-28, -5, 56, 17, 6); R(-14, -19, 30, 15, 6); line(-1, -14, 30, -44, 8); line(9, -12, 40, -40, 8);
      R(-26, -30, 3, 27, 1); g.beginPath(); g.ellipse(-24.5, -32, 8, 3, 0, 0, 7); F();
    },
    copter() {
      line(-12, 24, 26, 24, 3.5); line(-3, 9, -3, 24, 3); line(16, 9, 16, 24, 3);
      R(-46, -3, 36, 10, 5); Pl([[-52, -18], [-44, -18], [-38, 6], [-48, 6]]);
      g.beginPath(); g.ellipse(4, 2, 27, 17, 0, 0, 7); F(); cut(() => g.ellipse(20, 0, 11, 10, 0, 0, 7)); R(-3, -30, 6, 13, 2);
      const rl = 46 * (run ? .55 + .45 * Math.abs(Math.cos(w * 22)) : .8); line(-rl, -32, rl, -32, 4);
    },
    fighter() {
      Pl([[-38, -1], [-30, -1], [-20, -4], [-30, -30], [-40, -30]]);
      Pl([[-42, 0], [-32, -8], [12, -8], [46, 0], [12, 8], [-32, 8]]); cut(() => { g.moveTo(10, -6.5); g.lineTo(24, -6.5); g.lineTo(32, -2); g.lineTo(10, -2); g.closePath(); });
      Pl([[-2, 7], [22, 7], [2, 32], [-14, 32]]);
    },
    bomber() {
      Pl([[-44, 0], [-40, -6], [-26, -6], [-30, -36], [-40, -40], [-46, -40]]);
      Pl([[-46, 2], [-38, -12], [22, -12], [46, -4], [46, 6], [24, 12], [-38, 12]]); cut(() => { g.moveTo(34, -10); g.lineTo(42, -8); g.lineTo(45, -5); g.lineTo(34, -5); g.closePath(); });
      Pl([[-16, 9], [26, 9], [16, 32], [-28, 32]]); cut(() => g.roundRect(-13, 17, 22, 9, 3));
    },
  };
  // aircraft: plate stays put; altitude is communicated by a small chevron instead of a lifted sprite
  const off = { flak: 7, artillery: 4, copter: 3, bomber: 3, fighter: 0, heavy_tank: 3, tank: 3, infantry: 0, mech: 0, sniper: 0, recon: 0 }[id] || 0;
  g.save(); g.scale(.72, .72); g.translate(0, off); glyph[id](); g.restore();
  if (alt) { g.fillStyle = INK; g.beginPath(); g.moveTo(-6, P - 7); g.lineTo(0, P - 13); g.lineTo(6, P - 7); g.lineTo(0, P - 10); g.closePath(); g.fill(); }
  g.restore();
}
