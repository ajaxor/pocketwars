// A small binary min-heap for the path searches (movement.js, fog.js). Entries come out by cost, and among equal costs in the order
// they went in, which is exactly the order the old "sort the whole queue, take the first" searches produced (Array.prototype.sort is
// stable), so paths and tie-breaks are unchanged; only the time spent is.

export class PathHeap {
  constructor() {
    this.items = [];   // [x, y, cost, seq]
    this.seq = 0;
  }

  get length() { return this.items.length; }

  push(x, y, cost) {
    const a = this.items;
    a.push([x, y, cost, this.seq++]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!before(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  /** The entry with the lowest cost (the earliest pushed among equals), as [x, y, cost]. */
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && before(a[l], a[m])) m = l;
        if (r < a.length && before(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

const before = (a, b) => a[2] < b[2] || (a[2] === b[2] && a[3] < b[3]);
