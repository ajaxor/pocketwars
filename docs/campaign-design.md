# Campaign design

Status: **design draft, nothing here is built yet.** This captures the campaign vision so it can be refined and then built in slices (see
[Build order](#build-order)). Names, numbers and rosters are placeholders unless marked decided.

## The pitch

A continent of nations, each held by a leader the Chorus has assimilated (see [Story](#story)). You choose which one to fight next, in
any order, like a Mega Man stage select. Beat a leader and they are freed and **join your side**: from then on you can bring them to a mission as your commander. Every leader brings their own **production
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

## Story

Status: **decided direction: the Chorus seduces with technology ("the Gift"). Nation names are decided; leader names are still working names.** The idea: a villain is taking over a continent that is divided into nations, and
**every** nation is assimilated. The player is one grizzled old veteran on an island the signal never reached, who decides to fight back.

### Premise

- The continent is a patchwork of nations, each led by one of the leaders (the same leaders the player can later field).
- A new power, placeholder name **the Chorus** (an alien collective that presents as a human conqueror, see below), arrives and takes the nations one at a time. A conquered nation is **assimilated**: its
  leader is taken over (a visor, cold eyes, a new uniform in the Chorus colours), its army is re-equipped with Chorus tech, and its
  people march as one.
- **All eight nations fall, with no exceptions.** The player is not a nation's leader: they are **Col. Harlan**, a retired veteran who lives alone on
  **Lastholm**, a small island off the coast. The intro shows the continent going dark nation by nation until only his island's light is
  left, and a grumbling decision to take it all back.
- Every stage on the continent map is a nation to **liberate**. This is why the stages can be fought in any order: the Chorus holds all
  of them, and the player picks where to strike first.

### The Gift (decided)

The Chorus does not invade. It **arrives with presents**, in the manner of XCOM's aliens in reverse: the first contact is a broadcast to every
capital offering a **Lattice node**, technology far beyond anything on the continent, free, "only try it". The story keeps the Gift
**general on purpose**: it is whatever each nation wants most, and what that means in play (each faction's technology) is decided by the
faction's own tech tree, which is richer than one theme per nation.

1. **First contact.** The Envoy's signal lands near Solace, the richest and most curious nation, then reaches every capital.
2. **The Gift.** Every nation is offered what it wants most. Nobody is told what the others were given.
3. **Dependence.** Within a year the nation's factories, supply and defence run on Lattice. Its best equipment only works on Chorus tech.
4. **The turn.** The last step is plugging the army into the shared network. Leaders who connect are **assimilated**: harmonised, not killed.
5. **Every nation says yes**, Ashmark included. Ada, tired of a lifetime of making do, grabbed it with both hands.
6. **The one that was never plugged in.** Col. Harlan, retired, lives alone on Lastholm with a radio, a workshop and a long memory. The
   signal never reached his rock, and he would not have taken it anyway: he has heard "it's free" before. He is the only person with a
   free army, and the army is a handful of volunteers and a lot of scrap, which is exactly why the Chorus cannot switch it off.

What this gives the design:
- **Labs are Gift sites.** Capturing one lets you reverse-engineer Chorus-derived units (the XCOM loop).
- **Freed leaders recover their tech** with the Chorus control stripped out.
- **A mid-campaign worry:** anything running Gift tech might still be listening. Room for a "purge" mechanic later.
- **The final act** shows the Chorus's own units, which the Gift was only ever a pale copy of.

### Why this fits the design

- **"Defeated leaders join you" becomes liberation.** Beating an assimilated leader breaks the hold: the portrait changes back to
  the leader's real face, they say what it was like, and they join your side. The recruit scene has an emotional beat for free.
- **A reason for the leader roster to be different from you.** Each leader's kit is their nation's identity (coast, mountains, desert
  and so on), and the Chorus has bent that kit with its own tech while it held them.
- **A reason for labs.** Labs are either neutral research sites a free nation built, or Chorus facilities that make assimilated units.
  Capturing one is liberating it.
- **A reason for allies in the finale.** The boss is the Chorus's core; the allies you bring are the nations that have most to
  settle with it.

### Portraits: two looks per leader

Each leader has a **free** portrait and an **assimilated** one. The portrait art is already one parametric bust driven by traits
(`gallery/portrait-art.js`), so the assimilated look is an overlay on the same face, not a second drawing:

| Part | Free | Assimilated |
|---|---|---|
| Palette | army colours | desaturated, with the Chorus accent colour |
| Eyes | normal | glowing, no highlights |
| Head | normal hat or hair | a visor or a circuit-lined cap over it |
| Expression | the leader's own | locked flat; they never smile |
| Uniform | the leader's own | the same cut in grey with the Chorus emblem |

The unit art for an assimilated army gets the same treatment: the army's sprites with a Chorus tint and a small emblem, so a mission
against an assimilated leader reads on the map at a glance. Units regain their colours when the nation is freed.

### Structure (three acts)

1. **The fall (intro).** A short sequence on the continent map: nations fall one by one, each shown as a portrait switching to its
   assimilated version. Only Lastholm's light stays on. Ends on Harlan's decision to fight back.
2. **The liberation (the stage select).** Free order, with hints that the Envoy's gifts are not what they seem. Each stage opens with a short exchange between the player's chosen commander
   and the assimilated leader. After the win, a liberation scene plays: the portrait reverts, the leader joins you and may comment on
   whoever else is still held. As the roster of free leaders grows, the continent map recovers its colours.
3. **The core (the final boss).** The Chorus's capital, in two phases: the Envoy's fortress, then the reveal and the alien army. The
   player picks one or two allies; scenes vary with who is chosen.

### Tone

Bright, readable and PG: assimilation is mind control, nobody dies on screen, and the freed leaders are shaken but recover. The sci-fi
horror is in the portraits and the continent map, not in the dialogue. Think of the Chorus as an unsettling, polite, unified voice:
its units and leaders say the same line together.

### The villain (decided)

The Chorus is an **alien collective** that arrived from orbit. It does not show its true form: it speaks and appears through a **human
avatar**, a calm, polite figure that stands in for it in every scene (the intro, the pre-mission exchanges, the recruit scenes). The
leaders and the player believe they are fighting a human conqueror with advanced technology.

- **The avatar** is a character in its own right: a human face (placeholder name: **the Envoy**) with the same portrait system as the
  leaders. It is calm, courteous, never raises its voice, and says what the Chorus says in the first person plural.
- **Assimilation is alien technology** disguised as the Envoy's gift: the visors and caps that take over a leader come from the same
  source. The player slowly learns this from the liberated leaders (a clue in each recruit scene).
- **The reveal** comes in the final battle (below). Until then, every enemy unit is a recognisable unit with a Chorus tint.

### The final battle: the true nature

The last stage is the Chorus's capital, fought in two phases:

1. **The Envoy's fortress.** The map the player expects: the Envoy's avatar commands an assimilated army with units and labs from every
   nation it has taken. Taking the HQ ends this phase.
2. **The reveal.** The avatar breaks: the human face fails and the Chorus's true form appears (a cutscene in the visual-novel layout with
   the avatar's portrait glitching into something else). The map changes: the HQ opens, **alien units** arrive from the landing site,
   and the real fight starts. The player's allies react to what they see.

The alien units appear **only here**, so they can be much stranger than the human units and need no balance against the rest of the roster.
They are placeholders for the sprite lab to explore:

| Alien unit | Idea |
|---|---|
| Drone swarm carrier | A hive that releases small fliers each turn |
| Spore mortar | Slow indirect fire that leaves a lingering damaging cloud on a tile |
| Walker | A tall tripod that steps over everything and shoots from 2 tiles up |
| Husk | Cheap infantry that spawns where an assimilated unit dies |
| Phase skimmer | A fast flier that ignores terrain and line of sight |
| Brood cruiser | A large air or ground ship that carries and deploys other alien units |
| Warden | A heavy defender that shields adjacent units from the first hit each turn |
| The core | The real final target: a stationary structure, not a unit (capture or destroy to win) |

The win condition of phase 2 is open: capture and hold the landing site, or destroy the core (see the questions below).

### Open story questions

- Is the player a named leader (for example Brandt, the simple starter) or a custom commander? A named one gives sharper dialogue; a
  custom one lets the player pick a face.
- Does a freed leader keep a trace of assimilation (a faint visor line) as a visual reminder of the campaign's progress?
- Does the final boss try to re-assimilate the allies mid-battle? It would be a strong boss mechanic (units or a leader's power
  turning against you), but it is real engine work, so it is a stretch goal.
- What ends phase 2: capture the landing site, destroy the core, or survive a number of turns?
- How are the phase changes built? Simplest is two maps back to back (the second with the surviving units carried over); the harder
  option is one map that changes mid-battle.
- Does the Envoy ever appear to the player directly before the end (calls, taunts), so the avatar feels like a person the player has met?
- How much of the intro is animated, and how much is a still image with text? The draft assumes stills and the visual-novel layout.

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

### Roster and personalities

The leaders and their personalities carry the story and the gameplay. Every leader has a **flaw** that explains why they accepted the Gift
(or, for Harlan, why he never did), and a **leaning** that hints at their kit. A leaning is a tendency, not a single theme: each faction's
unit and building set is richer than one line. The data lives in `data/campaign.json` (`bio`, `flaw` and portrait traits per leader, `theme` per nation); speech is in `data/speech/`.

| Leader | Nation | Personality | Flaw (why they fell) | Leaning |
|---|---|---|---|---|
| Col. Harlan (you) | Lastholm | Grumpy, anti-technology old man with get-off-my-lawn energy | Stubborn: never took the Gift | The scrappy underdog: volunteers, salvage, old machines |
| Cmdr. Ada | Ashmark | Warm, empathic, wildly optimistic farm-country ace with a cowboy hat and a country accent | Hope: sees the best in everyone, even the Chorus | Fast and aggressive infantry and light air |
| Marshal Vex | Vantor Reach | Secretive spy in a trench coat who talks in code | Pride: certain he can keep the Gift a secret | Stealth and ambush |
| Gen. Hiroshi | Ironvale | Old samurai who quotes the Art of War | Duty: the wisest victory is the one with no battle | Heavy armour |
| Dr. Ludwig | Solace | German mad scientist with wild white hair | Curiosity: cannot leave an experiment alone | Supply, repair and gadgets |
| Adm. Sasha | Tidehaven | Australian pirate admiral with an eyepatch | Greed: could not resist a treasure | Sea power and amphibious assault |
| Wing Cmdr. Chase | Skyreach | Young tech-bro flier in aviator glasses | Hype: chases whatever is newest | Light air: cheap, fast, fragile |
| Cmdr. Dmitri | Deepmere | Gloomy submariner in a fur hat with a Russian accent and a dark sense of humour | Loneliness: hungers for anyone who will listen | The deep sea: patient and hard to find |
| Sovereign Lysandra | Highspire | A haughty medieval queen (thees, thous and inventive insults) | Vanity: the best things are hers by right | Exotic late-game technology |
| The Envoy | the Chorus | Warm, patient, generous; never lies; speaks as "we" | n/a | The Chorus's human avatar and the final boss |

See `docs/characters.md` for how each one looks and talks, and `data/speech/` for what they say.

Seven opponents is the current working number; the continent (`tools/make-continent.mjs`) can be regenerated with more or fewer lands.

**Arcs once freed:** Vex is the bitter ally who knew better and gives intelligence on the Chorus; Hiroshi carries the most guilt and becomes
your shield; Ludwig is the key to reverse-engineering Gift tech and cannot stop apologising for how much he enjoyed it; Sasha is the rogue ally who
sells you things but stays loyal; Ada, the hot-headed ace, is ashamed and furious at herself, and is the first to say "I'll follow you" to the old man. What each leader says, free and assimilated, is in `data/speech/`.

Eight enemy leaders plus the final boss is the working target. Fewer is fine for a first release (four to six, see
[Build order](#build-order)).

### Final boss

The Envoy (the Chorus's human avatar), then the Chorus itself (see the [final battle](#the-final-battle-the-true-nature)). In the first
phase the boss fields something from **every** leader's kit (a mix of building types and labs) so that no single counter-pick covers it;
that is the reason the player brings allies. In the second phase it fields alien units that exist nowhere else.

## Production buildings

Today a property has a `builds` list of unit **categories** (`data/terrain.json`), and every player shares the same list. The
campaign needs each leader to have different options from the same four building types.

| Building | Today builds | In the campaign |
|---|---|---|
| Barracks | infantry | infantry-family units; a leader's list swaps in their own infantry (e.g. Takeda: mech; Vex: spy) |
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
| Takeda | soldier, mech | tank, heavy tank, strider, flak | copter | cruiser, battleship |
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
- Liberation (the enemy leader's portrait reverts to their real face and they join you)
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

## Implementation status

- **Done:** nations Ashmark, Vantor Reach, Tidehaven, Ironvale, Solace, Skyreach, Deepmere and Highspire; the Gift story in the intro (arrival, Envoy, Gift scene, the fall of all eight nations, the glide in on Lastholm, Harlan's decision); leader bios on the world-map card; Campaign button on the title screen; skippable animated intro (data/campaign.json `intro.scenes`, drawn on a canvas by `src/render/campaign-art.js`, timeline in `src/campaign/cutscene.js`); world map with a generated continent of eight assimilated nations, your free island hideout Lastholm, and a few decorative islands; assimilated portrait variant (`assim` option in `src/render/portrait-art.js`); factions Tidehaven, Skyreach, Deepmere, Highspire and Lastholm added. The continent is generated by `tools/make-continent.mjs` (re-run it after moving a capital).
- **Leaders in battle:** skirmish has a leader picker per team; loadouts (build menus + starting formations) live in `data/loadouts.json` (all kits identical for now). See `docs/leaders.md`.
- **Not yet:** missions, leaders in campaign missions, labs, allies, the final battle. The world map's mission button is a disabled placeholder.
- The intro plays every time Campaign is pressed (Skip, Esc or Enter ends it; "Replay intro" is on the map).
