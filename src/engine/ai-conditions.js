// Named conditions that data/ai.json build rules can reference with `"when": "<name>"`.
// Each is (game, player) => boolean.

export const AI_CONDITIONS = {
  /** True when any opposing unit is on an airborne layer (see rules.json -> layers[*].airborne). */
  enemyHasAirborne: (game, player) => game.state.units.some(
    (u) => u.owner !== player && game.registry.rules.layers[game.registry.unit(u.type).layer].airborne === true,
  ),
};
