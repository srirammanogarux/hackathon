import { makePost } from "@/lib/brain/brain.mjs";
import { personaOf, fixture, json, errorJson } from "@/lib/server";

export const maxDuration = 120;

// Body: { item, profile, risky? }. risky=true returns the persona's deliberately unsafe draft
// (Kaaval demo moment: face in frame / "best dentist") instead of calling Lekhak.
export async function POST(req: Request) {
  try {
    const { item, profile, risky } = await req.json();
    if (risky) return json({ post: { ...fixture(`${personaOf(profile)}.unsafe-post.json`), plan_id: item?.id ?? "p1" }, risky: true });
    return json({ post: await makePost(item, profile) });
  } catch (e) {
    return errorJson(e);
  }
}
