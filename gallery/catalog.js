// The gallery's unit catalogue: every unit the project knows about, in one list, with where it sits in the development pipeline.
// Pure (no DOM, no canvas), so it is unit-tested. Sources:
//   the game's registry (data/units.json)     units that are in the game
//   gallery/concepts.json                     experimental ideas (art and a description only)
//   gallery/planned-units.json       drawn but not in the game yet (the stealth bomber): also an idea
//   gallery/status.json                       { stages: [...], units: { id: stage } }: the pipeline stage of every unit
//
// THE PIPELINE (status.json `stages`, in order):  idea -> draft -> solid -> balanced -> ready
//   idea      not in the game (a concept)           draft     in the game, still needs icon / interface work
//   solid     the icon is good                      balanced  stats and damage are tuned          ready  all done
// A unit in the game is at least a draft; a concept or planned unit is an idea. Change a unit's stage by editing status.json.

export const GROUPS = [
  { id: 'infantry', label: 'Infantry' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'air', label: 'Air' },
  { id: 'naval', label: 'Naval' },
  { id: 'structure', label: 'Structures' },
];

/** Buildings the game already has (terrain render.building), shown in the Structures tab. */
const GAME_BUILDING_NAME = { hq: 'HQ', city: 'City', factory: 'Factory', barracks: 'Barracks', airfield: 'Airfield', shipyard: 'Shipyard' };

const CATEGORY_GROUP = { infantry: 'infantry', amphibious: 'infantry', vehicle: 'vehicle', aircraft: 'air', naval: 'naval', mine: 'naval' };

/** "range 2-3" from the unit's longest-reaching weapon, or "unarmed". */
export function rangeNote(def, weapons) {
  const ws = (def.weapons || []).map((id) => weapons[id]).filter(Boolean);
  if (!ws.length) return 'unarmed';
  const w = ws.reduce((a, b) => (b.range[1] > a.range[1] ? b : a));
  return `range ${w.range[0] === w.range[1] ? w.range[0] : `${w.range[0]}–${w.range[1]}`}`;
}

/**
 * @param {{registry:object, concepts:{facilities:object[], units:object[]}, planned?:object, status:{stages:object[], units:object}}} src
 * @returns {object[]} entries: { id, name, group, kind ('unit' | 'building' | 'wall'), section, stage, inGame, sprite, art ('game' | 'concept'), altitude, water, cost, move, range, role?, facility?, mechanic?, overlaps?, tags[] }
 */
export function buildCatalog({ registry, concepts, planned = {}, status }) {
  const out = [];
  const stageOf = (id, fallback) => status.units[id] || fallback;
  for (const id of registry.unitIds) {
    const def = registry.unit(id);
    out.push({
      id, name: def.name, group: CATEGORY_GROUP[def.category] || 'vehicle', stage: stageOf(id, 'draft'), inGame: true,
      sprite: def.render.sprite, waterSprite: def.render.waterSprite || null, kind: 'unit', section: null, art: 'game', altitude: def.render.altitude || 0, water: def.moveClass === 'naval',
      cost: def.cost, move: def.move, range: rangeNote(def, registry.weapons), weapons: (def.weapons || []).map((w) => registry.weapons[w]).filter(Boolean),
      tags: Object.keys(def.attributes || {}),
    });
  }
  for (const [id, def] of Object.entries(planned)) {
    out.push({
      id, name: def.name, group: CATEGORY_GROUP[def.category] || 'air', stage: stageOf(id, 'idea'), inGame: false,
      sprite: def.render.sprite, waterSprite: null, kind: 'unit', section: null, art: 'game', altitude: def.render.altitude || 0, water: false,
      cost: def.cost, move: def.move, range: rangeNote(def, registry.weapons), weapons: [], tags: Object.keys(def.attributes || {}),
      mechanic: def.note || 'Drawn, but not in the game yet.',
    });
  }
  for (const id of registry.terrainIds || Object.keys(registry.terrain || {})) {
    const b = registry.terrain[id]?.render?.building;
    if (!b) continue;
    out.push({ id: `building_${id}`, name: GAME_BUILDING_NAME[id] || registry.terrain[id].name || id, group: 'structure', section: 'Game buildings', kind: 'building', stage: stageOf(`building_${id}`, 'draft'), inGame: true,
      sprite: b, art: 'game', altitude: 0, water: false, cost: null, move: 0, range: null, weapons: [], tags: [], mechanic: registry.terrain[id].attributes?.property?.builds?.length ? `Builds: ${registry.terrain[id].attributes.property.builds.join(', ')}.` : null });
  }
  const facilities = Object.fromEntries(concepts.facilities.map((f) => [f.id, f]));
  for (const c of concepts.units) {
    out.push({
      id: c.id, name: c.name, group: c.group, stage: stageOf(c.id, 'idea'), inGame: false, sprite: c.sprite, art: 'concept',
      altitude: c.altitude || 0, water: !!c.water, cost: c.cost, move: c.move, range: null, role: c.role, facility: facilities[c.facility]?.name || c.facility,
      kind: c.kind || 'unit', section: c.section || null, cracked: !!c.cracked, broken: !!c.broken, waterSprite: c.waterSprite || null, fixedColors: c.fixedColors || null,
      mechanic: c.mechanic, overlaps: c.overlaps, tags: [],
    });
  }
  return out;
}

/** Things that are wrong with the catalogue, as readable sentences (empty = fine). */
export function catalogProblems(catalog, status) {
  const p = [], stages = status.stages.map((s) => s.id), groups = GROUPS.map((g) => g.id), seen = new Set();
  for (const u of catalog) {
    if (seen.has(u.id)) p.push(`unit "${u.id}" appears twice`);
    seen.add(u.id);
    if (!stages.includes(u.stage)) p.push(`unit "${u.id}" has an unknown stage "${u.stage}"`);
    if (!groups.includes(u.group)) p.push(`unit "${u.id}" has an unknown group "${u.group}"`);
    if (u.inGame && u.stage === 'idea') p.push(`unit "${u.id}" is in the game, so it is at least a draft`);
    if (!u.inGame && u.stage !== 'idea') p.push(`unit "${u.id}" is not in the game, so it can only be an idea`);
  }
  for (const id of Object.keys(status.units)) if (!seen.has(id)) p.push(`status.json lists "${id}", which is not a unit`);
  return p;
}

/** Count of units per stage, in pipeline order: [{ id, label, note, n }]. */
export function stageCounts(catalog, status) {
  return status.stages.map((s) => ({ ...s, n: catalog.filter((u) => u.stage === s.id).length }));
}
