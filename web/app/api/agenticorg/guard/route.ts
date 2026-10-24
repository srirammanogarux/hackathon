import { guardCheck, findApproval } from "@/lib/agenticorg.mjs";

export const maxDuration = 60;

// POST {script, shots?, never?, profession?} -> {verdict, reasons, risk, rewrite, runId, viaAgenticOrg, escalated, approval}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json(await guardCheck(body));
}

// GET ?correlationId=... -> the AgenticOrg approval item for that run (poll for the human's decision)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("correlationId");
  return Response.json({ approval: await findApproval(id).catch((e) => ({ error: String(e?.message ?? e) })) });
}
