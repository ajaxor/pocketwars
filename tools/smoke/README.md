# Browser smoke tests

Drives the real game in headless Chromium at a phone size (390x844, touch) and a desktop size (1440x900) and checks that the screens come
up, nothing throws or 404s, nothing scrolls sideways, and a whole battle round plays (the human ends the turn, the computer plays, the next
day starts), on an ordinary map and on a fogged one. It also taps a factory with a touch event and checks that the build menu stays open
(the ghost-click guard) and that the opening dialogue card appears. Screenshots go to `tools/smoke/out/` (git-ignored) so a layout can be
looked at as well as measured.

```
cd tools/smoke && npm install          # once: installs playwright-core
npx playwright-core install chromium   # once, unless a Chromium is already installed (or set CHROMIUM=/path/to/chrome)
npm run smoke                          # from the repo root; exits 1 when a check fails
npm run smoke -- --only battle,tapFactory --sizes phone
```

Checks: `title`, `galleries`, `skirmishPages`, `editor`, `campaign`, `battle`, `fogBattle`, `tapFactory`.

The game exposes a few hooks (`window.__pocketwars`, see the end of `src/main.js`) only when the page is opened with `?smoke`; a normal
game exposes nothing. It is not part of `npm test` or the deploy workflow (it needs a browser), so run it by hand after changing the
menus, the session wiring, touch handling or layout.
