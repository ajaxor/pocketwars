// Deterministic randomness for tile art.

/** Deterministic pseudo-random number in [0, 1) for grid position (x, y) and a per-call index. */
export function rnd(x, y, i = 0) {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(i + 31, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
