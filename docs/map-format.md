# Map files (`*.map.json`)

Maps live in `data/maps/` and are listed in `data/maps/index.json` (`{"default": "<id>", "maps": {"<id>": "<file>"}}`).
Choose one in the browser with `?map=<id>`. Format: `"pocketwars-map"`, version 1. Parsing (`src/data/map-format.js`)
reports every problem at once.

```json
{
  "format": "pocketwars-map",
  "version": 1,
  "id": "classic",
  "name": "Front Line",
  "description": "optional",
  "players": [
    { "faction": "ashmark", "controller": "human", "funds": 8000 },
    { "faction": "vantor_reach",   "controller": "ai",    "funds": 8000 }
  ],
  "legend": {
    ".": { "terrain": "plain" },
    "O": { "terrain": "hq", "owner": 0 }
  },
  "tiles": ["..O.", "...."],
  "units": [ { "type": "soldier", "owner": 0, "x": 2, "y": 0, "hp": 10 } ]
}
```

- `players`: 2-4 entries (each gets its own colour), unique factions from `data/factions.json`; `controller` is `human` or `ai`; player index = position.
  Player 0 moves first. Optional `leader`: a leader id from `data/loadouts.json`; that leader's menus apply and the map's own units for that player are replaced by the leader's starting formation (see `docs/leaders.md`).
- `legend`: one character -> terrain id (+ optional `owner` player index, only on terrain with the `property` attribute).
- `tiles`: equal-length rows of legend glyphs; up to 64x64.
- `ground` + `groundLegend` (both optional): a second grid of row strings under the terrain, using its own legend of glyph -> id from
  `data/ground.json` (`grass`, `dirt`). Tiles it does not cover use `rules.json -> defaultGround`. Ground is only a surface: terrain
  (rough, mountain, forest, city...) is drawn on top of it and there is no functional difference between grass and dirt yet.
- `units`: `type` from `data/units.json`, player `owner` (or `null` for a neutral structure: a turret or jammer nobody owns, hostile to
  everyone), `x`/`y`, optional `hp` (default max). A unit cannot start on
  terrain impassable to its move class or on an occupied tile.
- `id` must be a lowercase slug and match its key in `index.json`.

`serializeMap(map)` is the inverse of `parseMap`; the map editor (`editor/`) uses both. To add a map: drop the file in `data/maps/`, add it
to `index.json`, run `npm run validate`.

## Making maps with the editor

The title screen's **Map editor** paints terrain, buildings, units and defences with the game's own art, with symmetry (left/right, top/bottom,
180 degrees, four ways), fill, pick and undo, and sets the name, size and players. **File -> Download .map.json** writes a file in exactly
this format: drop it in `data/maps/`, add it to `index.json` and run `npm run validate`. **Save to My maps** keeps it in the browser only (the
skirmish page lists it as "(my map)"). Any shipped map can be opened as a starting point (File -> Game maps).

## Terrain notes

- Walls: `wall` is impassable to everything (aircraft too) and blocks line of sight; `wall_breach` gets a neutral cracked wall on it when
  the game starts (one hit breaks it, leaving passable rubble). Wall tiles of either kind link up into continuous pipes; put cracked walls on
  straight runs (a corner or an end is drawn whole). A map with a `jammer` unit is played in fog of war (the skirmish page can turn it off; on a map without one it is locked off). Every shipped map but `classic` has a symmetric set of neutral jammers on contested ground.

- Move classes are `foot`, `wheels`, `tread`, `air` and `naval`. Roads cost the same as open ground (no speed bonus); forests cost treads 2 and block wheels; rough ground blocks wheels and costs treads 1; mountains admit only foot (and air). Water (`sea`) admits only `naval` (and air). `shoals` are little islets in the sea: impassable to every ground and naval unit today (so no unit can use them yet) but they give cover (defense 2) for whatever unit gets to traverse them. A shipyard is a land tile that ships cannot move onto (they are repaired from the water beside it); ships are built on the yard itself, whatever its terrain, and sail off with their free move, so put each shipyard on the shore with sea next to it. The `amphibious` move class (marines) uses foot costs on land and 1 on sea and shoals. No transports exist yet, so every map needs a land route between HQs (tests enforce it).
  wheels and costs treads 1; mountains admit only foot (and air).
- `terrain.json -> render.base` is optional: terrain with none (plain, forest, mountain, rough, properties) takes the colour of the ground under it.
- `terrain.json -> render.group` (optional name): terrains with the same group are drawn as one shape even with different colours: the group's outline is rounded once and the borders between its members stay straight. No shipped terrain uses it at the moment.
- `terrain.json -> render.inlay` (true for roads): neighbouring ground stays square against it instead of rounding its corners.
- `terrain.json -> render.mini` (optional hex colour) is the flat colour used by the skirmish page's map preview.
- Maps larger than the screen scroll; any size up to 64x64 works.
