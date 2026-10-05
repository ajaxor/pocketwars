// What the editor's palette offers, read from the registry (no ids are listed by hand, so new terrain and units show up by themselves):
//
//   Terrain    every terrain that is not a property (walls included; the breakable wall is shown as "Cracked wall"), then each ground
//   Buildings  every property (painted with the chosen owner)
//   Units      every unit that is not a structure or a mine, in the order of data/units.json
//   Defences   every structure that is placed as a unit (turrets, the jammer); the cracked wall is a terrain
//
// An item is { key, kind: 'terrain' | 'ground' | 'unit', id, label, owned (does the owner row apply), neutralOk (may it be neutral) }.

export const TABS = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'units', label: 'Units' },
  { id: 'defences', label: 'Defences' },
];

export function palette(registry) {
  const terrain = [], buildings = [], units = [], defences = [];
  for (const id of registry.terrainIds) {
    const t = registry.terrain[id];
    if (t.attributes.property) buildings.push({ key: `t:${id}`, kind: 'terrain', id, label: t.name, owned: true, neutralOk: true });
    else terrain.push({ key: `t:${id}`, kind: 'terrain', id, label: t.attributes.wall?.structure ? registry.unit(t.attributes.wall.structure).name : t.name, owned: false, neutralOk: true });
  }
  for (const id of registry.groundIds) terrain.push({ key: `g:${id}`, kind: 'ground', id, label: `${registry.ground[id].name} ground`, owned: false, neutralOk: true });
  for (const id of registry.unitIds) {
    const u = registry.units[id];
    if (u.attributes.mine) continue;
    if (u.attributes.structure) { if (!u.render.inWall) defences.push({ key: `u:${id}`, kind: 'unit', id, label: u.name, owned: true, neutralOk: true }); }
    else units.push({ key: `u:${id}`, kind: 'unit', id, label: u.name, owned: true, neutralOk: false });
  }
  return { terrain, buildings, units, defences };
}
