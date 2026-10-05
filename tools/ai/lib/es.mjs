// An evolution strategy over the whole profile at once: every game played says something about every number, instead of one.
// (μ/μw, λ)-ES with mirrored sampling and cumulative step-size adaptation, the CMA-ES recipe without the covariance matrix (which
// needs far more games than we can play to be worth learning). Pure maths: no games in here, so it is easy to test.
//
// Everything is searched in a normalised space, one coordinate per dimension of the search space (lib/tune.mjs), 0..1 over the
// dimension's range (log scale for strategy weights). Each generation:
//   ask    λ candidates: the mean plus or minus σ x a random direction (a direction and its mirror, so noise cancels)
//   tell   their scores (all played against the mean, on the same games); the best μ are averaged, weighted, and the mean moves toward
//          them. σ grows while successive steps keep pointing the same way and shrinks when they cancel out (noise)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const SIGMA_MIN = 0.02;
export const SIGMA_MAX = 0.3;

const gauss = (rng) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** dimension value <-> 0..1 */
export const toUnit = (dim, v) => clamp01(dim.log ? Math.log(v / dim.min) / Math.log(dim.max / dim.min) : (v - dim.min) / (dim.max - dim.min));
export const fromUnit = (dim, x) => (dim.log ? dim.min * (dim.max / dim.min) ** clamp01(x) : dim.min + (dim.max - dim.min) * clamp01(x));

export function init(mean, { lambda = 16, sigma = 0.1 } = {}) {
  const n = mean.length;
  const mu = Math.max(1, Math.floor(lambda / 4));
  const raw = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const total = raw.reduce((a, b) => a + b, 0);
  const weights = raw.map((w) => w / total);
  const muEff = 1 / weights.reduce((a, w) => a + w * w, 0);
  const cs = (muEff + 2) / (n + muEff + 5);
  const damps = 1 + 2 * Math.max(0, Math.sqrt((muEff - 1) / (n + 1)) - 1) + cs;
  return { n, lambda: lambda - (lambda % 2), mu, weights, muEff, cs, damps, mean: [...mean], sigma, path: new Array(n).fill(0), generation: 0 };
}

/** λ candidates: { x: the point (clamped to 0..1), d: the step actually taken, in units of σ }. */
export function ask(state, rng) {
  const out = [];
  for (let k = 0; k < state.lambda / 2; k++) {
    const eps = Array.from({ length: state.n }, () => gauss(rng));
    for (const sign of [1, -1]) {
      const x = state.mean.map((m, i) => clamp01(m + sign * state.sigma * eps[i]));
      out.push({ x, d: x.map((xi, i) => (xi - state.mean[i]) / state.sigma) });
    }
  }
  return out;
}

/** Move the mean toward the best candidates (higher score is better) and adapt σ. Returns how far the mean moved, in σ. */
export function tell(state, candidates, scores) {
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]).slice(0, state.mu);
  const step = new Array(state.n).fill(0);
  order.forEach((idx, rank) => { for (let i = 0; i < state.n; i++) step[i] += state.weights[rank] * candidates[idx].d[i]; });
  for (let i = 0; i < state.n; i++) state.mean[i] = clamp01(state.mean[i] + state.sigma * step[i]);
  const k = Math.sqrt(state.cs * (2 - state.cs) * state.muEff);
  for (let i = 0; i < state.n; i++) state.path[i] = (1 - state.cs) * state.path[i] + k * step[i];
  const norm = Math.hypot(...state.path);
  const chi = Math.sqrt(state.n) * (1 - 1 / (4 * state.n) + 1 / (21 * state.n * state.n));
  state.sigma = Math.min(SIGMA_MAX, Math.max(SIGMA_MIN, state.sigma * Math.exp((state.cs / state.damps) * (norm / chi - 1))));
  state.generation++;
  return Math.hypot(...step);
}
