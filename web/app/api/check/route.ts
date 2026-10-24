import { checkBoundaries } from "@/lib/brain/brain.mjs";
import { createClient, ensureBoundariesAgent, reviewInputs, parseVerdict } from "@/lib/agenticorg.mjs";
import { has, json, errorJson } from "@/lib/server";

export const maxDuration = 120;

// Kaaval: brain rule engine + Claude verdict, and (if keyed) the AgenticOrg Boundaries agent,
// whose flag lands in the AgenticOrg approvals queue for a human.
// Body: { post, profile }.
export async function POST(req: Request) {
  try {
    const { post, profile } = await req.json();
    const verdict = await checkBoundaries(post, profile);
    let agenticorg: unknown = null;
    if (has.agenticorg()) {
      try {
        const client = (createClient as any)({
          baseUrl: process.env.AGENTICORG_BASE_URL || undefined,
          apiKey: process.env.AGENTICORG_API_KEY,
          timeoutMs: 45_000,
        });
        const { agent } = await ensureBoundariesAgent(client);
        const run = await client.runAgent(agent.id ?? agent.agent_id, {
          inputs: reviewInputs(post, { business: profile?.profession ?? "creator", language: profile?.language_in ?? "en" }),
        });
        agenticorg = { run_id: run.run_id, hitl: !!run.hitl_trigger, verdict: parseVerdict(run.output) };
      } catch (e) {
        agenticorg = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    return json({ verdict, post, agenticorg });
  } catch (e) {
    return errorJson(e);
  }
}
