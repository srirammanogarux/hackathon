// A6: PRD §11 acceptance criteria, end to end in mock mode (no keys, no network, sends disabled).
process.env.BRAIN_MOCK = "1";
process.env.AGENTICORG_MOCK = "1";
process.env.IG_MOCK = "1";
process.env.PAY_MOCK = "1";
delete process.env.V2_SENDS_ENABLED;

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDb, setDb } from "../../lib/v2/db";
import { seed, SUNITA_IG_USER_ID, SUNITA_REEL_MEDIA_ID } from "../../lib/v2/seed";
import { handleInbound } from "../../lib/v2/pipeline";
import { decideAndDeliver } from "../../lib/v2/approvals";
import { handlePaymentWebhook, mockPaidEvent } from "../../lib/v2/payments";
import type { InboundEvent } from "../../lib/v2/types";

let sunitaId = "";
let n = 0;
const ev = (kind: "comment" | "dm", text: string, who = "rajesh.k"): InboundEvent => {
  const externalId = `t_${++n}`;
  const igsid = `igsid_${who}`;
  return {
    kind,
    igUserId: SUNITA_IG_USER_ID,
    externalId,
    threadKey: kind === "dm" ? igsid : externalId,
    customer: { igsid, username: who, name: who === "rajesh.k" ? "Rajesh Kumar" : undefined },
    text,
    mediaId: kind === "comment" ? SUNITA_REEL_MEDIA_ID : undefined,
    timestamp: Date.now(),
  };
};
const outMessages = async (threadId: string) => (await getDb().find("messages", { threadId, direction: "out" }));

beforeEach(async () => {
  ({ sunitaId } = await seed(setDb()));
});

test("comment 'How do I order?' gets an in-tone auto reply fast, and a DM is opened", async () => {
  const t0 = Date.now();
  const r = await handleInbound(ev("comment", "How do I order?"));
  assert.equal(r.policy, "auto");
  assert.equal(r.sent, true);
  assert.ok(Date.now() - t0 < 120_000);
  const out = await outMessages(r.threadId!);
  assert.equal(out.length, 1);
  assert.equal(out[0].sentBy, "smiley");
  const dm = await getDb().findOne("threads", { channel: "ig_dm", externalId: "igsid_rajesh.k" });
  assert.ok(dm, "DM thread opened from the comment");
  assert.equal((await outMessages(dm!._id)).length, 1);
});

test("sensitive comment never auto-sends; one tap sends it", async () => {
  const r = await handleInbound(ev("comment", "Is this made with palm oil?", "neha.eats"));
  assert.equal(r.policy, "approval");
  assert.equal(r.sent, false);
  assert.equal((await outMessages(r.threadId!)).length, 0);
  const approval = await getDb().findOne("approvals", { draftId: r.draftId! });
  assert.equal(approval?.status, "pending");
  assert.equal((await getDb().get("threads", r.threadId!))?.status, "waiting_owner");

  const res = await decideAndDeliver(approval!._id, "send");
  assert.equal(res.approval.status, "sent");
  const out = await outMessages(r.threadId!);
  assert.equal(out.length, 1);
  assert.equal(out[0].sentBy, "owner");
});

test("DM '2 thalis tomorrow, Gomti Nagar' → order → payment link → paid → owner alert + thank-you", async () => {
  await handleInbound(ev("dm", "Hi! Can I get 2 thalis tomorrow for my office in Gomti Nagar?"));
  const r = await handleInbound(ev("dm", "1 pm please. 4B, Cyber Heights, Vibhuti Khand, Gomti Nagar"));
  assert.ok(r.orderId, "order created");
  assert.ok(r.paymentUrl, "payment link sent");
  const order = (await getDb().get("orders", r.orderId!))!;
  assert.equal(order.total, 240);
  assert.deepEqual(order.items.map((i) => [i.name, i.qty]), [["Veg thali", 2]]);
  assert.equal(order.status, "link_sent");
  assert.ok(order.address?.includes("Cyber Heights"));
  const lastOut = (await outMessages(r.threadId!))[0];
  assert.ok(lastOut.text.includes(r.paymentUrl!), "link is in the DM");

  const payment = (await getDb().findOne("payments", { orderId: order._id }))!;
  const body = JSON.stringify(mockPaidEvent(payment));
  const headers = new Headers({ "x-mock-signature": "mock" });
  const paid = await handlePaymentWebhook(body, headers);
  assert.equal(paid.status, "paid");
  const dup = await handlePaymentWebhook(body, headers);
  assert.ok(dup.ok);

  assert.equal((await getDb().get("orders", order._id))?.status, "paid");
  const alerts = await getDb().find("notifications", { creatorId: sunitaId, kind: "paid" });
  assert.equal(alerts.length, 1, "exactly one paid alert even with a duplicate webhook");
  assert.ok(alerts[0].title.includes("240"));
  assert.ok((await outMessages(r.threadId!))[0].text.length > 0, "thank-you DM");
});

test("duplicate webhook delivery is ignored", async () => {
  const e = ev("comment", "Price kitna hai?", "ankit_lko");
  await handleInbound(e);
  const again = await handleInbound(e);
  assert.equal(again.skipped, "duplicate");
});

test("kill switch: paused autopilot sends nothing, queues for approval", async () => {
  await getDb().patch("creators", sunitaId, { autoReplyPaused: true });
  const r = await handleInbound(ev("comment", "Aaj ka menu kya hai?", "priya"));
  assert.equal(r.sent, false);
  assert.equal((await outMessages(r.threadId!)).length, 0);
  assert.ok(await getDb().findOne("approvals", { draftId: r.draftId! }));
});

test("spam is not answered and is hidden", async () => {
  const r = await handleInbound(ev("comment", "Follow back 🔥🔥 check my page for free followers", "spam_bot_99"));
  assert.equal(r.policy, "skip");
  assert.equal((await outMessages(r.threadId!)).length, 0);
  assert.equal((await getDb().get("threads", r.threadId!))?.status, "hidden");
});

test("every step lands in the audit log", async () => {
  await handleInbound(ev("comment", "How do I order?"));
  await handleInbound(ev("comment", "Is this made with palm oil?", "neha.eats"));
  const types = new Set((await getDb().find("events", { creatorId: sunitaId })).map((e) => e.type));
  for (const t of ["message_in", "draft_created", "draft_sent", "message_out", "approval_requested"]) assert.ok(types.has(t as never), `missing ${t}`);
});
