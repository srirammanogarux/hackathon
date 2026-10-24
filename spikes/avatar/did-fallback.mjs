// Fallback if HeyGen is blocked: D-ID /talks animates one photo with our audio.
// Less realistic (head-only motion), but fast and self-serve.
//
//   node --env-file-if-exists=../../.env did-fallback.mjs --image face.jpg --audio voice.mp3 [--out out/did.mp4]
//
// Env: DID_API_KEY = the "API_USERNAME:API_PASSWORD" key from studio.d-id.com > Account Settings.
// Docs (checked 24 Oct 2026): docs.d-id.com/reference/createtalk, /upload-an-image, /upload-an-audio, /basic-authentication
//   POST /images (multipart "image")  -> { url }      temp storage
//   POST /audios (multipart "audio", <=6 MB) -> { url }
//   POST /talks { source_url, script: { type: "audio", audio_url }, config: { stitch: true } } -> { id }
//   GET  /talks/{id} -> status created|started|done|error|rejected, result_url
// Output keeps the source image framing when stitch=true, so feed a 9:16 portrait photo for a Reel.
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { pollUntil, download, parseArgs, isUrl } from './heygen.mjs';

const BASE = 'https://api.d-id.com';
const KEY = process.env.DID_API_KEY;
if (!KEY) {
  console.error('DID_API_KEY is not set.');
  process.exit(2);
}
// Docs show the key passed as-is after "Basic". Some accounts need it base64-encoded; set DID_BASE64=1 then.
const AUTH = `Basic ${process.env.DID_BASE64 ? Buffer.from(KEY).toString('base64') : KEY}`;

async function did(method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: AUTH, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
async function upload(path, kind) {
  if (isUrl(path)) return path;
  const form = new FormData();
  form.append(kind, new Blob([await readFile(path)], { type: MIME[extname(path).toLowerCase()] }), basename(path));
  return (await did('POST', kind === 'image' ? '/images' : '/audios', form)).url;
}

const args = parseArgs(process.argv.slice(2));
if (!args.image || !args.audio) {
  console.error('usage: did-fallback.mjs --image face.jpg --audio voice.mp3 [--out out/did.mp4]');
  process.exit(1);
}

const t0 = Date.now();
const [source_url, audio_url] = await Promise.all([upload(args.image, 'image'), upload(args.audio, 'audio')]);
const tUp = Date.now();

const { id } = await did('POST', '/talks', {
  source_url,
  script: { type: 'audio', audio_url },
  config: { stitch: true, result_format: 'mp4' },
});
console.log(`talk ${id} submitted (upload ${((tUp - t0) / 1000).toFixed(1)}s)`);

const talk = await pollUntil('talk', () => did('GET', `/talks/${id}`), (d) => ['done', 'error', 'rejected'].includes(d.status), {
  intervalMs: 3000,
});
if (talk.status !== 'done') {
  console.error(`talk ${talk.status}:`, JSON.stringify(talk.error ?? talk));
  process.exit(1);
}
const tDone = Date.now();
const out = args.out ?? `out/did-${id}.mp4`;
await download(talk.result_url, out);
console.log(`saved ${out}  render ${((tDone - tUp) / 1000).toFixed(1)}s  total ${((Date.now() - t0) / 1000).toFixed(1)}s  duration ${talk.duration ?? '?'}s`);
