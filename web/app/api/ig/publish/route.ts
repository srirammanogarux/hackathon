// POST { creatorId, videoUrl, caption } → publishReel. Mock unless IG keys + V2_SENDS_ENABLED=1.
import { ensureSeeded } from "@/lib/v2/db";
import { publishReel } from "@/lib/v2/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { creatorId, videoUrl, caption = "" } = await req.json().catch(() => ({}));
  if (!creatorId || !videoUrl) return Response.json({ ok: false, error: "creatorId and videoUrl are required" }, { status: 400 });
  await ensureSeeded();
  try {
    return Response.json({ ok: true, ...(await publishReel(creatorId, videoUrl, caption)) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
