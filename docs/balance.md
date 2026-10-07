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

## Balance log

Changes made from these reports (return = damage dealt per credit fielded, from `balance:leaders`; "median" = the median unit's return):

- **Round 1.** Fighter 10,000 -> 13,000 and move 9 -> 6 (it was the top damage dealer for 8 of 9 leaders, 3.5x the median return); vintage
  fighter 5,000 -> 6,000, move 7 -> 5; stealth fighter 16,000 -> 19,000, move 9 -> 6. Vintage and torpedo bombers moved to high air (a
  conscript could shoot them). Aircraft and vehicle moves cut by about a quarter (fighters most; vehicles floor 3, aircraft floor 4), motorcycle
  5 -> 4, no road bonus. Fog vision no longer matches movement; fogged players cannot move into never-seen tiles.
- **Round 2.** Submarine 9,000 -> 11,000 (3.7x median); SAM launcher 9,000 -> 11,000; rocket launcher 9,000 -> 10,000; rocket buggy 4,500 -> 5,000;
  destroyer 7,000 -> 8,000; gun boat 3,000 -> 3,500; cruiser 12,000 -> 13,000; diver 4,500 -> 5,500 (the leader doing best on naval maps leaned
  on it); copter 8,000 -> 7,000; stealth copter 12,000 -> 10,000; stealth bomber 22,000 -> 19,000; dreadnought 34,000 -> 30,000; light bombs 58 -> 68
  damage. Start armies: ludwig's start fighter became a radar plane and lysandra's a copter, to keep the starting armies within 4,500 of each
  other. (Marine and mech cuts were tried and reverted: the trade matrix showed them overshooting.)
- **Result** (720 games each): leaders went from 40-67% to 46-55% average score against the field. Fighters' return fell from 3.5x to 2.2x
  the median. Still above the pack: submarine, destroyer, fighter (and SAM launcher, on a very small sample).
- **Round 3 (AI and fuel).** The AI now values fliers within their fuel range (see `docs/ai.md`) and copter and transport copter fuel went 4 -> 6.
  Copter return rose from 0.2 to 0.39 (the median); leaders now span 44-57% (wider than round 2's 46-55%, since air-heavy leaders gain most), so
  the next balance pass should start from a fresh run. The leader report gained "Most under-used armed units" (units that never attacked, by
  credits wasted); about half of all armed units never attack in a game, so read it against that median.
- **Round 4 (from play).** Helicopters (copter, transport copter, stealth copter) no longer use fuel; radar plane fuel 3 -> 6. Fighters and bombers
  fly further so they can strike anywhere, and cost more for it: fighter move 6 -> 8, 13,000 -> 19,000; vintage fighter 5 -> 7, 6,000 -> 9,000;
  stealth fighter 6 -> 8, 19,000 -> 22,000; bomber 5 -> 7, 12,000 -> 14,500; vintage bomber 4 -> 6, 6,500 -> 7,500; torpedo bomber 5 -> 7,
  9,000 -> 10,500; stealth bomber 6 -> 8, 19,000 -> 21,500; copter 7,000 -> 8,000; stealth copter 10,000 -> 11,000. Start armies: vex's fighter
  became a torpedo bomber, hiroshi's a radar plane, harlan's vintage fighter a vintage bomber.
- **Result** (720 games): fighter return 0.63 (1.5x the median, it was 2.0x at the first price of 16,000) and fighters fielded fell from 25M to 7M
  credits; bombers 0.56. Only the submarine is above twice the median. Leaders now span 43-62% (chase, whose kit is copters and bombers, leads at
  62%; ludwig trails at 43%): the removed helicopter fuel helped the air-heavy kits most, so the next pass should look at chase and ludwig.
  Note: the AI plays defensively, so about half of all armed units never attack; that is a style rather than a fault as long as its income
  holds up, and the under-use table should be read with that in mind.
- **Round 5 (bombers).** The report only showed return (damage dealt per credit), which hides that a bomber mostly hits what cannot hit back. A
  net column (damage dealt - value lost, per credit fielded) shows it: bomber +0.28 against -0.05 for a tank and +0.09 for a heavy tank, so the
  bomber was well ahead of ground units despite a median return. Bomber 14,500 -> 17,000, vintage bomber 7,500 -> 9,000, torpedo bomber
  10,500 -> 12,500, stealth bomber 21,500 -> 24,000. Result: bomber return 0.48, net +0.18, fielded 22M -> 16M credits. Fighters are still the
  best of the planes on net (+0.45) and are the next candidate.
- **Round 6 (from play, October 2026).** RPG trooper range 2-3 -> 1-2 (it can now fire at an adjacent unit, and be answered there); motorcycle infantry
  move 4 -> 3. Not yet measured: run `npm run balance:units` and the leader report before judging either, and re-tune the AI (`npm run ai:tune`, it
  was already stale).
- **Round 7 (October 2026 units).** Flamethrower (renamed flame trooper; `noCounter`), royal guard (armour 0.35), shock trooper (damage 62, ignores armour 0), swordsman (x1.5 vs infantry), missile tank and airship shipped, with per-leader carrier pricing. New `npm run balance:infantry` ranks every leader's primary infantry by strength at equal money (Lanchester square law; 1.00 = the field's middle). First guesses put royal guard at 0.87, flamethrower 0.83, motorcycle 0.81, shock trooper 1.05, swordsman 1.19. Prices set to: royal guard 2,000 -> 1,600, shock trooper 1,600 -> 1,300, swordsman 1,500 -> 1,300, flamethrower 2,500 -> 1,700, motorcycle 2,000 -> 1,900, airship 19,000 -> 16,000 (the leader run showed return 0.21 and 2% destroyed). Chase's start swapped recon for artillery to keep start armies within 4,500.
- **Result** (720 games): chase 57%, vex 56%, lysandra 54%, ada 52%, dmitri 48%, harlan 48%, rex 46%, ludwig 45%, hiroshi 43% (each +-4). Primary infantry now rate 0.76 (motorcycle, kept low for its mobility) to 1.24; the new ones sit at 1.0-1.24. Chase and vex lead; hiroshi and ludwig trail and are the next candidates (swordsman and flamethrower returns were still low, 0.32 and 0.17, before the price cuts). Missile tank return 0.40, as the median.
- **No starting units.** `npm run balance:leaders -- --no-start-units` plays the leader run with the skirmish rule "Starting units: Off" (report in `tools/balance/out/no-start-units/`). After removing Vex's motorcycle and Dmitri's vintage bomber (720 games each): with starting units chase 57, dmitri 54, lysandra 54, vex 53, ada 53, harlan 48, ludwig 45, rex 44, hiroshi 43; without them chase 57, dmitri 53, vex 52, ada 51, harlan 49, lysandra 49, hiroshi 48, ludwig 46, rex 44. The spread narrows (43-57 to 44-57) and the leaders that move are the ones whose starts were strong or weak: lysandra -5 (her royal guard, tank and artillery start), hiroshi +5. Chase stays on top, so her lead is her menu (motorcycle, flamethrower, hover tank) and not her start; rex stays low for the same reason.
- **Flamethrower made elite.** Toughness 1 -> 1.5 and cost 1,700 -> 2,500 (infantry rating 0.94, was 1.13 at 1,700 before the toughness). Leader run (720 games): chase 55, dmitri 54, vex 54, lysandra 53, ada 53, harlan 49, ludwig 44, rex 44, hiroshi 43. Chase eased 2 points, Ludwig (who builds it) 1 lower, both within noise. Flamethrower return is still 0.20 (30% destroyed, down from 36%), so the AI gets little out of it per credit; it costs more now but lasts longer.
- **Flamethrower as an AT alternative.** Armour piercing 0 -> 0.3 (RPG and bazooka are 1) and a +5 capture bonus (`capture: { bonus: 5 }`, new). Damage to a full-HP tank 0.5 -> 2.0 HP; infantry rating 0.95 at 2,500. Leader run: chase 57, dmitri 54, vex 54, lysandra 53, ada 53, harlan 48, ludwig 45, hiroshi 43, rex 43. Flamethrower return 0.20 -> 0.26, net about even (-0.01), 27% destroyed; Chase went back up 2 points (within noise), so the flamethrower alone does not explain her lead.
- **Medic auto-heal, no AT + flamethrower, AI ignores jammers.** The medic's heal is free, automatic after every order and includes itself (`heal: { auto, self }`, no Heal order, so the AI no longer plans around it); Ludwig lost the mech (the flamethrower is his AT alternative; no leader has both); both AIs skip jammers as targets. Leader run: chase 57, dmitri 54, ada 53, lysandra 52, vex 51, harlan 49, ludwig 46, rex 45, hiroshi 43. Medic damage return is ~0 by nature; its healing is not measured by this report (a "HP healed" column would show whether the AI uses it).
- **AI uses medics.** The strategist values ending a medic's order next to wounded friends (and itself) as if it were giving a Heal order, since the medic now heals automatically after every order (`tactics.js`); mechanics still use the Heal order. New "Healing" table in the leader report (credits of HP restored per credit of healer fielded): mechanic 0.89, medic 0.28 (720 games). Leader scores unchanged within noise (chase 57 ... hiroshi 43).
