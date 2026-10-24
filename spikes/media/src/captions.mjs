// Caption timing + caption PNG rendering.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fontFaceCss, fontStack } from './fonts.mjs';
import { screenshotHtml } from './browser.mjs';

/** @typedef {{text:string,start:number,end:number}} Timed */

/**
 * No timings available: spread words across the audio, weighted by length
 * (longer words take longer to say; a better guess than equal slots).
 * @returns {Timed[]} word timings
 */
export function evenWordTimings(script, duration, { lead = 0.15, tail = 0.25 } = {}) {
  const words = script.trim().split(/\s+/).filter(Boolean);
  const weights = words.map((w) => [...w].length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.1, duration - lead - tail);
  let t = lead;
  return words.map((text, i) => {
    const d = (weights[i] / total) * span;
    const w = { text, start: t, end: t + d };
    t += d;
    return w;
  });
}

/**
 * ElevenLabs /with-timestamps alignment (character level) -> word timings.
 * @param {{characters:string[],character_start_times_seconds:number[],character_end_times_seconds:number[]}} a
 * @returns {Timed[]}
 */
export function charAlignmentToWords(a) {
  const words = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur), (cur = null);
      return;
    }
    const s = a.character_start_times_seconds[i];
    const e = a.character_end_times_seconds[i];
    if (!cur) cur = { text: ch, start: s, end: e };
    else (cur.text += ch), (cur.end = e);
  });
  if (cur) words.push(cur);
  return words;
}

/**
 * Group word timings into on-screen caption chunks.
 * Breaks on sentence punctuation, maxWords, or maxChars.
 * @param {Timed[]} words
 * @returns {Timed[]} chunks (each shown from its first word start to the next chunk start)
 */
export function wordsToCaptionChunks(words, { maxWords = 4, maxChars = 26 } = {}) {
  const chunks = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    chunks.push({ text: cur.map((w) => w.text).join(' '), start: cur[0].start, end: cur.at(-1).end });
    cur = [];
  };
  for (const w of words) {
    const len = cur.map((x) => x.text).join(' ').length + w.text.length + 1;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) flush();
    cur.push(w);
    if (/[.!?।,;:]$/.test(w.text)) flush();
  }
  flush();
  // Hold each chunk until the next one starts so captions don't flicker.
  for (let i = 0; i < chunks.length - 1; i++) chunks[i].end = Math.max(chunks[i].end, chunks[i + 1].start);
  return chunks;
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Full-frame transparent HTML with the caption in the lower third. */
export function captionHtml(text, language, { width = 1080, height = 1920, bottom = 420 } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaceCss()}
html,body{margin:0;width:${width}px;height:${height}px;background:transparent}
.wrap{position:absolute;left:60px;right:60px;bottom:${bottom}px;display:flex;justify-content:center}
.cap{font-family:${fontStack(language)};font-weight:800;font-size:64px;line-height:1.35;color:#fff;text-align:center;
  background:rgba(0,0,0,.62);border-radius:22px;padding:14px 30px 20px;text-wrap:balance}
</style></head><body><div class="wrap"><div class="cap">${esc(text)}</div></div></body></html>`;
}

/**
 * Render caption chunks to transparent PNGs.
 * @returns {Promise<(Timed & {png:string})[]>}
 */
export async function renderCaptionPngs(chunks, { language, outDir, width = 1080, height = 1920, bottom = 420 }) {
  await mkdir(outDir, { recursive: true });
  const result = [];
  for (let i = 0; i < chunks.length; i++) {
    const png = path.resolve(outDir, `cap-${String(i).padStart(3, '0')}.png`);
    await screenshotHtml(captionHtml(chunks[i].text, language, { width, height, bottom }), { width, height, path: png, type: 'png', transparent: true });
    result.push({ ...chunks[i], png });
  }
  return result;
}
