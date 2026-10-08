// The title screen: a full-screen overlay with the logo, a progress bar and one column of equally wide buttons, over a battlefield that
// drifts diagonally behind it (src/render/menu-backdrop.js).
// This is only the view: it builds its DOM and exposes the states below. The launcher (src/launcher.js) decides when each
// state happens. Its styles are the `.title*` rules in style.css; the buttons are the shared `.btn` kit.
//
//   setProgress(pct, text)   progress bar and status line
//   setVersion(text)         small build label at the bottom
//   setReady()               the game has loaded: the buttons below are enabled by their own setters and the progress bar fades away
//   setSkirmish(enabled)     turn the Skirmish button on or off (it needs the game's maps, so it waits for the load)
//   setCampaign(enabled)     turn the Campaign button on or off (it needs the campaign data, so it waits for the load)
//   setEditor(enabled)       the same for the Map editor
//   setFailed(message)       loading failed: the menu is disabled and a Retry button appears
//   showBackdrop(registry)   start the scrolling battlefield behind the menu (it needs the game's data, so it waits for the load)
//   coverBackdrop(on)        another page sits on top of the menu: drop the battlefield (and its memory); when uncovered, a new one is made
//   showUpdate(onClick)      show the "new version available" button
//   remove()                 take the overlay away (the game is underneath)
//   onSkirmish / onCampaign / onEditor / onRetry   called when those buttons are pressed; set by the launcher

import { MenuBackdrop } from '../render/menu-backdrop.js';

export class TitleScreen {
  /**
   * @param {Document} doc
   * @param {{links?: {label:string, href:string}[]}} [opts]  extra buttons under the main ones (the galleries)
   */
  constructor(doc, { links = [] } = {}) {
    const h = (tag, cls, text) => {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    this.doc = doc;
    this.ready = false;
    this.backdrop = null;
    this.covered = false;
    this.backdropArgs = null;
    this.onSkirmish = () => {};
    this.onCampaign = () => {};
    this.onEditor = () => {};
    this.onRetry = () => {};
    this.onUpdate = () => {};

    const progress = h('div', 'title-prog');
    this.fill = h('div', 'title-fill'); progress.append(this.fill);
    this.status = h('div', 'title-status', 'Starting...');
    this.campaign = h('button', 'btn btn--primary btn--lg title-campaign', 'Campaign'); this.campaign.disabled = true;
    this.campaign.addEventListener('click', () => this.onCampaign());
    this.skirmish = h('button', 'btn btn--lg title-skirmish', 'Skirmish'); this.skirmish.disabled = true;
    this.skirmish.addEventListener('click', () => this.onSkirmish());
    this.editor = h('button', 'btn btn--lg title-editor', 'Map editor'); this.editor.disabled = true;
    this.editor.addEventListener('click', () => this.onEditor());
    this.links = h('nav', 'title-links');
    for (const { label, href } of links) { const a = h('a', 'btn btn--ghost', label); a.setAttribute('href', href); this.links.append(a); }
    this.retry = h('button', 'btn btn--primary btn--lg title-retry', 'Retry'); this.retry.hidden = true;
    this.retry.addEventListener('click', () => this.onRetry());
    this.upd = h('button', 'btn btn--sm title-upd', 'New version available - tap to update'); this.upd.hidden = true;
    this.upd.addEventListener('click', () => this.onUpdate());
    this.ver = h('div', 'title-ver');

    const loading = this.loading = h('div', 'title-loading');   // the progress bar and its status line travel together
    loading.append(progress, this.status);

    const menu = h('div', 'title-menu');                         // every button in it is as wide as the column
    menu.append(this.campaign, this.skirmish, this.editor, this.links, this.retry);
    const logo = h('h1', 'title-logo');
    logo.append(h('span', 'logo-top', 'Pocket'), h('span', 'logo-main', 'Wars'));
    const head = h('div', 'title-head'); head.append(logo, loading);
    const foot = h('div', 'title-foot'); foot.append(this.upd, this.ver);
    const body = h('div', 'title-body');
    body.append(head, menu, foot);

    this.bg = h('div', 'title-bg-slot');                         // the battlefield's canvas goes here
    this.root = h('div', 'title');
    this.root.append(this.bg, h('div', 'title-shade'), body);
    doc.body.append(this.root);
  }

  setProgress(pct, text) { this.loading.classList.remove('is-done'); this.fill.style.width = pct + '%'; this.status.textContent = text; }
  setVersion(text) { this.ver.textContent = text; }
  setReady() { this.ready = true; this.retry.hidden = true; this.setProgress(100, 'Ready'); this.loading.classList.add('is-done'); }
  setSkirmish(enabled) { this.skirmish.disabled = !enabled; }
  setCampaign(enabled) { this.campaign.disabled = !enabled; }
  setEditor(enabled) { this.editor.disabled = !enabled; }
  setFailed(message) {
    this.ready = false;
    this.skirmish.disabled = this.campaign.disabled = this.editor.disabled = true;
    this.retry.hidden = false;
    this.setProgress(0, 'Could not load the game: ' + message);
  }
  /** Start a new battlefield behind the menu (the previous one, if any, is stopped). `opts` goes to MenuBackdrop (random, raf, caf, win). */
  showBackdrop(registry, opts) {
    this.backdrop?.stop();
    this.backdropArgs = [registry, opts];
    this.backdrop = null;
    if (this.covered) return;
    this.backdrop = new MenuBackdrop(this.doc, registry, opts);
    this.bg.append(this.backdrop.canvas);
    this.backdrop.start();
  }
  coverBackdrop(on) {
    this.covered = on;
    if (on) { this.backdrop?.stop(); this.backdrop = null; return; }   // the picture is big: it is not kept alive under a page that hides it
    if (this.backdropArgs && !this.backdrop) this.showBackdrop(...this.backdropArgs);
  }
  showUpdate(onClick) { this.onUpdate = onClick; this.upd.hidden = false; }
  remove() { this.backdrop?.stop(); this.root.remove(); }
}
