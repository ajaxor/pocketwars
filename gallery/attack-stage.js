// What the Attacks tab sets up for one weapon of one unit: who it shoots at, how far away, and on what ground. Pure (no DOM), so it is unit-tested.
const GROUND = ['direct_ground', 'indirect_ground'];

/**
 * @param registry the entity registry
 * @param {string} unitId  an armed unit
 * @param {string} weaponId  one of its weapons
 * @returns {{ attacker:string, weapon:string, target:string, distance:number, attackerWater:boolean, targetWater:boolean }}
 */
export function attackStage(registry, unitId, weaponId) {
  const def = registry.unit(unitId), w = registry.weapon(weaponId);
  const targets = w.targets || [];
  const hitsGround = targets.some((t) => GROUND.includes(t));
  const hitsAir = targets.some((t) => t === 'low_air' || t === 'high_air');
  let target = 'tank', targetWater = false;
  if (hitsAir && !hitsGround && !targets.includes('surface')) target = 'fighter';                 // anti-air only: shoot at a plane
  else if (targets.includes('underwater') && weaponId === 'depth_charges') { target = 'submarine'; targetWater = true; }
  else if (!hitsGround || (def.moveClass === 'naval' && targets.includes('surface'))) { target = 'destroyer'; targetWater = true; }   // ships and torpedoes shoot at ships
  else if (targets.includes('surface') && !targets.includes('direct_ground') && !targets.includes('indirect_ground')) { target = 'destroyer'; targetWater = true; }
  if (weaponId === 'torpedoes' || weaponId === 'hunter_torpedoes' || weaponId === 'aerial_torpedo') { target = 'destroyer'; targetWater = true; }
  if (def.moveClass === 'naval' && targets.includes('indirect_ground') && !targets.includes('surface')) { target = 'tank'; targetWater = false; }
  const reach = w.range?.[1] ?? 1;
  return { attacker: unitId, weapon: weaponId, target, distance: Math.max(1, Math.min(3, reach)), attackerWater: def.moveClass === 'naval', targetWater };
}

/** Every armed unit that is in the game, with one stage per weapon; the unarmed ones are listed apart. */
export function attackList(registry) {
  const armed = [], unarmed = [];
  for (const id of registry.unitIds) {
    const def = registry.unit(id);
    if (def.render.inWall) continue;
    const ws = (def.weapons || []).filter((wid) => registry.weapon(wid));
    if (ws.length) armed.push({ id, name: def.name, category: def.category, stages: ws.map((wid) => attackStage(registry, id, wid)) });
    else unarmed.push({ id, name: def.name });
  }
  return { armed, unarmed };
}
