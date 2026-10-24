// In-app notifications (the bell). GET lists them; POST { ids?: string[] } marks read (all when no ids).
import { getDb } from "@/lib/v2/db";
import { getNotifications, resolveCreator } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

const creatorIdOf = (req: Request) => new URL(req.url).searchParams.get("creatorId") ?? undefined;

export async function GET(req: Request) {
  try {
    return json(await getNotifications(creatorIdOf(req)));
  } catch (e) {
    return errorJson(e);
  }
}

export async function POST(req: Request) {
  try {
    const body: { ids?: string[] } = await req.json().catch(() => ({}));
    const db = getDb();
    const creator = await resolveCreator(db, creatorIdOf(req));
    const unread = await db.find("notifications", { creatorId: creator._id, read: false });
    const ids = body.ids ? new Set(body.ids) : null;
    await Promise.all(unread.filter((n) => !ids || ids.has(n._id)).map((n) => db.patch("notifications", n._id, { read: true })));
    return json(await getNotifications(creator._id));
  } catch (e) {
    return errorJson(e);
  }
}
