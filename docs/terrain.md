# Terrain sets

Every army has a home land. A **tileset** (`data/tilesets.json`) redraws the terrain in that land; the rules never change. A map names its tileset
(`"tileset": "tundra"`); a map without one is drawn in the default (`temperate`).

| Tileset | Army | Ground | Forest | Mountain | Rough | Cliff |
|---|---|---|---|---|---|---|
| temperate | Lastholm | grass | pines | peak | rocks | stone ridge |
| tundra | Deepmere | snow | snowy spruce | glacier peak | frozen scree | ice cliff |
| desert | Ashmark | sand | oasis palms | mesa | badlands | sandstone |
| urban | Vantor Reach | paving | park | tower blocks | rubble | concrete barrier |
| jungle | Solace | jungle floor | rainforest | mossy crag | thicket | mossy cliff |
| ruins | Ironvale | ash | deadwood | slag heap | wreckage | broken wall |
| islands | Tidehaven | sand | palm grove | volcanic peak | reef rock | sea cliff |
| highlands | Skyreach | heath | dark pines | granite peak | boulder field | granite |
| royal | Highspire | lawn | blossom orchard | castle spires | flagstones | hedge wall |

The faction-to-land pairing is provisional (the campaign will lean on it through `registry.homeTileset(faction)`). Each tileset has a skirmish map with its home
army as player 0: Ridgeback, Whiteout, Dune Sea, Concrete Canyon, Mudslide, Burnt Offering, Atoll, Skyline Pass, Garden Maze. The title screen's **Terrain** link
opens a gallery of every tileset.

## New terrain (the same in every tileset)

- **Soft ground** (`snow_drift`, `dune`, `mud`): wheels cost 2, bikes 3, everything else 1. Drifts and dunes draw on whatever ground is under them.
- **Cliff** (`cliff`): impassable to everything on the ground, at sea and on the hover; aircraft fly over (cost 1). It blocks sight and direct fire (height 2). Cliff tiles
  link up like walls: the top of a ledge with a sheer face on every side that has no cliff to its south.
- **Ruins** (`ruin_city`, `ruin_factory`): no income, no defence of their own. A soldier (any unit with `capture`) standing on one gets a **Rebuild** order: it costs
  4000 (city) or 7000 (factory), the tile turns into a city or factory owned by the soldier's player at once, and the soldier's turn ends. The button is greyed out
  when the owner cannot pay. Rebuilding can be undone. The computer rebuilds a ruin when it keeps a quarter of the price in hand and a soldier can reach it.
  The costs are data: `terrain.json -> attributes.ruin.cost`.

## Data and drawing

`tilesets.json`: `{ id: { name, faction, description, ground, terrain: { terrainId: { name, render: { base, decor, mini, style, group } } } } }`. Only those render keys can be
overridden (`building` can not: buildings are never themed). `style` is an object of options the drawing reads (`greens`, `snow`, `rock`, `canopy`, `walls`, `texture`...); see the
defaults at the top of each drawing in `src/render/terrain-*.js`. Water terrains keep one `base` colour per tileset so sea and shoals still join. A test requires a drawing for
every decor a tileset names. To preview: `node tools/sprite-lab/terrain.mjs [tileset...] [--map=id] [--S=48] [--out=dir]`.
