// The shipped water maps must be winnable and playable: no transports exist yet, so the only way to capture an HQ is on foot
// over land, and ships need open deep water from their shipyards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readData } from '../helpers/node-io.js';
import { loadRegistry, loadMapIndex, loadMap } from '../../src/data/loader.js';
import { Game } from '../../src/engine/game.js';
import { playTurn } from '../../src/engine/ai.js';
import { allProperties } from '../../src/engine/queries.js';

const registry = await loadRegistry(readData);
const index = await loadMapIndex(readData);

/** Tiles reachable from (sx, sy) by 4-neighbour steps over tiles the move class can enter. */
function flood(map, from, moveClass) {
  const seen = new Set([from.y * map.width + from.x]);
  const queue = [from];
  while (queue.length) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(ny * map.width + nx)) continue;
      if (registry.terrainDef(map.terrain[ny][nx]).moveCost[moveClass] == null) continue;
      seen.add(ny * map.width + nx);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

for (const id of Object.keys(index.maps)) {
  test(`${id}: every HQ can be reached on foot from every other player's HQ`, async () => {
    const map = await loadMap(readData, registry, id);
    const game = new Game(registry, map);
    const hqs = allProperties(game).filter((p) => p.terrain.attributes.victoryOnCapture);
    for (const a of hqs) {
      const reach = flood(map, a, 'foot');
      for (const b of hqs) assert.ok(reach.has(b.y * map.width + b.x), `${id}: HQ at ${b.x},${b.y} is cut off from ${a.x},${a.y}`);
    }
  });
}

for (const id of ['harbor_front', 'reef_raiders', 'twin_fleets']) {
  test(`${id}: each shipyard opens onto deep water that reaches the other side's shipyards`, async () => {
    const map = await loadMap(readData, registry, id);
    const game = new Game(registry, map);
    const yards = allProperties(game).filter((p) => p.terrain.attributes.property.builds.includes('naval'));
    assert.ok(yards.length >= 2);
    const reach = flood(map, yards[0], 'naval');
    for (const y of yards) assert.ok(reach.has(y.y * map.width + y.x), `${id}: shipyard ${y.x},${y.y} is boxed in`);
    for (const y of yards) {
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => registry.terrainDef(map.terrain[y.y + dy]?.[y.x + dx] ?? 'plain').attributes?.submergible);
      assert.ok(around.length > 0, `${id}: shipyard ${y.x},${y.y} has no deep water next to it`);
    }
  });

  test(`${id}: the AI can play five rounds without an invalid order`, async () => {
    const map = await loadMap(readData, registry, id);
    const game = new Game(registry, map);
    for (let i = 0; i < 10 && !game.isOver; i++) { playTurn(game); if (!game.isOver) game.endTurn(); }
    assert.ok(game.state.day >= 5 || game.isOver);
  });
}
