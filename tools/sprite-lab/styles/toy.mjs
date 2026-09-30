// Style C — Toy / cel-shaded vector. Same procedural approach as the current sprites, but every shape gets a bold
// dark outline, a soft top-to-bottom gradient and a specular highlight, and aircraft use the same side view as
// the ground units. Drawn in a 100-unit tile space so proportions are easy to reason about.
import { lighten, darken, mix } from '../lib.mjs';

export const meta = { id: 'toy', name: 'Toy vector', blurb: 'bold outlines, gradients, specular highlights, consistent side view' };

const OUT = '#1c1a24', SKIN = '#f4cfa6', GLASS = '#c9ecff', STEEL = '#aeb3bd', STEEL_D = '#5f6470', TREAD = '#2d2d36', OLIVE = '#66714a', BROWN = '#8a5a32';

export function draw(g, id, o) {
  const { s, c, dk, alt = 0, w = 0, run = 1 } = o;
  const lt = lighten(c, .38);
  g.save(); g.scale(s / 100, s / 100);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 2.6; g.strokeStyle = OUT;

  // shadow (stays on the ground when the unit flies)
  const sw = { infantry: 20, mech: 22, sniper: 20, recon: 32, tank: 34, heavy_tank: 37, artillery: 30, flak: 33, copter: 26, fighter: 28, bomber: 38 }[id] || 30;
  g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(0, 31, sw, 5, 0, 0, 7); g.fill();
  if (alt) g.translate(0, -alt * 100);

  const path = (fn) => { g.beginPath(); fn(); };
  const rr = (x, y, ww, hh, r = 3) => path(() => g.roundRect(x, y, ww, hh, r));
  const poly = (pts) => path(() => { g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); g.closePath(); });
  const circ = (x, y, r) => path(() => g.arc(x, y, r, 0, 7));
  const ell = (x, y, rx, ry, rot = 0) => path(() => g.ellipse(x, y, rx, ry, rot, 0, 7));
  // fill with a vertical gradient over [y0,y1] then outline
  const paint = (col, y0, y1, stroke = true) => {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, lighten(col, .22)); gr.addColorStop(.55, col); gr.addColorStop(1, darken(col, .22));
    g.fillStyle = gr; g.fill(); if (stroke) g.stroke();
  };
  const flat = (col) => { g.fillStyle = col; g.fill(); g.stroke(); };
  const shine = (x, y, rx, ry, rot = -.2) => { g.fillStyle = 'rgba(255,255,255,.42)'; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
  const tube = (x0, y0, x1, y1, th, col) => {
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = th + 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = col; g.lineWidth = th; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = Math.max(1, th * .3); g.beginPath(); g.moveTo(x0, y0 - th * .2); g.lineTo(x1, y1 - th * .2); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2.6;
  };
  const trackSet = (x0, x1, y, hgt) => {
    rr(x0, y, x1 - x0, hgt, hgt / 2); paint(TREAD, y, y + hgt);
    const n = Math.round((x1 - x0) / 11);
    for (let i = 0; i < n; i++) { const x = x0 + hgt / 2 + i * ((x1 - x0 - hgt) / (n - 1)); circ(x, y + hgt / 2, hgt * .32); flat('#8b909b'); }
  };
  const sway = Math.sin(w * 8) * 2 * run;

  const draw = {
    infantry() {
      rr(-12, 10, 9, 18 + sway, 3.5); paint(dk, 10, 28); rr(3, 10, 9, 18 - sway, 3.5); paint(dk, 10, 28);
      rr(-14, -10, 28, 26, 8); paint(c, -10, 16); rr(-14, 9, 28, 5, 2); paint(dk, 9, 14); shine(-7, -3, 3, 8, .1);
      circ(0, -20, 10); paint(SKIN, -30, -10);
      path(() => { g.arc(0, -22, 12, Math.PI, 0); g.closePath(); }); paint(dk, -34, -22); rr(-14, -23, 28, 3.5, 1.5); paint(dk, -23, -19.5);
      tube(-8, 4, 27, -12, 3.5, '#3b3b44'); rr(-10, 2, 8, 6, 2); paint(BROWN, 2, 8);
      rr(6, -2, 12, 6, 3); paint(c, -2, 4);
    },
    mech() {
      rr(-14, 10, 12, 18, 3.5); paint(dk, 10, 28); rr(2, 10, 12, 18, 3.5); paint(dk, 10, 28);
      rr(-16, -12, 32, 28, 9); paint(c, -12, 16); rr(-16, -12, 32, 9, 5); paint(dk, -12, -3); shine(-9, 2, 3, 8, .1);
      rr(-26, -8, 9, 22, 3); paint(dk, -8, 14);
      circ(0, -21, 11); paint(dk, -32, -10); rr(-1, -24, 12, 4, 2); paint('#8fd3f5', -24, -20); shine(5, -23, 3, 1, 0); rr(-9, -15, 18, 5, 2); paint(lighten(dk, .1), -15, -10);
      g.save(); g.translate(0, -4); g.rotate(-.28); rr(-22, -6, 52, 12, 6); paint(OLIVE, -6, 6); rr(-24, -7, 7, 14, 3); paint(STEEL_D, -7, 7); rr(26, -8, 7, 16, 3); paint(STEEL, -8, 8); g.restore();
      rr(6, 6, 13, 7, 3); paint(c, 6, 13);
    },
    sniper() {
      const cloth = mix(c, OLIVE, .5);
      rr(-12, 10, 9, 18, 3.5); paint(OLIVE, 10, 28); rr(3, 10, 9, 18, 3.5); paint(OLIVE, 10, 28);
      rr(-14, -10, 28, 26, 8); paint(cloth, -10, 16); rr(-10, -12, 20, 6, 3); paint(c, -12, -6); shine(-7, -1, 3, 7, .1);
      circ(0, -20, 10); paint(SKIN, -30, -10);
      rr(-19, -26, 38, 5, 2.5); paint(OLIVE, -26, -21); path(() => { g.arc(0, -25, 12, Math.PI, 0); g.closePath(); }); paint('#6f7b4f', -37, -25);
      tube(-14, 8, 45, -12, 3, '#33333c'); rr(-16, 5, 12, 8, 3); paint(BROWN, 5, 13);
      rr(6, -12, 16, 5, 2.5); paint('#15151b', -12, -7); circ(21, -9.5, 2.2); flat('#7fd0ff');
      rr(4, -2, 14, 6, 3); paint(cloth, -2, 4);
    },
    recon() {
      circ(-19, 20, 9); paint(TREAD, 11, 29); circ(-19, 20, 4); flat(STEEL); circ(19, 20, 9); paint(TREAD, 11, 29); circ(19, 20, 4); flat(STEEL);
      rr(-32, -4, 64, 24, 7); paint(c, -4, 20); rr(-32, 11, 64, 9, 4); paint(dk, 11, 20); shine(-14, 0, 10, 2, 0);
      poly([[-6, -20], [12, -20], [24, -4], [-6, -4]]); paint(dk, -20, -4); poly([[2, -17], [11, -17], [19, -6], [2, -6]]); flat(GLASS); shine(7, -13, 3, 1.6, .6);
      tube(-28, -22, -6, -22, 4, STEEL_D); rr(-22, -22, 4, 19, 1); flat(STEEL_D);
      circ(31, 4, 2.8); flat('#ffd84d');
    },
    tank() {
      trackSet(-34, 34, 8, 19);
      rr(-30, -9, 60, 20, 6); paint(c, -9, 11); rr(-30, 3, 60, 8, 4); paint(dk, 3, 11); shine(-10, -5, 10, 1.8, 0);
      rr(-14, -25, 30, 18, 7); paint(dk, -25, -7); shine(-6, -21, 8, 2, 0); rr(-4, -32, 12, 8, 3); paint(dk, -32, -24);
      tube(14, -16, 40, -16, 6, STEEL_D); rr(38, -20, 6, 9, 2); paint(STEEL, -20, -11);
    },
    heavy_tank() {
      trackSet(-37, 37, 7, 21);
      rr(-33, -12, 66, 25, 6); paint(c, -12, 13); rr(-34, 4, 68, 9, 4); paint(dk, 4, 13); shine(-12, -8, 12, 2, 0);
      rr(-19, -31, 40, 21, 7); paint(dk, -31, -10); shine(-8, -27, 10, 2, 0); rr(-6, -38, 13, 8, 3); paint(dk, -38, -30);
      tube(20, -26, 42, -26, 5.5, STEEL_D); tube(20, -15, 42, -15, 5.5, STEEL_D);
    },
    artillery() {
      poly([[-32, 26], [-6, 8], [2, 14], [-24, 28]]); paint(dk, 8, 28);
      rr(-16, -2, 42, 17, 4); paint(c, -2, 15); shine(-4, 1, 9, 1.6, 0);
      tube(-6, -6, 38, -32, 9, STEEL_D); rr(32, -42, 9, 14, 3); g.save(); g.translate(36, -35); g.rotate(-.5); rr(-5, -7, 10, 14, 3); paint(STEEL, -7, 7); g.restore();
      rr(-2, -14, 15, 14, 4); paint(dk, -14, 0);
      rr(12, -14, 8, 26, 3); paint(dk, -14, 12);
      circ(-1, 20, 10); paint(TREAD, 10, 30); circ(-1, 20, 5); flat(STEEL); circ(-1, 20, 1.6); flat(STEEL_D);
    },
    flak() {
      trackSet(-32, 32, 9, 18);
      rr(-28, -5, 56, 17, 6); paint(c, -5, 12); rr(-28, 5, 56, 7, 3); paint(dk, 5, 12);
      rr(-14, -19, 30, 15, 6); paint(dk, -19, -4); shine(-6, -15, 7, 1.8, 0);
      tube(-1, -14, 30, -44, 7, STEEL_D); tube(8, -12, 40, -40, 7, STEEL_D);
      rr(-26, -30, 3, 27, 1); flat(STEEL_D); ell(-24.5, -32, 8, 3); paint(STEEL, -35, -29);
    },
    copter() {
      tube(-12, 24, 26, 24, 3, STEEL_D); rr(-3, 9, 3, 15, 1); flat(STEEL_D); rr(15, 9, 3, 15, 1); flat(STEEL_D);
      rr(-46, -3, 36, 10, 5); paint(c, -3, 7); poly([[-52, -18], [-44, -18], [-38, 6], [-48, 6]]); paint(dk, -18, 6);
      ell(4, 2, 27, 17); paint(c, -15, 19); path(() => { g.ellipse(4, 2, 27, 17, 0, 0, Math.PI); }); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); shine(-8, -7, 10, 3.5);
      ell(20, 0, 12, 11); paint('#9fdcf7', -11, 11); shine(16, -5, 4, 2.6);
      rr(-3, -30, 6, 13, 2); flat(STEEL_D);
      const rl = 46 * (run ? .55 + .45 * Math.abs(Math.cos(w * 22)) : .8);
      tube(-rl, -32, rl, -32, 3, '#3d404a');
      tube(28, 14, 42, 16, 3.5, '#2b2b33');
    },
    fighter() {
      poly([[6, -2], [-6, -2], [-16, -22], [-6, -22]]); paint(darken(dk, .15), -22, -2);
      poly([[-38, -1], [-30, -1], [-20, -4], [-30, -30], [-40, -30]]); paint(dk, -30, -1);
      poly([[-42, 0], [-32, -8], [12, -8], [46, 0], [12, 8], [-32, 8]]); paint(c, -8, 8);
      poly([[-2, 6], [22, 6], [2, 30], [-14, 30]]); paint(dk, 6, 30);
      poly([[10, -8], [24, -8], [34, -3], [10, -3]]); paint(GLASS, -8, -3); shine(18, -6, 4, 1.2, 0);
      rr(2, -3, 12, 5, 2); paint(darken(c, .3), -3, 2);
      const fl = (run ? .7 + .3 * Math.sin(w * 40) : .4) * 12; poly([[-42, -3], [-42 - fl, 0], [-42, 3]]); flat('#ffa63a');
    },
    bomber() {
      poly([[8, -2], [-8, -2], [-12, -24], [-2, -24]]); paint(darken(c, .3), -24, -2);
      poly([[-44, 0], [-40, -6], [-26, -6], [-30, -36], [-40, -40], [-46, -40]]); paint(dk, -40, 0); poly([[-46, -8], [-30, -8], [-30, -2], [-46, -2]]); paint(dk, -8, -2);
      poly([[-46, 2], [-38, -12], [22, -12], [46, -4], [46, 6], [24, 12], [-38, 12]]); paint(c, -12, 12); rr(-44, 6, 90, 6, 3); paint(dk, 6, 12); shine(-4, -8, 22, 1.8, 0);
      poly([[34, -12], [42, -10], [46, -5], [34, -5]]); paint(GLASS, -12, -5);
      poly([[-16, 8], [26, 8], [16, 30], [-28, 30]]); paint(darken(c, .1), 8, 30);
      rr(-14, 15, 22, 11, 4); paint(STEEL_D, 15, 26); g.strokeStyle = '#eee'; g.lineWidth = 2; const a = run ? Math.sin(w * 25) * 3 : 0; g.beginPath(); g.moveTo(11, 14 - a); g.lineTo(11, 28 + a); g.stroke();
    },
  };
  draw[id]();
  g.restore();
}
