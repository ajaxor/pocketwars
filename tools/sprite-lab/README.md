# Sprite lab

Offline tool for prototyping unit art. It renders sprites to PNG headlessly (no browser needed) so a style can be
drawn, looked at, and refined in a loop. It is **not** part of the game build and adds no dependency to the game.

```
cd tools/sprite-lab
npm install                                   # installs @napi-rs/canvas, local to this folder
node sheet.mjs toy 176 toy.png                # contact sheet: <style> <tile px> <out>
node compare.mjs cmp.png 120 current pixel toy badge   # side-by-side: <out> <tile px> <styles...>
```

Use tile size ~120 to see units at phone size (a 40 CSS px tile on a 3x screen), 40 for 1x, 176+ to inspect detail.

## Styles

A style is a module in `styles/` exporting `meta` and `draw(g, id, o)`, which paints one unit centred on `(0, 0)` of a
tile of size `o.s` (`o = { s, c, dk, alt, w, run, make }`: tile size, faction colour, dark colour, altitude fraction,
animation clock, 1 while active, and a canvas factory).

| Style | Idea |
| --- | --- |
| `current` | The game today (`src/render/unit-sprites.js`), wrapped for comparison |
| `pixel` | 32x32 grid, automatic 1px outline, nearest-neighbour scaled |
| `toy` | Bold outlines, gradients and highlights, one consistent side view |
| `badge` | Cream glyph on a faction-coloured plate, tuned for tiny sizes |

Rendered samples are published under `gallery/` (see `gallery/index.html`).
