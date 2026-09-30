// A small picture of a whole map for the skirmish page: one flat square per tile in the terrain's preview colour
// (terrain.json -> render.mini, falling back to its base colour or the ground under it), properties marked with their owner's colour and HQs outlined.
// It draws on any 2D context and keeps no state, so the page can redraw it when a player changes colour.

/** The box a preview has to fit in, in CSS pixels. */
export const MINI_BOX = { w: 176, h: 136 };

/** Pixels per tile that make `map` fit MINI_BOX (whole pixels, at least 2). */
export const miniTile = (map, box = MINI_BOX) => Math.max(2, Math.min(14, Math.floor(Math.min(box.w / map.width, box.h / map.height))));

/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} map   a GameMap
 * @param {object} registry
 * @param {(owner:number|null)=>string} colorOf  colour of a player's properties (null = neutral)
 * @param {number} [px]  pixels per tile (default: miniTile)
 */
export function drawMinimap(g, map, registry, colorOf, px = miniTile(map)) {
  const groundColor = (x, y) => { const gr = registry.groundDef(map.ground?.[y]?.[x]); return gr ? gr.render.mini || gr.render.base : '#86b95c'; };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = registry.terrainDef(map.terrain[y][x]);
      const isProperty = !!t.attributes.property;
      // a property sits on its ground, unless the terrain paints its own base (a shipyard on the water)
      g.fillStyle = isProperty && !t.render.base ? groundColor(x, y) : t.render.mini || t.render.base || groundColor(x, y);
      g.fillRect(x * px, y * px, px, px);
      if (!isProperty) continue;
      const pad = px >= 6 ? Math.round(px * .18) : 0;
      g.fillStyle = colorOf(map.owners[y][x]);
      g.fillRect(x * px + pad, y * px + pad, px - pad * 2, px - pad * 2);
      if (t.attributes.victoryOnCapture) {
        g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, px * .12);
        g.strokeRect(x * px + pad + .5, y * px + pad + .5, px - pad * 2 - 1, px - pad * 2 - 1);
      }
    }
  }
}
