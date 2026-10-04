# Unit art: lessons learned

Notes from iterating on unit sprites (mostly the naval rework) so the next round goes faster.

## Workflow
- **Render and look before committing.** `node tools/sprite-lab/lab.mjs units flat <ids> --size 300 --bg sea --out x.png`, then view the PNG. Also check a whole-map shot, since size and contrast read differently at game scale. Regenerate the gallery (`lab.mjs gallery`) before every push.
- **Show variants, let the owner pick.** For anything subjective (outlines, underwater shade, shoal styles) add a control to the gallery and compare side by side (3-4 options), then commit only the winner and delete the control.
- **Small steps.** Each request is usually one or two tweaks per unit; make exactly that, render, and don't "improve" neighbouring parts. Two mistakes this round came from reinterpreting a request: removing the wrong cruiser block, and tilting a whole battleship turret when only the barrels were meant.
- **Ask which element is meant** when a description could match two parts; otherwise restate your reading in the reply.

## Conventions that held up
- **Build from the parts library** (`src/render/parts.js`, catalogued in `render-parts.md`) and add a part there when a second sprite needs the same thing, instead of copying it. Moving code into the library must leave the sprite-lab sheets byte-identical.
- Sprites are drawn facing right; the frame mirrors for `face`. Infantry-type units opt out with `render.facing: false`.
- Flat shading only. Thin outline in the team's dark colour (stamped silhouette in `outline.js`) unifies every unit.
- Ships are drawn twice, clipped above and below a fixed waterline, so bobbing changes how much is under water. Underwater = light colour mixed toward dark (`UNDER_SHADE` .45), not the full dark.
- Anything sitting on or under the water should read as part of that layer: propellers use the underwater hull colour, and the foam/bubbles sit at the line.
- Turrets are lighter than the underwater hull (otherwise they merge with it); barrels are near-black.
- Silhouette is what distinguishes units. Differentiate with superstructure shape (plus-shaped bridge, tiered wings, tall bridge) before adding detail or colour.
- Avoid blue team colours: they vanish against water tiles.
- Hidden units get an eye marker (white when an enemy can see them, and only when the viewer can see that), a submerge animation, and fade out instead of vanishing.
- **Keep icons simple; minimise detail.** No windows on ships (a hull, a superstructure and one distinguishing silhouette is enough). No wing markings, airframe stripes, lamps, rails or hubs. Aircraft carriers are a deck, a runway line and a mast.
- **Specialist infantry = a plain soldier plus one prop** (bandana and AK-47, one white case with one cross, one large wrench, a fur hat). Don't add gear that doesn't change the silhouette.
- **Structures:** few shapes, one idea per building, no windows; walls and static defences use the buildings' language (blocks seen from the front-left and above: lit front, dark right side, light roof, shadow to the lower right) on a pale concrete pad. Walls are concrete runs with a team-coloured coping and a team-coloured post wherever the line turns, ends or branches; a defence is a small team-coloured block with one dark weapon on it.
- Walkers' legs use the shared `pillarLeg` (a straight swinging pillar with a flat foot) rather than jointed limbs.

## Pitfalls
- Hard-coded per-ship numbers (keel, propeller y, bridge offsets) drift apart; re-tune propellers whenever a hull changes.
- Keep new rules data-driven (weapon `indirect`, unit `render.facing`) and validate them in `src/data/validate.js`.
- Facing lives in engine state (deterministic and undoable); the renderer only derives previews from the previewed path.
- Don't reformat data JSON with scripts; make targeted edits to keep diffs small.
