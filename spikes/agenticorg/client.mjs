// Minimal AgenticOrg REST client (plain fetch, no deps).
// Routes verified against github.com/mishrasanjeev/agentic-org (v4.8.0, same
// version the hackathon instance reports at /api/v1/health):
//   docs/route_inventory.json, sdk-ts/src/index.ts, api/v1/{agents,a2a,approvals,workflows}.py
//
// Auth: workspace API key (ao_sk_...) as `Authorization: Bearer <key>`.
// Default-scope keys carry agents:read/write, connectors.read, mcp:read/call, a2a:read.
// They do NOT carry a2a:write, workflows:*, approvals:* -> create the key with
// those scopes (Settings > API Keys) if you need A2A tasks / workflows / approvals.

export const HACKATHON_BASE_URL = 'https://agenticorg.hackathon.pinelabs.com';

export function createClient({ baseUrl = HACKATHON_BASE_URL, apiKey, timeoutMs = 90_000 } = {}) {
  const root = baseUrl.replace(/\/$/, '');

  async function call(method, path, { body, query } = {}) {
    const url = new URL(root + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, String(v));
    const headers = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const err = new Error(`${method} ${path} -> HTTP ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data)}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    baseUrl: root,
    call,

    // Public (no key)
    health: () => call('GET', '/api/v1/health'),
    a2aAgentCard: () => call('GET', '/api/v1/a2a/agent-card'),
    a2aBuiltinAgents: () => call('GET', '/api/v1/a2a/agents'), // built-in agent_type catalog

    // Agents (scope agents:read / agents:write)
    listAgents: async (query) => {
      const d = await call('GET', '/api/v1/agents', { query });
      return d?.items ?? d;
    },
    getAgent: (id) => call('GET', `/api/v1/agents/${id}`),
    createAgent: (body) => call('POST', '/api/v1/agents', { body }),
    updateAgent: (id, body) => call('PATCH', `/api/v1/agents/${id}`, { body }),
    // Synchronous: returns {run_id, status, output, confidence, hitl_trigger, ...}
    runAgent: (id, { inputs, action = 'process', context = {} }) =>
      call('POST', `/api/v1/agents/${id}/run`, { body: { action, inputs, context } }),

    // A2A (scope a2a:write). Only BUILT-IN agent_type values (see a2aBuiltinAgents);
    // runs the built-in prompt, not a custom agent's prompt. company_id required.
    a2aCreateTask: ({ agentType, companyId, inputs, action = 'process', context = {}, metadata = {} }) =>
      call('POST', '/api/v1/a2a/tasks', {
        body: { agent_type: agentType, company_id: companyId, action, inputs, context, metadata },
      }),
    a2aGetTask: (taskId) => call('GET', `/api/v1/a2a/tasks/${taskId}`),

    // Approvals / HITL queue (scope approvals:read). Deciding needs a signed-in
    // human JWT (POST /api/v1/approvals/{id}/decide reads the user's `sub`);
    // an API key cannot approve.
    listApprovals: async ({ status, includeExpired, page = 1, perPage = 50 } = {}) =>
      call('GET', '/api/v1/approvals', {
        query: { status, include_expired: includeExpired, page, per_page: perPage },
      }),

    // Workflows (scope workflows:read / workflows:write)
    createWorkflow: (body) => call('POST', '/api/v1/workflows', { body }),
    runWorkflow: (wfId, payload = {}) => call('POST', `/api/v1/workflows/${wfId}/run`, { body: { payload } }),
    getWorkflowRun: (runId) => call('GET', `/api/v1/workflows/runs/${runId}`),
  };
}

// ---- Boundaries agent ------------------------------------------------------

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

// Workflow: agent review -> human_in_loop gate. Agent steps without `inputs`
// receive the run's trigger payload (workflows/step_types.py).
export function boundariesWorkflowSpec(agentId) {
  return {
    name: 'Boundaries review with human gate',
    domain: 'marketing',
    description: 'Boundaries agent reviews a draft post, a human approves before publishing.',
    definition: {
      name: 'Boundaries review with human gate',
      steps: [
        { id: 'review', name: 'Boundaries review', type: 'agent', agent_id: agentId },
        {
          id: 'human_review',
          name: 'Human approves post',
          type: 'human_in_loop',
          depends_on: ['review'],
          assignee_role: 'admin',
          timeout_hours: 4,
          decision_options: ['approve', 'reject'],
        },
      ],
    },
  };
}

// Poll until a predicate on the fetched value is true.
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
