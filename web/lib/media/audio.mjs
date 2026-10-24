// Placeholder narration with macOS `say` (used when no ElevenLabs key).
import { run } from './ffmpeg.mjs';

export const SAY_VOICES = { hi: 'Lekha', kn: 'Soumya', ta: 'Vani', te: 'Geeta', en: 'Rishi' };

/**
 * @param {string} text
 * @param {string} outPath .m4a or .wav (decided by extension)
 * @param {{language?:string, voice?:string, rate?:number}} [opts]
 */
export async function sayToFile(text, outPath, { language = 'en', voice, rate } = {}) {
  const v = voice ?? SAY_VOICES[language] ?? 'Samantha';
  const args = ['-v', v, '-o', outPath];
  if (outPath.endsWith('.wav')) args.push('--data-format=LEI16@44100');
  if (rate) args.push('-r', String(rate));
  args.push(text);
  await run('say', args);
  return outPath;
}
