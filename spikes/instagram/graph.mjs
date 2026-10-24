// Tiny Graph API client for the "Instagram API with Facebook Login" variant (graph.facebook.com).
// Docs: developers.facebook.com/docs/instagram-platform (checked 24 Oct 2026, Graph API v26.0).
export const VERSION = process.env.GRAPH_API_VERSION ?? 'v26.0';
export const GRAPH = `https://graph.facebook.com/${VERSION}`;

export function env() {
  const { IG_USER_ID, IG_ACCESS_TOKEN } = process.env;
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) return null;
  return { userId: IG_USER_ID, token: IG_ACCESS_TOKEN };
}

export function requireEnv() {
  const e = env();
  if (!e) {
    console.error('IG_USER_ID and IG_ACCESS_TOKEN must be set in the repo-root .env (see SETUP.md).');
    process.exit(2);
  }
  return e;
}

export async function graph(method, path, params = {}) {
  const { token } = requireEnv();
  const qs = new URLSearchParams({ ...stringify(params), access_token: token });
  const url = method === 'GET' ? `${GRAPH}${path}?${qs}` : `${GRAPH}${path}`;
  const res = await fetch(url, method === 'GET' ? {} : { method, body: qs });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    const err = new Error(`${method} ${path} -> ${res.status} ${e.type ?? ''} code=${e.code} sub=${e.error_subcode ?? '-'}: ${e.error_user_msg ?? e.message ?? JSON.stringify(json)}`);
    err.graph = e;
    throw err;
  }
  return json;
}

function stringify(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) out[k] = String(v);
  return out;
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
