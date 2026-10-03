// Visual effects driven by engine events (strike / capture). The engine never touches this; the Presenter
// feeds events in here. Effect positions are stored in tile units and scaled at draw time, so a window
// resize mid-animation stays aligned.

import { drawFaded } from './layer.js';
import { font } from './font.js';

const tileCentre = (u) => [u.x + .5, u.y + .5];

export class Effects {
  /** @param registry entity registry (for each unit's render.attackFx)
   *  @param {(owner:number)=>{color:string,dark:string}} colorsOf faction colours per player index */
  constructor(registry, colorsOf) {
    this.registry = registry;
    this.colorsOf = colorsOf;
    this.list = [];
    this.holds = new Map(); // unit id -> { hp, until }: the HP to show until a blow has landed (the engine has already applied it)
    this.lockUntil = 0; // input is blocked until this time (ms)
  }

  clear() { this.list = []; this.holds.clear(); this.lockUntil = 0; }

  /**
   * The HP digit to draw for `unit`: the game's HP, except while a strike on it is still in flight, when it is the HP it had before.
   * An attacker therefore keeps its old HP until the counterattack has landed.
   */
  displayHp(unit, now) {
    const h = this.holds.get(unit.id);
    if (!h) return unit.hp;
    if (now >= h.until) { this.holds.delete(unit.id); return unit.hp; }
    return h.hp;
  }
  isLocked(now) { return now < this.lockUntil; }

  /** Queue an attack (or counterattack). Returns the time the next strike in a sequence should start. */
  strike(ev, t0) {
    const { attacker: a, defender: d, damage, destroyed } = ev;
    // a weapon can name its own effect (depth charges, torpedoes); otherwise the unit's attack look is used
    const fx = (ev.weapon && this.registry.weapon(ev.weapon).fx) || this.registry.unit(a.type).render.attackFx;
    const [x0, y0] = tileCentre(a);
    const [x1, y1] = tileCentre(d);
    let hit;
    if (fx === 'lunge') {
      this.list.push({ k: 'lunge', id: a.id, dx: d.x - a.x, dy: d.y - a.y, t0, d: 360 });
      hit = t0 + 180;
    } else if (fx === 'drop') {
      // bombs fall straight down onto the target from above
      this.list.push({ k: 'bomb', x: x1, y: y1, t0, d: 520 });
      hit = t0 + 520;
    } else if (fx === 'torpedo') {
      // a small dark torpedo running under the surface to the target
      const dur = 620;
      this.list.push({ k: 'torpedo', x0, y0, x1, y1, t0, d: dur });
      hit = t0 + dur;
    } else {
      const arc = fx === 'arc';
      const dur = arc ? 480 : 200;
      this.list.push({ k: 'shot', x0, y0, x1, y1, arc, color: this.colorsOf(a.owner).color, t0, d: dur });
      hit = t0 + dur;
    }
    const before = (u, lost) => Math.round((u.hp + lost) * 10) / 10;
    // the target shows its old HP until the blow lands; the attacker of a first blow shows its old HP until the counter (if any) lands too
    if (!destroyed) this.holds.set(d.id, { hp: before(d, damage), until: hit });
    if (!ev.counter) this.holds.set(a.id, { hp: a.hp, until: hit });
    this.list.push(
      { k: 'burst', x: x1, y: y1, t0: hit, d: destroyed ? 700 : 420, big: destroyed },
      { k: 'txt', x: x1, y: y1, s: '-' + damage, t0: hit, d: 900 },
      { k: 'hit', id: d.id, t0: hit, d: 300 },
    );
    if (destroyed) this.list.push({ k: 'die', unit: d, t0: hit, d: 600 });
    this.lockUntil = Math.max(this.lockUntil, hit + 700);
    return hit + 450;
  }

  capture(ev, t0) {
    const [cx, cy] = tileCentre(ev.unit);
    const { color } = this.colorsOf(ev.owner);
    this.list.push(
      { k: 'cap', x: ev.x, y: ev.y, a: ev.from, b: ev.to, color, t0, d: 1000 },
      { k: 'txt', x: cx, y: cy, s: ev.completed ? 'Captured!' : ev.progress + '/' + ev.needed, c: '#fff', t0: t0 + 500, d: 900 },
    );
    if (ev.completed) this.list.push({ k: 'burst', x: cx, y: cy, t0: t0 + 1000, d: 700, big: true, c: color });
    this.lockUntil = Math.max(this.lockUntil, t0 + (ev.completed ? 1700 : 1400));
  }

  /** A move cut short by something hidden: a red ring where the unit stopped and a call-out over what it ran into. */
  interrupt(ev, t0) {
    this.list.push(
      { k: 'ping', x: ev.blocker.x + .5, y: ev.blocker.y + .5, t0, d: 900 },
      { k: 'txt', x: ev.blocker.x + .5, y: ev.blocker.y + .5, s: 'Contact!', sz: .34, c: '#ffd166', t0: t0 + 150, d: 1100 },
    );
    this.lockUntil = Math.max(this.lockUntil, t0 + 900);
  }

  /** A unit diving or coming up: ripples on the water. `down` is true for a dive. */
  dive(ev, t0, down) {
    this.list.push({ k: 'ripple', x: ev.unit.x + .5, y: ev.unit.y + .5, down, t0, d: 800 });
    this.lockUntil = Math.max(this.lockUntil, t0 + 500);
  }

  /** Income floating up from each property as a turn begins (ev = a turnStart event). Does not lock input. */
  income(ev, t0) {
    (ev.incomes || []).forEach((p, i) => {
      this.list.push({ k: 'txt', x: p.x + .5, y: p.y + .1, s: '+' + p.amount, sz: .3, c: '#ffe45c', t0: t0 + i * 140, d: 1300 });
    });
  }

  /** A spy sabotaging a property (a 'sabotage' event): sparks over the tile and a call-out. Does not lock input. */
  sabotage(ev, t0) {
    this.list.push(
      { k: 'burst', x: ev.x + .5, y: ev.y + .5, t0, d: 700, big: false, c: '#ff7b6b' },
      { k: 'txt', x: ev.x + .5, y: ev.y + .35, s: 'Sabotaged!', sz: .3, c: '#ff7b6b', t0: t0 + 200, d: 1300 },
    );
  }

  /** HP restored at the start of a turn (the `healed` list of a turnStart event): a green +HP over each unit. Does not lock input. */
  healed(ev, t0) {
    (ev.healed || []).forEach((h, i) => {
      this.list.push({ k: 'txt', x: h.x + .5, y: h.y + .3, s: `+${Math.round((h.to - h.from) * 10) / 10}`, sz: .3, c: '#9be564', t0: t0 + 200 + i * 120, d: 1200 });
    });
  }

  /** A unit refilled with ammo (a 'resupply' event): a call-out over it. Does not lock input. */
  resupply(unit, t0, cost = 0) {
    this.list.push({ k: 'txt', x: unit.x + .5, y: unit.y + .35, s: 'Resupplied', sz: .28, c: '#9be564', t0, d: 1200 });
    if (cost) this.list.push({ k: 'txt', x: unit.x + .5, y: unit.y + .7, s: `-${cost.toLocaleString('en-US')}`, sz: .3, c: '#ff7b6b', t0, d: 1200 });
  }

  /** Troops dropped next to a carrier (a 'deploy' event): a call-out over the new unit. Does not lock input. */
  deploy(ev, t0) {
    this.list.push({ k: 'txt', x: ev.dropped.x + .5, y: ev.dropped.y + .35, s: 'Deployed', sz: .28, c: '#fff', t0, d: 1200 });
  }

  /** Pixel offset applied to a unit while a lunge or hit-shake is playing. */
  unitOffset(id, now, S) {
    let dx = 0;
    let dy = 0;
    for (const f of this.list) {
      if (f.id !== id || now < f.t0 || now >= f.t0 + f.d) continue;
      const p = (now - f.t0) / f.d;
      if (f.k === 'lunge') { const o = Math.sin(Math.PI * p) * S * .38; dx += f.dx * o; dy += f.dy * o; }
      else if (f.k === 'hit') dx += Math.sin(now / 22) * S * .06 * (1 - p);
    }
    return [dx, dy];
  }

  /** @param {(unit:object, alpha:number)=>void} drawDying draws a unit that has already been removed from the game */
  draw(g, now, S, drawDying) {
    this.list = this.list.filter((f) => now < f.t0 + f.d);
    for (const f of this.list) {
      if (now < f.t0 && f.k !== 'die') continue;
      const p = Math.max(0, (now - f.t0) / f.d);
      if (f.k === 'shot') {
        const x = (f.x0 + (f.x1 - f.x0) * p) * S;
        const y = (f.y0 + (f.y1 - f.y0) * p) * S - (f.arc ? Math.sin(Math.PI * p) * S * 1.1 : 0);
        if (p < .3) { g.fillStyle = 'rgba(255,240,170,' + (1 - p / .3) + ')'; g.beginPath(); g.arc(f.x0 * S, f.y0 * S, S * .18 * (1 - p / .3), 0, 7); g.fill(); }
        g.fillStyle = '#ffe45c'; g.beginPath(); g.arc(x, y, S * .09, 0, 7); g.fill();
        g.fillStyle = f.color; g.beginPath(); g.arc(x, y, S * .05, 0, 7); g.fill();
      } else if (f.k === 'torpedo') {
        const x = (f.x0 + (f.x1 - f.x0) * p) * S, y = (f.y0 + (f.y1 - f.y0) * p) * S;
        const a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
        g.save(); g.translate(x, y); g.rotate(a); g.lineCap = 'round';
        g.fillStyle = '#1d222b'; g.beginPath(); g.ellipse(0, 0, S * .07, S * .025, 0, 0, 7); g.fill(); g.restore();
      } else if (f.k === 'ping') {
        g.save(); g.globalAlpha = 1 - p; g.strokeStyle = '#ff5a4d'; g.lineWidth = 3;
        for (let i = 0; i < 2; i++) { const q = Math.min(1, p * 1.4 - i * .25); if (q > 0) { g.beginPath(); g.arc(f.x * S, f.y * S, S * (.15 + .55 * q), 0, 7); g.stroke(); } }
        g.restore();
      } else if (f.k === 'ripple') {
        g.save(); g.globalAlpha = (1 - p) * .9; g.strokeStyle = '#e8f6ff'; g.lineWidth = S * .05;
        const r = f.down ? S * (.55 - .4 * p) : S * (.15 + .45 * p);
        g.beginPath(); g.ellipse(f.x * S, f.y * S + S * .1, r, r * .45, 0, 0, 7); g.stroke();
        g.beginPath(); g.ellipse(f.x * S, f.y * S + S * .1, r * .6, r * .27, 0, 0, 7); g.stroke();
        g.restore();
      } else if (f.k === 'bomb') {
        // a growing shadow on the ground and a bomb accelerating down onto it
        const by = f.y * S - (1 - p * p) * S * 1.1;
        g.fillStyle = 'rgba(0,0,0,' + (.1 + .25 * p) + ')'; g.beginPath(); g.ellipse(f.x * S, f.y * S + S * .1, S * (.1 + .22 * p), S * (.05 + .1 * p), 0, 0, 7); g.fill();
        g.save(); g.translate(f.x * S, by); g.fillStyle = '#2b2f36'; g.beginPath(); g.ellipse(0, 0, S * .07, S * .12, 0, 0, 7); g.fill();
        g.fillStyle = '#ffe45c'; g.fillRect(-S * .05, -S * .16, S * .1, S * .04); g.restore();
      } else if (f.k === 'burst') {
        const r = S * (f.big ? .75 : .45) * (.25 + .75 * p);
        g.save(); g.translate(f.x * S, f.y * S); g.globalAlpha = 1 - p;
        g.fillStyle = f.c || '#ff9a2e'; g.beginPath(); g.arc(0, 0, r * .7, 0, 7); g.fill();
        g.strokeStyle = '#fff3b0'; g.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + p; g.beginPath(); g.moveTo(Math.cos(a) * r * .6, Math.sin(a) * r * .6); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); g.stroke(); }
        g.restore();
      } else if (f.k === 'txt') {
        // outline + digits are drawn opaque and faded as one image; per-shape alpha lets the black outline show through the fill
        const y = f.y * S - S * .3 - p * S * .5, rx = S * 1.1, ry = S * .4;
        drawFaded(g, 1 - p * p, f.x * S - rx, y - ry, rx * 2, ry * 2, (c) => {
          c.save(); c.font = font(700, S * (f.sz || .44)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = f.sz ? 3 : 4; c.strokeStyle = '#000';
          c.strokeText(f.s, f.x * S, y); c.fillStyle = f.c || '#ff5a4d'; c.fillText(f.s, f.x * S, y); c.restore();
        });
      } else if (f.k === 'die') {
        drawDying(f.unit, now < f.t0 ? 1 : 1 - p);
      } else if (f.k === 'cap') {
        const q = 1 - Math.pow(1 - p, 3);
        const fr = f.a + (f.b - f.a) * q;
        const px = f.x * S;
        const py = f.y * S;
        const fy = py + S * .72 - fr * S * .62;
        g.save(); g.strokeStyle = '#eee'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(px + S * .8, py + S * .92); g.lineTo(px + S * .8, py + S * .06); g.stroke();
        g.fillStyle = f.color; g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + S * .8, fy); g.lineTo(px + S * .42, fy + S * .05 + Math.sin(now / 90) * S * .03); g.lineTo(px + S * .8, fy + S * .2); g.closePath(); g.fill(); g.stroke(); g.restore();
      }
    }
  }
}
