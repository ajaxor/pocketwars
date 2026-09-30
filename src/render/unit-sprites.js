// Unit drawing. The art itself (sprites and shadows) is in unit-art.js and one frame is composed by unit-frame.js;
// this file adds what only the game needs: faction colours, fade and the HP digit.
// To add a unit visual, add a sprite and a shadow to unit-art.js and reference it by name from data/units.json.
import { SPRITES, SHADOWS } from './unit-art.js';
import { drawFrame } from './unit-frame.js';

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
 */
export function drawUnit(g, unit, o) {
  const { def, colors, px, py, size: s, now, animate, moving, alpha = 1, showHp } = o;
  const run = animate ? 1 : 0;
  const w = now / 1000 * (moving ? 2 : 1);
  const ph = unit.x * .9 + unit.y * 1.7;
  g.save(); g.translate(px + s / 2, py + s / 2); g.globalAlpha = (run ? 1 : .55) * alpha;
  drawFrame(g, ART, def.render.sprite, { s, c: colors.color, dk: colors.dark, alt: def.render.altitude || 0, w, ph, run });
  g.restore();
  const dh = Math.ceil(unit.hp - 1e-9);
  if (showHp && dh < 10 && dh > 0) {
    g.save(); g.globalAlpha = (run ? 1 : .55) * alpha; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${s * .32}px ui-monospace,monospace`; g.lineWidth = 3; g.strokeStyle = '#000';
    g.strokeText(dh, px + s * .8, py + s * .82); g.fillText(dh, px + s * .8, py + s * .82); g.restore();
  }
}
