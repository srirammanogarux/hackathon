import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureSeeded, getDb } from "@/lib/v2/db";
import { formatInr } from "@/lib/v2/orders";
import { mockPaidEvent } from "@/lib/v2/payments";
import { PayButton } from "./pay-button";

// Customer-facing checkout for a payment link. Mock links get a "Pay with UPI" button that posts
// the mock ORDER_PROCESSED webhook; real Pine Labs links land here after checkout (via /pay/callback)
// and just show the stored status.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay · Reels Magic" };

export default async function MockCheckout({ params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params;
  await ensureSeeded();
  const db = getDb();
  // linkId, or our order id when Pine Labs redirects back through /pay/callback.
  const payment = (await db.findOne("payments", { linkId })) ?? (await db.find("payments", { orderId: linkId }, { limit: 1 }))[0];
  if (!payment) notFound();
  const order = await db.get("orders", payment.orderId);
  if (!order) notFound();
  const creator = await db.get("creators", order.creatorId);
  const shop = creator?.businessName ?? "Your order";
  const paid = payment.status === "paid" || order.status === "paid";
  const closed = !paid && (payment.status === "expired" || order.status === "cancelled");

  return (
    <main className="min-h-dvh bg-mist px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_8px_24px_rgba(16,24,40,0.06)]">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-butter text-lg font-semibold text-ink" aria-hidden>
              {shop.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{shop}</p>
              <p className="text-sm text-muted">{creator?.city ?? "Order payment"}</p>
            </div>
          </div>

          <ul className="mt-6 divide-y divide-line border-y border-line">
            {order.items.map((i) => (
              <li key={i.name} className="flex justify-between gap-4 py-3 text-[15px]">
                <span className="text-ink">
                  {i.qty} × {i.name}
                </span>
                <span className="tabular-nums text-muted">{formatInr(i.qty * i.price)}</span>
              </li>
            ))}
          </ul>
          {order.deliverAt ? <p className="mt-3 text-sm text-muted">Delivery: {order.deliverAt}</p> : null}

          <div className="mt-6 flex items-baseline justify-between">
            <span className="text-sm text-muted">Total</span>
            <span className="font-display text-3xl font-bold tabular-nums text-ink">{formatInr(payment.amount)}</span>
          </div>

          <div className="mt-6">
            {paid ? (
              <p className="flex h-14 items-center justify-center rounded-full bg-mint font-semibold text-ok" role="status">
                Paid ✓
              </p>
            ) : closed ? (
              <p className="rounded-2xl bg-blush px-4 py-3 text-center text-sm text-ink">
                This link has expired. Message {creator?.name ?? "the shop"} for a new one.
              </p>
            ) : payment.provider === "mock" ? (
              <PayButton event={JSON.stringify(mockPaidEvent(payment))} label={`Pay ${formatInr(payment.amount)} with UPI`} />
            ) : (
              <>
                <a
                  href={payment.url}
                  className="flex h-14 items-center justify-center rounded-full bg-ink font-semibold text-white"
                >
                  Pay {formatInr(payment.amount)} with UPI
                </a>
                <p className="mt-3 text-center text-sm text-muted">Already paid? We&apos;ll confirm here in a minute.</p>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-faint">
          {payment.provider === "mock" ? "Test checkout. No money moves." : "Secured by Pine Labs"}
        </p>
      </div>
    </main>
  );
}
