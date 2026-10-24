// Offline mock of the 4 ElevenLabs endpoints we use, to exercise request/response code without a key.
// Audio comes from macOS `say`; char timings are spread evenly. NOT real ElevenLabs output.
// Usage: node src/mock-elevenlabs.mjs  (listens on :8787), then
//   ELEVENLABS_API_KEY=mock ELEVENLABS_BASE_URL=http://localhost:8787 node src/tts-demo.mjs te
import http from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sayToFile } from './audio.mjs';
import { run, probeDuration } from './ffmpeg.mjs';

const LANG_BY_SCRIPT = [[/[ऀ-ॿ]/, 'hi'], [/[ಀ-೿]/, 'kn'], [/[஀-௿]/, 'ta'], [/[ఀ-౿]/, 'te']];
const detect = (t) => LANG_BY_SCRIPT.find(([re]) => re.test(t))?.[1] ?? 'en';
const body = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });

http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.headers['xi-api-key'] == null) return send(401, { detail: 'missing xi-api-key' });
  if (req.url === '/v1/models') return send(200, [{ model_id: 'eleven_v3' }, { model_id: 'eleven_multilingual_v2' }]);
  if (/\/v1\/text-to-speech\/[^/]+\/with-timestamps/.test(req.url)) {
    const { text, model_id } = JSON.parse(await body(req));
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mock-el-'));
    const m4a = await sayToFile(text, path.join(dir, 'a.m4a'), { language: detect(text) });
    const mp3 = path.join(dir, 'a.mp3');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', m4a, '-b:a', '128k', mp3]);
    const dur = await probeDuration(mp3);
    const chars = [...text];
    const step = dur / chars.length;
    return send(200, {
      audio_base64: (await readFile(mp3)).toString('base64'),
      alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => +(i * step).toFixed(3)), character_end_times_seconds: chars.map((_, i) => +((i + 1) * step).toFixed(3)) },
      _mock: { model_id },
    });
  }
  if (req.url === '/v1/voices/add') {
    const raw = (await body(req)).toString('latin1');
    const ok = raw.includes('name="name"') && raw.includes('name="files"');
    return ok ? send(200, { voice_id: 'mockVoice123', requires_verification: false }) : send(422, { detail: 'name and files required' });
  }
  send(404, { detail: req.url });
}).listen(8787, () => console.log('mock ElevenLabs on :8787'));
