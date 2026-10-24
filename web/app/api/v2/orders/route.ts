// Orders list grouped Today / Upcoming / Earlier, with today's totals.
import { getOrders } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return json(await getOrders(new URL(req.url).searchParams.get("creatorId") ?? undefined));
  } catch (e) {
    return errorJson(e);
  }
}
