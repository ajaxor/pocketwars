# Characters

How each character looks and talks. Their traits live in `data/campaign.json`; **what they say lives in `data/speech/<id>.json`**, one file
per character. The loader (`src/data/campaign.js`) requires a valid speech file for every leader, and `src/campaign/speech.js` picks lines.

## Speech files

Each file has a `voice` note (the rules for writing more lines in that voice) and, for each situation below, at least four lines. A `Talker`
gives a random line for a situation, never the same line twice in a row, and uses every line once before repeating. Verse lines are
separated by `" / "`, so a dialogue box can break the line there.

| Situation | When it is used |
|---|---|
| `greeting` | meeting someone, or opening a conversation |
| `battle_start` | the start of a battle |
| `attack` | attacking an enemy unit |
| `unit_lost` | losing one of their own units |
| `capture` | capturing a building |
| `danger` | their headquarters or army is in trouble |
| `victory` | winning a battle |
| `defeat` | losing a battle |
| `taunt` | taunting an enemy |
| `praise` | praising an ally or the player |
| `idle` | an idle remark: just who they are |
| `tech` | reacting to technology, the Chorus and the Gift |
| `joined` | joining the player after being freed (for the Envoy: welcoming someone into the Chorus) |
| `assimilated` | what they say while under the Chorus (for Harlan, who is never taken: turning down the Chorus) |

## The characters

### Col. Gus Harlan (Lastholm (you))

- **Look:** Grizzled retired colonel; olive cap, white moustache, scar.
- **Voice:** Grumpy old man, get-off-my-lawn energy, hates technology. "Back in my day", "kid", "bah", "gadgets".
- **Sample:** "Kids these days can't even fix a fence. Or a tank. Or a toaster."
- **File:** `data/speech/harlan.json`

### Cmdr. Ada Brandt (Ashmark)

- **Look:** Red-haired girl with freckles and a cowboy hat.
- **Voice:** Country accent (y'all, reckon, sugar, dropped g's). Super empathic and wildly, madly optimistic; apologises to the enemy while shooting them.
- **Sample:** "Y'know, I reckon every day's a gift. Even the ones with explosions!"
- **File:** `data/speech/ada.json`

### Marshal Vex Orlov (Vantor Reach)

- **Look:** Bald, scarred, stubbled, in a trench coat with the collar up.
- **Voice:** Secretive spy: code names, code phrases, spy jokes, "if I told you I would have to kill you".
- **Sample:** "In my line of work, even the weather is a cover story."
- **File:** `data/speech/vex.json`

### Gen. Hiroshi Takeda (Ironvale)

- **Look:** Old samurai with a topknot and a big white moustache.
- **Voice:** Formal and calm; quotes Sun Tzu's Art of War for every occasion; "Hai!".
- **Sample:** "Sun Tzu says: opportunities multiply as they are seized. I am seizing a nap."
- **File:** `data/speech/hiroshi.json`

### Dr. Ludwig Kestrel (Solace)

- **Look:** Mad scientist: wild white hair, round glasses, lab coat.
- **Voice:** German accent (ze, vill, ja, wunderbar); everything is an experiment; constant science talk.
- **Sample:** "Did you know ze entropy of ze universe always increases? So does my laundry."
- **File:** `data/speech/ludwig.json`

### Adm. Sasha Marlow (Tidehaven)

- **Look:** Eyepatch, long dark hair, white admiral's cap.
- **Voice:** Pirate talk: arr, matey, ye, plunder, rum, Davy Jones.
- **Sample:** "Never trust a sober sailor. Or a seagull. Or a map."
- **File:** `data/speech/sasha.json`

### Wing Cmdr. Chase Vale (Skyreach)

- **Look:** Young blond flier in gold aviator glasses.
- **Voice:** Tech bro: bro, disrupt, pivot, scale, ship it, runway, synergy; war is a product launch.
- **Sample:** "I'm thinking of an app. It's like Uber, but for tanks. Tankr."
- **File:** `data/speech/chase.json`

### Cmdr. Dmitri Volkov (Deepmere)

- **Look:** Stubbled submariner in a fur ushanka with a red star.
- **Voice:** Russian accent (dropped articles, da, comrade); very dark humour; old Soviet and Radio Yerevan jokes.
- **Sample:** "In Soviet Russia, dark humour tells you."
- **File:** `data/speech/dmitri.json`

### Sovereign Lysandra Thorne (Highspire)

- **Look:** Platinum-haired queen in a golden crown.
- **Voice:** Shakespearean verse: thee, thou, methinks, in rhymed couplets (lines separated by " / ").
- **Sample:** "All the world's a stage, and I the star; / The rest are merely players, near and far."
- **File:** `data/speech/lysandra.json`

### The Envoy (the Chorus)

- **Look:** Pale, white-haired, glowing eyes, a high collar.
- **Voice:** Calm, warm and polite; speaks as "we"; never lies; quietly unsettling.
- **Sample:** "We have been listening to your planet. It is very noisy. We like it."
- **File:** `data/speech/envoy.json`

## Adding or changing a character

1. Add the leader to `data/campaign.json` (`leaders`) with portrait traits, a `bio` and a `flaw`.
2. Add `data/speech/<id>.json` with a `voice` note and at least four lines for every situation. The test suite fails until all of them exist.
3. Portrait traits the art supports: `hat` (cap, helmet, headset, captain, cowboy, ushanka, crown), `hairStyle` (ponytail, bun, long, short, bald, wild, topknot), `jaw`, and flags `eyepatch`, `scar`, `tallCollar`, `stubble`, `stache`, `glasses`, `aviators`, `coat`, `trench`, `freckles`, `wide`, and `eyeStyle` (required, and no two leaders may share one): the eyes, defined in `src/render/eye-styles.js` (weary, bright, cold, serene, manic, fierce, cocky, deadpan, regal, glow). A style sets eye shape, tilt, lids, iris and pupil size, lashes, bags, eye-shadow and glints; add a new style there for a new leader. Likewise `noseStyle` (broad, button, long, hawk, pointed, roman, slim, bulb, refined, minimal), `mouthStyle` (grim, grin, thin, firm, pursed, sneer, smirk, slit, full, tiny) and `chinStyle` (block, soft, point, jut, weak, cleft, angular, double, delicate, smooth) are required and unique per leader, defined in `src/render/face-styles.js`. Portrait backdrops are dark (tinted towards the faction colour) so any skin or hair stands out.

## In battle

When a battle has leaders, each says a `battle_start` line on a card before the first move. After that a leader only speaks at **milestones**, each
of which fires once per battle (`src/campaign/commentary.js`, `MILESTONES`): an enemy starting to capture their HQ (`danger`), their first unit
lost (`unit_lost`), their first kill (`taunt`), first building captured (`capture`), first building lost (`danger`), being outnumbered two to one
(`danger`) or far ahead (`taunt`), their first attack, third kill, third loss, third capture, sixth kill, and a remark on their first turn (`idle`).
When it is over the winner has a `victory` line. After a comment a leader is quiet for a few seconds; a milestone that comes due meanwhile waits.
A line within a situation is never repeated soon (the Talker's bag).

Comments show in a banner with the leader's portrait (108 px, 20 px text): at the bottom during the computer's turn, and at the top (going away by
itself) during the player's turn. Every leader comments, the player's and the computer's. Pressing and holding the screen during the computer's turn
fast-forwards it. To add a milestone, add an entry to `MILESTONES` (and a counter in `#tally` if it needs a new count). Code:
`src/ui/commentary-banner.js`, `src/ui/pacing.js`.

