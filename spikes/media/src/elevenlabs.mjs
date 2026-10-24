// ElevenLabs helpers: TTS with char timestamps -> word timings, forced alignment, instant voice clone.
// Plain fetch (Node 18+), no SDK. Key from process.env.ELEVENLABS_API_KEY.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { charAlignmentToWords } from './captions.mjs';

const BASE = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io'; // override for mock tests
// Premade multilingual voice used when ELEVENLABS_VOICE_ID is unset.
export const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY not set');
  return k;
}

async function call(pathname, init = {}) {
  const res = await fetch(BASE + pathname, { ...init, headers: { 'xi-api-key': key(), ...(init.headers ?? {}) } });
  if (!res.ok) {
    const err = new Error(`ElevenLabs ${res.status} ${pathname}: ${(await res.text()).slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

/** @returns {Promise<{model_id:string,name:string,languages?:{language_id:string}[]}[]>} */
export async function listModels() {
  return (await call('/v1/models')).json();
}

/** Prefer eleven_v4 if the account exposes it, else eleven_v3. */
export async function pickModel() {
  const ids = (await listModels()).map((m) => m.model_id);
  return ids.find((id) => id === 'eleven_v4') ?? ids.find((id) => id.startsWith('eleven_v4')) ?? 'eleven_v3';
}

/**
 * TTS + character timings -> word timings for captions.
 * @param {{text:string, voiceId?:string, modelId?:string, languageCode?:string, outputFormat?:string}} o
 * @returns {Promise<{audio:Buffer, words:{text:string,start:number,end:number}[], alignment:object, modelId:string, latencyMs:number}>}
 */
export async function ttsWithTimestamps({ text, voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID, modelId = 'eleven_v3', languageCode, outputFormat = 'mp3_44100_128' }) {
  const body = { text, model_id: modelId, ...(languageCode ? { language_code: languageCode } : {}) };
  const url = `/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${outputFormat}`;
  const t0 = performance.now();
  let res;
  try {
    res = await call(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    // Some models reject language_code; retry once without it.
    if (e.status !== 400 && e.status !== 422 || !languageCode) throw e;
    delete body.language_code;
    res = await call(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
  const json = await res.json();
  const latencyMs = Math.round(performance.now() - t0);
  const alignment = json.alignment ?? json.normalized_alignment;
  return { audio: Buffer.from(json.audio_base64, 'base64'), words: alignment ? charAlignmentToWords(alignment) : [], alignment, modelId, latencyMs };
}

/** Plain TTS (no timestamps). Fallback if a model doesn't support /with-timestamps. */
export async function tts({ text, voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID, modelId = 'eleven_v3', languageCode, outputFormat = 'mp3_44100_128' }) {
  const t0 = performance.now();
  const res = await call(`/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: modelId, ...(languageCode ? { language_code: languageCode } : {}) }),
  });
  const audio = Buffer.from(await res.arrayBuffer());
  return { audio, latencyMs: Math.round(performance.now() - t0) };
}

/**
 * Forced Alignment API: any audio + its transcript -> word timings.
 * Works for user-recorded voiceovers too.
 * @returns {Promise<{words:{text:string,start:number,end:number}[], latencyMs:number}>}
 */
export async function forcedAlignment({ audio, text, filename = 'audio.mp3' }) {
  const form = new FormData();
  form.append('file', new Blob([audio]), filename);
  form.append('text', text);
  const t0 = performance.now();
  const json = await (await call('/v1/forced-alignment', { method: 'POST', body: form })).json();
  return {
    words: json.words.map((w) => ({ text: w.text, start: w.start, end: w.end })).filter((w) => w.text.trim()),
    latencyMs: Math.round(performance.now() - t0),
  };
}

/**
 * Instant Voice Clone from local sample(s). 1-2 min of clean speech recommended.
 * @param {{name:string, files:string[], description?:string, removeBackgroundNoise?:boolean}} o
 * @returns {Promise<{voice_id:string, requires_verification:boolean, latencyMs:number}>}
 */
export async function createInstantVoiceClone({ name, files, description, removeBackgroundNoise = true }) {
  const form = new FormData();
  form.append('name', name);
  if (description) form.append('description', description);
  form.append('remove_background_noise', String(removeBackgroundNoise));
  for (const f of files) form.append('files', new Blob([await readFile(f)]), path.basename(f));
  const t0 = performance.now();
  const json = await (await call('/v1/voices/add', { method: 'POST', body: form })).json();
  return { ...json, latencyMs: Math.round(performance.now() - t0) };
}
