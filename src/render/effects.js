// Visual effects driven by engine events (strike / capture). The engine never touches this; the Presenter
// feeds events in here. Effect positions are stored in tile units and scaled at draw time, so a window
// resize mid-animation stays aligned.

const tileCentre = (u) => [u.x + .5, u.y + .5];

export class Effects {
  /** @param registry entity registry (for each unit's render.attackFx)
   *  @param {(owner:number)=>{color:string,dark:string}} colorsOf faction colours per player index */
  constructor(registry, colorsOf) {
    this.registry = registry;
    this.colorsOf = colorsOf;
    this.list = [];
    this.lockUntil = 0; // input is blocked until this time (ms)
  }

  clear() { this.list = []; this.lockUntil = 0; }
  isLocked(now) { return now < this.lockUntil; }

  /** Queue an attack (or counterattack). Returns the time the next strike in a sequence should start. */
  strike(ev, t0) {
    const { attacker: a, defender: d, damage, destroyed } = ev;
    const fx = this.registry.unit(a.type).render.attackFx;
    const [x0, y0] = tileCentre(a);
    const [x1, y1] = tileCentre(d);
    let hit;
    if (fx === 'lunge') {
      this.list.push({ k: 'lunge', id: a.id, dx: d.x - a.x, dy: d.y - a.y, t0, d: 360 });
      hit = t0 + 180;
    } else {
      const arc = fx === 'arc';
      const dur = arc ? 480 : 200;
      this.list.push({ k: 'shot', x0, y0, x1, y1, arc, color: this.colorsOf(a.owner).color, t0, d: dur });
      hit = t0 + dur;
    }
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
      } else if (f.k === 'burst') {
        const r = S * (f.big ? .75 : .45) * (.25 + .75 * p);
        g.save(); g.translate(f.x * S, f.y * S); g.globalAlpha = 1 - p;
        g.fillStyle = f.c || '#ff9a2e'; g.beginPath(); g.arc(0, 0, r * .7, 0, 7); g.fill();
        g.strokeStyle = '#fff3b0'; g.lineWidth = 3;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + p; g.beginPath(); g.moveTo(Math.cos(a) * r * .6, Math.sin(a) * r * .6); g.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); g.stroke(); }
        g.restore();
      } else if (f.k === 'txt') {
        g.save(); g.globalAlpha = 1 - p * p; g.font = `800 ${S * .42}px ui-monospace,monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = '#000';
        const y = f.y * S - S * .3 - p * S * .5; g.strokeText(f.s, f.x * S, y); g.fillStyle = f.c || '#ff5a4d'; g.fillText(f.s, f.x * S, y); g.restore();
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
