// The owner's settings. PATCH { autoReplyPaused } is the kill switch (§11): when paused,
// Smiley drafts but never auto-sends; everything waits for her OK.
import { getDb, logEvent } from "@/lib/v2/db";
import { creatorView, getCreator, resolveCreator } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

const creatorIdOf = (req: Request) => new URL(req.url).searchParams.get("creatorId") ?? undefined;

export async function GET(req: Request) {
  try {
    return json(await getCreator(creatorIdOf(req)));
  } catch (e) {
    return errorJson(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.autoReplyPaused !== "boolean") return json({ error: "Send { autoReplyPaused: boolean }" }, 400);
    const db = getDb();
    const creator = await resolveCreator(db, body.creatorId ?? creatorIdOf(req));
    await db.patch("creators", creator._id, { autoReplyPaused: body.autoReplyPaused });
    // No dedicated event type yet (see contract-requests.md); the kill switch is a send block.
    await logEvent(creator._id, "send_blocked", { reason: "owner_kill_switch", autoReplyPaused: body.autoReplyPaused, by: "owner" });
    return json(creatorView({ ...creator, autoReplyPaused: body.autoReplyPaused }));
  } catch (e) {
    return errorJson(e);
  }
}
