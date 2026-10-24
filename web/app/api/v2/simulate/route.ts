// Demo/QA: inject a fake customer comment or DM through the real pipeline, as if Instagram's
// webhook had delivered it. `{ kind: "pay" }` pays the customer's latest open payment link.
// Off in production unless V2_SIMULATE=1.
import { ensureSeeded, getDb } from "@/lib/v2/db";
import { handleInbound } from "@/lib/v2/pipeline";
import { SUNITA_IG_USER_ID, SUNITA_REEL_MEDIA_ID } from "@/lib/v2/seed";
import { errorJson, json } from "@/lib/server";

export const dynamic = "force-dynamic";

const enabled = () => process.env.NODE_ENV !== "production" || process.env.V2_SIMULATE === "1";

// Same username → same IG-scoped id, so follow-up DMs land in the same thread.
const igsidFor = (username: string) => "69" + [...username].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1e12, 7).toString().padStart(12, "0");

export async function POST(req: Request) {
  if (!enabled()) return json({ error: "simulate is disabled" }, 404);
  try {
    await ensureSeeded();
    const b = await req.json().catch(() => ({}));
    const username = String(b.username ?? "rajesh.k").slice(0, 40);
    const igsid = String(b.igsid ?? igsidFor(username));

    if (b.kind === "pay") return json(await payLatest(igsid));

    const kind = b.kind === "comment" ? "comment" : "dm";
    const text = String(b.text ?? "").trim().slice(0, 1000);
    if (!text) return json({ error: "text is required" }, 400);
    const externalId = `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const started = Date.now();
    const result = await handleInbound({
      kind,
      igUserId: String(b.igUserId ?? SUNITA_IG_USER_ID),
      externalId,
      threadKey: kind === "dm" ? igsid : externalId,
      customer: { igsid, username, name: b.name ? String(b.name) : undefined },
      text,
      mediaId: kind === "comment" ? String(b.mediaId ?? SUNITA_REEL_MEDIA_ID) : b.mediaId ? String(b.mediaId) : undefined,
      timestamp: started,
    });
    return json({ ok: true, ms: Date.now() - started, ...result });
  } catch (e) {
    return errorJson(e);
  }
}

async function payLatest(igsid: string) {
  const db = getDb();
  const thread = await db.findOne("threads", { channel: "ig_dm", externalId: igsid });
  const order = thread?.orderId ? await db.get("orders", thread.orderId) : null;
  if (!order || order.status !== "link_sent") return { ok: false, error: "no open payment link for this customer" };
  const payment = await db.findOne("payments", { orderId: order._id });
  if (!payment) return { ok: false, error: "no payment row" };
  const { mockPaidEvent, handlePaymentWebhook } = await import("@/lib/v2/payments");
  const body = JSON.stringify(mockPaidEvent(payment));
  const res = await handlePaymentWebhook(body, new Headers({ "content-type": "application/json", "x-mock-signature": "mock" }));
  return { ...res, orderId: order._id };
}
