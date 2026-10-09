# Terrain sets

A **tileset** (`data/tilesets.json`) is a biome: it redraws the terrain in that land; the rules never change. Each biome has one or two home armies
(`factions`); armies that share one are meant to use it differently, in how their maps are laid out. A map names its tileset (`"tileset": "tundra"`);
a map without one is drawn in the default (`temperate`).

| Tileset | Armies | Ground | Forest | Mountain |
|---|---|---|---|---|
| temperate | Lastholm, Highspire | grass | pines | peak |
| tundra | Deepmere, Vantor Reach | snow | snowy spruce | glacier peak |
| desert | Ashmark, Skyreach | sand | cactus groves | mesa |
| ruins | Ironvale, Solace | ash | deadwood | slag heap |
| islands | Tidehaven | sand | palm grove | volcanic peak |

The pairing is provisional (the campaign will lean on it through `registry.homeTileset(faction)`): nine armies over five biomes, so islands has one army
for now. The urban, royal gardens, highlands and jungle tilesets were removed in October 2026. Skirmish maps showing the biomes: Ridgeback and Garden Maze (temperate),
Whiteout and Frozen Canyon (tundra), Dune Sea and Skyline Pass (desert), Mudslide (ruins), Burnt Offering (ruins), Atoll (islands). The title screen's **Terrain** link
opens a gallery of every tileset.

## Ground costs

- **Penalties are paid once per move.** A tile's `moveCost` is 1 plus a penalty (open ground is 2 for wheels, so a penalty of 1). A move costs one point per tile entered plus the single biggest penalty among them, not one per tile: a wheeled unit crossing ten tiles of open ground pays 11, not 20 (`computeReach` in `src/engine/movement.js`). The AI's distance field still sums the per-tile costs.
- **Open ground** (`plain`) costs **wheeled vehicles 2**; a **road** costs them 1 (and every class pays the same on both otherwise), so wheels want the road.
  Forests block wheels, mountains block wheels and treads.
- Rough ground, cliffs and the soft ground (snowdrift, dune, mud) were removed in October 2026. Their drawings are kept, unused, in `src/render/unused/removed-terrain.js`.
  Shipped maps that used them now have plain ground (mud became bare dirt ground), and a cliff became a mountain.

## Terrain that is the same in every tileset

- **Ford** (`ford`): shallow water in a river or sea. Feet and tracks wade it (cost 2), amphibious and hover units and aircraft cross freely, wheels, bikes and ships cannot.
  It has its own pale-blue colour with stepping stones, so it reads as a crossing.
- **Ice** (`ice`): a frozen surface (`Ice`; lakes in the tundra). Every ground unit can cross it (wheels and bikes slip: 2 and 3), ships cannot. It never breaks; it is
  plain terrain for now, so later mechanics can build on it. Whiteout has an ice crossing in the lake, Mudslide a ford in the river.
- **Ruins** (`ruin_city`, `ruin_factory`): no income, no defence of their own. A soldier (any unit with `capture`) standing on one gets a **Rebuild** order: it costs
  4000 (city) or 7000 (factory), the tile turns into a city or factory owned by the soldier's player at once, and the soldier's turn ends. The button is greyed out
  when the owner cannot pay. Rebuilding can be undone. The computer rebuilds a ruin when it keeps a quarter of the price in hand and a soldier can reach it.
  The costs are data: `terrain.json -> attributes.ruin.cost`.

## Roads

A road is a narrow strip of asphalt (42% of the tile, `ROAD_WIDTH` in `terrain-art.js`) laid over the ground, with a darker edge: the ground shows either side, so a road
does not read as the grey of fog of war. It runs out of each tile by the arms `roadShape` finds and is rounded at a bend. A tileset recolours it through the road's
`render.style` (`color`, `edge`, `specks`, `width`), not a `base`.

## Data and drawing

`tilesets.json`: `{ id: { name, factions: [factionId...], description, ground, terrain: { terrainId: { name, render: { base, decor, mini, style, group } } } } }`. Only those render keys can be
overridden (`building` can not: buildings are never themed). `style` is an object of options the drawing reads (`greens`, `snow`, `rock`, `canopy`, `walls`, `texture`...); see the
defaults at the top of each drawing in `src/render/terrain-*.js`. Water terrains keep one `base` colour per tileset so sea and shoals still join. A test requires a drawing for
every decor a tileset names. To preview: `node tools/sprite-lab/terrain.mjs [tileset...] [--map=id] [--S=48] [--out=dir]`.
