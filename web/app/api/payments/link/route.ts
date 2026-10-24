import { ensureSeeded } from "@/lib/v2/db";
import { startPayment } from "@/lib/v2/payments";

// POST { orderId } → the order's payment link (created once, reused while open).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId) return Response.json({ ok: false, error: "orderId required" }, { status: 400 });
  try {
    await ensureSeeded();
    const payment = await startPayment(orderId);
    return Response.json({ ok: true, payment });
  } catch (e) {
    const message = (e as Error).message;
    return Response.json({ ok: false, error: message }, { status: /not found/.test(message) ? 404 : 400 });
  }
}
