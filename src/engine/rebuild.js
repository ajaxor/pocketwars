// Rebuilding ruins. A terrain with the `ruin` attribute ({ becomes, cost }: a ruined city, a ruined factory) is the shell of a building. A unit with the
// `capture` attribute standing on it may Rebuild it in place of Capture: the owner pays `cost`, the tile turns into the `becomes` terrain (a property), it
// belongs to the unit's owner at once, and the unit's turn ends. The change is kept in `state.terrain` (the map itself never changes), so Undo and Reset
// see it, and every rule reads the tile through queries.terrainIdAt.

import { attributeConfig, hasAttribute } from './attributes.js';
import { snapshotUnit, terrainAt, terrainIdAt, unitDef } from './queries.js';

/** The ruin config { becomes, cost } of the tile at (x, y), or null when it is not a ruin. */
export const ruinAt = (game, x, y) => attributeConfig(terrainAt(game, x, y), 'ruin') ?? null;

/** Why `unit` could not rebuild the ruin at (x, y) (default: where it stands), or null when it can. */
export function rebuildProblem(game, unit, x = unit.x, y = unit.y) {
  const ruin = ruinAt(game, x, y);
  if (!ruin) return 'not-a-ruin';
  if (!hasAttribute(unitDef(game, unit), 'capture')) return 'cannot-rebuild';
  if (game.state.funds[unit.owner] < ruin.cost) return 'not-enough-funds';
  return null;
}

/** Could `unit` rebuild the ruin at (x, y) right now (it is a ruin, the unit is a builder, the owner can pay)? */
export const canRebuild = (game, unit, x, y) => rebuildProblem(game, unit, x, y) === null;

/** Is there a ruin at (x, y) that `unit` could rebuild if only its owner had the money? (The Rebuild button is shown, greyed, for those.) */
export const couldRebuild = (game, unit, x, y) => { const p = rebuildProblem(game, unit, x, y); return p === null || p === 'not-enough-funds'; };

/** Pay for and rebuild the ruin `unit` stands on. Returns the 'rebuild' event. */
export function resolveRebuild(game, unit) {
  const { x, y } = unit;
  const ruin = ruinAt(game, x, y);
  const from = terrainIdAt(game, x, y);
  game.state.funds[unit.owner] -= ruin.cost;
  game.state.terrain[y][x] = ruin.becomes;
  game.state.owners[y][x] = unit.owner;
  unit.capture = 0;
  return [{ type: 'rebuild', unit: snapshotUnit(unit), x, y, owner: unit.owner, from, to: ruin.becomes, cost: ruin.cost }];
}
