import { api, PLANS } from "@/lib/plural.mjs";
import { has, appBase, json, errorJson } from "@/lib/server";

// Pine Labs hosted checkout. No keys -> mock order that the /pay page marks as paid.
export async function POST(req: Request) {
  try {
    const { plan = "trial", name = "Saathi", mobile, returnTo } = await req.json().catch(() => ({}));
    const back = typeof returnTo === "string" && returnTo.startsWith("/") ? `?to=${encodeURIComponent(returnTo)}` : "";
    const ALL: Record<string, { paise: number; label: string }> = { ...PLANS, starter: { paise: 9900, label: "Rs 99 / 30 days" } };
    const p = ALL[plan] ?? PLANS.trial;
    if (!has.pine()) return json({ mock: true, order_id: `mock-${Date.now()}`, redirect_url: null });
    const base = appBase(req);
    const res = await api("POST", "/api/checkout/v1/orders", {
      merchant_order_reference: `saathi-${plan}-${Date.now()}`,
      order_amount: { value: p.paise, currency: "INR" },
      integration_mode: "REDIRECT",
      pre_auth: false,
      allowed_payment_methods: ["UPI", "CARD"],
      notes: p.label,
      callback_url: `${base}/pay/callback${back}`,
      failure_callback_url: `${base}/pay/callback${back}`,
      purchase_details: {
        customer: {
          email_id: process.env.TEST_CUSTOMER_EMAIL || "creator@saathi.app",
          first_name: String(name).slice(0, 40) || "Saathi",
          last_name: "Creator",
          mobile_number: mobile || process.env.TEST_CUSTOMER_MOBILE || "9999999999",
          country_code: "91",
        },
      },
    });
    return json({ mock: false, order_id: res.order_id, redirect_url: res.redirect_url });
  } catch (e) {
    return errorJson(e);
  }
}
