// A5: read models for the shop screens, on the seeded demo history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setDb, getDb, ensureSeeded } from "../../lib/v2/db";
import { getSunita } from "../../lib/v2/seed";
import {
  getInbox,
  getThread,
  getOrders,
  getApprovalsQueue,
  getInsights,
  getHome,
  postTitle,
  deliveryDay,
  replyGaps,
  plainReason,
} from "../../lib/v2/queries";
import type { Message } from "../../lib/v2/types";

async function fresh() {
  setDb();
  await ensureSeeded();
  return getSunita(getDb());
}

test("inbox: 3 threads, newest first, with the right badges", async () => {
  await fresh();
  const inbox = await getInbox();
  assert.equal(inbox.rows.length, 3);
  assert.deepEqual(inbox.counts, { all: 3, dms: 1, comments: 2, waiting: 1, hidden: 0 });
  assert.ok(inbox.rows[0].lastAt >= inbox.rows[1].lastAt);

  const neha = inbox.rows.find((r) => r.customer.username === "neha.eats")!;
  assert.equal(neha.badge?.kind, "waiting");
  assert.equal(neha.badge?.label, "Waiting for you");
  assert.equal(neha.source.postTitle, "Soft till lunch");

  const meera = inbox.rows.find((r) => r.customer.username === "meera.s")!;
  assert.equal(meera.badge?.label, "Order ₹360 paid");

  const ankit = inbox.rows.find((r) => r.customer.username === "ankit_lko")!;
  assert.equal(ankit.badge?.label, "Replied by Smiley");
});

test("thread: messages ascending, pending draft with approval, order with payment", async () => {
  await fresh();
  const inbox = await getInbox();
  const neha = await getThread(inbox.rows.find((r) => r.customer.username === "neha.eats")!.threadId);
  assert.ok(neha);
  assert.equal(neha.pending.length, 1);
  assert.ok(neha.pending[0].approvalId);
  assert.match(neha.pending[0].reason, /Ingredient claim/);
  assert.equal(neha.pending[0].replyTo, "Is this made with palm oil?");

  const meera = await getThread(inbox.rows.find((r) => r.customer.username === "meera.s")!.threadId);
  assert.ok(meera);
  assert.equal(meera.messages.length, 6);
  assert.ok(meera.messages[0].createdAt < meera.messages[5].createdAt);
  assert.equal(meera.order?.status, "paid");
  assert.equal(meera.order?.payment?.status, "paid");
  assert.equal(await getThread("nope"), null);
});

test("orders: today total is ₹360, all paid, attributed to the reel", async () => {
  await fresh();
  const o = await getOrders();
  assert.equal(o.creatorName, "Sunita");
  assert.deepEqual(o.today, { count: 1, total: 360, paid: 1, unpaid: 0, paidTotal: 360 });
  const all = o.groups.flatMap((g) => g.orders);
  assert.equal(all.length, 1);
  assert.equal(all[0].source.label, "IG DM");
  assert.equal(all[0].source.postTitle, "Soft till lunch");
  assert.equal(all[0].canSendLink, false);
});

test("approvals queue: palm-oil comment with draft and plain reason", async () => {
  await fresh();
  const { items } = await getApprovalsQueue();
  assert.equal(items.length, 1);
  assert.equal(items[0].customerMessage, "Is this made with palm oil?");
  assert.match(items[0].draft, /sarson/);
  assert.equal(items[0].channel, "ig_comment");
  assert.match(items[0].reason, /only you can confirm/);
});

test("insights: Meera's order is attributed to 'Soft till lunch'", async () => {
  await fresh();
  const i = await getInsights();
  assert.equal(i.top?.title, "Soft till lunch");
  assert.equal(i.top?.orders, 1);
  assert.equal(i.top?.revenue, 360);
  assert.equal(i.topLine, `"Soft till lunch" brought 1 order`);
  assert.equal(i.replies.auto, 4);
  assert.equal(i.replies.approved, 0);
  assert.equal(i.medianReplyLabel, "1 min");
  assert.match(i.suggestion, /Soft till lunch/);
});

test("home: stats strip and the kill switch", async () => {
  const sunita = await fresh();
  let h = await getHome();
  assert.equal(h.ordersToday, 1);
  assert.equal(h.revenueToday, 360);
  assert.equal(h.waitingForYou, 1);
  assert.equal(h.autopilot, true);
  await getDb().patch("creators", sunita._id, { autoReplyPaused: true });
  h = await getHome(sunita._id);
  assert.equal(h.autopilot, false);
});

test("helpers: post titles, delivery days, reply gaps, reasons", () => {
  assert.equal(postTitle("Hi, main Sunita 🙏 Meet the kitchen."), "Hi, main Sunita");
  const t = Date.parse("2026-10-24T10:00:00+05:30"); // a Saturday
  assert.equal(deliveryDay({ deliverAt: "Tomorrow, 1 pm", createdAt: t }) - deliveryDay({ createdAt: t }), 1);
  assert.equal(deliveryDay({ deliverAt: "Mon 26 Oct, 1 pm", createdAt: t }) - deliveryDay({ createdAt: t }), 2);
  const m = (direction: "in" | "out", min: number) => ({ direction, createdAt: min * 60_000 }) as Message;
  assert.deepEqual(replyGaps([m("in", 0), m("in", 1), m("out", 3), m("out", 4), m("in", 10), m("out", 11)]), [180_000, 60_000]);
  assert.match(plainReason("discount"), /never bargains/);
});
