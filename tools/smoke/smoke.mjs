// Browser smoke tests: drive the real game in headless Chromium at a phone and a desktop size and check that the screens come up,
// nothing throws, nothing overflows sideways, and a whole battle round (the human's end turn, the computer's turn, back) completes.
// Screenshots go to tools/smoke/out/ (git-ignored). Not part of the game build and not run by `npm test`.
//
//   cd tools/smoke && npm install        once
//   npx playwright-core install chromium  once, unless a Chromium is already installed (set CHROMIUM=/path/to/chrome to point at one)
//   node tools/smoke/smoke.mjs            from the repo root (or `npm run smoke` here); exits 1 when a check fails
//   options: --only title,skirmish   run some of the checks    --sizes phone,desktop

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const only = opt('only')?.split(',') ?? null;
const SIZES = { phone: { width: 390, height: 844, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, desktop: { width: 1440, height: 900 } };
const sizes = (opt('sizes')?.split(',') ?? Object.keys(SIZES)).filter((s) => SIZES[s]);

// ---- the dev server -----------------------------------------------------------------------------------------------------------
const PORT = 8700 + Math.floor(Math.random() * 200);
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const BASE = `http://localhost:${PORT}/`;
const up = async () => { for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 100)); } throw new Error('dev server did not start'); };

// ---- bookkeeping --------------------------------------------------------------------------------------------------------------
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); };

async function session(browser, size, run) {
  const context = await browser.newContext({ viewport: { width: SIZES[size].width, height: SIZES[size].height }, ...SIZES[size] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // a bad response is named by its address; the dev server has no version.json (the shell falls back to the repo root), so that 404 is expected
  page.on('response', (r) => { if (r.status() >= 400 && !/version\.json|favicon/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  try { await run(page, errors); } catch (e) { check(`${size}: ${run.name} finished`, false, String(e.message || e).split('\n')[0]); }
  await context.close();
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });
const btn = (page, label) => page.locator('button', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
const openTitle = async (page, hooks = false) => { await page.goto(BASE + (hooks ? '?smoke' : '')); await page.waitForSelector('.title-skirmish:not([disabled])', { timeout: 20000 }); };

// ---- the checks ---------------------------------------------------------------------------------------------------------------
async function title(page, errors, size) {
  await openTitle(page);
  check(`${size}: title screen loads with Campaign, Skirmish and the editor enabled`, (await page.locator('.title-campaign:not([disabled]), .title-skirmish:not([disabled]), .title-editor:not([disabled])').count()) === 3);
  check(`${size}: title screen has no sideways scroll`, await noOverflow(page));
  await shot(page, `${size}-title`);
  check(`${size}: title screen threw nothing`, errors.length === 0, errors.join(' | '));
}

async function galleries(page, errors, size) {
  for (const path of ['gallery/', 'gallery/terrain.html']) {
    await page.goto(BASE + path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    check(`${size}: ${path} loads and has drawn something`, (await page.locator('canvas').count()) > 0);
    await shot(page, `${size}-${path.replace(/\W+/g, '-')}`);
  }
  check(`${size}: the galleries threw nothing`, errors.length === 0, errors.join(' | '));
}

async function skirmishPages(page, errors, size) {
  await openTitle(page);
  await page.click('.title-skirmish');
  await page.waitForSelector('.sk');
  const steps = [];
  for (let i = 0; i < 3; i++) {
    steps.push(await noOverflow(page));
    await shot(page, `${size}-skirmish-step${i + 1}`);
    if (i < 2) await btn(page, 'Next').click();
  }
  check(`${size}: the three skirmish steps have no sideways scroll`, steps.every(Boolean));
  await btn(page, 'Back').click(); await btn(page, 'Back').click(); await btn(page, 'Back').click();
  await page.waitForSelector('.sk', { state: 'detached' });
  check(`${size}: Back from the first step returns to the title screen`, await page.locator('.title-skirmish').isVisible());
  check(`${size}: the skirmish pages threw nothing`, errors.length === 0, errors.join(' | '));
}

/** Start a skirmish on the map whose card carries `mapName` (default: the first). */
async function startSkirmish(page, mapName = null) {
  await openTitle(page, true);
  await page.click('.title-skirmish');
  await page.waitForSelector('.sk');
  if (mapName) await page.locator('.sk-map', { hasText: mapName }).first().click();
  await btn(page, 'Next').click(); await btn(page, 'Next').click();
  await btn(page, 'Start battle').click();
  await page.waitForSelector('.title', { state: 'detached' });
}

/** The human ends the turn (a second tap confirms when units are unmoved), the computer plays its turn, and it is the human's again on the next day. */
async function oneRound(page) {
  const day = async () => Number(((await page.locator('text=/^Day \\d+$/').first().textContent()) || '').replace(/\D/g, ''));
  const was = await day();
  const end = page.locator('button', { hasText: /^\s*End\s*turn\s*$/ }).first();
  await end.click();
  await page.waitForTimeout(350);
  if (await page.locator('text=Tap again to end turn').count()) await end.click();   // "Are you sure?"
  // the computer's turn: the day moves on when play comes back to the first player. A press on the screen fast-forwards it.
  await page.waitForFunction((d) => [...document.querySelectorAll('*')].some((e) => e.children.length === 0 && e.textContent.trim() === `Day ${d + 1}`), was, { timeout: 150000 });
  await page.waitForFunction(() => {
    const end = [...document.querySelectorAll('button')].find((b) => /^\s*End\s*turn\s*$/.test(b.textContent));
    return end && !end.disabled && !document.querySelector('.cm:not(.cm--hidden)');
  }, null, { timeout: 30000 });
  return { from: was, to: await day() };
}

async function battle(page, errors, size) {
  await startSkirmish(page);
  // the leaders speak before the first move: a card with a portrait, text and the hint to tap (Session wiring of the opening)
  const card = await page.waitForSelector('.cm:not(.cm--hidden)', { timeout: 15000 }).then(() => true, () => false);
  check(`${size}: the opening dialogue card appears`, card);
  if (card) await shot(page, `${size}-battle-opening-card`);
  await page.waitForFunction(() => window.__pocketwars?.ready(), null, { timeout: 30000 });   // the opening cards and reinforcements
  await shot(page, `${size}-battle-start`);
  check(`${size}: the board is drawn and the HUD is up`, (await page.locator('canvas#c').isVisible()) && (await page.locator('text=End turn').count()) > 0);
  const r = await oneRound(page);
  await shot(page, `${size}-battle-after-round`);
  check(`${size}: a full round (end turn, the computer plays, back to the human) completes`, r.to === r.from + 1, `day ${r.from} to ${r.to}`);
  check(`${size}: the battle threw nothing`, errors.length === 0, errors.join(' | '));
}

async function fogBattle(page, errors, size) {
  // a map with jammers (fog on by default): the computer's turn is shown through the fog (Session#visibleTo / #playAiStep)
  await startSkirmish(page, 'Whiteout');
  await page.waitForFunction(() => window.__pocketwars?.ready(), null, { timeout: 30000 });
  const r = await oneRound(page);
  await shot(page, `${size}-fog-after-round`);
  check(`${size}: a fogged battle plays a full round`, r.to === r.from + 1, `day ${r.from} to ${r.to}`);
  check(`${size}: the fogged battle threw nothing`, errors.length === 0, errors.join(' | '));
}

async function tapFactory(page, errors, size) {
  // a tap on a property that builds opens the build row, and the click that follows the touch must not choose from it (ghost-click guard)
  await startSkirmish(page);
  await page.waitForFunction(() => window.__pocketwars?.ready(), null, { timeout: 30000 });   // the opening is over
  if (!(await page.evaluate(() => !!window.__pocketwars))) { check(`${size}: the smoke hooks are present`, false); return; }
  const before = await page.evaluate(() => window.__pocketwars.unitCount());
  await page.evaluate(() => window.__pocketwars.showBuilding('factory'));
  await page.waitForTimeout(1200);   // the camera glides there
  const at = await page.evaluate(() => window.__pocketwars.buildingSpot('factory'));
  const tap = (p) => (SIZES[size].hasTouch ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
  await tap(at);
  await page.waitForTimeout(500);
  await shot(page, `${size}-factory-tap`);
  check(`${size}: tapping a factory opens the build menu`, (await btn(page, 'Close').count()) > 0 && (await page.locator('text=Factory').count()) > 0);
  check(`${size}: the tap that opened it did not also buy something`, (await page.evaluate(() => window.__pocketwars.unitCount())) === before);
  check(`${size}: the factory tap threw nothing`, errors.length === 0, errors.join(' | '));
}

async function editor(page, errors, size) {
  await openTitle(page);
  await page.click('.title-editor');
  await page.waitForSelector('.ed-head');
  check(`${size}: the map editor opens with no sideways scroll`, await noOverflow(page));
  await shot(page, `${size}-editor`);
  await page.locator('.ed-back').click();
  await page.waitForSelector('.ed-head', { state: 'detached' });
  check(`${size}: Back from the editor returns to the title screen`, await page.locator('.title-skirmish').isVisible());
  check(`${size}: the editor threw nothing`, errors.length === 0, errors.join(' | '));
}

async function editorPaint(page, errors, size) {
  // drawing really works: pick a palette item, tap the board, Undo lights up; Undo puts the board back and Redo brings the change again
  await openTitle(page);
  await page.click('.title-editor');
  await page.waitForSelector('.ed-head');
  await page.waitForTimeout(600);   // the camera fits the board
  const undo = page.locator('button', { hasText: /^\s*Undo\s*$/ }).first();
  const redo = page.locator('button', { hasText: /^\s*Redo\s*$/ }).first();
  const items = page.locator('.ed-item');
  check(`${size}: the editor palette lists things to paint`, (await items.count()) > 3);
  await items.nth(3).click();
  const box = await page.locator('canvas.ed-canvas').boundingBox();
  const tap = (p) => (SIZES[size].hasTouch ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
  check(`${size}: nothing to undo before the first stroke`, await undo.isDisabled());
  await tap({ x: box.x + box.width * .5, y: box.y + box.height * .5 });
  await page.waitForTimeout(300);
  check(`${size}: a tap on the board paints (Undo is available)`, await undo.isEnabled());
  await shot(page, `${size}-editor-painted`);
  await undo.click();
  check(`${size}: Undo takes the stroke back, Redo is then available`, (await undo.isDisabled()) && (await redo.isEnabled()));
  check(`${size}: editor painting threw nothing`, errors.length === 0, errors.join(' | '));
}

async function campaign(page, errors, size) {
  await openTitle(page);
  await page.click('.title-campaign');
  await page.waitForSelector('.cine, .wm', { timeout: 10000 });
  await page.waitForTimeout(800);
  await shot(page, `${size}-campaign-intro`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.wm', { timeout: 10000 });
  await page.waitForTimeout(500);
  await shot(page, `${size}-campaign-map`);
  check(`${size}: the campaign intro skips to the world map`, await page.locator('.wm').isVisible());
  check(`${size}: the world map has no sideways scroll`, await noOverflow(page));
  check(`${size}: the campaign threw nothing`, errors.length === 0, errors.join(' | '));
}

const CHECKS = { title, galleries, skirmishPages, editor, editorPaint, campaign, battle, fogBattle, tapFactory };

// ---- run ----------------------------------------------------------------------------------------------------------------------
try {
  await up();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  for (const size of sizes) {
    for (const [name, fn] of Object.entries(CHECKS)) {
      if (only && !only.includes(name)) continue;
      await session(browser, size, async function run(page, errors) { await fn(page, errors, size); });
    }
  }
  await browser.close();
} finally {
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed; screenshots in tools/smoke/out/`);
process.exit(failed.length ? 1 : 0);
