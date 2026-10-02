# Campaign design

Status: **design draft, nothing here is built yet.** This captures the campaign vision so it can be refined and then built in slices (see
[Build order](#build-order)). Names, numbers and rosters are placeholders unless marked decided.

## The pitch

A continent of rival leaders. You choose which one to fight next, in any order, like a Mega Man stage select. Beat a leader and they
**join your side**: from then on you can bring them to a mission as your commander. Every leader brings their own **production
buildings**, their own **starting units** and their own **power**, so choosing who to field is the main strategic decision of a mission.
The map also holds neutral or enemy **labs**: capturable buildings that build a different cross-section of unusual units. Defeat every
leader and you face the final boss, with one or two of your allies fighting beside you.

## Pillars

1. **Choose, don't grind.** The route through the campaign is the player's. No fixed difficulty ladder; every stage is playable from the start.
2. **Leaders are loadouts.** A leader is a bundle of rules (what each factory builds, what you start with, a power) rather than a stat
   bonus. Fielding a different leader should change how you play the same map.
3. **Capture is the progression.** You earn leaders by beating them, and units by capturing labs mid-mission. Both are "take the thing".
4. **Overlap, not hierarchy.** Several buildings and units do similar jobs in different ways (a hover carrier, a troop glider and a
   shuttle all carry soldiers), so choices are sideways, not "bigger is better".
5. **Phone first.** Short missions (10 to 20 minutes), clear one-screen choices, portraits that read at small sizes.

## The campaign loop

```
 Continent map ──► pick a stage (a leader's territory)
      ▲                    │
      │                    ▼
      │            pick YOUR leader (any ally you own, or your starter)
      │                    │
      │                    ▼
      │            mission: capture the enemy HQ (or the stage's goal)
      │                    │
      └── enemy leader joins you ◄── victory
```

- **Start.** You begin with one leader (the starter; see [Leaders](#leaders)) and every stage unlocked. One stage, the final boss, is locked.
- **Stage select.** A continent map with one territory per enemy leader, drawn so the terrain hints at the leader's theme (coast,
  mountains, desert, and so on). Selecting a stage shows the opposing leader, their kit (so you can plan a counter) and your best
  record on it.
- **Leader select.** Before each mission you pick which of your leaders to command. Every leader you own is available for every stage,
  including a stage you have already won (replayable for a better record).
- **Victory.** The defeated leader joins your roster, with their portrait, kit and power. A short scene (visual-novel layout, below)
  plays on each first victory.
- **The finale.** When every stage is cleared the boss stage unlocks. You choose your own commander **plus one or two allies** (see
  [Allies](#allies-in-the-final-battle)) and fight on a large map.

### Decided

- Stage order is free. All leaders can be fought at the start.
- A defeated leader joins you and can be chosen as your commander in later missions.
- Each leader has their own factory combination and starting units.
- Labs offer extra units when captured.
- The final boss lets the player bring one or two allies.

### Open

- Whether a stage's difficulty scales with how many leaders you already own (so late stages are not trivial), or stays fixed.
- Whether there is any persistent resource between missions (money, upgrades) or each mission starts from the leader's kit only. The
  draft assumes **none**: progression is only "which leaders do I own".

## Leaders

A leader is data. Each has:

| Part | What it is |
|---|---|
| Identity | Name, army colours, portrait traits (see the [portrait gallery](https://ajaxor.github.io/pocketwars/gallery/portraits.html)), one-liners for each dialogue situation |
| **Build sets** | For each basic building (barracks, factory, airfield, shipyard), the list of units it can produce for this leader |
| **Starting units** | The units and positions this leader begins a mission with, relative to their HQ (the map decides the exact tiles) |
| Power | One special ability, charged by fighting, used once it is full (e.g. "all units move again"). Optional for the first build |
| Flavour | Voice lines, a defeat scene, a recruit scene |

### Roster (placeholder)

Four leaders exist as portrait concepts. The other four are sketches so the build sets can be reasoned about as a set.

| Leader | Army | Theme | Notes |
|---|---|---|---|
| Cmdr. Ada Brandt | Orange Star | Fast, aggressive, infantry and light air | Natural starter: the simplest kit |
| Marshal Vex Orlov | Violet Nebula | Stealth and ambush | Stealth Lab units cheap |
| Gen. Tomas Rey | Green Earth | Heavy armour, walkers | Strongest factory, weakest air |
| Dr. Nia Kestrel | Yellow Comet | Drones, support, gadgets | Repair and supply units on tap |
| (tbd) | | Naval and amphibious: hovercraft and marines | Shipyard is the strong building |
| (tbd) | | Gliders and light air | Cheap, fast, fragile |
| (tbd) | | Deep sea: subs, mines, drones | Wins on water maps |
| (tbd) | | Orbital: space-port units | The late-game "hard" leader |

Eight enemy leaders plus the final boss is the working target. Fewer is fine for a first release (four to six, see
[Build order](#build-order)).

### Final boss

One leader who is not available to the player until beaten (they join after the credits, if at all). The boss fields something from
**every** leader's kit (a mix of building types and labs) so that no single counter-pick covers it; that is the reason the player
brings allies.

## Production buildings

Today a property has a `builds` list of unit **categories** (`data/terrain.json`), and every player shares the same list. The
campaign needs each leader to have different options from the same four building types.

| Building | Today builds | In the campaign |
|---|---|---|
| Barracks | infantry | infantry-family units; a leader's list swaps in their own infantry (e.g. Rey: mech; Vex: spy) |
| Factory | vehicle | ground vehicles; some leaders get walkers or hovercraft here instead of wheeled units |
| Airfield | aircraft (also resupplies them) | aircraft; some leaders get gliders or drones |
| Shipyard | naval, amphibious | ships and marines; some leaders get hovercraft or underwater units |

The principle is **same building, different menu**: a leader's build set for a building is a list of unit ids, and a building shows
the owner's list. This keeps the map data simple (a barracks is a barracks) while making the same map play differently per leader.

Rules to keep (from the current game): one unit built per property per turn, the new unit is `fresh` (it can only move that turn),
cost is paid up front.

### Example build sets (placeholder)

| Leader | Barracks | Factory | Airfield | Shipyard |
|---|---|---|---|---|
| Brandt | soldier, mech, sniper | recon, tank, artillery | copter, fighter, transport copter | marine, destroyer |
| Orlov | soldier, spy | recon, phantom tank | stealth copter, bomber | submarine, destroyer |
| Rey | soldier, mech | tank, heavy tank, strider, flak | copter | cruiser, battleship |
| Kestrel | soldier, sniper | supply truck, rocket battery, tank | swarm drones, repair drone, copter | destroyer, mine layer |

The exact menus are a balance question to settle with play. The point of the table is the shape: every leader has a clear identity and
a clear weakness, and menus overlap enough that a leader can still do every job in a worse way.

## Labs

A **lab** is a special property that builds units no basic building does. They are placed by the map: neutral (capture to use) or held
by the enemy (capture to deny and use). A lab is a property like any other (income, capture points, repair), with a unit list instead of
the basic categories.

| Lab (from the concept gallery) | What it builds | Role on a map |
|---|---|---|
| Hover Lab | Hover scout, hover tank, hover carrier | Crossing water and land; fast flanks |
| Mech Factory | Strider, titan | Heavy push through rough terrain |
| Stealth Lab | Phantom tank, stealth copter, spy | Ambush, sabotage |
| Glider Field | Troop glider, scout glider | Cheap, one-way insertion and sight |
| Space Port | Drop pod, shuttle, orbital satellite | Late game; very expensive |
| Underwater Lab | Abyss sub, mine layer, torpedo drone | Sea control |
| Drone Bay | Swarm drones, repair drone | Harassment and support |

(The units and their ideas are in the experimental section of the [unit gallery](https://ajaxor.github.io/pocketwars/gallery/#concepts).)

Rules:

- A lab's menu is **the same for every leader**, so a lab is a clear reason to go capture it, and a lab that is already yours on a map
  is a clear reason to guard it.
- Placing a lab is part of **map design**, and each stage should have one or two. Stage themes decide which: a coastal leader's map has
  an Underwater Lab and a Hover Lab, a mountain leader's has a Mech Factory.
- Possibly: a leader gets a **discount** on the lab that matches their theme. (Open.)

## Allies in the final battle

Before the boss mission the player chooses a commander plus **one or two allies** (the cap is a design knob).

Open questions that decide how this plays, with the leaning:

| Question | Leaning |
|---|---|
| Does an ally own separate HQ and buildings, or do they share yours? | **Shared army**: allies add their build menus to your properties and their starting units to your side. Easy to understand on a phone |
| Who controls the ally's units? | The player. Allies are not separate AI players |
| Does an ally add a power? | Yes: powers stack, each ally's power is an extra button |
| How does an ally change the buildings? | Each building's menu becomes the **union** of the commander's and the allies' lists for that building |
| Does choosing two allies make the boss trivial? | The boss is tuned for the maximum number of allies; picking fewer is a harder, optional challenge |

If shared armies turn out to be confusing, the fallback is that each ally commands their own colour and their own properties (a team
game), at the cost of more UI.

## Dialogue and portraits

Decided direction: the **flat bust portrait in the visual-novel layout** (large cut-outs at the screen edges, the speaker lit and the
listener dimmed, a slim text box). See the [portrait gallery](https://ajaxor.github.io/pocketwars/gallery/portraits.html).

Scenes to write per leader:

- Mission intro (a short exchange between your commander and the enemy leader)
- Mid-mission triggers (first capture, losing the HQ, low health on the commander): short lines, probably the "chatter chip"
- Defeat and recruitment (the enemy leader joins you)
- Final battle (a scene for each possible ally)

Dialogue lines are data (speaker, expression, text), kept next to the leader.

## Systems this needs

These are the engine and UI changes, in the repo's own terms. None exist yet.

1. **Leaders** in `data/leaders.json`: id, faction, portrait traits, build sets per building, starting units, power, lines. A
   `leaders` section in the registry and validation in `src/data/validate.js`.
2. **Per-player build menus.** `buildProblem` (`src/engine/economy.js`) currently asks `property.builds.includes(def.category)`. It
   should ask the player's leader for the building's unit list instead. A building would carry a *kind* (barracks, factory, airfield,
   shipyard), not a category list, and the leader maps kind to units. The AI's `data/ai.json` build rules would become per leader.
3. **Labs as properties** with their own unit list, owned by the map (`terrain.json` property `builds` already supports a list of
   categories; labs can name specific units).
4. **Missions as data**: a map plus the opposing leader plus conditions (default: capture the HQ). `data/maps/*.map.json` already
   encodes players and units; a mission would bind a leader to a player slot so the leader's starting units and build menu apply.
5. **Campaign state and saving**: which leaders are owned, which stages are cleared, records. A small JSON in local storage.
6. **UI**: continent map (stage select), leader select, the dialogue layer, a recruit screen. The existing `Hud`/`kit` windows can
   host most of it.
7. **Powers** (can be deferred; it is the least certain part): a charge meter fed by combat, and an action in the controller that the
   engine resolves as events like any other order.

## Build order

A suggested path that always leaves the game playable:

1. **Leaders as data, one mission.** `leaders.json`, per-leader build sets, per-leader starting units, a leader picker before a skirmish.
   (Proves the central idea and reuses today's maps.)
2. **Campaign shell.** Stage select (a list first, a map later), leader select, a campaign state with owned leaders, and the recruit-on-victory step.
3. **Labs.** Add 2 labs from the concept gallery (for example the Hover Lab and the Mech Factory), their units, and a map or two that uses them.
4. **Dialogue.** The visual-novel layer, with intro and recruit scenes for the first leaders.
5. **More leaders and stages**, one per theme, until the roster is complete.
6. **Final boss and allies.**
7. **Powers**, if they still look necessary.

## Risks and open questions

- **Balance** grows with every leader × stage pairing. Mitigation: keep leaders close to a baseline kit, and give each a clear weak
  spot, not an overall bonus. A small headless AI-vs-AI test across leader pairs can flag outliers.
- **AI** has to play every leader's menu well enough. Today it picks from `data/ai.json` build lists; per-leader lists are the minimum.
  Labs and the new unit mechanics (stealth, deploy, gliders) all need AI support; the plan is "uses every unit sensibly", not "plays well".
- **Content volume**: eight leaders, eight to ten maps, a script for each. The roster can ship in slices (see the build order).
- **New mechanics in the concept units** (cloaking, mines, orbital strikes, a new air layer) are real engine work. Pick labs for the
  first slices whose units need the least new engine (hover, mech, drone) before the ones that need new rules (space port, stealth).
- **Difficulty without a ladder** (free stage order): decide whether to scale enemies by progress or by the leader chosen.
- **Allies**: shared army vs separate colours (see above).
- **Save data** and a "new game" option need a decision before the first release of the campaign.
