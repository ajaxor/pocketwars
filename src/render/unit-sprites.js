// Unit drawing. The art itself (sprites and shadows) is in unit-art.js and one frame is composed by unit-frame.js;
// this file adds what only the game needs: faction colours, the dark-grey wash on units that have acted, fade and the HP digit.
// To add a unit visual, add a sprite and a shadow to unit-art.js and reference it by name from data/units.json.
import { SPRITES, SHADOWS } from './unit-art.js';
import { DISABLED_TINT } from './unit-frame.js';
import { drawOutlined, OUTLINE_THIN } from './outline.js';
import { drawFaded } from './layer.js';
import { font } from './font.js';

export const UNIT_SPRITES = SPRITES;

const ART = { SPRITES, SHADOWS };

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
 * @param {number} o.face      1 faces right (the way sprites are drawn), -1 mirrors the unit to face left
 * @param {boolean} o.onWater  the unit is on a water tile: a unit with render.waterSprite draws that instead (the marine's dinghy)
 * @param {null|'low'|'empty'} o.ammo  ammo warning bullet on the tile's bottom right (see drawAmmo): flashes when low, steady red when empty
 * @param {boolean} o.exposed  a hidden unit an enemy can see right now: it loses its eye (see detection.js isExposed)
 * @param {boolean} o.hidden    the unit is hidden from other players (submerged, or any other hidden layer): an eye on its corner
 * @param {boolean} o.submerged a dived unit: its sprite draws itself low in the water (see the submarine in unit-art.js)
 */
export function drawUnit(g, unit, o) {
  const { def, colors, px, py, size: s, now, animate, moving, alpha = 1, showHp, submerged = false, hidden = false, exposed = false, face = 1, onWater = false, ammo = null } = o;
  const run = animate ? 1 : 0;
  const w = now / 1000 * (moving ? 2 : 1);
  const ph = unit.x * .9 + unit.y * 1.7;
  g.save(); g.translate(px + s / 2, py + s / 2);
  // a thin line in the unit's dark team colour all round it, except round the sprite's own black parts (barrels, visors, ink lines: skipBlack)
  drawOutlined(g, ART, onWater && def.render.waterSprite ? def.render.waterSprite : def.render.sprite, { s, c: colors.color, dk: colors.dark, alt: def.render.altitude || 0, w, ph, run, moving: !!moving, submerged, face },
    { r: Math.max(1, s * OUTLINE_THIN), color: colors.dark, tint: run ? null : DISABLED_TINT, alpha, skipBlack: true });
  g.restore();
  if (hidden && !exposed) drawEye(g, px + s * .2, py + s * .2, s * .15, alpha);   // only a unit nobody can see wears the eye: once an enemy notices it the badge goes
  const dh = Math.ceil(unit.hp - 1e-9);
  const digit = showHp && dh < 10 && dh > 0;
  if (ammo === 'low' || ammo === 'empty') drawAmmo(g, px + s * .84, py + (digit ? s * .54 : s * .8), s, ammo, now, alpha);
  if (digit) {
    const hx = px + s * .8, hy = py + s * .82, r = s * .3;
    drawFaded(g, alpha, hx - r, hy - r, r * 2, r * 2, (c) => {   // outline + digit as one image, so fading never greys the digit, and a unit that has acted keeps a clear white digit
      c.save(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = font(700, s * .34); c.lineWidth = 3; c.strokeStyle = '#000';
      c.strokeText(dh, hx, hy); c.fillText(dh, hx, hy); c.restore();
    });
  }
}

/**
 * The ammo warning: a bullet at (x, y) on the bottom right of the tile. 'low' flashes (gold, on and off), 'empty' is steady red.
 * Sits above the HP digit when there is one. Nothing is drawn for units with plenty of ammo (the caller passes null).
 */
export const AMMO_BLINK_MS = 340;
export function drawAmmo(g, x, y, s, level, now, alpha = 1) {
  if (level === 'low' && Math.floor(now / AMMO_BLINK_MS) % 2) return;   // the "off" half of the flash
  const col = level === 'empty' ? '#ff3b30' : '#ffd23f', tip = level === 'empty' ? '#a31510' : '#d98a1e';
  const w = s * .12, h = s * .26;
  g.save(); g.globalAlpha = alpha; g.translate(x, y);
  const body = () => { g.beginPath(); g.moveTo(-w / 2, h / 2); g.lineTo(-w / 2, -h * .05); g.quadraticCurveTo(-w / 2, -h / 2, 0, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h * .05); g.lineTo(w / 2, h / 2); g.closePath(); };
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, s * .05); g.strokeStyle = '#000'; body(); g.stroke();
  g.fillStyle = col; body(); g.fill();
  g.fillStyle = tip; g.beginPath(); g.moveTo(-w / 2, -h * .05); g.quadraticCurveTo(-w / 2, -h / 2, 0, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h * .05); g.closePath(); g.fill();   // the bullet's tip
  g.fillStyle = '#000'; g.fillRect(-w / 2, h * .28, w, Math.max(1, s * .02));   // the band at its base
  g.restore();
}

/** The "hidden" marker: a white almond-shaped eye with a dark pupil on a dark round badge, centred on (x, y), r = badge radius. */
function drawEye(g, x, y, r, alpha = 1) {
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(16,24,40,.82)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath();
  g.moveTo(x - r * .72, y); g.quadraticCurveTo(x, y - r * .78, x + r * .72, y); g.quadraticCurveTo(x, y + r * .78, x - r * .72, y); g.closePath(); g.fill();
  g.fillStyle = '#2a6fd0'; g.beginPath(); g.arc(x, y, r * .3, 0, 7); g.fill();
  g.fillStyle = '#0b1320'; g.beginPath(); g.arc(x, y, r * .15, 0, 7); g.fill();
  g.restore();
}
