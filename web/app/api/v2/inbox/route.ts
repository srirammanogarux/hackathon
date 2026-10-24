// Inbox list: comment + DM threads with last line and badge.
import { getInbox } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return json(await getInbox(new URL(req.url).searchParams.get("creatorId") ?? undefined));
  } catch (e) {
    return errorJson(e);
  }
}
