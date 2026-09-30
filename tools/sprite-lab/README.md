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
node lab.mjs sheet flat-b                          every unit x both factions (detail view, 176 px tiles)
node lab.mjs compare current,flat-a,flat-b         styles stacked for side-by-side (120 px = a phone tile on a 3x screen)
node lab.mjs units current,flat-b sniper,flak      before/after: chosen units, styles as columns
node lab.mjs zoom flat-b flak                      one unit large + phone size + 1x, on every terrain
node lab.mjs anim flat-b flak                      animation filmstrip (spinning radar, recoil, running gear...)
node lab.mjs check flat-b                          numbers: size, tile overflow, shadow fit
node lab.mjs gallery                               rebuild gallery/ (images + index.html) from every style
```

Flags: `--bg plain|forest|mountain|road|sea|#rrggbb`, `--t <seconds into the animation>`, `--size <tile px>`, `--out <file.png>`.
Backdrops use the game's real terrain drawing, so units are judged on what they will actually sit on.

Sizes to judge at: **40** is a phone tile at 1x, **120** is the same tile on a 3x screen, **176+** is for detail work.
Details that vanish at 40 are not worth the pixels; silhouette and faction colour have to carry there.

`check` catches what eyes miss: a unit wider than its tile, a shadow that is the wrong width or detached from the
body, an unexpectedly small unit. Run it after every edit.

## Styles

Two kinds are discovered automatically:

| Folder | Exports | Use |
| --- | --- | --- |
| `variants/*.js` | `meta`, `SPRITES`, `SHADOWS` | Game-compatible sets. Same signature as `src/render/unit-sprites.js`, so they can be copied into the game as-is. `check` works on these. |
| `styles/*.mjs` | `meta`, `draw(g, id, o)` | Free-form experiments (pixel art, toy vector, badge). |

`variants/flat-core.js` holds all the flat drawings; `flat-a`, `flat-b` and `flat-c` are three finishes of it:

| Variant | Finish |
| --- | --- |
| `flat-a` | Pure flat fills, as the game looks today, with more detail |
| `flat-b` | A light band on top and a dark band underneath every part |
| `flat-c` | Banded shading plus a thin outline in each part's own darker colour |

To add a look, add a file that exports `meta` and calls `makeFlat({...})` (or write a new set), then `node lab.mjs gallery`.

## Adopting a variant in the game

Sprite names already match `data/units.json`, so no data changes are needed.

1. Copy `variants/flat-core.js` to `src/render/` and export the chosen look from it (`makeFlat({ shade: true })`).
2. In `src/render/unit-sprites.js`, use its `SPRITES` in place of the current table.
3. In `drawUnit`, replace the generic shadow ellipse with `(SHADOWS[def.render.sprite] || defaultShadow)(g, { s, alt, w, ph, run })`,
   drawn before the altitude translation so aircraft shadows stay on the ground.

## Notes for design work

- Draw at the size it will be seen. Judge every change at 120 and 40 before 176.
- Keep each unit's silhouette distinct from its neighbours (sniper vs infantry was the classic offender).
- Keep every unit inside its tile (`check` reports it) and its shadow under its own footprint.
- Flat variants draw in a 100-unit tile space centred on (0, 0), facing right; `b` and `j` (bob and jitter) arrive in
  pixels and are converted for you.
