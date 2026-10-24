import { pollPendingPayments } from "@/lib/v2/payments";

// Cron target (every 2 min): re-checks open Pine Labs links in case a webhook went missing.
export const dynamic = "force-dynamic";

async function handle() {
  try {
    return Response.json({ ok: true, updated: await pollPendingPayments() });
  } catch (e) {
    console.error("[payments/poll]", e);
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
