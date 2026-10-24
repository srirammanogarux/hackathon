// Read models for the shop screens (Inbox, Thread, Orders, Approvals, Insights, Home).
// Pure joins over getDb(); no writes. Every entry point seeds first and defaults to Sunita,
// so the JSON routes work on a fresh dev server with no setup.
import { ensureSeeded, getDb, type Db } from "./db";
import { getSunita } from "./seed";
import { v2 } from "./config";
import type {
  Approval,
  Channel,
  Creator,
  Draft,
  Id,
  Message,
  Ms,
  Notification,
  Order,
  OrderStatus,
  Payment,
  Post,
  SentBy,
  Thread,
  ThreadStatus,
} from "./types";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const IST = 330 * MIN; // day boundaries follow the shop's clock, not the server's

export type Opts = { now?: Ms };

// ---- shared bits ----------------------------------------------------------------

export type BadgeKind = "waiting" | "paid" | "order" | "smiley" | "owner" | "new";
export interface Badge {
  kind: BadgeKind;
  label: string;
}

export interface CustomerLite {
  username?: string;
  name?: string;
  display: string; // "meera.s" or "Meera S"
}

export interface SourceLite {
  channel: Channel;
  label: string; // "IG DM" | "IG comment"
  postTitle?: string; // "Soft till lunch"
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Short title from a caption: "Soft till lunch 🫓 Ghar ka khana…" → "Soft till lunch". */
export function postTitle(caption: string): string {
  const first = caption.split(/[\n.!?|]|\p{Extended_Pictographic}/u)[0].trim();
  const words = (first || caption.trim()).split(/\s+/).slice(0, 5).join(" ");
  return words.length > 32 ? `${words.slice(0, 31)}…` : words;
}

const customerLite = (c: { username?: string; name?: string }): CustomerLite => ({
  username: c.username,
  name: c.name,
  display: c.username ?? c.name ?? "Customer",
});

const channelLabel = (ch: Channel) => (ch === "ig_dm" ? "IG DM" : "IG comment");

export async function resolveCreator(db: Db, creatorId?: Id): Promise<Creator> {
  await ensureSeeded();
  if (creatorId) {
    const c = await db.get("creators", creatorId);
    if (c) return c;
  }
  return getSunita(db);
}

async function postsById(db: Db, creatorId: Id) {
  const posts = await db.find("posts", { creatorId });
  return new Map(posts.map((p) => [p._id, p]));
}

const asc = <T extends { createdAt: Ms }>(rows: T[]) => [...rows].sort((a, b) => a.createdAt - b.createdAt);

/** Day number in IST, so "today" means today in Lucknow. */
const istDay = (t: Ms) => Math.floor((t + IST) / DAY);

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Taking order",
  confirmed: "Unpaid",
  link_sent: "Link sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

/** Orders that count as real money (not still being slot-filled, not cancelled). */
const isLive = (o: Order) => o.status !== "draft" && o.status !== "cancelled";

/** Plain-words reason for an approval, used when A4's reason is just a tag. */
export function plainReason(reason: string | undefined, tags: string[] = []): string {
  if (reason && reason.length > 24) return reason;
  const t = `${reason ?? ""} ${tags.join(" ")}`.toLowerCase();
  if (/ingredient|health|palm|oil|sugar|allerg/.test(t)) return "Ingredient claim: only you can confirm";
  if (/discount|bulk|deal|negotia/.test(t)) return "Discount or bulk deal: Smiley never bargains for you";
  if (/complain/.test(t)) return "A complaint: better coming from you";
  if (/money|price|not in menu/.test(t)) return "Money not on your menu: please check the amount";
  if (/profession|dental|medical|regulated/.test(t)) return "Professional advice: only you can answer this";
  if (/confidence|unsure|unknown/.test(t)) return "Smiley isn't sure what they mean";
  if (/first|warm|trust/.test(t)) return `One of your first ${v2.trustWarmup} replies: Smiley checks with you`;
  return reason || "Smiley wants your OK before replying";
}

// ---- inbox ---------------------------------------------------------------------

export interface InboxRow {
  threadId: Id;
  channel: Channel;
  customer: CustomerLite;
  lastText: string;
  lastSentBy: SentBy;
  lastAt: Ms;
  status: ThreadStatus;
  waiting: boolean;
  badge?: Badge;
  source: SourceLite;
}

export interface Inbox {
  rows: InboxRow[];
  counts: { all: number; dms: number; comments: number; waiting: number; hidden: number };
}

function threadBadge(lastOut: Message | undefined, waiting: boolean, order: Order | undefined): Badge | undefined {
  if (waiting) return { kind: "waiting", label: "Waiting for you" };
  if (order && order.status === "paid") return { kind: "paid", label: `Order ${inr(order.total)} paid` };
  if (order && order.status !== "cancelled") {
    const tail = order.status === "draft" ? "taking order" : order.status === "link_sent" ? "link sent" : "unpaid";
    return { kind: "order", label: order.status === "draft" ? "Taking order" : `Order ${inr(order.total)} · ${tail}` };
  }
  if (lastOut?.sentBy === "smiley") return { kind: "smiley", label: "Replied by Smiley" };
  if (lastOut?.sentBy === "owner") return { kind: "owner", label: "Replied by you" };
  if (!lastOut) return { kind: "new", label: "New" };
  return undefined;
}

export async function getInbox(creatorId?: Id): Promise<Inbox> {
  const db = getDb();
  const creator = await resolveCreator(db, creatorId);
  const [threads, posts, pendingDrafts, orders] = await Promise.all([
    db.find("threads", { creatorId: creator._id }),
    postsById(db, creator._id),
    pendingDraftsByThread(db, creator._id),
    db.find("orders", { creatorId: creator._id }),
  ]);
  const orderByThread = new Map<Id, Order>();
  for (const o of orders) if (!orderByThread.has(o.threadId)) orderByThread.set(o.threadId, o); // newest first

  const visible = threads.filter((t) => t.status !== "hidden");
  const rows = await Promise.all(
    visible.map(async (t): Promise<InboxRow> => {
      const msgs = await db.find("messages", { threadId: t._id });
      const last = msgs[0];
      const lastOut = msgs.find((m) => m.direction === "out");
      const waiting = t.status === "waiting_owner" || pendingDrafts.has(t._id);
      const order = (t.orderId && orders.find((o) => o._id === t.orderId)) || orderByThread.get(t._id);
      const post = t.sourcePostId ? posts.get(t.sourcePostId) : undefined;
      return {
        threadId: t._id,
        channel: t.channel,
        customer: customerLite(t.customer),
        lastText: last?.text ?? "",
        lastSentBy: last?.sentBy ?? "customer",
        lastAt: last?.createdAt ?? t.lastMessageAt,
        status: t.status,
        waiting,
        badge: threadBadge(lastOut, waiting, order),
        source: { channel: t.channel, label: channelLabel(t.channel), postTitle: post ? postTitle(post.caption) : undefined },
      };
    }),
  );
  rows.sort((a, b) => b.lastAt - a.lastAt);
  return {
    rows,
    counts: {
      all: rows.length,
      dms: rows.filter((r) => r.channel === "ig_dm").length,
      comments: rows.filter((r) => r.channel === "ig_comment").length,
      waiting: rows.filter((r) => r.waiting).length,
      hidden: threads.length - visible.length,
    },
  };
}

async function pendingDraftsByThread(db: Db, creatorId: Id) {
  const approvals = await db.find("approvals", { creatorId, status: "pending" });
  const map = new Map<Id, { draft: Draft; approval: Approval }>();
  for (const a of approvals) {
    const d = await db.get("drafts", a.draftId);
    if (d && d.status === "pending" && !map.has(d.threadId)) map.set(d.threadId, { draft: d, approval: a });
  }
  return map;
}

// ---- thread --------------------------------------------------------------------

export interface PendingDraftView {
  draftId: Id;
  approvalId?: Id;
  text: string;
  reason: string;
  replyTo?: string;
  createdAt: Ms;
}

export interface OrderView {
  orderId: Id;
  threadId: Id;
  customer: CustomerLite;
  items: { name: string; qty: number; price: number }[];
  itemsLine: string; // "3 Veg thali"
  total: number;
  deliverAt?: string;
  address?: string;
  status: OrderStatus;
  statusLabel: string;
  paid: boolean;
  canSendLink: boolean;
  payment?: { status: Payment["status"]; url: string; provider: Payment["provider"] };
  source: SourceLite;
  createdAt: Ms;
}

export interface ThreadView {
  thread: {
    id: Id;
    channel: Channel;
    status: ThreadStatus;
    customer: CustomerLite;
    source: SourceLite;
    lastInboundAt?: Ms;
  };
  messages: { id: Id; direction: Message["direction"]; text: string; sentBy: SentBy; createdAt: Ms }[];
  pending: PendingDraftView[];
  order?: OrderView;
}

const itemsLine = (o: Order) => o.items.map((i) => `${i.qty} ${i.name}`).join(", ") || "Items not decided yet";

async function orderView(db: Db, o: Order, thread: Thread | null, posts: Map<Id, Post>): Promise<OrderView> {
  const payment = (await db.find("payments", { orderId: o._id }, { limit: 1 }))[0];
  const channel = thread?.channel ?? "ig_dm";
  const post = o.sourcePostId ? posts.get(o.sourcePostId) : undefined;
  return {
    orderId: o._id,
    threadId: o.threadId,
    customer: customerLite(o.customer),
    items: o.items,
    itemsLine: itemsLine(o),
    total: o.total,
    deliverAt: o.deliverAt,
    address: o.address,
    status: o.status,
    statusLabel: ORDER_STATUS_LABEL[o.status],
    paid: o.status === "paid",
    canSendLink: o.status === "confirmed",
    payment: payment ? { status: payment.status, url: payment.url, provider: payment.provider } : undefined,
    source: { channel, label: channelLabel(channel), postTitle: post ? postTitle(post.caption) : undefined },
    createdAt: o.createdAt,
  };
}

export async function getThread(threadId: Id): Promise<ThreadView | null> {
  await ensureSeeded();
  const db = getDb();
  const t = await db.get("threads", threadId);
  if (!t) return null;
  const [msgs, drafts, orders, posts] = await Promise.all([
    db.find("messages", { threadId }),
    db.find("drafts", { threadId, status: "pending" }),
    db.find("orders", { threadId }),
    postsById(db, t.creatorId),
  ]);
  const byId = new Map(msgs.map((m) => [m._id, m]));
  const pending = await Promise.all(
    drafts.map(async (d): Promise<PendingDraftView> => {
      const a = await db.findOne("approvals", { draftId: d._id });
      return {
        draftId: d._id,
        approvalId: a && a.status === "pending" ? a._id : undefined,
        text: d.text,
        reason: plainReason(a?.reason, d.reasons),
        replyTo: byId.get(d.messageId)?.text,
        createdAt: d.createdAt,
      };
    }),
  );
  const open = (t.orderId && orders.find((o) => o._id === t.orderId)) || orders.find((o) => o.status !== "cancelled");
  const post = t.sourcePostId ? posts.get(t.sourcePostId) : undefined;
  return {
    thread: {
      id: t._id,
      channel: t.channel,
      status: t.status,
      customer: customerLite(t.customer),
      source: { channel: t.channel, label: channelLabel(t.channel), postTitle: post ? postTitle(post.caption) : undefined },
      lastInboundAt: t.lastInboundAt,
    },
    messages: asc(msgs).map((m) => ({ id: m._id, direction: m.direction, text: m.text, sentBy: m.sentBy, createdAt: m.createdAt })),
    pending: pending.sort((a, b) => a.createdAt - b.createdAt),
    order: open ? await orderView(db, open, t, posts) : undefined,
  };
}

// ---- orders --------------------------------------------------------------------

export type OrderGroup = "today" | "upcoming" | "earlier";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Which IST day an order is for. `deliverAt` is human ("Tomorrow, 12:30 pm", "Sat 25 Oct, 1 pm"),
 *  relative to when the order was taken. Unknown → the day it was taken. */
export function deliveryDay(o: Pick<Order, "deliverAt" | "createdAt">): number {
  const base = istDay(o.createdAt);
  const s = (o.deliverAt ?? "").toLowerCase();
  if (!s) return base;
  if (/\btoday\b|\baaj\b/.test(s)) return base;
  if (/\btomorrow\b|\bkal\b/.test(s)) return base + 1;
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return istDay(Date.parse(`${iso[0]}T12:00:00+05:30`));
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}`).test(s));
  if (wd >= 0) {
    const baseWd = new Date(base * DAY + 12 * 3600_000).getUTCDay();
    return base + ((wd - baseWd + 7) % 7);
  }
  return base;
}

export interface OrdersView {
  creatorName: string;
  today: { count: number; total: number; paid: number; unpaid: number; paidTotal: number };
  groups: { key: OrderGroup; title: string; orders: OrderView[] }[];
  toCook: string | null; // "3 thalis to cook tomorrow"
}

export async function getOrders(creatorId?: Id, opts: Opts = {}): Promise<OrdersView> {
  const now = opts.now ?? Date.now();
  const db = getDb();
  const creator = await resolveCreator(db, creatorId);
  const [orders, posts, threads] = await Promise.all([
    db.find("orders", { creatorId: creator._id }),
    postsById(db, creator._id),
    db.find("threads", { creatorId: creator._id }),
  ]);
  const threadById = new Map(threads.map((t) => [t._id, t]));
  const views = await Promise.all(
    orders.filter((o) => o.status !== "cancelled").map(async (o) => ({ o, v: await orderView(db, o, threadById.get(o.threadId) ?? null, posts) })),
  );

  const todayN = istDay(now);
  const takenToday = orders.filter((o) => isLive(o) && istDay(o.createdAt) === todayN);
  const paidToday = takenToday.filter((o) => o.status === "paid");

  const group = (o: Order): OrderGroup => {
    const d = deliveryDay(o);
    return d === todayN ? "today" : d > todayN ? "upcoming" : "earlier";
  };
  const groups: OrdersView["groups"] = (
    [
      ["today", "Today"],
      ["upcoming", "Upcoming"],
      ["earlier", "Earlier"],
    ] as const
  )
    .map(([key, title]) => ({
      key,
      title,
      orders: views
        .filter(({ o }) => group(o) === key)
        .sort((a, b) => (key === "earlier" ? b.o.createdAt - a.o.createdAt : a.o.createdAt - b.o.createdAt))
        .map(({ v }) => v),
    }))
    .filter((g) => g.orders.length);

  const tomorrowQty = orders
    .filter((o) => isLive(o) && deliveryDay(o) === todayN + 1)
    .flatMap((o) => o.items)
    .filter((i) => /thali/i.test(i.name))
    .reduce((n, i) => n + i.qty, 0);

  return {
    creatorName: creator.name,
    today: {
      count: takenToday.length,
      total: takenToday.reduce((n, o) => n + o.total, 0),
      paid: paidToday.length,
      unpaid: takenToday.length - paidToday.length,
      paidTotal: paidToday.reduce((n, o) => n + o.total, 0),
    },
    groups,
    toCook: tomorrowQty ? `${plural(tomorrowQty, "thali")} to cook tomorrow` : null,
  };
}

// ---- approvals -----------------------------------------------------------------

export interface ApprovalCard {
  approvalId: Id;
  draftId: Id;
  threadId: Id;
  channel: Channel;
  source: SourceLite;
  customer: CustomerLite;
  customerMessage: string;
  draft: string;
  reason: string;
  createdAt: Ms;
}

export async function getApprovalsQueue(creatorId?: Id): Promise<{ items: ApprovalCard[] }> {
  const db = getDb();
  const creator = await resolveCreator(db, creatorId);
  const [approvals, posts] = await Promise.all([db.find("approvals", { creatorId: creator._id, status: "pending" }), postsById(db, creator._id)]);
  const items: ApprovalCard[] = [];
  for (const a of approvals) {
    const d = await db.get("drafts", a.draftId);
    if (!d || d.status !== "pending") continue;
    const [t, m] = await Promise.all([db.get("threads", d.threadId), db.get("messages", d.messageId)]);
    if (!t) continue;
    const post = t.sourcePostId ? posts.get(t.sourcePostId) : undefined;
    items.push({
      approvalId: a._id,
      draftId: d._id,
      threadId: t._id,
      channel: t.channel,
      source: { channel: t.channel, label: channelLabel(t.channel), postTitle: post ? postTitle(post.caption) : undefined },
      customer: customerLite(t.customer),
      customerMessage: m?.text ?? "",
      draft: d.text,
      reason: plainReason(a.reason, d.reasons),
      createdAt: a.createdAt,
    });
  }
  items.sort((a, b) => a.createdAt - b.createdAt); // oldest first: they've waited longest
  return { items };
}

// ---- insights ------------------------------------------------------------------

export interface PostRow {
  postId: Id;
  title: string;
  kind: Post["kind"];
  thumbnailUrl?: string;
  publishedAt: Ms;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  conversations: number; // threads started from this post
  orders: number;
  revenue: number; // ₹ from live (confirmed+) orders attributed to the post
}

export interface InsightsView {
  posts: PostRow[];
  top?: PostRow;
  topLine: string | null; // "'Soft till lunch' brought 5 orders"
  replies: { total: number; auto: number; approved: number; byYou: number };
  medianReplyMs: number | null;
  medianReplyLabel: string;
  suggestion: string; // planner input for next week
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Time from a customer's first unanswered message to our next reply, per thread. */
export function replyGaps(messages: Message[]): number[] {
  const gaps: number[] = [];
  let waitingSince: number | null = null;
  for (const m of asc(messages)) {
    if (m.direction === "in") waitingSince ??= m.createdAt;
    else if (waitingSince !== null) {
      gaps.push(m.createdAt - waitingSince);
      waitingSince = null;
    }
  }
  return gaps;
}

export function durationLabel(ms: number | null): string {
  if (ms === null) return "No replies yet";
  if (ms < MIN) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)} min`;
  const h = ms / (60 * MIN);
  return `${h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h)} hr`;
}

export async function getInsights(creatorId?: Id): Promise<InsightsView> {
  const db = getDb();
  const creator = await resolveCreator(db, creatorId);
  const [posts, orders, threads, approvals] = await Promise.all([
    db.find("posts", { creatorId: creator._id }),
    db.find("orders", { creatorId: creator._id }),
    db.find("threads", { creatorId: creator._id }),
    db.find("approvals", { creatorId: creator._id }),
  ]);

  const rows: PostRow[] = posts.map((p) => {
    const mine = orders.filter((o) => o.sourcePostId === p._id && isLive(o));
    return {
      postId: p._id,
      title: postTitle(p.caption),
      kind: p.kind,
      thumbnailUrl: p.thumbnailUrl,
      publishedAt: p.publishedAt,
      reach: p.insights.reach,
      likes: p.insights.likes,
      comments: p.insights.comments,
      saves: p.insights.saves,
      conversations: threads.filter((t) => t.sourcePostId === p._id).length,
      orders: mine.length,
      revenue: mine.reduce((n, o) => n + o.total, 0),
    };
  });
  rows.sort((a, b) => b.orders - a.orders || b.revenue - a.revenue || b.reach - a.reach);
  const top = rows[0];

  const allMsgs = (await Promise.all(threads.map((t) => db.find("messages", { threadId: t._id })))).filter((m) => m.length);
  const outs = allMsgs.flat().filter((m) => m.direction === "out");
  const approvedTexts = new Set(
    approvals.filter((a) => a.status === "sent" || a.status === "edited").map((a) => (a.finalText ?? "").trim()).filter(Boolean),
  );
  const approvedCount = approvals.filter((a) => a.status === "sent" || a.status === "edited").length;
  const smileyOut = outs.filter((m) => m.sentBy === "smiley");
  const auto = smileyOut.filter((m) => !approvedTexts.has(m.text.trim())).length;
  const byYou = outs.filter((m) => m.sentBy === "owner" && !approvedTexts.has(m.text.trim())).length;

  const med = median(allMsgs.flatMap(replyGaps));

  const topLine = top && (top.orders || top.conversations) ? `"${top.title}" brought ${top.orders ? plural(top.orders, "order") : plural(top.conversations, "chat")}` : null;

  return {
    posts: rows,
    top,
    topLine,
    replies: { total: outs.length, auto, approved: approvedCount, byYou },
    medianReplyMs: med,
    medianReplyLabel: durationLabel(med),
    suggestion: suggestionFor(top, creator),
  };
}

function suggestionFor(top: PostRow | undefined, creator: Creator): string {
  if (!top) return `Post your first Reel this week. Show ${creator.businessName}'s food being made, and end with "DM to order".`;
  const proof = top.orders
    ? `It brought ${plural(top.orders, "order")} (${inr(top.revenue)}) and reached ${top.reach.toLocaleString("en-IN")} people.`
    : `It reached ${top.reach.toLocaleString("en-IN")} people and started ${plural(top.conversations, "chat")}.`;
  return `Make 2 more Reels like "${top.title}". ${proof} Post before 10 am so lunch orders come in, and end with "DM to order".`;
}

// ---- home ----------------------------------------------------------------------

export interface HomeView {
  creator: CreatorView;
  ordersToday: number;
  revenueToday: number;
  repliesHandled: number;
  waitingForYou: number;
  autopilot: boolean;
  unreadNotifications: number;
  topLine: string | null;
}

export interface CreatorView {
  id: Id;
  name: string;
  businessName: string;
  igUsername?: string;
  autoReplyPaused: boolean;
  repliesSentCount: number;
  warmupLeft: number; // replies still needing approval before Smiley may auto-send
}

export const creatorView = (c: Creator): CreatorView => ({
  id: c._id,
  name: c.name,
  businessName: c.businessName,
  igUsername: c.igUsername,
  autoReplyPaused: c.autoReplyPaused,
  repliesSentCount: c.repliesSentCount,
  warmupLeft: Math.max(0, v2.trustWarmup - c.repliesSentCount),
});

export async function getCreator(creatorId?: Id): Promise<CreatorView> {
  return creatorView(await resolveCreator(getDb(), creatorId));
}

export async function getHome(creatorId?: Id, opts: Opts = {}): Promise<HomeView> {
  const db = getDb();
  const creator = await resolveCreator(db, creatorId);
  const [orders, insights, queue, notes] = await Promise.all([
    getOrders(creator._id, opts),
    getInsights(creator._id),
    getApprovalsQueue(creator._id),
    db.find("notifications", { creatorId: creator._id, read: false }),
  ]);
  return {
    creator: creatorView(creator),
    ordersToday: orders.today.count,
    revenueToday: orders.today.total,
    repliesHandled: insights.replies.auto + insights.replies.approved,
    waitingForYou: queue.items.length,
    autopilot: !creator.autoReplyPaused,
    unreadNotifications: notes.length,
    topLine: insights.topLine,
  };
}

// ---- notifications -------------------------------------------------------------

export async function getNotifications(creatorId?: Id, limit = 20): Promise<{ items: Notification[]; unread: number }> {
  const db = getDb();
  const creator = await resolveCreator(db, creatorId);
  const all = await db.find("notifications", { creatorId: creator._id });
  return { items: all.slice(0, limit), unread: all.filter((n) => !n.read).length };
}

