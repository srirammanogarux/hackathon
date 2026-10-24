// Minimal HeyGen v3 client. Docs: https://developers.heygen.com (checked 24 Oct 2026).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, dirname } from 'node:path';

const BASE = 'https://api.heygen.com';

export function apiKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    console.error('HEYGEN_API_KEY is not set. Put it in the repo-root .env and run with --env-file-if-exists=../../.env');
    process.exit(2);
  }
  return key;
}

export async function heygen(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'X-Api-Key': apiKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.error ?? json)}`);
  return json.data;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4' };

// POST /v3/assets, multipart, max 32 MB (images, mp3/wav, mp4). Returns asset_id.
export async function uploadAsset(path) {
  const type = MIME[extname(path).toLowerCase()];
  if (!type) throw new Error(`Unsupported file type: ${path}`);
  const form = new FormData();
  form.append('file', new Blob([await readFile(path)], { type }), basename(path));
  const res = await fetch(`${BASE}/v3/assets`, { method: 'POST', headers: { 'X-Api-Key': apiKey() }, body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST /v3/assets -> ${res.status} ${JSON.stringify(json.error ?? json)}`);
  return json.data.asset_id ?? json.data.id;
}

export const isUrl = (s) => /^https?:\/\//.test(s);

export async function pollUntil(label, fn, done, { intervalMs = 5000, timeoutMs = 20 * 60_000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const data = await fn();
    const s = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`  [${s}s] ${label}: ${data.status}`);
    if (done(data)) return data;
    if (Date.now() - t0 > timeoutMs) throw new Error(`${label} timed out after ${s}s`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
      else out[a.slice(2)] = argv[++i];
    } else out._.push(a);
  }
  return out;
}
