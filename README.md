# Pocket Wars

A turn-based tactics game that runs in your phone's browser. Build units, capture properties, and take the enemy HQ.

The whole game is one self-contained file, `index.html`, with no dependencies and no build step.

## Play

Once GitHub Pages is enabled: https://ajaxor.github.io/pocketwars/

Or open `index.html` directly in any modern browser. It is designed for touch screens, but mouse clicks work too.

## How to play

- Tap one of your units to select it, tap a highlighted tile to move, then choose Capture or Wait, or tap an enemy to attack (tap again to confirm).
- Tap a factory, barracks or airfield you own to build vehicles, infantry or aircraft.
- Infantry, Mech and Sniper units can capture properties. Capturing takes 20 capture points, and each turn adds the unit's current HP.
- Units on owned properties heal each turn, and each property earns funds.
- Win by capturing the enemy HQ or by destroying all enemy units when they cannot rebuild.
- Undo reverts your last move, and it is cleared when you end your turn.

## Units

| Group | Units |
|-------|-------|
| Infantry (Barracks) | Infantry, Mech, Sniper |
| Vehicles (Factory) | Recon, Tank, Heavy Tank, Artillery, Flak |
| Aircraft (Airfield) | Copter, Fighter, Bomber |

Fighters and Bombers are high air units, so only Flak and Fighters can hit them. Artillery cannot hit copters.

## Hosting on GitHub Pages

1. Push to `main`.
2. In the repository, go to Settings, then Pages.
3. Under Build and deployment, choose Deploy from a branch, select `main` and `/ (root)`, and save.

The `.nojekyll` file tells Pages to serve the files as they are.

## Development notes

- Everything lives in `index.html`: styles, game data, rules, AI and rendering.
- The undo feature must be removed if fog of war is ever added, because undoing a move would give free scouting.
