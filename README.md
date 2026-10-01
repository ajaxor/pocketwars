# Pocket Wars

A turn-based tactics game that runs in your phone's browser. Build units, capture properties, and take the enemy HQ.

**Play:** https://ajaxor.github.io/pocketwars/

## How to play

- Tap any tile to see what is on it (unit and terrain info cards). Tap one of your units to select it, tap a highlighted tile to move, then choose Capture or Wait, or tap an enemy and press Attack (tapping it again also confirms).
- Tap a factory, barracks, airfield or shipyard you own to open its build menu: tap a unit to select it, then tap it again (or press Build) to build.
- Units with the `capture` attribute (Soldier, Mech) capture properties: 20 points, each turn adds the unit's HP.
- Units on owned properties heal each turn, and each property earns funds.
- Win by capturing the enemy HQ or by destroying all enemy units when they cannot rebuild.
- Undo reverts your last order; it is cleared when you build, end your turn, or when an order runs into or reveals a hidden unit.
- **Ships** are built at shipyards on the shore and launched onto an adjacent water tile (you pick which when there are several): Destroyer (sonar, melee guns and depth charges), Submarine, Cruiser (move-and-fire cannon, melee flak) and Battleship (long-range guns that cannot fire after moving, melee secondary guns). Ships sail on open sea only; shoals (little islets) block them.
- **Submarines dive** on deep water (Submerge / Surface in the order window). A submerged sub is invisible to the enemy unless one of their units is next to it, or a destroyer is within 3 tiles. Only depth charges and torpedoes can hit it.
- **Interrupted moves:** a move is planned without knowing about hidden units. If it runs into one, the unit stops on the last free tile, the hidden unit is revealed, and the unit can still attack or wait from there (it cannot fire indirect weapons, as it has moved).
- Units with several weapons pick the one that does the most damage to the target automatically; the damage preview names it.
- Large maps scroll: drag to pan, pinch (or ctrl + wheel) to zoom.
- Skirmish on the title screen lets you pick a map, set up to 4 teams (player or computer, colour) and the starting funds.
- The gear in the status bar opens a menu: resume, reset the mission, or quit back to the title screen.

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

Undo and hidden units: an order that is interrupted by, or reveals, a hidden unit clears the undo snapshot (otherwise undo would be free scouting). If real fog of war is ever added, undo must be removed entirely.
