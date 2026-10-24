// Renders samples/carousels.json -> out/carousel-<lang>-<n>.jpg for every language.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCarousel } from './carousel.mjs';
import { closeBrowser, getBrowser } from './browser.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const specs = JSON.parse(await readFile(path.join(root, 'samples/carousels.json'), 'utf8'));
const only = process.argv.slice(2);

let t = performance.now();
await getBrowser();
console.log(`browser launch: ${(performance.now() - t).toFixed(0)} ms`);
for (const [lang, spec] of Object.entries(specs)) {
  if (only.length && !only.includes(lang)) continue;
  t = performance.now();
  const files = await renderCarousel(spec, { outDir: path.join(root, 'out') });
  console.log(`${lang}: ${files.length} slides in ${(performance.now() - t).toFixed(0)} ms -> ${path.relative(root, files[0])} ...`);
}
await closeBrowser();
