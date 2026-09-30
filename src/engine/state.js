// Mutable game state. It is plain data (no methods) so it can be cloned for undo, saved, or asserted on in tests.
//
// state = {
//   turn: number            index of the player whose turn it is
//   day: number             starts at 1, increments each time play returns to player 0
//   funds: number[]         per player
//   owners: (number|null)[][]   owner of each tile ([y][x]); null = neutral / not a property
//   units: Unit[]           Unit = { id, type, owner, x, y, hp, done, capture }
//   defeated: boolean[]     per player
//   winner: null | number | 'draw'
//   nextUnitId: number
// }

export function createState(map, registry) {
  let nextUnitId = 1;
  return {
    turn: 0,
    day: 1,
    funds: map.players.map((p) => p.funds),
    owners: map.owners.map((row) => [...row]),
    units: map.units.map((u) => ({
      id: nextUnitId++, type: u.type, owner: u.owner, x: u.x, y: u.y,
      hp: u.hp ?? registry.rules.maxHp, done: false, capture: 0,
    })),
    defeated: map.players.map(() => false),
    winner: null,
    nextUnitId,
  };
}

/** Deep copy of the parts of state an order can change (used for undo). */
export const snapshotState = (state) => ({
  units: state.units.map((u) => ({ ...u })),
  owners: state.owners.map((row) => [...row]),
  funds: [...state.funds],
  defeated: [...state.defeated],
  nextUnitId: state.nextUnitId,
});

export function restoreState(state, snap) {
  state.units = snap.units.map((u) => ({ ...u }));
  state.owners = snap.owners.map((row) => [...row]);
  state.funds = [...snap.funds];
  state.defeated = [...snap.defeated];
  state.nextUnitId = snap.nextUnitId;
}
