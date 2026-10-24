// Usage: node --env-file-if-exists=../../.env src/tts-demo.mjs [--model eleven_v3] [--voice <id>] [hi kn ta te en]
// Writes out/tts-<lang>.mp3 + out/tts-<lang>.words.json (+ .alignment.json) and prints latency.
// make-reel-demo.mjs picks these up automatically.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickModel, ttsWithTimestamps, tts, forcedAlignment } from './elevenlabs.mjs';
import { probeDuration } from './ffmpeg.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');
await mkdir(outDir, { recursive: true });

if (!process.env.ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY not set (put it in the repo-root .env). Nothing to do.');
  process.exit(2);
}

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const modelArg = flag('--model');
const voiceId = flag('--voice');
const LINES = {
  hi: 'दिन में दो बार ब्रश कीजिए और हर छह महीने में दाँतों की जाँच ज़रूर करवाइए।',
  kn: 'ದೋಸೆ ಹಿಟ್ಟನ್ನು ರಾತ್ರಿಯಿಡೀ ಹುದುಗಿಸಿ, ಬೆಳಿಗ್ಗೆ ಗರಿಗರಿ ದೋಸೆ ಸಿದ್ಧ.',
  ta: 'தினமும் இருமுறை பல் துலக்குங்கள், ஆறு மாதத்திற்கு ஒருமுறை பரிசோதனை செய்யுங்கள்.',
  te: 'పెసలను ఆరు గంటలు నానబెట్టి, అల్లం చట్నీతో వేడివేడిగా వడ్డించండి.',
  en: 'Brush twice a day, floss every night, and see your dentist every six months.',
};
const langs = argv.length ? argv : Object.keys(LINES);

let t = performance.now();
const modelId = modelArg ?? (await pickModel());
console.log(`model: ${modelId} (models lookup ${(performance.now() - t).toFixed(0)} ms)`);

const results = [];
for (const lang of langs) {
  const text = LINES[lang];
  const base = path.join(outDir, `tts-${lang}`);
  let audio, words, latencyMs, how = 'with-timestamps';
  try {
    ({ audio, words, latencyMs } = await ttsWithTimestamps({ text, modelId, languageCode: lang, voiceId }));
  } catch (e) {
    console.warn(`${lang}: with-timestamps failed (${e.message.slice(0, 160)}); falling back to tts + forced alignment`);
    ({ audio, latencyMs } = await tts({ text, modelId, languageCode: lang, voiceId }));
    const fa = await forcedAlignment({ audio, text });
    words = fa.words; latencyMs += fa.latencyMs; how = 'tts+forced-alignment';
  }
  await writeFile(`${base}.mp3`, audio);
  await writeFile(`${base}.words.json`, JSON.stringify(words, null, 1));
  const dur = await probeDuration(`${base}.mp3`);
  results.push({ lang, how, latencyMs, audioSec: +dur.toFixed(2), words: words.length });
  console.log(`${lang}: ${how} ${latencyMs} ms -> ${dur.toFixed(2)}s audio, ${words.length} words; first: ${JSON.stringify(words[0])}`);
}
console.table(results);
