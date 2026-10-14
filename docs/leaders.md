# Leaders in battle

A leader brings a **kit** to a battle: their own infantry, one unlocked lab unit, and the units you start with. What each building builds is the same for everyone (`docs/production.md`).

## Data: `data/loadouts.json`
- `default`: the kit everyone inherits. `infantry` is the unit its HQ builds; `build` maps a production building's terrain id to the unit ids it offers, in menu order (the HQ's menu is made from `infantry`).
- `start` maps `hq` or a production building's terrain id to a list of `{ "unit": id, "at": [side, forward] }` offsets (`side` positive = right-hand, `forward` positive = toward the enemy). The `hq` set is placed around the HQ; every other set is placed around **each** building of that type the player owns, so two garages get two copies of the garage set, and a building type the map has none of gives nothing.
- `leaders.<id>`: `infantry` (their HQ unit; omitted = the soldier), `unlock` (a list with the one lab unit they can build without owning the lab) and `start.hq` (their opening HQ set). Anything omitted is inherited. Every campaign leader (except the Envoy) needs an entry.
- `npm run validate` checks the file and that every formation fits on every shipped map.

## Using a leader
- Map files: optional `players[i].leader`. No leader means the default menus and the map's own units.
- Skirmish: each team picks a leader, `Random` or `None`. Human teams default to the home nation's hero, computer teams to random (random avoids leaders other teams already use). `None` keeps the map's own units.
- Menus: `menuFor(game, player, x, y)` in `src/engine/economy.js`; the build check, the AI and the funds check all use it.

## Placement (`src/data/formation.js`)
Sets are placed in order: the HQ's, then buildings in reading order (`placeStart`); each set is placed by `placeFormation` around its own building.
Forward is, from the building, toward the average enemy HQ, snapped to N/S/E/W (map centre if there is none). Units are placed in list order at their offset. A tile is invalid if it is off the map, impassable for the unit, taken, any property, or not connected to the HQ. An invalid spot takes the nearest valid tile (then same row, nearest the HQ, nearest the centre line). Units with nowhere to stand are skipped (validation fails if that happens on a shipped map).

## The nine kits

| Leader | HQ infantry | Unlock (lab unit, built without the lab) |
|---|---|---|
| Harlan (Lastholm) | soldier | heavy tank |
| Ada (Ashmark) | commando | hover tank |
| Vex (Vantor Reach) | spy | missile sub |
| Hiroshi (Ironvale) | swordsman | missile tank |
| Ludwig (Solace) | shock trooper | stealth bomber |
| Rex (Tidehaven) | marine | amphibious tank |
| Chase (Skyreach) | motorcycle | stealth copter |
| Dmitri (Deepmere) | conscript | airship |
| Lysandra (Highspire) | royal guard | dreadnought |

The Envoy (the Chorus) has no kit yet. Starting armies are the faction's infantry, an artillery and a tank at the HQ, plus one unit per production building the map gives them, so armies differ only by the infantry (about 1,500 apart; `tests/data/leaders.test.js`).

## Troop carriers and menus

A carrier that drops infantry (`deploy.basic`: transport copter, APC, troop transport and the like) costs its base price plus all (`rules.carrierCargoRate`, 1) of what the leader's basic infantry costs over the soldier, per drop: Dmitri's conscripts make carriers cheaper, Ada's commandos dearer. `costFor` in `src/engine/queries.js` is the one place that works it out (build, menu, AI). Every build menu is shown cheapest first for that leader (`menuFor` sorts by `costFor`, so the order in `data/loadouts.json` does not matter).
