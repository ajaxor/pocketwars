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
node lab.mjs anim flat flak                        animation filmstrip (spinning radar, recoil, running gear...)
node lab.mjs check flat                            numbers: size, tile overflow, shadow fit
node lab.mjs gallery                               rebuild the live gallery page (gallery/index.html)
```

Flags: `--bg plain|forest|mountain|road|sea|#rrggbb`, `--t <seconds into the animation>`, `--size <tile px>`, `--out <file.png>`.
Backdrops use the game's real terrain drawing, so units are judged on what they will actually sit on.

Sizes to judge at: **40** is a phone tile at 1x, **120** is the same tile on a 3x screen, **176+** is for detail work.
Details that vanish at 40 are not worth the pixels; silhouette and faction colour have to carry there.

`check` catches what eyes miss: a unit wider than its tile, a shadow that is the wrong width or detached from the
body, an unexpectedly small unit. Run it after every edit.

## The game's unit art

The art is `src/render/unit-art.js` (exports `SPRITES` and `SHADOWS`); `src/render/unit-frame.js` composes one frame
(shadow, altitude, bob and jitter) and `src/render/unit-sprites.js` `drawUnit` calls it. The lab, the gallery and the
game all run those same files, so what you review is what ships. `variants/flat.js` just re-exports the game art so the lab
can render it as the style `flat`.

To try a new direction, add a sibling file in `variants/` (export `meta`, `SPRITES`, `SHADOWS`) or a free-form one in
`styles/` (export `meta`, `draw(g, id, o)`), then `compare` it with `flat`. Sprite names match `data/units.json`.

The art is deliberately simple: flat blocks, no outlines. The infantry family (infantry, mech, sniper) shares one body,
head and walk cycle (`trooper`), differing only in pack and weapon. Fighter and bomber are drawn in a 3/4 view (near wing toward the viewer), the rest side-on. A unit that has acted is faded as
one flattened image (`drawFrameAlpha` in `unit-frame.js`), so its parts never blend with each other; pass `alpha` to a lab
style's `draw` to preview it. `variants/detailed.js` keeps the richer set the game
briefly used, for comparison (`lab.mjs compare flat,detailed`).

## The gallery

`gallery/index.html` is a live page: it runs the game's `unit-art.js` on canvas with the game's animation states (Idle, Moving at
double speed, and the faded still Done pose), with controls for tile size and ground colour. It is published to
GitHub Pages at `/gallery/`, and locally at `http://localhost:8080/gallery/` (`npm start`).
`node lab.mjs gallery` regenerates the page shell; `gallery/preview.js` is hand-written.
Like the game, it is cache-busted: `/gallery/index.html` is a tiny loader that reads `version.json` (fetched fresh) and imports
`v/<hash>/gallery/preview.js`; the workflow publishes the gallery code, data and sprite modules under that folder, so a
deploy shows up immediately instead of after the browser's cache expires.

## Planned units

`planned-units.json` holds units that are drawn but not in the game yet (currently `stealth_bomber`, the flying-wing
sprite that used to be the bomber). It lives here, not in `data/`, so the game never loads it. The lab and the gallery
include these units (marked PLANNED); the plain `bomber` is now a four-engine transport-style jet. To ship one, move its
entry into `data/units.json`, fill in its balance numbers and add its damage rows.

## Notes for design work

- Draw at the size it will be seen. Judge every change at 120 and 40 before 176.
- Keep each unit's silhouette distinct from its neighbours (sniper vs infantry was the classic offender).
- Keep every unit inside its tile (`check` reports it) and its shadow under its own footprint.
- Flat variants draw in a 100-unit tile space centred on (0, 0), facing right; `b` and `j` (bob and jitter) arrive in
  pixels and are converted for you.
