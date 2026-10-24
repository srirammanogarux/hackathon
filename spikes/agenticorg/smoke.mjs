// Smoke test: health -> list agents -> ensure "Boundaries" agent -> run one review
// -> (if flagged) show the pending approval item -> optional workflow + A2A.
//
//   node --env-file=.env spikes/agenticorg/smoke.mjs                 # agent run
//   node --env-file=.env spikes/agenticorg/smoke.mjs --workflow      # + workflow with human gate
//   node --env-file=.env spikes/agenticorg/smoke.mjs --a2a           # + A2A task (built-in compliance_guard)
//   node --env-file=.env spikes/agenticorg/smoke.mjs --draft "text"  # custom draft
//
// Env: AGENTICORG_API_KEY (ao_sk_...), AGENTICORG_BASE_URL (optional),
//      AGENTICORG_COMPANY_ID (only for --a2a).
import {
  HACKATHON_BASE_URL,
  createClient,
  ensureBoundariesAgent,
  reviewInputs,
  parseVerdict,
  boundariesWorkflowSpec,
  pollUntil,
} from './client.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const draftIdx = args.indexOf('--draft');

const DRAFT =
  draftIdx >= 0
    ? args[draftIdx + 1]
    : "Bengaluru's BEST dental clinic! 🦷 See Priya's smile before and after our veneers. " +
      '"Dr. Rao changed my life" - happy patient. Book now and get 30% off teeth whitening this Diwali!';

const apiKey = process.env.AGENTICORG_API_KEY || '';
const bases = [...new Set([process.env.AGENTICORG_BASE_URL, HACKATHON_BASE_URL].filter(Boolean))];

const log = (label, v) => console.log(`\n== ${label}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 2)}`);

async function pickBase() {
  for (const baseUrl of bases) {
    try {
      const h = await createClient({ baseUrl }).health();
      log(`health ${baseUrl}`, h);
      return baseUrl;
    } catch (e) {
      console.log(`health ${baseUrl} failed: ${e.message}`);
    }
  }
  throw new Error('No AgenticOrg base URL reachable');
}

const baseUrl = await pickBase();
const pub = createClient({ baseUrl });
const builtins = await pub.a2aBuiltinAgents();
log('built-in agent types (public, /api/v1/a2a/agents)', (builtins.agents ?? builtins).map((a) => a.id).join(', '));

if (!apiKey) {
  console.log('\nAGENTICORG_API_KEY is empty: stopping after public checks. Add the key to .env and re-run.');
  process.exit(0);
}

// Try each base with the key: the env URL may differ from the hackathon host.
let client;
let agents;
for (const b of [baseUrl, ...bases.filter((x) => x !== baseUrl)]) {
  try {
    client = createClient({ baseUrl: b, apiKey });
    agents = await client.listAgents();
    break;
  } catch (e) {
    console.log(`listAgents on ${b} failed: ${e.message}`);
    client = null;
  }
}
if (!client) process.exit(1);
log(`agents on ${client.baseUrl} (${agents.length})`, agents.map((a) => `${a.id}  ${a.name}  [${a.agent_type}, ${a.status}]`).join('\n'));

const { agent, created } = await ensureBoundariesAgent(client);
log(created ? 'created Boundaries agent' : 'using existing Boundaries agent', { id: agent.id ?? agent.agent_id, status: agent.status });
const agentId = agent.id ?? agent.agent_id;

log('draft', DRAFT);
const t0 = Date.now();
const run = await client.runAgent(agentId, { inputs: reviewInputs(DRAFT) });
log(`run (${Date.now() - t0} ms)`, {
  run_id: run.run_id,
  status: run.status,
  confidence: run.confidence,
  hitl_trigger: run.hitl_trigger,
  error: run.error,
});
log('verdict', parseVerdict(run.output) ?? run.output);

if (run.hitl_trigger) {
  // The run created a HITL item. Our app finds it by context.run_id and polls its status.
  try {
    const page = await client.listApprovals({ status: 'pending' });
    const item = (page.items ?? []).find((i) => i.context?.run_id === run.run_id);
    log('pending approval for this run', item ? { id: item.id, title: item.title, status: item.status, expires_at: item.expires_at } : 'not found in first page');
    console.log('A signed-in reviewer approves/rejects it in the AgenticOrg UI (Approvals). Poll GET /api/v1/approvals?status=approved|rejected to learn the decision.');
  } catch (e) {
    console.log(`listApprovals failed (key probably lacks approvals:read): ${e.message}`);
  }
}

if (flag('--workflow')) {
  try {
    const wf = await client.createWorkflow(boundariesWorkflowSpec(agentId));
    const wfId = wf.id ?? wf.workflow_id;
    log('workflow created', { id: wfId, name: wf.name });
    const started = await client.runWorkflow(wfId, reviewInputs(DRAFT));
    const runId = started.run_id ?? started.id;
    log('workflow run started', started);
    const final = await pollUntil(
      () => client.getWorkflowRun(runId),
      (r) => !['pending', 'running', 'queued'].includes(r.status),
      { onTick: (r) => console.log(`  run ${runId}: ${r.status} ${r.steps_completed}/${r.steps_total}`) },
    );
    log('workflow run (stops at waiting_hitl until a human decides)', {
      status: final.status,
      steps: (final.steps ?? []).map((s) => ({ id: s.step_id ?? s.id, status: s.status })),
    });
  } catch (e) {
    console.log(`workflow failed (needs workflows:write scope): ${e.message}`);
  }
}

if (flag('--a2a')) {
  const companyId = process.env.AGENTICORG_COMPANY_ID;
  if (!companyId) {
    console.log('\n--a2a needs AGENTICORG_COMPANY_ID (GET /api/v1/companies or the UI). Skipping.');
  } else {
    try {
      const task = await client.a2aCreateTask({ agentType: 'compliance_guard', companyId, inputs: reviewInputs(DRAFT) });
      log('a2a task', { id: task.run_id ?? task.id, status: task.status });
      log('a2a task (GET)', await client.a2aGetTask(task.run_id ?? task.id));
    } catch (e) {
      console.log(`a2a failed (needs a2a:write scope): ${e.message}`);
    }
  }
}
