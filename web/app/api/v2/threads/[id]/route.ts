// One conversation: messages, pending drafts awaiting approval, open order + payment.
import { getThread } from "@/lib/v2/queries";
import { json, errorJson } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const view = await getThread((await params).id);
    return view ? json(view) : json({ error: "Thread not found" }, 404);
  } catch (e) {
    return errorJson(e);
  }
}
