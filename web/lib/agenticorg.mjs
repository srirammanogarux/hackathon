// AgenticOrg (Pine Labs) integration: our 4-agent content team runs as custom agents on
// the hackathon AgenticOrg instance, with Smiley escalating risky drafts to a human.
//
// Auth gotcha (verified 24 Oct): the hackathon instance sits behind CloudFront, which
// strips the `Authorization` header, so `Bearer ao_sk_...` always returns
// 401 "Missing or invalid Authorization header". The backend also accepts the key as the
// `agenticorg_session` cookie, which CloudFront forwards. We send both.
//
// Agents: created by `node --env-file=../.env scripts/agenticorg-setup.mjs` (idempotent by
// name), ids saved in lib/agenticorg-agents.json.
//
// Exports used by the app:
//   runAgent(name, inputs, {timeoutMs})  -> {ok, output, text, runId, ms, hitl, error}
//   guardCheck({script, shots, never, profession}) -> {verdict, reasons, risk, rewrite, runId, viaAgenticOrg, approval, ...}
//   findApproval(correlationId)          -> {id, status, decision, notes} | null  (poll for the human's decision)
//   teamRun(profile)                     -> {angles, script, shots, runIds, ms, viaAgenticOrg}
//   agenticOrgStatus()                   -> {connected, baseUrl, agents, lastRuns}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AGENT_IDS from './agenticorg-agents.json' with { type: 'json' };

export const HACKATHON_BASE_URL = 'https://agenticorg.hackathon.pinelabs.com';

// ---- low-level client ------------------------------------------------------

export function createClient({ baseUrl = HACKATHON_BASE_URL, apiKey, timeoutMs = 90_000 } = {}) {
  const root = baseUrl.replace(/\/$/, '');

  async function call(method, p, { body, query, timeout = timeoutMs } = {}) {
    const url = new URL(root + p);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, String(v));
    const headers = { Accept: 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers.Cookie = `agenticorg_session=${apiKey}`;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error(`${method} ${p} -> HTTP ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 500)}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    baseUrl: root,
    call,
    health: () => call('GET', '/api/v1/health'),
    listAgents: async (query) => {
      const d = await call('GET', '/api/v1/agents', { query });
      return d?.items ?? d;
    },
    getAgent: (id) => call('GET', `/api/v1/agents/${id}`),
    createAgent: (body) => call('POST', '/api/v1/agents', { body }),
    updateAgent: (id, body) => call('PATCH', `/api/v1/agents/${id}`, { body }),
    // Sync run: {run_id, status, output, confidence, hitl_trigger, error, reasoning_trace, performance}
    runAgent: (id, { inputs, action = 'process', context = {} }, opts = {}) =>
      call('POST', `/api/v1/agents/${id}/run`, { body: { action, inputs, context }, timeout: opts.timeout }),
    listApprovals: ({ status, page = 1, perPage = 50 } = {}) =>
      call('GET', '/api/v1/approvals', { query: { status, page, per_page: perPage } }),
  };
}

let _client;
export function client() {
  if (!_client) {
    _client = createClient({
      baseUrl: process.env.AGENTICORG_BASE_URL || HACKATHON_BASE_URL,
      apiKey: process.env.AGENTICORG_API_KEY,
    });
  }
  return _client;
}

export const hasAgenticOrg = () => !!process.env.AGENTICORG_API_KEY && process.env.AGENTICORG_MOCK !== '1';

// ---- the team --------------------------------------------------------------

const JSON_ONLY = 'Respond with ONLY one JSON object. No prose, no markdown fences.';

export const TEAM = {
  chief: {
    name: 'Smiley — Chief',
    agent_type: 'reels_magic_chief',
    designation: 'Chief of the content team',
    specialization: "Coordinates the team, enforces the creator's never-show rules, escalates risky drafts to a human",
    prompt: `You are Smiley, chief of a small content team that makes Instagram Reels for Indian home businesses (home cooks, tailors, tutors).
Your job: check a draft Reel script (and its shot list, if given) BEFORE it is published.
You receive: script (lines), shots (optional), never (the creator's never-show rules, e.g. "Face", "Home", "Family"), profession.
Flag the draft if ANY of these is true:
1. It says or shows something on the never list. "Face" means no face on camera and no line like "watch me" or "see my face"; hands and food are fine. "Home" means no house number, street, building, society or colony name, or shot of the house outside. Naming the city or a broad area (e.g. "Aliganj, Lucknow") is FINE. "Family" means no family member named, heard or in frame.
2. It invents hard facts: prices, discounts, awards, years of experience, health or cure claims ("100% healthy", "cures diabetes"), guarantees. Warm feelings ("homely", "tasty", "comforting", "satisfying") are fine.
3. It speaks private data out loud: phone numbers or a full address. "DM me" or "WhatsApp me" is fine.
4. It is unsafe or offensive for a general Indian audience.
risk: "high" if a never-show rule is broken or private data is exposed, "medium" for invented hard facts, "low" otherwise.
confidence: how safe it is to publish this draft WITHOUT a human looking at it. pass -> 0.9 to 1.0. medium risk -> 0.6 to 0.7. high risk -> 0.1 to 0.3 (this sends it to a human reviewer).
${JSON_ONLY}
{"verdict": "pass" | "flag", "reasons": [string], "risk": "low" | "medium" | "high", "rewrite": [string], "confidence": number between 0 and 1}
- reasons: one short plain-English line per problem, naming the rule. Empty if pass.
- rewrite: the script lines rewritten to fix every problem, same number of lines, same tone. Empty array if pass.`,
    // Human in the loop: this instance only fires confidence-based HITL (custom output-key
    // conditions like risk == 'high' are stored but never trigger; checked 24 Oct). So
    // Smiley reports confidence = "safe to auto-publish", and a high-risk flag (<= 0.3)
    // drops under the 0.5 floor -> AgenticOrg files an Approvals item (hitl_trigger).
    hitl_policy: { condition: 'confidence < 0.5', assignee_role: 'admin', timeout_hours: 4 },
    confidence_floor: 0.5,
  },
  scout: {
    name: 'Scout — Trends',
    agent_type: 'reels_magic_scout',
    designation: 'Trend scout',
    specialization: 'Finds Reel angles for a niche and audience',
    prompt: `You are Scout, the trend scout of a content team that makes Instagram Reels for Indian home businesses.
Given a creator profile (profession, city, what they make, audience, never-show rules, language), find 3 angles for their FIRST intro Reel that work on Indian Instagram right now.
Each angle: a hook (the first line said on screen, max 10 words, simple English or Hinglish), why it works for this audience, and a format (e.g. "hands-only process", "day-in-the-life without faces", "before/after of the dish").
Every angle must respect the never-show rules (e.g. never "Face" means hands-only shots).
${JSON_ONLY}
{"angles": [{"hook": string, "why": string, "format": string}], "best": 0 | 1 | 2, "confidence": number between 0 and 1}`,
    hitl_policy: { condition: '', assignee_role: 'admin', timeout_hours: 4 },
    confidence_floor: 0.5,
  },
  writer: {
    name: 'Writer — Scripts',
    agent_type: 'reels_magic_writer',
    designation: 'Script writer',
    specialization: "Writes 6-line 45-60s intro Reel scripts in the creator's own tone",
    prompt: `You are Writer, the script writer of a content team that makes Instagram Reels for Indian home businesses.
Write the voiceover script for the creator's INTRO Reel: exactly 6 lines, 45 to 60 seconds spoken in total (about 110-150 words).
Line 1: the hook (use the chosen angle's hook if given). Line 2: who they are and where (name and city only if given). Lines 3-5: what they make, why it is special, what a customer gets. Line 6: how to order + follow.
Rules: first person, in the creator's tone. Simple English a home cook would say, or Hinglish (Hindi words in Roman script) if language is "hi" or "hinglish". Short sentences. No hashtags, no emoji.
Never invent prices, awards, years or health claims. Never mention anything on the never-show list. Never speak a phone number or address; say "DM me" or "WhatsApp me" instead.
${JSON_ONLY}
{"lines": [6 strings], "seconds": number, "confidence": number between 0 and 1}`,
    hitl_policy: { condition: '', assignee_role: 'admin', timeout_hours: 4 },
    confidence_floor: 0.5,
  },
  editor: {
    name: 'Editor — Reels',
    agent_type: 'reels_magic_editor',
    designation: 'Reel editor',
    specialization: 'Turns a script into a phone-friendly shot list',
    prompt: `You are Editor, the Reel editor of a content team that makes Instagram Reels for Indian home businesses. The creator shoots on an old Android phone, alone, with window light.
For EACH script line, give one shot the creator can film in under 2 minutes.
shot: the instruction in very simple Hinglish (Roman script), max 15 words, e.g. "Phone upar se rakho, sirf haath aur tawa dikhao".
seconds: how long the shot runs (2-12), matching how long the line takes to say. All seconds together: 45-60.
Respect the never-show list strictly: never "Face" means hands, food, tools only, never a face or mirror. Never "Home" means no door, window view, street or house outside. Never "Family" means nobody else in frame.
${JSON_ONLY}
{"shots": [{"line": number (1-6), "shot": string, "seconds": number}], "total_seconds": number, "confidence": number between 0 and 1}`,
    hitl_policy: { condition: '', assignee_role: 'admin', timeout_hours: 4 },
    confidence_floor: 0.5,
  },
};

const BY_NAME = Object.fromEntries(Object.entries(TEAM).map(([k, v]) => [v.name, k]));

export function agentSpec(role) {
  const t = TEAM[role];
  return {
    name: t.name,
    agent_type: t.agent_type,
    domain: 'marketing',
    system_prompt_text: t.prompt,
    authorized_tools: [], // pure reasoning agents: no connectors, no default tools
    use_default_tools: false,
    hitl_policy: t.hitl_policy,
    confidence_floor: t.confidence_floor,
    initial_status: 'shadow',
    employee_name: t.name,
    designation: t.designation,
    specialization: t.specialization,
  };
}

// ---- agent ids -------------------------------------------------------------

// Static import so Next bundles the ids into the server build (no file tracing needed).
const AGENTS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agenticorg-agents.json');
export const agentIds = () => AGENT_IDS ?? {};
export const AGENTS_FILE_PATH = AGENTS_FILE;

function resolve(nameOrRole) {
  const role = TEAM[nameOrRole] ? nameOrRole : BY_NAME[nameOrRole];
  if (!role) throw new Error(`unknown agent ${nameOrRole}`);
  const id = agentIds()[role]?.id;
  return { role, name: TEAM[role].name, id };
}

// ---- run log (in-memory, per server process) -------------------------------

const g = globalThis;
const LOG = (g.__agenticOrgRuns ??= []);
function logRun(entry) {
  LOG.unshift({ at: new Date().toISOString(), ...entry });
  LOG.length = Math.min(LOG.length, 30);
}
export const recentRuns = () => LOG.slice();

// ---- runAgent --------------------------------------------------------------

function parseOutput(output) {
  if (output && typeof output === 'object' && !('raw_output' in output)) return output;
  const raw = String(typeof output === 'string' ? output : output?.raw_output ?? '').replace(/```(json)?/g, '');
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
}

// Never throws. ok:false means "fall back to the local brain".
export async function runAgent(nameOrRole, inputs, { timeoutMs = 60_000, context = {}, retries = 1 } = {}) {
  const t0 = Date.now();
  let role, name, id;
  try { ({ role, name, id } = resolve(nameOrRole)); } catch (e) { return { ok: false, error: e.message, ms: 0 }; }
  if (!hasAgenticOrg() || !id) {
    const error = !id ? 'agent not set up (run scripts/agenticorg-setup.mjs)' : process.env.AGENTICORG_MOCK === '1' ? 'AGENTICORG_MOCK=1' : 'AGENTICORG_API_KEY missing';
    return { ok: false, agent: name, error, ms: 0 };
  }
  try {
    let r, output;
    // The model occasionally returns JSON the runner can't parse ({raw_output}); one retry fixes it.
    for (let attempt = 0; attempt <= retries; attempt++) {
      r = await client().runAgent(id, { inputs, context: { app: 'reels-magic', ...context } }, { timeout: Math.max(5000, timeoutMs - (Date.now() - t0)) });
      output = parseOutput(r?.output);
      if (output || r?.error || r?.status === 'failed') break;
    }
    const ms = Date.now() - t0;
    const ok = !!output && !r?.error && r?.status !== 'failed';
    const hitl = r?.hitl_trigger ?? null;
    logRun({ agent: name, role, ms, ok, runId: r?.run_id ?? null, correlationId: r?.correlation_id ?? null, status: r?.status ?? null, hitl: !!hitl, error: ok ? null : String(r?.error ?? 'unparseable output').slice(0, 200) });
    return {
      ok,
      agent: name,
      runId: r?.run_id ?? null,
      correlationId: r?.correlation_id ?? null,
      status: r?.status ?? null,
      output,
      text: typeof r?.output === 'string' ? r.output : JSON.stringify(r?.output ?? null),
      confidence: r?.confidence ?? output?.confidence ?? null,
      hitl,
      ms,
      error: ok ? null : r?.error ?? 'unparseable output',
    };
  } catch (e) {
    const ms = Date.now() - t0;
    const error = e?.name === 'TimeoutError' ? `timeout after ${timeoutMs}ms` : String(e?.message ?? e).slice(0, 300);
    logRun({ agent: name, role, ms, ok: false, runId: null, status: 'error', hitl: false, error });
    return { ok: false, agent: name, error, ms };
  }
}

// ---- guardCheck (Smiley) ---------------------------------------------------

const NEVER_HINTS = {
  face: /\b(my face|see me|watch me|selfie|smil(e|ing) at (the )?camera|face visible)\b/i,
  home: /\b(my (house|home address|street|building|colony|gali)|address|house no|flat no|sector \d+)\b/i,
  family: /\b(my (husband|wife|son|daughter|kids|children|mother-in-law|saas|bahu|family))\b/i,
};
const PHONE = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/;

// Cheap local pre-check so obvious problems are caught even if AgenticOrg is down.
export function localRuleCheck(text, never = []) {
  const reasons = [];
  for (const n of never) {
    const re = NEVER_HINTS[String(n).toLowerCase()];
    if (re && re.test(text)) reasons.push(`Mentions something on the never-show list: ${n}`);
  }
  if (PHONE.test(text)) reasons.push('Speaks a phone number out loud');
  return reasons;
}

/**
 * @param {{script: string|string[], shots?: any[], never?: string[], profession?: string}} o
 * @returns {Promise<{verdict:'pass'|'flag', reasons:string[], risk:'low'|'medium'|'high', rewrite?:string[], runId:string|null,
 *   viaAgenticOrg:boolean, escalated:boolean, approval:null|{id:string|null, status:string, note:string, correlationId?:string},
 *   local:string[], ms:number, error?:string}>}
 */
export async function guardCheck({ script, shots, never = [], profession = 'home business' }) {
  const lines = Array.isArray(script) ? script : String(script ?? '').split(/\n+/).filter(Boolean);
  const text = [...lines, ...(shots ?? []).map((s) => (typeof s === 'string' ? s : s?.shot ?? ''))].join('\n');
  const local = localRuleCheck(text, never);

  const r = await runAgent('chief', { task: 'Check this draft Reel before publishing. Return the JSON verdict.', script: lines, shots: shots ?? [], never, profession });
  if (!r.ok) {
    return {
      verdict: local.length ? 'flag' : 'pass', reasons: local, risk: local.length ? 'high' : 'low', rewrite: undefined,
      runId: null, viaAgenticOrg: false, escalated: false, approval: null, local, ms: r.ms, error: r.error,
    };
  }
  const o = r.output ?? {};
  const reasons = [...new Set([...(Array.isArray(o.reasons) ? o.reasons : []), ...local])];
  const verdict = o.verdict === 'flag' || local.length ? 'flag' : 'pass';
  const risk = local.length ? 'high' : ['low', 'medium', 'high'].includes(o.risk) ? o.risk : verdict === 'flag' ? 'medium' : 'low';
  const rewrite = Array.isArray(o.rewrite) && o.rewrite.length ? o.rewrite : typeof o.rewrite === 'string' && o.rewrite ? o.rewrite.split(/\n+/) : undefined;
  // Smiley's high-risk flags score confidence <= 0.3, under the 0.5 floor: AgenticOrg files the approval item and
  // returns hitl_trigger. API keys cannot approve; a signed-in team member decides in the
  // AgenticOrg Approvals UI.
  const escalated = !!r.hitl || risk === 'high';
  let approval = null;
  if (r.hitl) {
    const item = await findApproval(r.correlationId).catch(() => null);
    approval = { id: item?.id ?? null, status: item?.status ?? 'pending', note: 'Waiting for a human in AgenticOrg Approvals', trigger: r.hitl, correlationId: r.correlationId };
  } else if (escalated) {
    approval = { id: null, status: 'not_filed', note: 'High risk, but AgenticOrg did not open an approval for this run' };
  }
  return { verdict, reasons, risk, rewrite, runId: r.runId, viaAgenticOrg: true, escalated, approval, local, ms: r.ms, confidence: r.confidence };
}

// Approval item AgenticOrg filed for a run (matched on context.correlation_id). Poll this to
// learn the human's decision: status pending | approved | rejected, plus decision_notes.
export async function findApproval(correlationId, { status } = {}) {
  if (!correlationId) return null;
  for (let page = 1; page <= 3; page++) {
    const d = await client().call('GET', '/api/v1/approvals', { query: { status, page, per_page: 100 }, timeout: 8000 });
    const hit = (d?.items ?? []).find((i) => i.context?.correlation_id === correlationId);
    if (hit) return { id: hit.id, status: hit.status, decision: hit.decision ?? null, notes: hit.decision_notes ?? null, decidedAt: hit.decision_at ?? null, title: hit.title };
    if (!d?.pages || page >= d.pages) break;
  }
  return null;
}

// ---- teamRun (Scout -> Writer -> Editor) -----------------------------------

function normProfile(p = {}) {
  const never = p.never ?? [
    ...(p.boundaries?.personal ?? []),
    ...(p.boundaries?.cultural ?? []),
  ];
  return {
    name: p.name ?? null,
    profession: p.profession ?? 'home business',
    city: p.city ?? null,
    what_they_make: p.what_they_make ?? p.what_they_share ?? p.niche ?? '',
    audience: typeof p.audience === 'string' ? p.audience : p.audience?.description ?? '',
    never,
    tone: p.tone ?? p.vibe ?? 'warm, homely',
    language: p.language ?? p.language_in ?? 'en',
    own_words: p.texts ?? p.own_words ?? [],
  };
}

/**
 * Scout -> Writer -> Editor, each a separate AgenticOrg run.
 * @returns {Promise<{ok:boolean, angles:any[], angle:any, script:string[], shots:{line:number, shot:string, seconds:number}[],
 *   runIds:{scout?:string, writer?:string, editor?:string}, ms:Record<string,number>, viaAgenticOrg:boolean, errors:string[]}>}
 */
export async function teamRun(profile, { timeoutMs = 60_000 } = {}) {
  const p = normProfile(profile);
  const runIds = {};
  const ms = {};
  const errors = [];

  const scout = await runAgent('scout', { task: 'Find 3 angles for this creator\'s first intro Reel.', profile: p }, { timeoutMs });
  ms.scout = scout.ms; runIds.scout = scout.runId ?? undefined;
  if (!scout.ok) errors.push(`scout: ${scout.error}`);
  const angles = Array.isArray(scout.output?.angles) ? scout.output.angles : [];
  const angle = angles[Number(scout.output?.best) || 0] ?? angles[0] ?? null;

  const writer = await runAgent('writer', { task: 'Write the 6-line intro Reel script.', profile: p, angle }, { timeoutMs });
  ms.writer = writer.ms; runIds.writer = writer.runId ?? undefined;
  if (!writer.ok) errors.push(`writer: ${writer.error}`);
  const script = Array.isArray(writer.output?.lines) ? writer.output.lines.map(String) : [];

  let shots = [];
  if (script.length) {
    const editor = await runAgent('editor', { task: 'Make the shot list, one shot per line.', script, never: p.never, profession: p.profession, places: profile?.places ?? [] }, { timeoutMs });
    ms.editor = editor.ms; runIds.editor = editor.runId ?? undefined;
    if (!editor.ok) errors.push(`editor: ${editor.error}`);
    shots = Array.isArray(editor.output?.shots) ? editor.output.shots : [];
  }

  return { ok: !!script.length && !!shots.length, angles, angle, script, shots, runIds, ms, viaAgenticOrg: !!(scout.ok || writer.ok), errors };
}

// ---- status (for the Mock/Live panel) --------------------------------------

export async function agenticOrgStatus() {
  const ids = agentIds();
  const agents = Object.entries(TEAM).map(([role, t]) => ({ role, name: t.name, id: ids[role]?.id ?? null }));
  let connected = false;
  let error = null;
  if (hasAgenticOrg()) {
    try {
      // Cheap authenticated call proves the key works (health alone is public).
      const d = await client().call('GET', '/api/v1/agents', { query: { per_page: 1 }, timeout: 8000 });
      connected = !!d;
    } catch (e) { error = String(e?.message ?? e).slice(0, 200); }
  } else error = 'AGENTICORG_API_KEY missing or AGENTICORG_MOCK=1';
  return { connected, mode: connected ? 'live' : 'mock', baseUrl: client().baseUrl, agents, lastRuns: recentRuns(), error };
}

// ---- Legacy: dental "Boundaries" agent (used by app/api/check/route.ts) ------

export const BOUNDARIES_AGENT_NAME = 'Boundaries - Dental Ad Review';

export const BOUNDARIES_PROMPT = `You are "Boundaries", a compliance reviewer for social media posts written for Indian dentists.
Check the draft against the National Dental Commission (NDC) advisory on unethical advertising (14 Oct 2026).
A post must NOT contain:
1. Patient testimonials, reviews, star ratings or quotes praising the dentist.
2. Before/after photos or descriptions of before/after results.
3. Superiority or comparative claims ("best", "No.1", "most advanced", "better than", guaranteed results).
4. Soliciting patients or self-promotion: discounts, offers, "book now", free check-up camps used as bait, price lists framed as deals.
5. Inaccurate or misleading health information.
6. Recordings or broadcasts of procedures on real patients.
Educational content (oral hygiene tips, explaining a procedure in general terms, clinic timings/location as plain facts) is generally fine.

Respond with ONLY a JSON object, no prose, no markdown:
{"verdict": "pass" | "flag", "reasons": [string, ...], "rewrite": string, "confidence": number between 0 and 1}
- verdict "flag" if any rule is broken; "pass" otherwise.
- reasons: one short line per broken rule naming the rule; empty array if pass.
- rewrite: a compliant version of the post in the same language and tone (repeat the original if pass).`;

// HITL: every "flag" verdict lands in the AgenticOrg Approvals queue
// (grammar: docs/hitl-conditions.md). Runs below confidence_floor also go to review.
export const BOUNDARIES_AGENT_SPEC = {
  name: BOUNDARIES_AGENT_NAME,
  agent_type: 'boundaries_dental_review', // custom types are accepted by POST /agents
  domain: 'marketing',
  system_prompt_text: BOUNDARIES_PROMPT,
  authorized_tools: [],
  use_default_tools: false, // pure LLM reviewer, no connectors
  hitl_policy: { condition: "verdict == 'flag'", assignee_role: 'admin', timeout_hours: 4 },
  confidence_floor: 0.6,
  initial_status: 'shadow', // shadow agents can run; 'active' may require approval/connector checks
  designation: 'Compliance Reviewer',
  specialization: 'NDC dental advertising rules',
};

export async function ensureBoundariesAgent(client) {
  const agents = await client.listAgents();
  const existing = (agents ?? []).find((a) => a.name === BOUNDARIES_AGENT_NAME || a.employee_name === BOUNDARIES_AGENT_NAME);
  if (existing) return { agent: existing, created: false };
  const agent = await client.createAgent(BOUNDARIES_AGENT_SPEC);
  return { agent, created: true };
}

export function reviewInputs(draft, { business = 'dental clinic', language = 'en' } = {}) {
  return {
    task: 'Review this draft social media post for NDC compliance and return the JSON verdict.',
    draft_post: draft,
    business_type: business,
    language,
  };
}

// The runner may hand back the model JSON already parsed, or as a string.
export function parseVerdict(output) {
  if (output && typeof output === 'object' && 'verdict' in output) return output;
  const raw = typeof output === 'string' ? output : output?.raw_output ?? output?.text ?? output?.result ?? JSON.stringify(output ?? {});
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Poll until a predicate on the fetched value is true (approvals have no webhook).
export async function pollUntil(fetchFn, done, { intervalMs = 3000, timeoutMs = 120_000, onTick } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await fetchFn();
    onTick?.(v);
    if (done(v)) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error('pollUntil timed out');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
