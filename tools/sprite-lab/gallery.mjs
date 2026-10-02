// Writes gallery/data.json (units, factions and terrain colours, read by gallery/portraits.js). The gallery page itself
// (gallery/index.html, preview.js and the views) is hand-written. Run: node lab.mjs gallery
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO, units, weapons, factions, terrain } from './lib.mjs';

// "range 2–3" from the unit's longest-reaching weapon ("unarmed" when it has none)
const rangeNote = (u) => {
  const ws = (u.weapons || []).map((id) => weapons[id]).filter(Boolean);
  if (!ws.length) return 'unarmed';
  const w = ws.reduce((a, b) => (b.range[1] > a.range[1] ? b : a));
  return `range ${w.range[0] === w.range[1] ? w.range[0] : `${w.range[0]}–${w.range[1]}`}`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function build() {
  const data = {
    units: Object.entries(units).map(([id, u]) => ({
      id, name: u.name, sprite: u.render.sprite, altitude: u.render.altitude || 0,
      note: `${u.planned ? 'PLANNED, not in the game · ' : ''}${u.category} · move ${u.move} · ${rangeNote(u)}`,
    })),
    factions: Object.entries(factions).map(([id, f]) => ({ id, name: f.name, color: f.color, dark: f.dark })),
    terrain: { plain: terrain.plain.render.base ?? '#86b95c', road: terrain.road.render.base, sea: terrain.sea.render.base },
  };
  writeFileSync(path.join(REPO, 'gallery', 'data.json'), JSON.stringify(data));
  console.log('wrote gallery/data.json');
}
