// Instagram webhook (A1). GET: Meta's subscription handshake. POST: signed comment / DM events →
// parseWebhook → pipeline.handleInbound per event. Always 200 once the signature checks out, so
// Meta doesn't retry (and double-deliver) because one event failed downstream.
import { v2 } from "@/lib/v2/config";
import { ensureSeeded, logEvent } from "@/lib/v2/db";
import { findCreatorByIgUserId, parseWebhook, verifySignature } from "@/lib/v2/instagram";
import { handleInbound } from "@/lib/v2/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === v2.igVerifyToken()) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("[ig webhook] bad signature");
    return new Response("bad signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const events = parseWebhook(body);
  await ensureSeeded();
  const results: Record<string, unknown>[] = [];
  for (const ev of events) {
    if (ev.isEcho) continue;
    try {
      results.push({ externalId: ev.externalId, ...(await handleInbound(ev)) });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[ig webhook] handleInbound failed", ev.externalId, error);
      const creator = await findCreatorByIgUserId(ev.igUserId).catch(() => null);
      await logEvent(creator?._id ?? "unknown", "error", { op: "handleInbound", externalId: ev.externalId, kind: ev.kind, error }).catch(() => {});
      results.push({ externalId: ev.externalId, error });
    }
  }
  return Response.json({ ok: true, received: events.length, handled: results.length, results });
}
