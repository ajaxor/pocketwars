# Production: buildings, labs and maps

Who can build what is decided by three things: the **building** (a fixed menu of every unit it can ever build), the **leader's roster** (the units of that faction: a leader builds only the units of each menu that are on their roster), and the **labs** the player holds (they upgrade units on the menu). Maps decide which buildings each side owns, so the map sets up the battle.

## Buildings (`data/terrain.json`, menus in `data/loadouts.json`)

| Building | Menu (every unit it can build; a faction's roster cuts it down) |
|---|---|
| HQ | the leader's own infantry, plus the unlocked infantry (below); unlimited builds |
| City | marine and amphibious infantry, plus the unlocked infantry |
| Garage | recon, rocket buggy, AA truck, supply truck, rocket launcher, motorcycle |
| Factory | tank, flak, artillery (treads), heavy tank, hover tank, missile tank, amphibious tank, stealth tank |
| Shipyard | destroyer, cruiser, battleship, dreadnought, aircraft carrier |
| Harbor | gun boat |
| Sub pen | diver, submarine, hunter sub, missile sub |
| Airfield | gun copter, missile copter, torpedo bomber, vintage fighter, vintage bomber, stealth copter, airship |
| Airbase | fighter, bomber, SAM launcher, stealth fighter, stealth bomber |

**Hubs and unlocks.** The HQ and every city (`hub`) build infantry. Owning a building unlocks one more infantry for all your hubs (`unlocks`): garage -> mechanic, factory -> AT infantry (mech), airfield -> RPG trooper. Leader infantry is HQ-only. Exceptions to "infantry at hubs": the motorcycle is built at the garage and the diver at the sub pen.

**Transfer.** An infantryman (attribute `transfer`) standing on a property of its owner can be sent to any other empty city that owner holds. It ends the unit's turn and resets capture. Fresh units, vehicles, the motorcycle and the diver cannot. The computer does not use it yet.

**Shelved.** The agency, chemical plant, support factory and artillery range are `shelved` (in the data, off every menu and map). So are the transport units (APC, transport copter, troop transport) and the flamethrower, sniper, medic, mortar, mine layer and radar plane; they wait for labs.

Every building but the HQ builds one unit per turn. Infantry and vehicles are mixed on purpose: a building has a theme, not a unit type.

## Rosters

Each leader has a `roster` in `data/loadouts.json`: the old faction units, so Ada has the missile tank and no tank, Harlan the vintage planes, and so on (the nine rosters are the old build lists, see `docs/leaders.md`). The menu a player sees at a building is the building's menu limited to their roster, cheapest first. Every faction has at least one unit at every building, so no building is dead to them. The default kit (no leader chosen) has a base roster without the lab-upgrade units and the faction-only units.

The starting units of a building are the default one, or the unit of the leader's menu there nearest to it in price.

## Labs

A lab builds nothing. While its owner holds it, it **upgrades** units on that owner's build menus: each unit the lab names is replaced by its upgrade, wherever it is on their menus (`upgrades` on the lab's terrain: unit id -> upgraded unit id). A leader without the plain unit gets nothing from it. Two labs that upgrade the same unit offer both upgrades. Tapping a lab shows what it upgrades. The upgrades are a first draft ("hover tank replaces tank"), to be tuned.

| Lab | Upgrades |
|---|---|
| Hover lab | tank -> hover tank |
| Stealth lab | tank -> stealth tank, missile copter -> stealth copter, fighter -> stealth fighter, bomber -> stealth bomber |
| Heavy lab | tank -> heavy tank, battleship -> dreadnought |
| Missile lab | tank -> missile tank, submarine -> missile sub |

Losing a lab changes the menu at once; units already built stay.

## Maps

Every shipped map (except the small tutorial map Front Line) gives each side one to six producers near its HQ, different sets for each side, and puts labs and factories in the middle, neutral and contested. `tests/data/map-design-rules.test.js` pins: waterfront buildings (shipyard, harbor, sub pen) need 40 connected water tiles; any other producer nearer the middle than its owner's HQ starts neutral; each map has two or more neutral producers, one of them a lab; two-player maps give the sides different producer sets.

## Not built yet

See `backlog.md`: spy plane, hover artillery, hover recon, Tesla truck, drop pod, satellite, cruise missile and the launch pad that would build the last three.
