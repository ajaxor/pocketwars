// Small read helpers over a game (registry + immutable map + mutable state). No rules live here.

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const round1 = (n) => Math.round(n * 10) / 10;
export const distance = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const inBounds = (map, x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height;
export const tileIndex = (map, x, y) => y * map.width + x;

export const unitAt = (game, x, y) => game.state.units.find((u) => u.x === x && u.y === y);
export const unitById = (game, id) => game.state.units.find((u) => u.id === id);
export const unitDef = (game, unit) => game.registry.unit(unit.type);
export const terrainAt = (game, x, y) => game.registry.terrainDef(game.map.terrain[y][x]);
export const ownerAt = (game, x, y) => game.state.owners[y][x];
export const removeUnit = (game, unit) => { game.state.units = game.state.units.filter((u) => u !== unit); };

/** Plain copy of the fields the presentation layer needs, safe to keep after the unit changes or dies. */
export const snapshotUnit = (u) => ({ id: u.id, type: u.type, owner: u.owner, x: u.x, y: u.y, hp: u.hp });

/** The `property` attribute config of the terrain at (x, y), or null when the tile is not a property. */
export function propertyAt(game, x, y) {
  const p = terrainAt(game, x, y).attributes.property;
  return p || null;
}

/** Every property tile as { x, y, terrain, owner, property } in row-major order. */
export function allProperties(game) {
  const out = [];
  for (let y = 0; y < game.map.height; y++) {
    for (let x = 0; x < game.map.width; x++) {
      const property = propertyAt(game, x, y);
      if (property) out.push({ x, y, terrain: terrainAt(game, x, y), owner: ownerAt(game, x, y), property });
    }
  }
  return out;
}

export const propertiesOwnedBy = (game, player) => allProperties(game).filter((p) => p.owner === player);
export const layerInfo = (game, unit) => game.registry.rules.layers[unitDef(game, unit).layer];
export const factionOf = (game, player) => game.registry.faction(game.map.players[player].faction);
