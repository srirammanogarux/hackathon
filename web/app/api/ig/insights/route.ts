// Nightly cron target: refresh post insights for ?creatorId= (or every creator when omitted).
import { ensureSeeded, getDb } from "@/lib/v2/db";
import { syncInsights } from "@/lib/v2/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(req: Request) {
  await ensureSeeded();
  const creatorId = new URL(req.url).searchParams.get("creatorId");
  const ids = creatorId ? [creatorId] : (await getDb().find("creators")).map((c) => c._id);
  const updated: Record<string, number> = {};
  for (const id of ids) updated[id] = await syncInsights(id);
  return Response.json({ ok: true, updated });
}

export const GET = run;
export const POST = run;
