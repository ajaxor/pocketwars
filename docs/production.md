# Production: buildings, labs and maps

Who can build what is decided by three things: the **building**, the **labs** its owner holds, and the **leader's kit**. Maps decide which buildings each side owns, so the map sets up the battle.

## Buildings (`data/terrain.json`, menus in `data/loadouts.json`)

| Building | Builds (default menu) |
|---|---|
| HQ | the leader's own infantry, unlimited builds |
| Garage | recon, rocket buggy, mechanic |
| Chemical plant | flamethrower, rocket launcher, mine layer (only when water touches the tile: `shore`) |
| Tank factory (`factory`) | AT infantry, tank, flak |
| Support factory | medic, supply truck, APC |
| Artillery range | mortar, artillery |
| Agency | sniper, radar plane (stand-in for the spy plane) |
| Shipyard | diver, destroyer, cruiser, battleship, aircraft carrier |
| Harbor | gun boat, troop transport |
| Sub pen | submarine, hunter sub |
| Airfield | copter, transport copter, torpedo bomber, RPG trooper |
| Airbase | fighter, bomber, SAM launcher |

Every building but the HQ builds one unit per turn. Infantry and vehicles are mixed on purpose: a building has a theme, not a unit type.

## Labs

A lab builds nothing. While its owner holds it, it **adds** units to the menus of the owner's other buildings (`adds` on the lab's terrain: building id -> unit ids). Tapping a lab shows what it adds where.

| Lab | Adds |
|---|---|
| Hover lab | hover tank (tank factory), amphibious tank (harbor) |
| Stealth lab | stealth tank (tank factory), stealth copter, stealth fighter, stealth bomber (airbase) |
| Heavy lab | heavy tank (tank factory), dreadnought (shipyard), airship (airfield) |
| Missile lab | missile tank (tank factory), missile sub (sub pen) |

Each leader has one **unlock**: a lab unit they can build without owning the lab (see `docs/leaders.md`). Losing a lab removes its units from the menu at once; units already built stay.

## Maps

Every shipped map (except the small tutorial map Front Line) gives each side one to six producers near its HQ, different sets for each side, and puts labs and factories in the middle, neutral and contested. `tests/data/map-design-rules.test.js` pins: waterfront buildings (shipyard, harbor, sub pen) need 40 connected water tiles; any other producer nearer the middle than its owner's HQ starts neutral; each map has two or more neutral producers, one of them a lab; two-player maps give the sides different producer sets.

## Not built yet

See `backlog.md`: spy plane, hover artillery, hover recon, Tesla truck, drop pod, satellite, cruise missile and the launch pad that would build the last three.
