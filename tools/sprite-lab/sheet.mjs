// usage: node sheet.mjs <style> [S] [out]
import { renderSheet } from './lib.mjs';
const [style, S = '176', out] = process.argv.slice(2);
const mod = await import(`./styles/${style}.mjs`);
const file = out || `${style}-${S}.png`;
const r = renderSheet(mod, Number(S), file);
console.log('wrote', file, r.W + 'x' + r.H);
