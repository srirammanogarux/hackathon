// Home stats strip: orders today, ₹, replies handled, waiting for you, autopilot.
import { getHome } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return json(await getHome(new URL(req.url).searchParams.get("creatorId") ?? undefined));
  } catch (e) {
    return errorJson(e);
  }
}
