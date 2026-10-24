// Orders (A3): the state machine draft → confirmed → link_sent → paid, plus cancelled from any
// non-paid state. `paid` and `cancelled` are terminal. One open draft order per thread, kept in
// threads.orderId while the brain slot-fills it; every insert/transition lands in the audit log.
import { getDb, logEvent } from "./db";
import type { Creator, Id, Ms, Order, OrderExtraction, OrderItem, OrderStatus, Thread } from "./types";

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["link_sent", "cancelled"],
  link_sent: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export async function transition(orderId: Id, to: OrderStatus, meta: Record<string, unknown> = {}): Promise<Order> {
  const db = getDb();
  const order = await db.get("orders", orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (!canTransition(order.status, to)) throw new Error(`order ${orderId}: illegal transition ${order.status} → ${to}`);
  const updatedAt = Date.now();
  await db.patch("orders", orderId, { status: to, updatedAt });
  await logEvent(order.creatorId, "order_status", { orderId, threadId: order.threadId, from: order.status, to, ...meta });
  return { ...order, status: to, updatedAt };
}

export function computeTotal(items: OrderItem[], creator: Pick<Creator, "deliveryFee">): number {
  const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
  return sub > 0 && creator.deliveryFee ? sub + creator.deliveryFee : sub;
}

// Serialise per thread so two quick DMs can't both insert a draft.
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  try {
    return await run;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}

/** Create or update the thread's open draft order from the latest extraction.
 *  If the thread's order is already confirmed/link_sent it is returned unchanged (the link
 *  amount must not drift); paid/cancelled orders start a fresh draft. */
export function upsertOrderFromExtraction(thread: Thread, creator: Creator, ex: OrderExtraction): Promise<Order> {
  return withLock(`thread:${thread._id}`, async () => {
    const db = getDb();
    const fresh = (await db.get("threads", thread._id)) ?? thread;
    let current = fresh.orderId ? await db.get("orders", fresh.orderId) : null;
    if (!current) current = (await db.find("orders", { threadId: thread._id, status: "draft" }, { limit: 1 }))[0] ?? null;

    if (current && (current.status === "confirmed" || current.status === "link_sent")) return current;

    const now = Date.now();
    const open = current?.status === "draft" ? current : null;
    const items = ex.items.length ? ex.items.map(({ name, qty, price }) => ({ name, qty, price })) : (open?.items ?? []);
    const fields = {
      items,
      total: computeTotal(items, creator),
      deliverAt: ex.deliverAt ?? open?.deliverAt,
      address: ex.address ?? open?.address,
      customer: { ...fresh.customer, ...open?.customer, ...(ex.customerName ? { name: ex.customerName } : {}) },
      sourcePostId: fresh.sourcePostId ?? open?.sourcePostId,
      updatedAt: now,
    };

    let order: Order;
    if (open) {
      await db.patch("orders", open._id, fields);
      order = { ...open, ...fields };
    } else {
      const doc = { ...fields, creatorId: creator._id, threadId: thread._id, status: "draft" as const, createdAt: now };
      const _id = await db.insert("orders", doc);
      order = { ...doc, _id };
      await logEvent(creator._id, "order_created", {
        orderId: _id,
        threadId: thread._id,
        sourcePostId: doc.sourcePostId,
        items,
        total: doc.total,
      });
    }
    if (fresh.orderId !== order._id || fresh.status !== "ordering") {
      await db.patch("threads", thread._id, { orderId: order._id, status: "ordering" });
    }
    return order;
  });
}

export function confirmOrder(orderId: Id): Promise<Order> {
  return transition(orderId, "confirmed");
}

export function cancelOrder(orderId: Id, reason: string): Promise<Order> {
  return transition(orderId, "cancelled", { reason });
}

export async function listOrders(creatorId: Id, { status, since }: { status?: OrderStatus; since?: Ms } = {}): Promise<Order[]> {
  const rows = await getDb().find("orders", { creatorId, status });
  return since ? rows.filter((o) => o.createdAt >= since) : rows;
}

export const formatInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** "2 × Veg thali · Tomorrow 1 pm · ₹240" */
export function orderSummary(order: Pick<Order, "items" | "deliverAt" | "total">): string {
  const items = order.items.map((i) => `${i.qty} × ${i.name}`).join(", ");
  return [items, order.deliverAt, formatInr(order.total)].filter(Boolean).join(" · ");
}
