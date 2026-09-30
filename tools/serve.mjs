// Tiny static dev server (ES modules and fetch() do not work from file://).
//   npm start            -> http://localhost:8080/        (PORT=1234 npm start to change)
//   http://localhost:8080/?map=<id> picks a map from data/maps/index.json
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PORT = Number(process.env.PORT) || 8080;

createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, path);
    const shared = path.startsWith('/tools/sprite-lab/variants/');   // browser-safe sprite modules used by /gallery/
    if (!file.startsWith(ROOT) || (!shared && /(^|[\\/])(\.git|node_modules|tests|tools)([\\/]|$)/.test(path))) throw new Error('forbidden');
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log(`Pocket Wars dev server: http://localhost:${PORT}/`));
