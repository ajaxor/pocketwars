// Procedural unit sprites. Each sprite is drawn centred on (0, 0) in a tile of size `s`, so a unit's
// `render.sprite` in units.json selects one of the functions in UNIT_SPRITES. To add a unit visual, add a
// function here and reference it by name from data/units.json.
//
// Sprite params: s = tile size, c / dk = faction colour / dark colour, w = animation clock (seconds),
// ph = per-unit phase offset, run = 1 while animating (0 when the unit has acted), b / j = bob / jitter.

const soldier = (kind) => (g, { s, c, dk, w, ph, run, b }) => {
  const l = Math.sin(w * 8 + ph) * s * .05 * run;
  g.fillStyle = dk; g.fillRect(-s * .14, s * .12, s * .1, s * .17 + l); g.fillRect(s * .04, s * .12, s * .1, s * .17 - l);
  g.fillStyle = c; g.beginPath(); g.roundRect(-s * .16, -s * .12 + b, s * .32, s * .28, 4); g.fill();
  g.fillStyle = '#f1c99b'; g.beginPath(); g.arc(0, -s * .2 + b, s * .09, 0, 7); g.fill();
  g.fillStyle = dk; g.beginPath(); g.arc(0, -s * .21 + b, s * .11, Math.PI, 0); g.fill(); g.fillRect(-s * .13, -s * .22 + b, s * .26, s * .03);
  const sw = Math.sin(w * 8 + ph) * s * .02 * run;
  g.strokeStyle = '#222'; g.lineWidth = Math.max(2, s * .05); g.lineCap = 'round'; g.beginPath();
  if (kind === 'mech') {
    g.strokeStyle = '#4b5238'; g.lineWidth = Math.max(4, s * .11); g.moveTo(-s * .2, s * .08 + b); g.lineTo(s * .22, -s * .2 + b + sw); g.stroke();
    g.fillStyle = dk; g.fillRect(-s * .22, -s * .08 + b, s * .07, s * .2);
  } else if (kind === 'sniper') {
    g.lineWidth = Math.max(1.5, s * .035); g.moveTo(-s * .12, s * .06 + b); g.lineTo(s * .4, -s * .04 + b + sw); g.stroke();
    g.fillStyle = '#111'; g.fillRect(s * .14, -s * .09 + b, s * .08, s * .04);
  } else {
    g.moveTo(-s * .1, s * .04 + b); g.lineTo(s * .26, -s * .12 + b + sw); g.stroke();
  }
};

const tank = (heavy) => (g, { s, c, dk, w, run, j }) => {
  const h = heavy;
  g.fillStyle = '#2b2b2b'; g.beginPath(); g.roundRect(-s * .34, s * .08 + j, s * .68, s * .19, 5); g.fill();
  g.fillStyle = '#9a9a9a'; const off = (w * s * .3 * run) % (s * .12); for (let i = 0; i < 6; i++) { const x = -s * .32 + i * s * .12 + off; if (x < s * .28) g.fillRect(x, s * .15 + j, s * .05, s * .04); }
  g.fillStyle = c; g.beginPath(); g.roundRect(-s * .3, -s * (h ? .1 : .06) + j, s * .6, s * (h ? .22 : .17), 4); g.fill();
  g.fillStyle = dk; g.beginPath(); g.roundRect(-s * (h ? .17 : .13), -s * (h ? .24 : .17) + j, s * (h ? .34 : .26), s * (h ? .17 : .14), 3); g.fill();
  g.fillStyle = '#222'; g.fillRect(s * .12, -s * (h ? .2 : .13) + j, s * (h ? .3 : .24), s * .045); if (h) g.fillRect(s * .12, -s * .13 + j, s * .3, s * .045);
};

const recon = (g, { s, c, dk, w, run, j }) => {
  g.fillStyle = c; g.beginPath(); g.roundRect(-s * .3, -s * .02 + j, s * .6, s * .2, 4); g.fill();
  g.fillStyle = dk; g.fillRect(-s * .02, -s * .14 + j, s * .22, s * .13); g.fillStyle = '#cfe6f5'; g.fillRect(s * .02, -s * .12 + j, s * .14, s * .08);
  g.fillStyle = '#222'; g.fillRect(-s * .26, -s * .13 + j, s * .2, s * .04); g.fillRect(-s * .2, -s * .1 + j, s * .03, s * .09);
  for (const wx of [-.19, .19]) { g.fillStyle = '#222'; g.beginPath(); g.arc(wx * s, s * .2, s * .08, 0, 7); g.fill(); g.strokeStyle = '#aaa'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(wx * s, s * .2); g.lineTo(wx * s + Math.cos(w * 10 * run) * s * .07, s * .2 + Math.sin(w * 10 * run) * s * .07); g.stroke(); }
};

const copter = (g, { s, c, dk, w, run }) => {
  g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(-s * .12, s * .25); g.lineTo(s * .22, s * .25); g.moveTo(-s * .05, s * .1); g.lineTo(-s * .05, s * .25); g.moveTo(s * .14, s * .1); g.lineTo(s * .14, s * .25); g.stroke();
  g.fillStyle = dk; g.fillRect(-s * .44, -s * .04, s * .34, s * .06); g.fillRect(-s * .46, -s * .16, s * .05, s * .22);
  g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, s * .24, s * .15, 0, 0, 7); g.fill();
  g.fillStyle = '#cfe6f5'; g.beginPath(); g.ellipse(s * .12, -s * .02, s * .1, s * .09, 0, 0, 7); g.fill();
  g.fillStyle = '#222'; g.fillRect(s * .22, s * .05, s * .13, s * .03);
  const rl = (run ? Math.abs(Math.cos(w * 22)) : .6) * s * .36 + s * .05; g.strokeStyle = '#222'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-rl, -s * .19); g.lineTo(rl, -s * .19); g.stroke(); g.fillStyle = '#222'; g.fillRect(-s * .02, -s * .21, s * .04, s * .08);
};

const fighter = (g, { s, c, dk, w, run }) => {
  const fl = (run ? .6 + .4 * Math.sin(w * 40) : .3) * s * .16;
  g.fillStyle = '#ff9a2e'; g.beginPath(); g.moveTo(-s * .32, -s * .03); g.lineTo(-s * .32 - fl, 0); g.lineTo(-s * .32, s * .03); g.fill();
  g.fillStyle = dk; g.beginPath(); g.moveTo(s * .12, -s * .03); g.lineTo(-s * .2, -s * .32); g.lineTo(-s * .26, -s * .32); g.lineTo(-s * .14, -s * .03); g.fill();
  g.beginPath(); g.moveTo(s * .12, s * .03); g.lineTo(-s * .2, s * .32); g.lineTo(-s * .26, s * .32); g.lineTo(-s * .14, s * .03); g.fill();
  g.beginPath(); g.moveTo(-s * .26, -s * .03); g.lineTo(-s * .38, -s * .14); g.lineTo(-s * .33, -s * .03); g.fill(); g.beginPath(); g.moveTo(-s * .26, s * .03); g.lineTo(-s * .38, s * .14); g.lineTo(-s * .33, s * .03); g.fill();
  g.fillStyle = c; g.beginPath(); g.moveTo(s * .4, 0); g.lineTo(s * .05, -s * .07); g.lineTo(-s * .32, -s * .06); g.lineTo(-s * .32, s * .06); g.lineTo(s * .05, s * .07); g.closePath(); g.fill();
  g.fillStyle = '#cfe6f5'; g.beginPath(); g.ellipse(s * .14, 0, s * .08, s * .035, 0, 0, 7); g.fill();
};

const bomber = (g, { s, c, dk, w, run }) => {
  g.fillStyle = dk; g.fillRect(-s * .4, -s * .16, s * .1, s * .32);
  g.fillStyle = c; g.fillRect(-s * .1, -s * .38, s * .2, s * .76); g.fillStyle = dk; g.fillRect(-s * .1, -s * .38, s * .03, s * .76);
  g.fillStyle = c; g.beginPath(); g.roundRect(-s * .42, -s * .07, s * .84, s * .14, s * .07); g.fill();
  g.fillStyle = '#cfe6f5'; g.beginPath(); g.ellipse(s * .34, 0, s * .07, s * .04, 0, 0, 7); g.fill();
  for (const ey of [-.22, .22]) { g.fillStyle = '#222'; g.fillRect(s * .06, ey * s - s * .04, s * .1, s * .08); g.strokeStyle = '#ddd'; g.lineWidth = 1.5; const a = Math.sin(w * 25) * run; g.beginPath(); g.moveTo(s * .17, ey * s - a * s * .08); g.lineTo(s * .17, ey * s + a * s * .08); g.stroke(); }
};

const flak = (g, { s, c, dk, w, ph, run, j }) => {
  g.fillStyle = '#2b2b2b'; g.beginPath(); g.roundRect(-s * .32, s * .1 + j, s * .64, s * .17, 5); g.fill();
  g.fillStyle = '#9a9a9a'; const off = (w * s * .3 * run) % (s * .12); for (let i = 0; i < 6; i++) { const x = -s * .3 + i * s * .12 + off; if (x < s * .27) g.fillRect(x, s * .16 + j, s * .05, s * .04); }
  g.fillStyle = c; g.beginPath(); g.roundRect(-s * .28, -s * .02 + j, s * .56, s * .15, 4); g.fill();
  g.fillStyle = dk; g.beginPath(); g.roundRect(-s * .14, -s * .14 + j, s * .28, s * .14, 3); g.fill();
  g.save(); g.translate(s * .02, -s * .1 + j); g.rotate(-.95 + Math.sin(w * 2 + ph) * .12 * run); g.fillStyle = '#222'; g.fillRect(0, -s * .055, s * .36, s * .04); g.fillRect(0, s * .015, s * .36, s * .04); g.restore();
  g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-s * .16, -s * .14 + j); g.lineTo(-s * .16 + Math.cos(w * 8 * run) * s * .09, -s * .16 + j - Math.abs(Math.sin(w * 8 * run)) * s * .06); g.stroke();
};

const artillery = (g, { s, c, dk, w, ph, run, j }) => {
  g.fillStyle = '#222'; for (const wx of [-.16, .12]) { g.beginPath(); g.arc(wx * s, s * .21, s * .07, 0, 7); g.fill(); g.strokeStyle = '#aaa'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(wx * s, s * .21); g.lineTo(wx * s + Math.cos(w * 6 * run) * s * .06, s * .21 + Math.sin(w * 6 * run) * s * .06); g.stroke(); }
  g.fillStyle = c; g.beginPath(); g.roundRect(-s * .22, s * .02 + j, s * .4, s * .14, 3); g.fill();
  g.save(); g.translate(-s * .02, s * .03 + j); g.rotate(-.5 + Math.sin(w * 1.5 + ph) * .12 * run); g.fillStyle = dk; g.fillRect(0, -s * .035, s * .38, s * .07); g.restore();
};

export const UNIT_SPRITES = {
  infantry: soldier('infantry'),
  mech: soldier('mech'),
  sniper: soldier('sniper'),
  recon,
  tank: tank(false),
  heavy_tank: tank(true),
  artillery,
  flak,
  copter,
  fighter,
  bomber,
};

/**
 * Draw one unit.
 * @param g canvas 2D context
 * @param {{type:string,x:number,y:number,hp:number}} unit  (x, y only seed the animation phase)
 * @param {object} o
 * @param {object} o.def        unit definition (render.sprite, render.altitude)
 * @param {{color:string,dark:string}} o.colors  faction colours
 * @param {number} o.px @param {number} o.py     top-left pixel position of the tile
 * @param {number} o.size       tile size in pixels
 * @param {number} o.now        clock in ms
 * @param {boolean} o.animate   idle animation on (false = static "already acted" pose)
 * @param {boolean} o.moving    drawn at double animation speed while sliding
 * @param {number} o.alpha      fade multiplier (dying units)
 * @param {boolean} o.showHp    draw the HP digit when damaged
 */
export function drawUnit(g, unit, o) {
  const { def, colors, px, py, size: s, now, animate, moving, alpha = 1, showHp } = o;
  const run = animate ? 1 : 0;
  const w = now / 1000 * (moving ? 2 : 1);
  const ph = unit.x * .9 + unit.y * 1.7;
  const c = colors.color;
  const dk = colors.dark;
  g.save(); g.translate(px + s / 2, py + s / 2); g.globalAlpha = (run ? 1 : .55) * alpha;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, s * .31, s * .3, s * .06, 0, 0, 7); g.fill();
  if (def.render.altitude) g.translate(0, -s * def.render.altitude + Math.sin(w * 3 + ph) * s * .03 * run);
  const b = Math.sin(w * 5 + ph) * s * .025 * run;
  const j = Math.sin(w * 14 + ph) * s * .012 * run;
  UNIT_SPRITES[def.render.sprite](g, { s, c, dk, w, ph, run, b, j });
  g.restore();
  const dh = Math.ceil(unit.hp - 1e-9);
  if (showHp && dh < 10 && dh > 0) {
    g.save(); g.globalAlpha = (run ? 1 : .55) * alpha; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${s * .32}px ui-monospace,monospace`; g.lineWidth = 3; g.strokeStyle = '#000';
    g.strokeText(dh, px + s * .8, py + s * .82); g.fillText(dh, px + s * .8, py + s * .82); g.restore();
  }
}
