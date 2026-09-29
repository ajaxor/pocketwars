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
    { "faction": "orange_star", "controller": "human", "funds": 8000 },
    { "faction": "blue_moon",   "controller": "ai",    "funds": 8000 }
  ],
  "legend": {
    ".": { "terrain": "plain" },
    "O": { "terrain": "hq", "owner": 0 }
  },
  "tiles": ["..O.", "...."],
  "units": [ { "type": "infantry", "owner": 0, "x": 2, "y": 0, "hp": 10 } ]
}
```

- `players`: 2-8 entries, unique factions from `data/factions.json`; `controller` is `human` or `ai`; player index = position.
  Player 0 moves first.
- `legend`: one character -> terrain id (+ optional `owner` player index, only on terrain with the `property` attribute).
- `tiles`: equal-length rows of legend glyphs; up to 64x64.
- `units`: `type` from `data/units.json`, player `owner`, `x`/`y`, optional `hp` (default max). A unit cannot start on
  terrain impassable to its move class or on an occupied tile.
- `id` must be a lowercase slug and match its key in `index.json`.

`serializeMap(map)` is the inverse of `parseMap` (for a future editor). To add a map: drop the file in `data/maps/`, add it
to `index.json`, run `npm run validate`.
