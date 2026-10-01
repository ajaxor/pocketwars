// A speech bubble attached to a unit's HP digit (bottom right of its tile), used to preview damage: "-4" over the unit that would
// be hit, and another over the attacker for the counterattack. Browser-safe; the caller supplies the tile's pixel position.
import { font } from './font.js';

/**
 * @param g canvas context
 * @param {number} px @param {number} py   top-left pixel of the unit's tile
 * @param {number} s                       tile size in pixels
 * @param {string} text                    e.g. "-4" or "KO"
 * @param {string} fill                    bubble colour
 */
export function drawBubble(g, px, py, s, text, fill) {
  const w = s * .66, h = s * .32;
  const bx = px + s * 1.04 - w, by = py + s * .26;        // above the HP digit, flush with the tile's right edge
  const tipX = px + s * .8, tipY = py + s * .66;          // the tail points at the HP digit
  g.save();
  g.lineJoin = 'round';
  const shape = () => {
    g.beginPath();
    g.roundRect(bx, by, w, h, h * .45);
    g.moveTo(tipX - s * .09, by + h - 1); g.lineTo(tipX, tipY); g.lineTo(tipX + s * .05, by + h - 1);
    g.closePath();
  };
  g.lineWidth = Math.max(2, s * .06); g.strokeStyle = '#000'; shape(); g.stroke();
  g.fillStyle = fill; shape(); g.fill();
  g.fillStyle = '#fff'; g.font = font(700, s * .24); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, bx + w / 2, by + h / 2 + s * .01);
  g.restore();
}

export const BUBBLE_HIT = '#d62828';
export const BUBBLE_COUNTER = '#e07b00';
