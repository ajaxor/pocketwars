#!/usr/bin/env node
// Tunes in short sessions, shipping each improvement as soon as it is proven, so a long search never hangs on one fragile run.
// Every session starts from the profile now in data/ai.json, searches for --minutes, and must pass the gate against it before
// data/ai.json changes. With --commit, each improvement is validated, tested, committed and pushed before the next session starts.
//
//   npm run ai:ratchet -- --sessions 6 --minutes 10 [--commit] [--push] [tune.mjs options: --lambda --batch-maps --gate-seeds ...]
//
// A session that crashes or finds nothing costs only its own minutes; the sessions before it are already shipped.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
const changed = () => run('git', ['diff', '--quiet', 'data/ai.json'], { stdio: 'ignore' }).status !== 0;

const opts = parseArgs(process.argv.slice(2));
const sessions = Number(opts.sessions ?? 6);
const minutes = String(opts.minutes ?? 10);
const own = new Set(['sessions', 'minutes', 'commit', 'push', 'positional']);
const pass = Object.entries(opts).filter(([k]) => !own.has(k)).flatMap(([k, v]) => (v === true ? [`--${k}`] : [`--${k}`, String(v)]));
let shipped = 0;

for (let i = 1; i <= sessions; i++) {
  console.log(`\n=== session ${i}/${sessions} (${minutes} min) ===`);
  const t = run('node', ['tools/ai/tune.mjs', '--minutes', minutes, '--write', ...pass]);
  if (t.status !== 0) { console.log(`session ${i} failed (exit ${t.status}); carrying on`); continue; }
  if (!changed()) { console.log('nothing to ship from this session'); continue; }
  if (!opts.commit) { shipped++; continue; }
  if (run('npm', ['run', '--silent', 'validate']).status !== 0 || run('npm', ['test', '--silent']).status !== 0) {
    console.log('the tuned profile failed validation or tests; discarding it'); run('git', ['checkout', 'data/ai.json']); continue;
  }
  run('git', ['add', 'data/ai.json']);
  run('git', ['commit', '-m', `Retune the strategist AI (session ${i})`]);
  if (opts.push) { run('git', ['pull', '--rebase', 'origin', 'main']); run('git', ['push', 'origin', 'HEAD:main']); }
  shipped++;
}
console.log(`\n${shipped} of ${sessions} sessions shipped an improvement`);
