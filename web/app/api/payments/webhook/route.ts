import { handlePaymentWebhook } from "@/lib/v2/payments";

// Pine Labs (Standard Webhooks signature) and the mock checkout post here. Needs the raw body.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const res = await handlePaymentWebhook(raw, req.headers);
    // 200 for anything we stored or deliberately ignored, so Pine Labs stops retrying.
    return Response.json(res, { status: res.ok ? 200 : res.error === "bad signature" ? 401 : 400 });
  } catch (e) {
    console.error("[payments/webhook]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
