// Payments (A3): Pine Labs Online payment links (UAT by default) with a no-network mock provider.
// startPayment() is idempotent per order; handlePaymentWebhook() verifies, dedupes and applies
// provider events; pollPendingPayments() covers missing webhooks (§12). Every status change is
// stored on payments.rawEvents, logged as payment_event and handed to pipeline.onPaymentUpdate().
//
// Pine Labs refs (docs: https://www.pinelabs.com/docs/online-payments/…, append .md):
//   POST /api/auth/v1/token                  client_credentials → { access_token, expires_at | expires_in }
//   POST /api/pay/v1/paymentlink             201; merchant_payment_link_reference is the idempotency key
//   GET  /api/pay/v1/paymentlink/{id}        { payment_link, payment_link_id, order_id, status, … }
//   Webhooks: Standard Webhooks headers, body { event_type, data: <order> }; success = ORDER_PROCESSED.
import { createHmac, createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getDb, logEvent } from "./db";
import { v2 } from "./config";
import { transition } from "./orders";
import { onPaymentUpdate } from "./pipeline";
import type { CreatePaymentLinkFn, Creator, Id, Order, Payment, PaymentStatus } from "./types";

export const PINELABS_UAT = "https://pluraluat.v2.pinepg.in";
export const LINK_TTL_MS = 24 * 3600_000;
export const POLL_AFTER_MS = 2 * 60_000;
const SYSTEM = "_system"; // creatorId for audit rows we can't attribute (unmatched webhooks)

// Not in v2 config yet (see .context/v2-build/contract-requests.md).
const pineBase = () => (process.env.PINELABS_BASE_URL || PINELABS_UAT).replace(/\/$/, "");
const pineWebhookSecret = () => process.env.PINELABS_WEBHOOK_SECRET ?? "";

type LinkResult = Awaited<ReturnType<CreatePaymentLinkFn>> & { providerOrderId?: string; raw?: unknown };

/** One stored entry in payments.rawEvents. `id` is the dedupe key. */
interface RawEvent {
  id: string;
  source: "create" | "webhook" | "poll";
  type: string;
  at: number;
  status?: PaymentStatus;
  providerOrderId?: string;
  body: unknown;
}

// ---- Pine Labs client ---------------------------------------------------------

let token: { value: string; until: number } | undefined;

const stdHeaders = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  "Request-ID": randomUUID(),
  "Request-Timestamp": new Date().toISOString(),
});

async function pineToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const res = await fetch(`${pineBase()}/api/auth/v1/token`, {
    method: "POST",
    headers: stdHeaders(),
    body: JSON.stringify({
      client_id: process.env.PINELABS_CLIENT_ID,
      client_secret: process.env.PINELABS_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_at?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error(`pinelabs token HTTP ${res.status}`);
  // The API reference returns expires_at (ISO); one guide shows expires_in (seconds). Handle both.
  const until = data.expires_at ? Date.parse(data.expires_at) : Date.now() + (data.expires_in ?? 3600) * 1000;
  token = { value: data.access_token, until: Number.isFinite(until) ? until : Date.now() + 3600_000 };
  return token.value;
}

async function pineApi<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${pineBase()}${path}`, {
    method,
    headers: { ...stdHeaders(), Authorization: `Bearer ${await pineToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`pinelabs ${method} ${path} HTTP ${res.status}: ${String(text).slice(0, 300)}`);
  return data as T;
}

type PineLink = { payment_link?: string; payment_link_id?: string; order_id?: string; status?: string };
// The create response body is undocumented (only "201"); assume it mirrors GET, possibly under `data`.
const unwrap = (r: PineLink & { data?: PineLink }): PineLink => (r?.payment_link_id ? r : (r?.data ?? r ?? {}));

function pineCustomer(order: Order) {
  const [first, ...rest] = (order.customer.name || order.customer.username || "Customer").trim().split(/\s+/);
  const phone = (order.customer.phone ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return {
    first_name: first.slice(0, 50),
    ...(rest.length ? { last_name: rest.join(" ").slice(0, 50) } : {}),
    ...(phone.length >= 10 ? { mobile_number: phone, country_code: "91" } : {}),
    merchant_customer_reference: order.customer.igsid.slice(0, 50),
  };
}

const pinelabs = {
  async createLink(order: Order, creator: Creator, ref: string): Promise<LinkResult> {
    const paise = Math.round(order.total * 100);
    if (paise < 100) throw new Error(`order ${order._id}: amount ₹${order.total} below Pine Labs minimum ₹1`);
    // The browser comes back to the existing /pay/callback route (handles GET and form POST),
    // which forwards to our checkout page; status is confirmed by webhook/poll, never the redirect.
    const back = `${v2.appBaseUrl()}/pay/callback?to=${encodeURIComponent(`/pay/mock/${order._id}`)}`;
    const body = {
      merchant_payment_link_reference: ref,
      amount: { value: paise, currency: "INR" },
      description: `${creator.businessName}: ${order.items.map((i) => `${i.qty} x ${i.name}`).join(", ")}`.slice(0, 250),
      expire_by: new Date(Date.now() + LINK_TTL_MS).toISOString(),
      allowed_payment_methods: ["UPI", "CARD"],
      customer: pineCustomer(order),
      callback_url: back,
      failure_callback_url: back,
      merchant_metadata: { order_id: order._id, creator_id: creator._id },
    };
    const res = unwrap(await pineApi("POST", "/api/pay/v1/paymentlink", body));
    let link = res;
    if (!link.payment_link_id || !link.payment_link || !link.order_id) {
      // Fill gaps from GET by merchant reference (documented), since the create body isn't.
      link = { ...unwrap(await pineApi("GET", `/api/pay/v1/paymentlink/ref/${encodeURIComponent(ref)}`)), ...stripEmpty(res) };
    }
    if (!link.payment_link_id || !link.payment_link) throw new Error("pinelabs: create payment link returned no link");
    return { provider: "pinelabs", linkId: link.payment_link_id, url: link.payment_link, providerOrderId: link.order_id, raw: res };
  },

  async getLink(linkId: string): Promise<PineLink> {
    return unwrap(await pineApi("GET", `/api/pay/v1/paymentlink/${encodeURIComponent(linkId)}`));
  },
};

const stripEmpty = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

const mock = {
  async createLink(order: Order): Promise<LinkResult> {
    const linkId = `mock_pl_${order._id.slice(-6)}${Math.random().toString(36).slice(2, 8)}`;
    return { provider: "mock", linkId, url: `${v2.appBaseUrl()}/pay/mock/${linkId}`, providerOrderId: `mock-order-${linkId}` };
  },
};

const providerFor = () => (v2.pinelabs() ? "pinelabs" : "mock");

function createLink(order: Order, creator: Creator, ref: string): Promise<LinkResult> {
  return providerFor() === "pinelabs" ? pinelabs.createLink(order, creator, ref) : mock.createLink(order);
}

export const createPaymentLink: CreatePaymentLinkFn = async (order, creator) => {
  const { linkId, url, provider } = await createLink(order, creator, order._id);
  return { linkId, url, provider };
};

// ---- startPayment ---------------------------------------------------------------

const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  return run.finally(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
}

const isOpen = (p: Payment, now = Date.now()) => (p.status === "created" || p.status === "pending") && p.createdAt + LINK_TTL_MS > now;

/** Get or create the payment link for an order and move it to link_sent. Safe to call repeatedly. */
export function startPayment(orderId: Id): Promise<Payment> {
  return withLock(`order:${orderId}`, async () => {
    const db = getDb();
    let order = await db.get("orders", orderId);
    if (!order) throw new Error(`order ${orderId} not found`);
    if (order.status === "paid" || order.status === "cancelled") throw new Error(`order ${orderId} is ${order.status}`);

    const now = Date.now();
    const previous = await db.find("payments", { orderId });
    const open = previous.find((p) => isOpen(p, now));
    if (open) return open;

    const creator = await db.get("creators", order.creatorId);
    if (!creator) throw new Error(`creator ${order.creatorId} not found`);
    if (order.status === "draft") order = await transition(orderId, "confirmed", { by: "startPayment" });

    for (const p of previous) {
      if (p.status === "created" || p.status === "pending") await db.patch("payments", p._id, { status: "expired" });
    }
    // Pine Labs returns the existing link for a repeated reference, so re-links need a fresh one.
    const ref = previous.length ? `${orderId}-r${previous.length + 1}` : orderId;
    const link = await createLink(order, creator, ref);
    const created: RawEvent = {
      id: `create:${link.linkId}`,
      source: "create",
      type: "LINK_CREATED",
      at: now,
      status: "created",
      providerOrderId: link.providerOrderId,
      body: link.raw ?? { ref, linkId: link.linkId, url: link.url },
    };
    const doc: Omit<Payment, "_id"> = {
      orderId,
      provider: link.provider,
      linkId: link.linkId,
      url: link.url,
      amount: order.total,
      status: "created",
      rawEvents: [created],
      createdAt: now,
    };
    const _id = await db.insert("payments", doc);
    if (order.status === "confirmed") await transition(orderId, "link_sent", { paymentId: _id, linkId: link.linkId });
    await logEvent(order.creatorId, "payment_link_created", {
      orderId,
      paymentId: _id,
      provider: link.provider,
      linkId: link.linkId,
      url: link.url,
      amount: order.total,
      ref,
    });
    return { ...doc, _id };
  });
}

// ---- webhook --------------------------------------------------------------------

/** Standard Webhooks signature (Pine Labs): base64 HMAC-SHA256 of `${id}.${timestamp}.${rawBody}`, keyed with the base64-decoded secret. */
export function signPineWebhook(id: string, timestamp: string, rawBody: string, secretB64: string): string {
  const key = Buffer.from(secretB64.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
}

export function verifyPineWebhook(headers: Headers, rawBody: string, secretB64: string, toleranceSec = 300): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader || !secretB64) return false;
  if (toleranceSec && Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec) return false;
  const expected = Buffer.from(signPineWebhook(id, timestamp, rawBody, secretB64));
  return sigHeader
    .split(" ")
    .map((s) => s.split(",")[1] ?? s)
    .some((sig) => {
      const got = Buffer.from(sig);
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
}

type PineOrderData = {
  order_id?: string;
  merchant_order_reference?: string;
  payment_link_id?: string;
  merchant_payment_link_reference?: string;
  status?: string;
  order_amount?: { value?: number };
  amount?: { value?: number };
  payments?: { status?: string; error_detail?: { code?: string } }[];
};
type PineEvent = { id?: string; event_type?: string; event?: string; data?: PineOrderData };

/** Provider event → our payment status. null = store but don't change status (refunds, settlements…). */
export function mapEvent(ev: PineEvent): PaymentStatus | null {
  const type = String(ev.event_type ?? ev.event ?? "").toUpperCase().replace(/\./g, "_");
  switch (type) {
    case "ORDER_PROCESSED":
    case "PAYMENT_CAPTURED": // not in Pine's event list; accepted for safety
    case "PAYMENT_LINK_PROCESSED": // "payment_link.processed" appears in one Payment Links guide only
      return "paid";
    case "ORDER_AUTHORIZED": // only with pre_auth=true, which we never set
      return "pending";
    case "PAYMENT_FAILED": {
      // An attempt failed; the link stays usable, so a later ORDER_PROCESSED still wins.
      const expired = ev.data?.payments?.some((p) => p.error_detail?.code === "PAYMENT_EXPIRED");
      return expired ? "expired" : "failed";
    }
    case "ORDER_FAILED":
      return "failed";
    case "ORDER_CANCELLED": // no "cancelled" PaymentStatus; the link can't be paid any more
    case "PAYMENT_LINK_EXPIRED":
    case "PAYMENT_LINK_CANCELLED":
      return "expired";
    default:
      return null;
  }
}

const baseRef = (ref?: string) => ref?.replace(/-r\d+$/, "");

async function findPaymentFor(data: PineOrderData): Promise<Payment | null> {
  const db = getDb();
  if (data.payment_link_id) {
    const p = await db.findOne("payments", { linkId: data.payment_link_id });
    if (p) return p;
  }
  if (data.order_id) {
    const all = await db.find("payments");
    const p = all.find((x) => (x.rawEvents as RawEvent[]).some((e) => e?.providerOrderId === data.order_id));
    if (p) return p;
  }
  // Unverified: whether a link's order carries our link reference as merchant_order_reference.
  for (const ref of [data.merchant_payment_link_reference, data.merchant_order_reference]) {
    const orderId = baseRef(ref);
    if (!orderId) continue;
    const rows = await db.find("payments", { orderId });
    if (rows.length) return rows.find((p) => p.status === "paid") ?? rows[0];
  }
  return null;
}

// Test seam: lets tests count pipeline callbacks without a module mock.
let pipelineHook: typeof onPaymentUpdate = onPaymentUpdate;
export function _setPaymentUpdateHook(fn?: typeof onPaymentUpdate) {
  pipelineHook = fn ?? onPaymentUpdate;
}

export interface PaymentUpdateResult {
  ok: boolean;
  orderId?: Id;
  status?: PaymentStatus;
  duplicate?: boolean;
  ignored?: boolean; // stored but no status change (late/out-of-order or informational event)
  error?: string;
}

/** The one write path for payment status changes (webhook + poll). Caller holds the "payments" lock. */
async function applyEvent(payment: Payment, entry: RawEvent): Promise<PaymentUpdateResult> {
  const db = getDb();
  const raw = payment.rawEvents as RawEvent[];
  if (raw.some((e) => e?.id === entry.id)) return { ok: true, orderId: payment.orderId, status: payment.status, duplicate: true };

  const order = await db.get("orders", payment.orderId);
  const creatorId = order?.creatorId ?? SYSTEM;
  const to = entry.status;
  // paid is final; anything after it (late FAILED, retries of other ids) is kept for audit only.
  const change = !!to && to !== payment.status && payment.status !== "paid";
  await db.patch("payments", payment._id, { rawEvents: [...raw, entry], ...(change ? { status: to } : {}) });
  await logEvent(creatorId, "payment_event", {
    paymentId: payment._id,
    orderId: payment.orderId,
    provider: payment.provider,
    eventId: entry.id,
    eventType: entry.type,
    source: entry.source,
    from: payment.status,
    to: change ? to : payment.status,
    applied: change,
  });
  if (!change) return { ok: true, orderId: payment.orderId, status: payment.status, ignored: true };

  if (to === "paid" && order) {
    if (order.status === "cancelled") {
      await logEvent(creatorId, "error", { where: "payments", reason: "paid_after_cancel", orderId: order._id, paymentId: payment._id });
      return { ok: true, orderId: order._id, status: to };
    }
    // Normally link_sent; walk the machine if a link was made outside startPayment.
    const path = { draft: ["confirmed", "link_sent", "paid"], confirmed: ["link_sent", "paid"], link_sent: ["paid"], paid: [] }[order.status] ?? [];
    for (const s of path as ("confirmed" | "link_sent" | "paid")[]) await transition(order._id, s, { paymentId: payment._id, eventId: entry.id });
  }
  try {
    await pipelineHook(payment.orderId, to);
  } catch (e) {
    await logEvent(creatorId, "error", { where: "onPaymentUpdate", orderId: payment.orderId, status: to, message: String((e as Error)?.message ?? e) });
  }
  return { ok: true, orderId: payment.orderId, status: to };
}

/** POST /api/payments/webhook. Pine Labs: Standard Webhooks signature. Mock: header x-mock-signature: mock (mock mode only). */
export async function handlePaymentWebhook(rawBody: string, headers: Headers): Promise<PaymentUpdateResult> {
  const signed = !!headers.get("webhook-signature");
  const mockOk = !signed && headers.get("x-mock-signature") === "mock" && providerFor() === "mock";
  if (!mockOk && !verifyPineWebhook(headers, rawBody, pineWebhookSecret())) return { ok: false, error: "bad signature" };

  let ev: PineEvent;
  try {
    ev = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "bad json" };
  }
  const data = ev.data ?? {};
  // webhook-id is stable across Pine's retries; fall back to the body id, then a body hash.
  const id = headers.get("webhook-id") || ev.id || `sha:${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
  const type = String(ev.event_type ?? ev.event ?? "UNKNOWN");

  return withLock("payments", async () => {
    const payment = await findPaymentFor(data);
    if (!payment) {
      await logEvent(SYSTEM, "payment_event", { unmatched: true, eventId: id, eventType: type, providerOrderId: data.order_id });
      return { ok: true, ignored: true, error: "no matching payment" };
    }
    let status = mapEvent(ev);
    const paise = data.order_amount?.value ?? data.amount?.value;
    if (status === "paid" && typeof paise === "number" && paise !== Math.round(payment.amount * 100)) {
      const order = await getDb().get("orders", payment.orderId);
      await logEvent(order?.creatorId ?? SYSTEM, "error", { where: "payments", reason: "amount_mismatch", paymentId: payment._id, paise, expected: payment.amount });
      status = null;
    }
    return applyEvent(payment, {
      id,
      source: "webhook",
      type,
      at: Date.now(),
      ...(status ? { status } : {}),
      providerOrderId: data.order_id,
      body: ev,
    });
  });
}

/** The webhook body the mock checkout posts (Pine's ORDER_PROCESSED shape). Deterministic id → double taps dedupe. */
export function mockPaidEvent(payment: Payment): unknown {
  const created = (payment.rawEvents as RawEvent[]).find((e) => e?.source === "create");
  const paise = Math.round(payment.amount * 100);
  const now = new Date().toISOString();
  return {
    id: `mock_evt_paid_${payment.linkId}`,
    event_type: "ORDER_PROCESSED",
    data: {
      order_id: created?.providerOrderId ?? `mock-order-${payment.linkId}`,
      merchant_order_reference: payment.orderId,
      payment_link_id: payment.linkId,
      type: "CHARGE",
      status: "PROCESSED",
      order_amount: { value: paise, currency: "INR" },
      pre_auth: false,
      payments: [
        {
          id: `mock-pay-${payment.linkId}`,
          status: "PROCESSED",
          payment_amount: { value: paise, currency: "INR" },
          payment_method: "UPI",
          payment_option: { upi_data: { txn_mode: "INTENT" } },
          created_at: now,
          updated_at: now,
        },
      ],
      created_at: new Date(payment.createdAt).toISOString(),
      updated_at: now,
      integration_mode: "REDIRECT",
    },
  };
}

// ---- polling (§12: webhooks missing) ------------------------------------------------

const LINK_STATUS: Record<string, PaymentStatus> = {
  CREATED: "created",
  CLICKED: "created",
  PAYMENT_INITIATED: "pending",
  PARTIAL_PROCESSED: "pending",
  PROCESSED: "paid",
  EXPIRED: "expired",
  CANCELLED: "expired",
};

/** Re-check Pine Labs for links still open after 2 min. Returns how many payments changed status. Mock: no-op. */
export async function pollPendingPayments(): Promise<number> {
  if (providerFor() !== "pinelabs") return 0;
  const db = getDb();
  const cutoff = Date.now() - POLL_AFTER_MS;
  const due = [...(await db.find("payments", { status: "created" })), ...(await db.find("payments", { status: "pending" }))].filter(
    (p) => p.provider === "pinelabs" && p.createdAt <= cutoff,
  );
  let changed = 0;
  for (const p of due) {
    let link: PineLink;
    try {
      link = await pinelabs.getLink(p.linkId);
    } catch (e) {
      const order = await db.get("orders", p.orderId);
      await logEvent(order?.creatorId ?? SYSTEM, "error", { where: "pollPendingPayments", paymentId: p._id, message: String((e as Error).message) });
      continue;
    }
    const status = link.status ? LINK_STATUS[link.status] : undefined;
    if (!status || status === p.status) continue;
    const res = await withLock("payments", async () => {
      const fresh = await db.get("payments", p._id);
      if (!fresh) return null;
      return applyEvent(fresh, {
        id: `poll:${p.linkId}:${link.status}`,
        source: "poll",
        type: `LINK_${link.status}`,
        at: Date.now(),
        status,
        providerOrderId: link.order_id,
        body: link,
      });
    });
    if (res && !res.duplicate && !res.ignored) changed++;
  }
  return changed;
}

/** For tests: forget the cached OAuth token. */
export function _resetPineToken() {
  token = undefined;
}
