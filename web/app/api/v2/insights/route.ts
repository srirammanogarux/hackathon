// Which post brought orders, reply stats, and next week's suggestion for the planner.
import { getInsights } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return json(await getInsights(new URL(req.url).searchParams.get("creatorId") ?? undefined));
  } catch (e) {
    return errorJson(e);
  }
}
