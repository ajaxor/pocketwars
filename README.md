# Pocket Wars

A turn-based tactics game that runs in your phone's browser. Build units, capture properties, and take the enemy HQ.

The game has no dependencies and no build tooling: `index.html` (loader and title screen), `style.css` and `game.js`.

## Play

Once GitHub Pages is enabled: https://ajaxor.github.io/pocketwars/

Or open `index.html` directly in any modern browser (it shows `build dev` because no commit hash is stamped locally). It is designed for touch screens, but mouse clicks work too.

## How to play

- Tap one of your units to select it, tap a highlighted tile to move, then choose Capture or Wait, or tap an enemy to attack (tap again to confirm).
- Tap a factory, barracks or airfield you own to build vehicles, infantry or aircraft.
- Infantry, Mech and Sniper units can capture properties. Capturing takes 20 capture points, and each turn adds the unit's current HP.
- Units on owned properties heal each turn, and each property earns funds.
- Win by capturing the enemy HQ or by destroying all enemy units when they cannot rebuild.
- Undo reverts your last move, and it is cleared when you end your turn.

## Units

| Group | Units |
|-------|-------|
| Infantry (Barracks) | Infantry, Mech, Sniper |
| Vehicles (Factory) | Recon, Tank, Heavy Tank, Artillery, Flak |
| Aircraft (Airfield) | Copter, Fighter, Bomber |

Fighters and Bombers are high air units, so only Flak and Fighters can hit them. Artillery cannot hit copters.

## Hosting and versioning

Deploys run through GitHub Actions (`.github/workflows/pages.yml`) on every push to `main`.

One-time setup: Settings, then Pages, then Build and deployment, then Source: **GitHub Actions**.

On each deploy the workflow copies the game files into a `_site` folder, writes `version.json` with the short commit hash and build time, and stamps the hash into `index.html`. The title screen shows that hash as `build abc1234`.

Cache busting: the page fetches `version.json` with `no-store` on every load and loads `style.css` and `game.js` with `?v=<hash>`, so a reload after a deploy gets the new code even if the browser cached the old files. If the cached `index.html` itself is stale, it jumps once to `?v=<hash>` to fetch a fresh copy. Coming back to the title screen after a new deploy shows an update button.

## Development notes

- `game.js` holds the game data, rules, AI and rendering. `style.css` holds the game UI styles. The title screen and loader live in `index.html`.
- To test locally, serve the folder (for example `python3 -m http.server`) and open it. With no `version.json`, the loader falls back to a timestamp so you always get your latest edits.
- The undo feature must be removed if fog of war is ever added, because undoing a move would give free scouting.
