import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'public');
// The generated directory is the sole deployment asset directory. It never
// contains local secrets, backend source, tests or development configuration.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'style.css', 'script.js']) await copyFile(resolve(root, file), resolve(output, file));
console.log('Prepared public assets: index.html, style.css and script.js.');
