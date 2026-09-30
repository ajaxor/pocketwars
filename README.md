# Pocket Wars

A turn-based tactics game that runs in your phone's browser. Build units, capture properties, and take the enemy HQ.

**Play:** https://ajaxor.github.io/pocketwars/

## How to play

- Tap any tile to see what is on it (unit and terrain info cards). Tap one of your units to select it, tap a highlighted tile to move, then choose Capture or Wait, or tap an enemy and press Attack (tapping it again also confirms).
- Tap a factory, barracks or airfield you own to open its build menu: pick a unit, then press Build.
- Units with the `capture` attribute (Soldier, Mech) capture properties: 20 points, each turn adds the unit's HP.
- Units on owned properties heal each turn, and each property earns funds.
- Win by capturing the enemy HQ or by destroying all enemy units when they cannot rebuild.
- Undo reverts your last order; it is cleared when you build or end your turn.

## Development

```
npm start          # dev server at http://localhost:8080  (?map=<id> picks a map)
npm test           # node --test, Node 22+
npm run validate   # validates data/*.json and every map
```

ES modules and `fetch` need a web server; opening `index.html` from `file://` does not work.

- **Entities are data.** Units, weapons, terrain, factions, rules and AI tuning are JSON in `data/`. Special handling is an
  *attribute* on the entity, each with tests: [docs/attributes.md](docs/attributes.md).
- **Combat is stats.** Toughness and armor on units, damage and armor piercing on weapons, target modes and line of sight:
  [docs/combat.md](docs/combat.md).
- **Maps are files.** `data/maps/*.map.json`: [docs/map-format.md](docs/map-format.md).
- **Code layout and deploy:** [docs/architecture.md](docs/architecture.md).

Deploys run through GitHub Actions on every push to `main`: tests and data validation gate the deploy, and each build is
published under `v/<commit>/` with a no-cache `version.json` pointing at it. One-time setup: Settings -> Pages -> Source:
**GitHub Actions**.

The undo feature must be removed if fog of war is ever added, because undoing a move would give free scouting.
