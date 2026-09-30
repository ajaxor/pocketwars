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
node lab.mjs compare current,flat                  styles stacked for side-by-side (120 px = a phone tile on a 3x screen)
node lab.mjs units current,flat sniper,flak        before/after: chosen units, styles as columns
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

## The flat sprite set

`variants/flat.js` is the unit art: one game-compatible module exporting `SPRITES` and `SHADOWS`, with the same
signature as `src/render/unit-sprites.js` (plus a shadow per unit). It is self-contained and browser-safe.
`variants/frame.js` composes one frame exactly as the game's `drawUnit` does; the lab and the gallery both use it.

`lab.mjs` also discovers any other file in `variants/` (game-compatible, exports `meta`, `SPRITES`, `SHADOWS`) or
`styles/` (free-form, exports `meta` and `draw(g, id, o)`), so a new direction can be prototyped beside it and compared
with `compare`. `current` is the game's own sprites, for before/after.

The infantry family (infantry, mech, sniper) shares one body, head and walk cycle; each unit's `KIT` supplies only its
pack and weapon, so any change to the body applies to all three.

## The gallery

`gallery/index.html` is a live page: it runs `flat.js` on canvas with the game's animation states (Idle, Moving at
double speed, and the faded still Done pose), with controls for tile size and ground colour. It is published to
GitHub Pages at `/gallery/`, and locally at `http://localhost:8080/gallery/` (`npm start`).
`node lab.mjs gallery` regenerates the page shell; `gallery/preview.js` is hand-written.

## Adopting the sprites in the game

Sprite names already match `data/units.json`, so no data changes are needed.

1. Copy `variants/flat.js` to `src/render/` and use its `SPRITES` in place of the table in `unit-sprites.js`.
2. In `drawUnit`, replace the generic shadow ellipse with `SHADOWS[def.render.sprite](g, { s, alt, w, ph, run })`,
   drawn before the altitude translation so aircraft shadows stay on the ground. `variants/frame.js` shows the order.

## Notes for design work

- Draw at the size it will be seen. Judge every change at 120 and 40 before 176.
- Keep each unit's silhouette distinct from its neighbours (sniper vs infantry was the classic offender).
- Keep every unit inside its tile (`check` reports it) and its shadow under its own footprint.
- Flat variants draw in a 100-unit tile space centred on (0, 0), facing right; `b` and `j` (bob and jitter) arrive in
  pixels and are converted for you.
