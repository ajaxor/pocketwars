# Leaders in battle

A leader brings a **kit** to a battle: their own infantry, a roster of units, and the units you start with. Each building has one fixed menu of everything it can build; a leader builds the part of it that is on their roster (`docs/production.md`).

## Data: `data/loadouts.json`
- `default`: the kit everyone inherits. `infantry` is the unit its HQ builds; `build` maps a production building's terrain id to every unit it can build, in menu order (the HQ's menu is made from `infantry`); `roster` lists the units of the base faction (the default kit's, used when no leader is picked).
- `start` maps `hq` or a production building's terrain id to a list of `{ "unit": id, "at": [side, forward] }` offsets (`side` positive = right-hand, `forward` positive = toward the enemy). The `hq` set is placed around the HQ; every other set is placed around **each** building of that type the player owns, so two garages get two copies of the garage set, and a building type the map has none of gives nothing.
- `leaders.<id>`: `infantry` (their HQ unit; omitted = the soldier), `roster` (the other units they can build) and `start.hq` (their opening HQ set). A building's starting unit is the default one, or the unit of the leader's menu there nearest in price (none if the menu is empty). Anything omitted is inherited. Every campaign leader (except the Envoy) needs an entry.
- `npm run validate` checks the file and that every formation fits on every shipped map.

## Using a leader
- Map files: optional `players[i].leader`. No leader means the default menus and the map's own units.
- Skirmish: each team picks a leader, `Random` or `None`. Human teams default to the home nation's hero, computer teams to random (random avoids leaders other teams already use). `None` keeps the map's own units.
- Menus: `menuFor(game, player, x, y)` in `src/engine/economy.js`; the build check, the AI and the funds check all use it.

## Placement (`src/data/formation.js`)
Sets are placed in order: the HQ's, then buildings in reading order (`placeStart`); each set is placed by `placeFormation` around its own building.
Forward is, from the building, toward the average enemy HQ, snapped to N/S/E/W (map centre if there is none). Units are placed in list order at their offset. A tile is invalid if it is off the map, impassable for the unit, taken, any property, or not connected to the HQ. An invalid spot takes the nearest valid tile (then same row, nearest the HQ, nearest the centre line). Units with nowhere to stand are skipped (validation fails if that happens on a shipped map).

## The nine kits

| Leader | HQ infantry | Roster (non-infantry units) |
|---|---|---|
| Harlan (Lastholm) | soldier | medic, sniper, AT infantry, vintage fighter and bomber, torpedo bomber, recon, artillery, APC, flak, tank, heavy tank, destroyer, troop transport, cruiser, battleship |
| Ada (Ashmark) | commando | mechanic, RPG trooper, rocket buggy, supply truck, missile tank, rocket launcher, SAM, copter, transport copter, fighter, bomber, gun boat, mine layer, hunter sub, cruiser, battleship |
| Vex (Vantor Reach) | spy | sniper, recon, flak, tank, rocket launcher, SAM, transport copter, stealth copter, fighter, bomber, gun boat, diver, destroyer, submarine, cruiser, missile sub |
| Hiroshi (Ironvale) | swordsman | mechanic, AT infantry, mortar, recon, supply truck, artillery, tank, heavy tank, SAM, copters, fighter, bomber, mine layer, destroyer, submarine, cruiser, dreadnought |
| Ludwig (Solace) | shock trooper | medic, mechanic, rocket buggy, supply truck, artillery, flak, hover tank, rocket launcher, stealth copter, radar plane, fighter, bomber, diver, destroyer, cruiser, missile sub, battleship |
| Rex (Tidehaven) | marine | medic, RPG trooper, mortar, recon, artillery, flak, amphibious tank, rocket launcher, copter, torpedo bomber, fighter, bomber, gun boat, mine layer, troop transport, hunter sub, cruiser, aircraft carrier, battleship |
| Chase (Skyreach) | motorcycle | flamethrower, sniper, recon, artillery, hover tank, heavy tank, rocket launcher, SAM, copters, radar plane, bomber, stealth fighter, destroyer, submarine, cruiser, aircraft carrier, battleship |
| Dmitri (Deepmere) | conscript | mechanic, RPG trooper, mortar, recon, APC, artillery, flak, heavy tank, rocket launcher, copter, torpedo bomber, airship, fighter, mine layer, troop transport, destroyer, cruiser, missile sub, battleship |
| Lysandra (Highspire) | royal guard | medic, sniper, flamethrower, recon, supply truck, artillery, flak, tank, heavy tank, rocket launcher, SAM, copters, radar plane, fighter, stealth bomber, gun boat, destroyer, cruiser, dreadnought |

The Envoy (the Chorus) has no kit yet. Some factions have no unit for some buildings (they own it but build nothing there): Harlan chemical plant, sub pen, airbase; Ada artillery range, agency; Vex support factory, artillery range; Hiroshi agency, harbor; Ludwig harbor; Rex agency; Chase support factory, harbor; Dmitri agency; Lysandra sub pen. New faction units may fill them. HQ starting sets are three units each from the roster; the HQ armies are within 4,500 of each other (`tests/data/leaders.test.js`).

## Troop carriers and menus

A carrier that drops infantry (`deploy.basic`: transport copter, APC, troop transport and the like) costs its base price plus all (`rules.carrierCargoRate`, 1) of what the leader's basic infantry costs over the soldier, per drop: Dmitri's conscripts make carriers cheaper, Ada's commandos dearer. `costFor` in `src/engine/queries.js` is the one place that works it out (build, menu, AI). Every build menu is shown cheapest first for that leader (`menuFor` sorts by `costFor`, so the order in `data/loadouts.json` does not matter).
