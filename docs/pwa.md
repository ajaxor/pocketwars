# Installing on a phone (PWA)

Pocket Wars is a progressive web app: it installs to the home screen, opens full screen with no browser bars, and plays offline.
Nothing is built or submitted to a store; GitHub Pages serves it and the phone installs it from the page.

## For players

- **iPhone / iPad:** open https://ajaxor.github.io/pocketwars/ in **Safari** (other iOS browsers also work on iOS 16.4 and later via Share → Add to Home Screen), tap Share, choose **Add to Home Screen**, then Add.
- **Android:** open the page in Chrome, then use the menu → **Install app** (or Add to Home screen). Chrome may also offer an install prompt by itself.
- Open the game once while online and let the title screen show **Ready**: that downloads the whole build (about 1.6 MB), after which it plays with no connection.
- An installed copy keeps its own storage on iOS, so **My maps** and the AI's memory of your play made in Safari do not appear in it (and the other way round). Use the editor's download or copy to move a map across.

## How it works

| File | What it does |
|---|---|
| `manifest.webmanifest` | name, colours, `display: standalone`, the icons (including a maskable one for Android) |
| `icons/` | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and the iPhone's `apple-touch-icon.png` (180 px, a full square: iOS rounds it). Drawn by `python3 tools/make-icons.py` (needs Pillow); the PNGs are committed |
| `index.html` | links the manifest and touch icon, and registers `sw.js` once the page has loaded. It does **not** register it in a local checkout (when the build stamp is still `__BUILD__`), so development never sees cached files |
| `sw.js` | the service worker (below) |
| `tools/build-file-list.mjs` | run by the deploy: writes `v/<hash>/files.json`, the list of every file in the build (galleries left out) |

The deploy (`.github/workflows/pages.yml`) already publishes each build under `v/<hash>/` and a tiny `version.json` naming the current one.
The service worker follows that scheme:

- **Shell** (`index.html`, `version.json`): network first, so a reload always finds a new deploy; the last copy is used offline.
- **Build files** (`v/<hash>/...`): cache first. A build never changes, so a hit is always right.
- **Background download:** whenever `version.json` names a build, the worker fetches everything in that build's `files.json`.
  That is what makes the first offline launch work even though the game's modules loaded before the worker took control.
- **Clean-up:** the two newest builds are kept; older ones are deleted. The stamped `sw.js` differs on every deploy, so phones install the new worker (`skipWaiting` and `clients.claim`) and drop the old shell cache.
- Everything else (the galleries, anything outside the scope) goes to the network untouched.

Updates reach an installed copy the way they reach a browser tab:

- **Launching the app** (a cold start, with a connection): the shell asks for `version.json` fresh, finds the newest build and loads it, so you are always on the latest game. Offline, you get the last build the phone downloaded.
- **Coming back to an app that was only suspended** (iOS keeps it in memory): nothing reloads by itself. If you are on the title screen, the launcher checks for a newer deploy and shows the update button (`src/launcher.js`); tapping it reloads onto the new build. A battle in progress is never interrupted.

## Filling the screen

The map canvas is sized from `src/render/viewport.js`, not `innerHeight`. In an installed iPhone app (translucent status bar, `viewport-fit=cover`) `innerHeight` can leave out the home-indicator strip while the page itself still fills the screen, which left a band at the bottom. The helper measures an invisible `position: fixed; inset: 0` box instead (the same box the page is laid out in) and falls back to `innerWidth` / `innerHeight` without a DOM. `watchViewport` refits on resize, rotation, returning to the app (`pageshow`) and any change of that box. Floating windows keep clear of the home indicator with `--safe-b` (`env(safe-area-inset-bottom)`).

That alone did not cure the bar (a white strip along the bottom of the installed app), which had two causes in `style.css`:

- **No solid root colour.** `style.css` replaced the shell's solid background with a gradient, and iOS paints the area outside the page (the home-indicator strip) with the root's solid `background-color`, falling back to white for a gradient alone. `html, body` now also set `background-color: var(--bg)`.
- **Layers shorter than the screen.** In an installed app the page box (`100%`, `inset: 0`) can be shorter than the screen. Every full-screen layer (`body`, the canvas, `#ui`, the title, skirmish, intro, world-map and editor screens) is sized by `height: var(--fill-h)`: `100%` in a browser tab, `100vh` (the whole screen) when installed (`display-mode: standalone`, or the `standalone` class the shell sets from `navigator.standalone`). The viewport probe uses the same variable.

An installed app's title screen shows `app WxH of WxH` after the build number (the window against the screen), so a window that stops short can be read off the phone.

## Testing

- `tests/pwa/pwa.test.js` checks the manifest and icon sizes, the shell's links, the deploy steps, the file list and the worker's rules against an in-memory Cache API (network first, cache first, the background download, offline fallback, keeping two builds).
- Real-device check after a deploy: open the page, wait for **Ready**, switch on airplane mode, relaunch from the home screen. Chrome's DevTools → Application → Manifest / Service Workers shows what the browser thinks.
- Locally, `npm start` serves without the worker. To try it, build a stamped copy as the workflow does (`sed` the placeholder in `index.html` and `sw.js`, run `tools/build-file-list.mjs` on the build folder) and serve that over `localhost`.
