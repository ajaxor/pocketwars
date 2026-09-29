// Node-side data reader for tests and tools: same `readJson(path)` contract as the browser's fetchReader.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));
export const readData = async (path) => JSON.parse(await readFile(DATA_DIR + path, 'utf8'));
