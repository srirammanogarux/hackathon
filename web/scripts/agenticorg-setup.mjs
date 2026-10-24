// Create (or update) the 4 Reels Magic agents on AgenticOrg, idempotent by name.
// Run from web/: node --env-file=../.env scripts/agenticorg-setup.mjs
import { writeFileSync } from 'node:fs';
import { client, TEAM, agentSpec, AGENTS_FILE_PATH } from '../lib/agenticorg.mjs';

const c = client();
console.log('health', await c.health());

const all = [];
for (let page = 1; ; page++) {
  const d = await c.call('GET', '/api/v1/agents', { query: { page, per_page: 100 } });
  all.push(...(d?.items ?? []));
  if (!d?.pages || page >= d.pages) break;
}
console.log(`tenant has ${all.length} agents`);

const out = {};
for (const role of Object.keys(TEAM)) {
  const spec = agentSpec(role);
  const existing = all.find((a) => a.name === spec.name);
  let agent;
  if (existing) {
    // Only the prompt and persona. Changing tools / HITL / confidence floor on an existing
    // agent opens a "Governance change approval" that a human must approve in the UI.
    agent = await c.updateAgent(existing.id, {
      system_prompt_text: spec.system_prompt_text,
      designation: spec.designation,
      specialization: spec.specialization,
    }).catch((e) => { console.warn(`update ${spec.name} failed: ${e.message}`); return existing; });
    console.log(`reused  ${spec.name} ${existing.id}`);
    agent = { ...existing, ...agent, id: existing.id };
  } else {
    agent = await c.createAgent(spec);
    console.log(`created ${spec.name} ${agent.id ?? agent.agent_id}`);
  }
  out[role] = { name: spec.name, id: agent.id ?? agent.agent_id, status: agent.status ?? null, hitl_condition: agent.hitl_condition ?? spec.hitl_policy.condition };
}
writeFileSync(AGENTS_FILE_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${AGENTS_FILE_PATH}`);
console.log(out);
