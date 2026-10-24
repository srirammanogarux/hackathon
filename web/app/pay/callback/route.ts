import { appBase } from "@/lib/server";

// Pine Labs sends the browser back here (GET or form POST) with order_id + status.
// We don't trust the redirect: /pay re-checks the order via /api/pay/status.
async function handle(req: Request) {
  const url = new URL(req.url);
  let params: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    if (form) params = { ...params, ...Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) };
  }
  const dest = params.to && params.to.startsWith("/") && !params.to.startsWith("//") ? params.to : "/pay";
  const to = new URL(dest, appBase(req));
  if (params.order_id) to.searchParams.set("order_id", params.order_id);
  to.searchParams.set("back", "1");
  return Response.redirect(to.toString(), 303);
}
export const GET = handle;
export const POST = handle;
