// Pending approvals with the customer's message, Smiley's draft and the reason.
// Decisions go to A4's POST /api/approvals/[id].
import { getApprovalsQueue } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return json(await getApprovalsQueue(new URL(req.url).searchParams.get("creatorId") ?? undefined));
  } catch (e) {
    return errorJson(e);
  }
}
