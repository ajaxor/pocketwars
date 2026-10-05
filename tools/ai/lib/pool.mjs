// Plays many matches in parallel on worker threads (one per CPU by default).
//
//   const pool = await createPool({ workers });
//   const results = await pool.run(jobs, { onResult });   // jobs: [{ mapId, seats, seed, maxDays?, fog?, margin? }]
//   pool.close();

import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

export async function createPool({ workers = availableParallelism() } = {}) {
  const url = new URL('./worker.mjs', import.meta.url);
  const all = await Promise.all(Array.from({ length: Math.max(1, workers) }, () => new Promise((resolve, reject) => {
    const w = new Worker(url);
    w.once('error', reject);
    w.once('message', (m) => (m.ready ? resolve(w) : reject(new Error('worker did not start'))));
  })));
  let nextId = 0;
  return {
    size: all.length,
    /** Play every job; resolves with the results in job order. Rejects on the first engine error. */
    run(jobs, { onResult } = {}) {
      return new Promise((resolve, reject) => {
        const results = new Array(jobs.length);
        let queued = 0;
        let done = 0;
        let failed = false;
        if (!jobs.length) return resolve(results);
        const feed = (w) => {
          if (failed || queued >= jobs.length) return;
          const index = queued++;
          const id = nextId++;
          const onMessage = (m) => {
            if (m.id !== id) return;
            w.off('message', onMessage);
            if (m.error) { failed = true; return reject(new Error(m.error)); }
            results[index] = m.result;
            done++;
            onResult?.(m.result, done, jobs.length);
            if (done === jobs.length) resolve(results);
            else feed(w);
          };
          w.on('message', onMessage);
          w.postMessage({ id, job: jobs[index] });
        };
        for (const w of all) feed(w);
      });
    },
    close: () => Promise.all(all.map((w) => w.terminate())),
  };
}
