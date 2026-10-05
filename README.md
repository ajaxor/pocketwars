# Pocket Wars

A turn-based tactics game that runs in your phone's browser. Build units, capture properties, and take the enemy HQ.

**Play:** https://ajaxor.github.io/pocketwars/

## How to play

- Tap any tile to see what is on it (unit and terrain info cards). Tap one of your units to select it, tap a highlighted tile to move, then choose Capture or Wait, or tap an enemy and press Attack (tapping it again also confirms).
- Tap a factory, barracks, airfield or shipyard you own to open its build menu: tap a unit to select it, then tap it again (or press Build) to build. A new unit appears on the property and gets a free move to drive off it (it cannot attack that turn); each property builds one unit per turn.
- Units with the `capture` attribute (Soldier, AT Infantry, Sniper, ...) capture properties: 20 points, each turn adds the unit's HP.
- Units on owned properties heal each turn, and each property earns funds.
- Win by capturing the enemy HQ or by destroying all enemy units when they cannot rebuild.
- Undo reverts your last order; it is cleared when you build, end your turn, or when an order runs into or reveals a hidden unit.
- **Marine** (shipyard): infantry that walks on land and crosses shoals and sea, where it is drawn riding a dinghy. **Transport copter** (airfield): a Chinook-style lifter that carries 2 soldiers as ammo; Deploy works like building (once a turn, before or after the copter moves, not on a copter that was just built): the soldier is placed on the copter and then moved and ordered normally (it can attack); cancelling puts it back. Aircraft with limited ammo are refilled by choosing Resupply (in place of Wait) next to an airfield you own; it costs money (a copter pays for the soldiers it takes on, like building them), ends the unit's turn, can be undone, and without the money it says "Not enough credits" and just waits. A bullet on the tile's bottom right flashes when ammo is low and stays red when it is out. Flyers also burn fuel (1 per turn, flying or idle, but an empty tank never stops a move): a can on the bottom left flashes yellow when low and is red when empty; they refuel for free at the start of your turn on or beside your airfields or aircraft carriers (helicopters also beside a supply truck), and a flyer that begins a turn with an empty tank crashes at the end of it. Transports (copter, APC, troop transport) carry their leader's basic infantry (conscript, marine, commando...). Units that begin their turn hidden (stealth, submerged, a sniper in cover) hit 50% harder that turn. Marines afloat can shoot ships. The dreadnought attacks twice a turn.
- **Ships** are built at shipyards on the shore and sail off the yard on their free move: Destroyer (sonar, melee guns and depth charges), Submarine, Cruiser (move-and-fire cannon, melee flak) and Battleship (long-range guns that cannot fire after moving, melee secondary guns). Ships sail on open sea only; shoals (little islets) block them.
- **Submarines dive** on deep water (Submerge / Surface in the order window). A submerged sub is invisible to the enemy unless one of their units is next to it, or a destroyer is within 3 tiles. Only depth charges and torpedoes can hit it.
- **Interrupted moves:** a move is planned without knowing about hidden units. If it runs into one, the unit stops on the last free tile, the hidden unit is revealed, and the unit can still attack or wait from there (it cannot fire indirect weapons, as it has moved).
- Units with several weapons pick the one that does the most damage to the target automatically; the damage preview names it.
- **Walls and defences.** Walls are pipes that nothing can cross (aircraft included) and that block line of sight; a **cracked wall** can be worn down and leaves rubble you can drive through. Structures shrug off ordinary fire: artillery, bombs, rockets and missiles do the real damage. **Cannon, SAM and artillery turrets** and the **jammer** can be attacked and destroyed but not captured. Turrets are never ordered by hand: when you end your turn, each of your turrets fires at the enemy in reach it would hurt most (only at what you can see), and every dark-grey turret (owned by nobody, hostile to everyone) fires at your units in its reach.
- **Fog of war.** While any jammer stands, you only see what your units and properties can see (along clear lines of sight; aircraft see over everything, mountains add range). A unit always sees at least as far as it can move, so you never move into the unknown. Unexplored ground is black (with a grey rim where it meets ground in sight), ground you have seen but cannot see now is greyed out, and the fog fades in and out as sight changes. Enemy turrets in the grey fog are shown frozen as you last saw them, even if they have since been destroyed. Damage and income numbers, and the camera, stay out of the fog. Destroy every jammer to lift it. The computer is not affected. An order that reveals new ground cannot be undone. Every map except the small Classic has neutral jammers, so skirmish starts in fog; the skirmish page can switch it off (that removes the jammers), and on a map without jammers the option is locked to Off.
- Large maps scroll: drag to pan, pinch (or ctrl + wheel) to zoom.
- Skirmish on the title screen lets you pick a map, set up to 4 teams (player or computer, colour) the starting funds and a leader for each team (random by default for computer teams). A leader sets which units the factories build and which units you start with, placed in a formation around the HQ (see docs/leaders.md).
- The gear in the status bar opens a menu: resume, reset the mission, or quit back to the title screen.
- **Map editor** (title screen): paint terrain, buildings, units and defences on a map with the game's own art. One finger (or the mouse) paints with the tool (Brush, Fill, Erase, Pick, Pan), two fingers or the wheel and right-drag move and zoom. Symmetry mirrors every edit (and gives the mirrored copies to the other side). Map sets the name, size and players; File makes a new map, opens any game map as a starting point, saves to "My maps" (they appear on the skirmish page), downloads the `.map.json` or copies it; Play starts the map straight away. Your work is kept in the browser after every change. Desktop keys: Ctrl+Z / Shift+Ctrl+Z, B F E I H, 1 and 3 for the brush size.

## Development

```
npm start          # dev server at http://localhost:8080  (?map=<id> picks a map)
npm test           # node --test, Node 22+
npm run validate   # validates data/*.json and every map
npm run ai:arena   # plays the AI engines against each other on every map and reports who wins
npm run ai:tune    # tunes the strategist AI by self-play (--write to keep a result that beats the shipped one)
```

ES modules and `fetch` need a web server; opening `index.html` from `file://` does not work.

- **Entities are data.** Units, weapons, terrain, factions, rules and AI tuning are JSON in `data/`. Special handling is an
  *attribute* on the entity, each with tests: [docs/attributes.md](docs/attributes.md).
- **Combat is stats.** Toughness and armor on units, damage and armor piercing on weapons, target modes and line of sight:
  [docs/combat.md](docs/combat.md).
- **Maps are files.** `data/maps/*.map.json`: [docs/map-format.md](docs/map-format.md).
- **The computer opponent** is a set of AI engines scored against each other, with a strategist that plans from the data and tunes
  itself: [docs/ai.md](docs/ai.md).
- **Code layout and deploy:** [docs/architecture.md](docs/architecture.md).
- **Where the game is going:** the campaign vision (leaders, per-leader factories, labs, final boss) is in [docs/campaign-design.md](docs/campaign-design.md).

Deploys run through GitHub Actions on every push to `main`: tests and data validation gate the deploy, and each build is
published under `v/<commit>/` with a no-cache `version.json` pointing at it. One-time setup: Settings -> Pages -> Source:
**GitHub Actions**.

Undo and hidden units: an order that is interrupted by, or reveals, a hidden unit clears the undo snapshot (otherwise undo would be free scouting). In fog of war the same goes for any order that brings a new tile into sight.
