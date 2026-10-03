# Leaders in battle

A leader brings a **kit** to a battle: what each factory builds, and which units you start with.

## Data: `data/loadouts.json`
- `default`: the kit everyone inherits. `build` maps a production building's terrain id (barracks, factory, airfield, shipyard) to the unit ids it offers, in menu order.
- `start` maps `hq` or a production building's terrain id to a list of `{ "unit": id, "at": [side, forward] }` offsets (`side` positive = right-hand, `forward` positive = toward the enemy). The `hq` set is placed around the HQ; every other set is placed around **each** building of that type the player owns, so two factories get two copies of the factory set, and a building type the map has none of gives nothing.
- `leaders.<id>`: overrides. A `build` or `start` entry that names a building replaces just that building's list (an empty `[]` removes it). Anything omitted is inherited. Every campaign leader (except the Envoy) needs an entry, even an empty `{}`.
- A menu may list units of a category the building does not normally build. Buildings with no loadout entry (labs and the like) fall back to their category menus.
- `npm run validate` checks the file and that every formation fits on every shipped map.

## Using a leader
- Map files: optional `players[i].leader`. No leader means the default menus and the map's own units.
- Skirmish: each team picks a leader, `Random` or `None`. Human teams default to the home nation's hero, computer teams to random (random avoids leaders other teams already use). `None` keeps the map's own units.
- Menus: `menuFor(game, player, x, y)` in `src/engine/economy.js`; the build check, the AI and the funds check all use it.

## Placement (`src/data/formation.js`)
Sets are placed in order: the HQ's, then buildings in reading order (`placeStart`); each set is placed by `placeFormation` around its own building.
Forward is, from the building, toward the average enemy HQ, snapped to N/S/E/W (map centre if there is none). Units are placed in list order at their offset. A tile is invalid if it is off the map, impassable for the unit, taken, any property, or not connected to the HQ. An invalid spot takes the nearest valid tile (then same row, nearest the HQ, nearest the centre line). Units with nowhere to stand are skipped (validation fails if that happens on a shipped map).

## Exclusive units

Units flagged `"exclusive": true` in `data/units.json` stay off the default kit and category menus; only a leader's `build` list can offer them. The twelve drafted units (spy, commando, medic, mortar, mechanic, gun boat, vintage fighter/bomber, torpedo bomber, radar plane, stealth fighter/bomber) are assigned this way in `data/loadouts.json`.
