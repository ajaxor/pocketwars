// Writes files.json into a deployed build folder: the list of every file the game needs, so the service worker (sw.js) can
// download the whole build for offline play. The galleries are left out (they are not part of the installed game).
//   node tools/build-file-list.mjs _site/v/<hash>
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Relative paths (forward slashes, sorted) of every file under `dir`, skipping `gallery/` and files.json itself. */
export function listBuildFiles(dir, rel = '') {
  const out = [];
  for (const name of readdirSync(join(dir, rel)).sort()) {
    const path = rel ? rel + '/' + name : name;
    if (statSync(join(dir, path)).isDirectory()) { if (path !== 'gallery') out.push(...listBuildFiles(dir, path)); }
    else if (path !== 'files.json') out.push(path);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node tools/build-file-list.mjs <build folder>'); process.exit(1); }
  const files = listBuildFiles(dir);
  writeFileSync(join(dir, 'files.json'), JSON.stringify(files) + '\n');
  console.log(`files.json: ${files.length} files`);
}
