// Noto Sans per script, inlined as base64 @font-face so HTML works via page.setContent()
// without a file server. Each script font is a Google Fonts variable woff2 (wght 400..800).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FONT_DIR = path.join(process.cwd(), 'lib', 'media', 'fonts');

const FACES = [
  { family: 'NotoLatin', file: 'noto-sans-latin.woff2' },
  { family: 'NotoDeva', file: 'noto-sans-devanagari.woff2' },
  { family: 'NotoKnda', file: 'noto-sans-kannada.woff2' },
  { family: 'NotoTaml', file: 'noto-sans-tamil.woff2' },
  { family: 'NotoTelu', file: 'noto-sans-telugu.woff2' },
];

// Script font first, Latin fallback for digits / English words / punctuation.
export const FONT_STACK = {
  hi: "'NotoDeva', 'NotoLatin', sans-serif",
  kn: "'NotoKnda', 'NotoLatin', sans-serif",
  ta: "'NotoTaml', 'NotoLatin', sans-serif",
  te: "'NotoTelu', 'NotoLatin', sans-serif",
  en: "'NotoLatin', sans-serif",
};

let cached;
/** @returns {string} CSS with @font-face rules for all scripts (base64 inlined). */
export function fontFaceCss() {
  if (cached) return cached;
  cached = FACES.map(({ family, file }) => {
    const b64 = readFileSync(path.join(FONT_DIR, file)).toString('base64');
    return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${b64}) format('woff2');font-weight:400 800;font-display:block;}`;
  }).join('\n');
  return cached;
}

/** @param {string} language hi|kn|ta|te|en */
export function fontStack(language) {
  const s = FONT_STACK[language];
  if (!s) throw new Error(`Unsupported language: ${language}`);
  return s;
}
