// Shared Pine Labs Online (Plural) helpers. Plain fetch, no deps.
// Docs: https://www.pinelabs.com/docs/online-payments (append .md to any page for raw markdown)
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';

export const UAT_BASE = 'https://pluraluat.v2.pinepg.in';
export const BASE = process.env.PINELABS_BASE_URL || UAT_BASE;

const stdHeaders = () => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Request-ID': randomUUID(),
  'Request-Timestamp': new Date().toISOString(),
});

export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(', ')}. Fill .env and run with: node --env-file=.env ...`);
    process.exit(2);
  }
}

// POST /api/auth/v1/token  -> {access_token, expires_at | expires_in}
let cached;
export async function getToken() {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${BASE}/api/auth/v1/token`, {
    method: 'POST',
    headers: stdHeaders(),
    body: JSON.stringify({
      client_id: process.env.PINELABS_CLIENT_ID,
      client_secret: process.env.PINELABS_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`token HTTP ${res.status}: ${JSON.stringify(data)}`);
  const until = data.expires_at ? Date.parse(data.expires_at) : Date.now() + (data.expires_in ?? 3600) * 1000;
  cached = { token: data.access_token, until };
  return cached.token;
}

export async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...stdHeaders(), Authorization: `Bearer ${await getToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} HTTP ${res.status}: ${typeof data === 'string' ? data.slice(0, 400) : JSON.stringify(data)}`);
  return data;
}

export const PLANS = {
  trial: { paise: 100, label: 'Rs 1 trial' },
  monthly: { paise: 29900, label: 'Rs 299 / month' },
};

// GET /api/pay/v1/orders/{order_id} -> {data: {status, ...}}
export const getOrder = (orderId) => api('GET', `/api/pay/v1/orders/${encodeURIComponent(orderId)}`);

// ---- Signatures -----------------------------------------------------------

// Browser redirect to callback_url carries {order_id, status, signature, [error_code, error_message]}.
// Doc algorithm (checkout-hosted-integration, "Verify signature"): all fields except `signature`,
// sorted by key asc, joined "k=v&k=v", HMAC-SHA256 with the hex-decoded secret key, hex digest, uppercase.
export function callbackSigningString(params) {
  return Object.keys(params)
    .filter((k) => k !== 'signature' && params[k] !== undefined && params[k] !== null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}
export function signCallback(params, secretKeyHex) {
  return createHmac('sha256', Buffer.from(secretKeyHex, 'hex')).update(callbackSigningString(params)).digest('hex').toUpperCase();
}
export function verifyCallback(params, secretKeyHex) {
  if (!params?.signature || !secretKeyHex) return false;
  const expected = Buffer.from(signCallback(params, secretKeyHex));
  const got = Buffer.from(String(params.signature).toUpperCase());
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// Webhooks follow Standard Webhooks: headers webhook-id, webhook-timestamp, webhook-signature ("v1,<b64>" space-separated list).
// signed = `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with base64-decoded secret, base64 digest.
export function signWebhook({ id, timestamp, rawBody }, secretB64) {
  const key = Buffer.from(String(secretB64).replace(/^whsec_/, ''), 'base64');
  return createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
}
export function verifyWebhook(headers, rawBody, secretB64, { toleranceSec = 300 } = {}) {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const sigHeader = headers['webhook-signature'];
  if (!id || !timestamp || !sigHeader || !secretB64) return false;
  if (toleranceSec && Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec) return false;
  const expected = Buffer.from(signWebhook({ id, timestamp, rawBody }, secretB64));
  return String(sigHeader)
    .split(' ')
    .map((s) => s.split(',')[1] ?? s)
    .some((sig) => {
      const got = Buffer.from(sig);
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
}
