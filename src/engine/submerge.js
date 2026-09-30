// Diving. A unit with the `submerge` attribute can dive on a tile with the terrain attribute `submergible` (deep water) and
// surface again; both are orders that end the unit's turn, like Wait, and can follow a move. While it is down the unit is on the
// layer the attribute names (rules.json -> layers -> underwater), so only weapons with a matching target mode can hit it, and that
// layer is `hidden`, which is what detection.js acts on. A unit whose move ends on a tile that is not submergible comes up by itself.

import { hasAttribute } from './attributes.js';
import { terrainAt, unitDef } from './queries.js';

/** Can this kind of unit dive at all? */
export const canDive = (game, unit) => hasAttribute(unitDef(game, unit), 'submerge');

/** Is the tile deep enough to dive on? */
export const submergibleAt = (game, x, y) => hasAttribute(terrainAt(game, x, y), 'submergible');

/** Could `unit`, standing on (x, y), dive now? */
export const canSubmergeAt = (game, unit, x = unit.x, y = unit.y) => canDive(game, unit) && !unit.submerged && submergibleAt(game, x, y);

/** Could `unit` surface now? */
export const canSurface = (unit) => !!unit.submerged;
