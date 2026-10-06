# Balance tools

Two tools for seeing how the game's pieces compare. Both read the game data, so they stay current as units, weapons and leaders change.
Output goes to `tools/balance/out/` (not committed).

## Unit trades: `npm run balance:units [-- --html]`

Every armed unit against every other unit, one attack each at full HP in the open, straight from the damage formula: HP dealt, HP taken
back (the reply, if the defender survives and can hit back directly), both in credits (HP x price / max HP), and the net. Also the damage
bought per credit of the attacker's price. Writes `unit-trades.csv` (one row per pair), `unit-matrix.csv`, `unit-report.md` (each unit's
average result, win share, best and worst targets, and the outliers: units far above or below the median for their price) and with
`--html` a heat map. It also distils the matrix by category (`category-trades.csv`, and a table in the report): mean and median value of a fight for each category against each
other one, and each unit against each category. A pair is counted from both ends (striking first, and being struck first, averaged), so the
numbers do not depend on who shoots first. A ranged unit is assumed to strike first and be answered second,
unless the target is ranged too (in the game itself an indirect shot is never countered), so ranged units always score a little oddly.
Movement, range, terrain, transport and capture are left out on purpose: this is the pure comparison of stat blocks, so
a price or weapon change shows up here first.

## Leader balance: `npm run balance:leaders [-- --maps 2p --seeds 1 --days 20]`

The factions are colours; the leaders (`data/loadouts.json`) are what differ, with their own build menus and starting units. Every pair of
leaders plays every two-player map twice (seats swapped), both seats played by the same AI engine and profile, scored like the tuner scores
games (material lead at the day limit). Writes `leader-report.md`: average against the field with a confidence interval, the
row-against-column matrix, each leader's score per map, and the leaders outside the noise. It measures leaders as the AI plays them.
The default run is 720 games (about 4 minutes on two cores); `--seeds 3` firms up the per-pair and per-map cells.

The leader report also has a "Where the damage comes from" section: for each leader its top three unit types by credits of enemy value
destroyed (damage dealt, counterattacks included), and for every unit type the **return**: damage dealt per credit fielded (built, plus
starting units), compared with the median. A unit far above the median for every leader that fields it is the first place to look.
