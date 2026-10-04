# Sprite lab

Offline tool for designing unit art. It renders sprites to PNG headlessly (no browser), so a design can be drawn,
looked at, measured and refined in a loop. It is **not** part of the game build and adds no dependency to the game.

```
cd tools/sprite-lab && npm install        # once; installs @napi-rs/canvas locally to this folder
node lab.mjs help                         # or, from the repo root:  npm run lab -- help
```

Images land in `tools/sprite-lab/out/` (git-ignored).

## The loop

```
node lab.mjs list                                  all styles found
node lab.mjs sheet flat                            every unit x both factions (detail view, 176 px tiles)
node lab.mjs compare flat,mystyle                  styles stacked for side-by-side (120 px = a phone tile on a 3x screen)
node lab.mjs units flat,mystyle sniper,flak        before/after: chosen units, styles as columns
node lab.mjs zoom flat flak                        one unit large + phone size + 1x, on every terrain
node lab.mjs anim flat flak                        animation filmstrip (gun recoil, running gear...)
node lab.mjs check flat                            numbers: size, tile overflow, shadow fit
node lab.mjs gallery                               rebuild gallery/data.json (portrait lab data)
```

Flags: `--moving` (walk cycle; idle soldiers stand still), `--bg plain|forest|mountain|road|sea|#rrggbb`, `--t <seconds into the animation>`, `--size <tile px>`, `--out <file.png>`.
Backdrops use the game's real terrain drawing, so units are judged on what they will actually sit on.

Sizes to judge at: **40** is a phone tile at 1x, **120** is the same tile on a 3x screen, **176+** is for detail work.
Details that vanish at 40 are not worth the pixels; silhouette and faction colour have to carry there.

`check` catches what eyes miss: a unit wider than its tile, a shadow that is the wrong width or detached from the
body, an unexpectedly small unit. Run it after every edit.

## The game's unit art

Shared pieces (wheels, treads, propellers, hull and waterline handling, turrets, tubes, dishes, legs...) live in `src/render/parts.js`; see `docs/render-parts.md`.

The art is `src/render/unit-art.js` (exports `SPRITES` and `SHADOWS`); `src/render/unit-frame.js` composes one frame
(shadow, altitude, bob and jitter) and `src/render/unit-sprites.js` `drawUnit` calls it. The lab, the gallery and the
game all run those same files, so what you review is what ships. `variants/flat.js` just re-exports the game art so the lab
can render it as the style `flat`.

To try a new direction, add a sibling file in `variants/` (export `meta`, `SPRITES`, `SHADOWS`) or a free-form one in
`styles/` (export `meta`, `draw(g, id, o)`), then `compare` it with `flat`. Sprite names match `data/units.json`.

The art is deliberately simple: flat blocks, no outlines. The foot family (soldier, mech, sniper) shares one body,
head and walk cycle (`trooper`), differing only in pack and weapon. Fighter and bomber are drawn in a 3/4 view (near wing toward the viewer), the rest side-on. A unit that has acted is washed with dark grey (`DISABLED_TINT`) and composited as
one flattened image (`drawFrameAlpha` in `unit-frame.js`), so its parts never blend with each other; pass `alpha` to a lab
style's `draw` to preview it. `variants/detailed.js` keeps the richer set the game
briefly used, for comparison (`lab.mjs compare flat,detailed`).

## The gallery

`gallery/index.html` is a live page: it runs the game's `unit-art.js` on canvas with the game's animation states (Idle, Moving at
double speed, and the dark-grey still Done pose), with controls for tile size and ground colour. It is published to
GitHub Pages at `/gallery/`, and locally at `http://localhost:8080/gallery/` (`npm start`).
`gallery/index.html` and `preview.js` are hand-written; `node lab.mjs gallery` only rewrites `gallery/data.json` (used by the portrait lab).
The page has tabs: Infantry, Vehicles, Air, Naval, Defences and Characters (`#characters` in the URL). `gallery/catalog.js` merges the game
registry, `concepts.json` and `planned-units.json` into one list of units; `units-view.js` draws the unit tabs and `characters-view.js` the
leaders (portrait, kit icons for what they build and start with, and a dialogue tester that types out each situation's lines).

**Pipeline stages** live in `gallery/status.json`: idea (not in the game), draft (in the game, icon/interface unfinished), solid (icon is good),
balanced, ready. Edit that file to promote a unit; a test checks that game units are at least draft and concepts stay idea.
Like the game, it is cache-busted: `/gallery/index.html` is a tiny loader that reads `version.json` (fetched fresh) and imports
`v/<hash>/gallery/preview.js`; the workflow publishes the gallery code, data and sprite modules under that folder, so a
deploy shows up immediately instead of after the browser's cache expires.

## Planned units

`gallery/planned-units.json` holds units that are drawn but not in the game yet (currently `stealth_bomber`, the flying-wing
sprite that used to be the bomber). It lives in `gallery/`, not in `data/`, so the game never loads it. The lab and the gallery
include these units (marked PLANNED); the plain `bomber` is now a four-engine transport-style jet. To ship one, move its
entry into `data/units.json`, fill in its balance numbers and add its damage rows.

## Experimental concept units

`gallery/concept-art.js` (sprites and shadows; the newer groups live in `concept-art-infantry.js`, `-static.js`, `-air.js`, `-ships.js`, `-vehicles.js` and `-fleet.js`, re-exported by it) and `gallery/concepts.json` (names, facilities, costs, mechanics) hold the concept units, plus structures (`gallery/structure-art.js`: labs, bases, walls; the gallery's Structures tab and wall builder in `gallery/wall-lab.js`)
for production facilities that do not exist yet (Hover Lab, Mech Factory, Stealth Lab, Glider Field, Space Port, Underwater Lab, Drone
Bay, plus new War Factory units, a Training Ground of specialist infantry, an Engineer Works of static defences, mines and gadgets, and new aircraft and ships for the existing Airfield and Shipyard; a later brainstorm in `concept-art-ideas.js` adds a Salvage Yard for Lastholm and units built around new mechanics). The Rocket Launcher started here and is now a real unit. They are shown in the gallery's "Experimental" section and are not in the game or in `data/`.
`node tools/sprite-lab/concepts.mjs [--only id,id] [--size 150] [--check] [--art file.js --data file.json]` renders them to a PNG contact sheet and checks their bounds.

## Leader portraits (concept)

`gallery/portraits.html` (plus `portrait-art.js` and `portraits.js`) shows four invented leaders, one per army, in seven portrait styles
and eight dialogue layouts. The portraits are one parametric bust driven by traits in the `LEADERS` list and pushed through a style
pipeline (flat, ink, pixel, duotone, halftone, medallion, poster); they blink and talk live. Nothing is in the game yet.

## Notes for design work

- Draw at the size it will be seen. Judge every change at 120 and 40 before 176.
- Keep each unit's silhouette distinct from its neighbours (sniper vs soldier was the classic offender).
- Keep every unit inside its tile (`check` reports it) and its shadow under its own footprint.
- Flat variants draw in a 100-unit tile space centred on (0, 0), facing right; `b` and `j` (bob and jitter) arrive in
  pixels and are converted for you.
