# Render parts library

`src/render/parts.js` holds the drawing pieces that many units share. Build a sprite from these instead of copying a wheel or a propeller
into a new file: a fix then lands in every unit, and units that carry the same kind of equipment look and move alike.
(`unit-art.js` still re-exports everything as `PARTS`, which the concept files used before.)

**Conventions.** `g` is a 2D context translated to the tile's centre; `s` is the tile size in pixels; x, y and sizes are fractions of `s`;
+x is forward and +y is down. `w` is the animation clock (seconds), `run` is 1 while animating and 0 once the unit has acted (a part freezes),
`ph` is a per-unit phase. Parts draw and return nothing. Colours are CSS strings; `mix(a, b, t)` blends two hex colours.

| Group | Part | What it draws |
|---|---|---|
| Primitives | `box`, `disc`, `oval`, `poly`, `stroke`, `mirror`, `both`, `mix` | rounded rectangle, circle, ellipse, filled polygon, round-capped line; `mirror(top)` closes a half outline into a symmetrical one |
| Colours | `INK`, `STEEL`, `GLASS`, `SKIN`, `OLIVE`, `RED`, `GLOW`, `FOAM`, `UNDER_SHADE` | the shared palette; `UNDER_SHADE` is how far a ship's dark colour is mixed toward its light colour below the waterline |
| Running gear | `wheel`, `wheels` | spoked wheel(s), turning with the clock |
| | `treads` | a pill-shaped track with moving cleats |
| | `walkerLeg` | a leg with hip, knee and a foot that lifts and plants (only while `walk` is 1) |
| | `antigrav` | a row of anti-gravity emitter pods with pulsing lenses, a light cone and rising motes (older hover look, no longer used by the concept hover units) |
| | `hoverTubes` | a manifold pipe with nozzles under a hull, firing rings of force at the ground on a fast interval (the hover units; the hull should bob deeper but slower) |
| Water | `afloat` | draws a ship twice, clipped above and below the waterline, and lays foam at both ends |
| | `surfacing`, `SUB_LINE` | a diving boat drawn like the regular submarine: above and below a fixed waterline, sinking as `submerged` goes 0 to 1, foam at both ends or round the periscope when dived |
| | `hullPath`, `deckAt` | hull outline with a swept-up bow, and the deck's height and slope at x |
| | `skyClip`, `seaClip`, `LINE` | the two clip regions and the waterline height |
| | `propeller`, `bubbles` | a ship's propeller with a bubble wake; bubbles rising from a point |
| | `periscope` | a mast with a small head, for submarines |
| Weapons and gear | `turret` | armoured block with barrels, tiltable to sit on a slope |
| | `tubes` | a pod of rocket or missile tubes with warhead tips (rotate the context to elevate) |
| | `dish` | a turning radar dish on a mast |
| | `propDisc` | an aircraft propeller seen end-on: translucent disc and a flickering blade |
| Infantry | `legs`, `torso`, `head`, `dome` | the body every foot unit shares |
| Effects | `sheen` | a bright band sweeping along a body, clipped to its outline (cloaks, low-observable skin) |
| | `plume` | smoke drifting aft from a funnel |

## Adding a part

1. If two sprites draw the same thing, move it into `parts.js` with a doc comment saying what the arguments mean, and use it from both.
2. A part takes the animation inputs it needs (`w`, `run`, `ph`) rather than reading globals, and draws nothing when `run` is 0 that would
   keep moving.
3. Add it to the table above. `tests/render/parts.test.js` draws every export against a recording context, so a crash shows up at once.
4. Before moving existing code into the library, render the sprite lab sheets (`lab.mjs sheet flat`, `concepts.mjs`) before and after and compare
   the PNGs: a pure move should leave them byte-identical.

## Not shared yet (candidates)

Each is drawn more than once with small differences; unify when the next unit needs one: the sandbag/concrete pads under the static
defences, ship deck mounts (`mount` in `art-ships.js` versus `turret`), radar dishes drawn by hand on the jammer, SAM site, carrier and
radar plane (now that `dish` exists), the medic cross and heal plus, and the muzzle-flash glints.
