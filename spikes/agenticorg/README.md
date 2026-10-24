# AgenticOrg spike: "Boundaries" agent with a human gate

```bash
node --env-file=.env spikes/agenticorg/smoke.mjs              # list, create/reuse, run one review
node --env-file=.env spikes/agenticorg/smoke.mjs --workflow   # also: workflow with a human_in_loop step
node --env-file=.env spikes/agenticorg/smoke.mjs --a2a        # also: A2A task (needs AGENTICORG_COMPANY_ID)
```

Env: `AGENTICORG_API_KEY` (starts `ao_sk_`), `AGENTICORG_BASE_URL` (optional; the script tries it and then `https://agenticorg.hackathon.pinelabs.com`).

## Status (24 Oct, 15:10)

- Verified without a key: the hackathon instance is up. `GET /api/v1/health` returns `version 4.8.0`, the same version as the GitHub repo HEAD I read. `GET /api/v1/a2a/agents` (public) lists 55 built-in agent types, including `compliance_guard`, `content_factory` and `social_media`. Authenticated routes return `401 {"detail":"Missing or invalid Authorization header"}`.
- Not run yet: everything that needs a key. There is no `.env` in the workspace, so the key wasn't available.
- Watch out: a GET request with a body (e.g. `curl -d '{}'`) gets a 403 HTML page from the edge WAF. `client.mjs` never sends one.

## Real endpoints (from `docs/route_inventory.json`, `sdk-ts/src/index.ts`, `api/v1/*.py`)

Auth on every call: `Authorization: Bearer ao_sk_...`.

| Purpose | Route | Key scope |
|---|---|---|
| List agents | `GET /api/v1/agents` → `{items:[...]}` | agents:read |
| Create agent | `POST /api/v1/agents` | agents:write |
| Run agent by id (sync) | `POST /api/v1/agents/{id}/run` body `{action, inputs, context}` | agents:write |
| A2A run by built-in type (sync) | `POST /api/v1/a2a/tasks` body `{agent_type, company_id, action, inputs, context, metadata}` | a2a:write |
| A2A task status | `GET /api/v1/a2a/tasks/{task_id}` → `{id, status, agent_type, result}` | a2a:read |
| Approvals queue | `GET /api/v1/approvals?status=pending\|approved\|rejected&include_expired=` | approvals:read |
| Decide | `POST /api/v1/approvals/{hitl_id}/decide` `{decision: approve\|reject, notes}` | human JWT only |
| Create workflow | `POST /api/v1/workflows` `{name, definition:{steps:[...]}, domain}` → `{workflow_id}` | workflows:write |
| Run workflow | `POST /api/v1/workflows/{id}/run` `{payload}` → `{run_id, status:"running"}` | workflows:write |
| Run status | `GET /api/v1/workflows/runs/{run_id}` → `{status, steps_total, steps_completed, steps[], result}` | workflows:read |

The agent run response looks like `{run_id, status, output, confidence, hitl_trigger, error, reasoning_trace, performance}`. `output` is the model's JSON, already parsed (or `{raw_output}` if parsing failed).

**Key scopes:** a key made with the default scopes only has `agents:read/write, connectors.read, mcp:read, mcp:call, a2a:read`. When you create the key (Settings > API Keys), add `a2a:write workflows:read workflows:write approvals:read`. Without them, A2A, workflows and approvals return 403.

**A2A caveat:** `/a2a/tasks` only accepts built-in `agent_type` values and runs the built-in prompt. It also needs a `company_id` that belongs to the tenant. Our custom Boundaries prompt therefore runs through `POST /agents/{id}/run`, not A2A.

## The Boundaries agent

`client.mjs` exports `BOUNDARIES_AGENT_SPEC`. It's a custom `agent_type` with no tools, `initial_status: "shadow"` (shadow agents can run), and a system prompt covering the six NDC rules. The agent returns `{verdict, reasons, rewrite, confidence}`.

## Human-in-the-loop: how it works and how our app finds out

1. **Agent-level gate (simplest).** Set `hitl_policy.condition = "verdict == 'flag'"` (grammar: `docs/hitl-conditions.md`; `always` reviews every run). Any run with that verdict, or with confidence below `confidence_floor`, gets `hitl_trigger` in the run response. It also creates a HITL item (`context.run_id` = our `run_id`) that shows up in the AgenticOrg **Approvals** UI.
2. **Workflow gate.** Use the steps `review` (`type: agent, agent_id`) and then `human_review` (`type: human_in_loop, assignee_role: admin`). The run pauses with `status: "waiting_hitl"` and resumes after the decision. See `boundariesWorkflowSpec()`. If a step gets no `inputs`, it receives the trigger payload.
3. **Who decides.** Only a signed-in AgenticOrg user can decide. `/decide` reads the user's JWT `sub`; an API key cannot approve, and the requester cannot approve their own item when a policy applies. So the human has to be a team member, or the business owner invited via `POST /api/v1/org/invite`, with an admin role or a role matching the domain.
4. **How our app learns the decision.** Poll. There is no decision webhook.
   - Agent gate: `GET /api/v1/approvals?status=approved` (and `rejected`), then match `context.run_id` to the run. Items have `status`, `decision`, `decision_notes`, `decision_at` and `expires_at` (default 4 h).
   - Workflow gate: `GET /api/v1/workflows/runs/{run_id}` until `status` leaves `waiting_hitl`.
   - `pollUntil()` in `client.mjs` does this, every 3 s.

Demo flow: the user writes a post, our backend runs Boundaries. On `pass`, it publishes. On `flag`, we show "Waiting for review", a team member approves in the AgenticOrg UI, and our poller picks up the decision and publishes or shows the rewrite.

## Open questions for mentors
- Is the hackathon tenant's key minted with `a2a:write`, `workflows:*` and `approvals:*`?
- Is `approvals.resume_agent_runs` on? (It's off by default, so an approved standalone run is not re-executed; we just read the decision.)
- Past team bug: a workflow ran zero steps. If `--workflow` shows `steps_total: 0`, fall back to the agent-level gate.
