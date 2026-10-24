// A6 orchestrator (PRD §5): webhook → classify → draft → policy → send/approve → order → pay → notify.
// Routes owned by other workstreams call these three entry points and never reimplement them:
//   handleInbound(ev)            app/api/ig/webhook, app/api/v2/simulate
//   deliverDraft(id, text, by)   approvals (after the owner taps Send/Edit) and auto-sends below
//   onPaymentUpdate(orderId, s)  payments webhook / poller
import { getDb, logEvent } from "./db";
import { classify, decidePolicy, draftReply, extractOrder } from "./brain";
import { hideComment, replyComment, sendDM } from "./instagram";
import { confirmOrder, orderSummary, upsertOrderFromExtraction } from "./orders";
import { startPayment } from "./payments";
import { requestApproval } from "./approvals";
import { notifyOwner } from "./notify";
import type { Classification, Creator, DraftResult, Id, InboundEvent, Intent, Message, PaymentStatus, SendResult, SentBy, Thread } from "./types";

// Intents that must never ride the order flow's auto-send, even mid-order.
const SENSITIVE: Intent[] = ["health_claim", "complaint", "discount", "professional_advice", "collab", "spam", "abuse"];
const ORDER_INTENTS: Intent[] = ["order", "order_status"];
// Comment intents where the public reply says "DM kar diya" and Smiley follows up privately.
const OPENS_DM: Intent[] = ["order", "how_to_order", "menu"];

export interface InboundResult {
  threadId?: Id;
  messageId?: Id;
  draftId?: Id;
  policy?: DraftResult["policy"];
  sent?: boolean;
  orderId?: Id;
  paymentUrl?: string;
  skipped?: string;
}

export async function handleInbound(ev: InboundEvent): Promise<InboundResult> {
  if (ev.isEcho) return { skipped: "echo" };
  const db = getDb();
  const creator = await db.findOne("creators", { igUserId: ev.igUserId });
  if (!creator) return { skipped: `no creator for ig ${ev.igUserId}` };
  if (await db.findOne("messages", { externalId: ev.externalId })) return { skipped: "duplicate" };

  const thread = await upsertThread(creator, ev);
  const now = Date.now();
  const messageId = await db.insert("messages", {
    threadId: thread._id,
    direction: "in",
    text: ev.text,
    sentBy: "customer",
    createdAt: ev.timestamp || now,
    externalId: ev.externalId,
  });
  await db.patch("threads", thread._id, { lastMessageAt: now, lastInboundAt: now });
  thread.lastInboundAt = now;
  await logEvent(creator._id, "message_in", { threadId: thread._id, messageId, channel: thread.channel, text: ev.text });

  try {
    const history = await historyOf(thread._id);
    const c = await classify(ev.text, creator, history);
    const inOrder = thread.channel === "ig_dm" && !SENSITIVE.includes(c.intent) && (ORDER_INTENTS.includes(c.intent) || thread.status === "ordering");

    const res = inOrder
      ? await orderTurn(creator, thread, history, c)
      : { draft: await draftReply(thread, creator, c, history) };

    const draftId = await db.insert("drafts", {
      threadId: thread._id,
      messageId,
      text: res.draft.text,
      intent: c.intent,
      confidence: c.confidence,
      policy: res.draft.policy,
      reasons: res.draft.reasons,
      status: "pending",
      createdAt: Date.now(),
    });
    await logEvent(creator._id, "draft_created", { draftId, intent: c.intent, confidence: c.confidence, policy: res.draft.policy, reasons: res.draft.reasons });
    const out: InboundResult = { threadId: thread._id, messageId, draftId, policy: res.draft.policy, orderId: res.orderId, paymentUrl: res.paymentUrl };

    if (res.draft.policy === "skip") {
      await db.patch("drafts", draftId, { status: "skipped" });
      await logEvent(creator._id, "draft_skipped", { draftId, reasons: res.draft.reasons });
      if (res.draft.hide && thread.channel === "ig_comment") {
        const hidden = await hideComment(creator, ev.externalId);
        await db.patch("threads", thread._id, { status: "hidden" });
        await logEvent(creator._id, "comment_hidden", { threadId: thread._id, commentId: ev.externalId, ok: hidden.ok, mock: hidden.mock });
      }
      return out;
    }

    if (res.draft.policy === "auto" && !creator.autoReplyPaused) {
      const sent = await deliverDraft(draftId, res.draft.text, "smiley");
      out.sent = sent.ok;
      if (sent.ok && thread.channel === "ig_comment" && OPENS_DM.includes(c.intent)) await openDmFromComment(creator, thread, ev, c);
      if (sent.ok) return out;
      await addReason(draftId, `send failed: ${sent.error}`);
    } else if (res.draft.policy === "auto") {
      // Owner kill switch (§11): nothing auto-sends while paused; everything waits for her.
      await addReason(draftId, "autopilot paused");
    }
    await requestApproval((await db.get("drafts", draftId))!, creator);
    out.sent = false;
    return out;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await logEvent(creator._id, "error", { where: "handleInbound", threadId: thread._id, error });
    await db.patch("threads", thread._id, { status: "waiting_owner" });
    return { threadId: thread._id, messageId, skipped: `error: ${error}` };
  }
}

/** One DM turn of slot filling. When every slot is in, confirm the order and attach a payment link. */
async function orderTurn(creator: Creator, thread: Thread, history: Message[], c: Classification) {
  const ex = await extractOrder(thread, creator, history);
  const order = await upsertOrderFromExtraction(thread, creator, ex);
  let text = ex.confirmText;
  let paymentUrl: string | undefined;

  if (ex.ready && order.items.length) {
    if (order.status === "draft") await confirmOrder(order._id);
    const payment = await startPayment(order._id);
    paymentUrl = payment.url;
    if (!text.includes(payment.url)) text = `${text}\n${payment.url}`;
    await notifyOwner(creator._id, "new_order", { orderId: order._id, summary: orderSummary(order), total: order.total, customer: order.customer });
  }

  const draft = { text };
  const policy = decidePolicy({ ...c, intent: "order" }, creator, draft, { channel: thread.channel, orderTotal: order.total, flow: "order" });
  return { draft: { ...draft, ...policy } as DraftResult, orderId: order._id, paymentUrl };
}

/** Comment asked how to order → public reply already went out; follow up privately (IG private reply). */
async function openDmFromComment(creator: Creator, commentThread: Thread, ev: InboundEvent, c: Classification) {
  const db = getDb();
  const dmThread = await upsertThread(creator, { ...ev, kind: "dm", threadKey: ev.customer.igsid });
  const history = await historyOf(dmThread._id);
  const opener = await draftReply(dmThread, creator, { ...c, intent: "how_to_order" }, history);
  if (opener.policy !== "auto") return;
  const res = await sendDM(creator, ev.customer.igsid, opener.text, { commentId: ev.externalId });
  await recordOutbound(creator, dmThread, opener.text, "smiley", res);
  await db.patch("threads", dmThread._id, { status: "ordering", sourcePostId: dmThread.sourcePostId ?? commentThread.sourcePostId });
}

export async function deliverDraft(draftId: Id, text: string, sentBy: SentBy = "owner"): Promise<{ ok: boolean; error?: string; mock?: boolean }> {
  const db = getDb();
  const draft = await db.get("drafts", draftId);
  if (!draft) return { ok: false, error: "draft not found" };
  if (draft.status === "sent") return { ok: true };
  const thread = (await db.get("threads", draft.threadId))!;
  const creator = (await db.get("creators", thread.creatorId))!;
  const inbound = await db.get("messages", draft.messageId);

  const res: SendResult =
    thread.channel === "ig_comment"
      ? await replyComment(creator, inbound?.externalId ?? thread.externalId, text)
      : await sendDM(creator, thread.customer.igsid, text, { lastInboundAt: thread.lastInboundAt });

  if (!res.ok) {
    await logEvent(creator._id, res.blocked ? "send_blocked" : "error", { draftId, reason: res.blocked, error: res.error });
    return { ok: false, error: res.blocked ?? res.error };
  }
  await recordOutbound(creator, thread, text, sentBy, res);
  await db.patch("drafts", draftId, { status: "sent", text });
  await db.patch("creators", creator._id, { repliesSentCount: creator.repliesSentCount + 1 });
  const nextStatus = thread.status === "waiting_owner" || thread.status === "open" ? (thread.orderId ? "ordering" : "open") : thread.status;
  await db.patch("threads", thread._id, { status: nextStatus });
  await logEvent(creator._id, "draft_sent", { draftId, sentBy, mock: !!res.mock, latencyMs: inbound ? Date.now() - inbound.createdAt : undefined });
  return { ok: true, mock: res.mock };
}

export async function onPaymentUpdate(orderId: Id, status: PaymentStatus): Promise<void> {
  const db = getDb();
  const order = await db.get("orders", orderId);
  if (!order) return;
  const thread = await db.get("threads", order.threadId);
  const creator = await db.get("creators", order.creatorId);
  if (!thread || !creator) return;

  if (status === "paid") {
    await notifyOwner(creator._id, "paid", { orderId, summary: orderSummary(order), total: order.total, customer: order.customer, address: order.address });
    const text = `${creator.toneProfile.signoffs[0] ?? "Thank you!"} Payment mil gaya ✅ ${orderSummary(order)}`;
    const res = await sendDM(creator, thread.customer.igsid, text, { lastInboundAt: thread.lastInboundAt });
    if (res.ok) await recordOutbound(creator, thread, text, "smiley", res);
    await db.patch("threads", thread._id, { status: "closed", orderId: undefined });
  } else if (status === "failed") {
    const text = "Payment nahi hua ji 🙏 Link se dobara try kar lijiye, ya mujhe yahin message kariye.";
    const res = await sendDM(creator, thread.customer.igsid, text, { lastInboundAt: thread.lastInboundAt });
    if (res.ok) await recordOutbound(creator, thread, text, "smiley", res);
  }
}

// ---- helpers ------------------------------------------------------------------

async function upsertThread(creator: Creator, ev: InboundEvent): Promise<Thread> {
  const db = getDb();
  const channel = ev.kind === "dm" ? "ig_dm" : "ig_comment";
  const existing = await db.findOne("threads", { creatorId: creator._id, channel, externalId: ev.threadKey });
  if (existing) return existing;
  const post = ev.mediaId ? await db.findOne("posts", { igMediaId: ev.mediaId }) : null;
  const id = await db.insert("threads", {
    creatorId: creator._id,
    channel,
    externalId: ev.threadKey,
    mediaId: ev.mediaId,
    sourcePostId: post?._id,
    customer: ev.customer,
    lastMessageAt: Date.now(),
    status: "open",
  });
  return (await db.get("threads", id))!;
}

async function addReason(draftId: Id, reason: string) {
  const draft = (await getDb().get("drafts", draftId))!;
  await getDb().patch("drafts", draftId, { reasons: [...draft.reasons, reason] });
}

async function historyOf(threadId: Id): Promise<Message[]> {
  const msgs = await getDb().find("messages", { threadId });
  return msgs.sort((a, b) => a.createdAt - b.createdAt);
}

async function recordOutbound(creator: Creator, thread: Thread, text: string, sentBy: SentBy, res: SendResult) {
  const db = getDb();
  const now = Date.now();
  const id = await db.insert("messages", { threadId: thread._id, direction: "out", text, sentBy, createdAt: now, externalId: res.externalId });
  await db.patch("threads", thread._id, { lastMessageAt: now });
  await logEvent(creator._id, "message_out", { threadId: thread._id, messageId: id, sentBy, channel: thread.channel, mock: !!res.mock, text });
  return id;
}
