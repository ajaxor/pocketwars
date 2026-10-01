// Render every shoal style (src/render/shoal-styles.js) on sea: a strip of tile variations per style, big and at game size.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { SHOAL_STYLES } from '../../src/render/shoal-styles.js';
const out = process.argv[2] || 'shoals.png';
const BASE = '#3d7ec7', names = Object.keys(SHOAL_STYLES), cols = 5, S = 150, small = 48;
const cv = createCanvas(cols * S + 20 + 6 * small, names.length * S);
const g = cv.getContext('2d');
g.fillStyle = BASE; g.fillRect(0, 0, cv.width, cv.height);
names.forEach((n, r) => {
  for (let c = 0; c < cols; c++) SHOAL_STYLES[n](g, c * S, r * S, S, { x: 3 + c * 5, y: 2 + r, now: 400 + c * 700 });
  for (let c = 0; c < 6; c++) SHOAL_STYLES[n](g, cols * S + 20 + c * small, r * S + 40, small, { x: 7 + c * 3, y: 4 + r, now: 900 });
});
writeFileSync(out, cv.toBuffer('image/png'));
console.log('wrote', out, names.join(', '));
