// Demo: carousel slides + narration -> reel per language.
// Uses ElevenLabs audio + word timings from out/tts-<lang>.* if present, else macOS `say` + even captions.
// Usage: node src/make-reel-demo.mjs [hi kn ta te en]
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCarousel } from './carousel.mjs';
import { closeBrowser } from './browser.mjs';
import { sayToFile } from './audio.mjs';
import { assembleReel } from './reel.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');
const specs = JSON.parse(readFileSync(path.join(root, 'samples/carousels.json'), 'utf8'));
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['hi'];

for (const lang of langs) {
  const spec = specs[lang];
  const endPunct = (t) => (/[.!?।]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const script = spec.slides.map((s) => [s.headline, s.body].filter(Boolean).map(endPunct).join(' ')).join(' ');
  const images = await renderCarousel(spec, { outDir });

  let audio, words, source;
  const elAudio = path.join(outDir, `tts-${lang}.mp3`);
  const elWords = path.join(outDir, `tts-${lang}.words.json`);
  if (existsSync(elAudio) && existsSync(elWords)) {
    audio = elAudio;
    words = JSON.parse(readFileSync(elWords, 'utf8'));
    source = 'elevenlabs';
  } else {
    let t = performance.now();
    audio = await sayToFile(script, path.join(outDir, `say-${lang}.m4a`), { language: lang });
    console.log(`${lang}: say audio ${(performance.now() - t).toFixed(0)} ms`);
    source = 'say+even';
  }

  const res = await assembleReel({ images, audio, out: path.join(outDir, `reel-${lang}.mp4`), language: lang, words, script });
  console.log(`${lang}: [${source}] ${path.relative(root, res.out)} ${res.duration.toFixed(2)}s, ${res.captions.length} captions, built in ${res.ms} ms`);
}
await closeBrowser();
