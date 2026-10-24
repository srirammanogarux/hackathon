// A1 · Instagram adapter for V2: webhook verify + parse, comment reply/hide, DMs (incl. private
// replies), Reel publishing, insights, OAuth (Instagram API with Instagram Login) and token refresh.
//
// Host: graph.instagram.com/v26.0 with an Instagram User token ("IGAA…"). If the token is a
// Facebook Login user token ("EAA…", what V1's IG_ACCESS_TOKEN is) we talk to graph.facebook.com
// instead: publish, insights and comment reply/hide are identical there, but DMs need a Page token.
//
// Safety: every write goes through `gate()`. No keys (`!v2.instagram()`) or sends disabled
// (`!v2.sendsEnabled()`) → no network, a mock result, and a send_blocked audit event.
import { createHmac, timingSafeEqual } from "node:crypto";
import { v2 } from "./config";
import { encrypt, decrypt } from "./crypto";
import { getDb, logEvent } from "./db";
import { SUNITA_IG_USER_ID } from "./seed";
import type { Creator, Id, InboundEvent, Ms, PostInsights, SendResult } from "./types";

import fxComment from "./fixtures/ig-comment.json";
import fxCommentSensitive from "./fixtures/ig-comment-sensitive.json";
import fxDm from "./fixtures/ig-dm.json";
import fxDmEcho from "./fixtures/ig-dm-echo.json";
import fxDmReferral from "./fixtures/ig-dm-referral.json";

export const GRAPH_VERSION = process.env.GRAPH_API_VERSION ?? "v26.0";
const IG_HOST = `https://graph.instagram.com/${GRAPH_VERSION}`;
const FB_HOST = `https://graph.facebook.com/${GRAPH_VERSION}`;
const HOUR = 3600_000;
const DM_WINDOW = 24 * HOUR;

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
];

// ---- webhook ------------------------------------------------------------------

/** X-Hub-Signature-256 = "sha256=" + hex HMAC-SHA256(raw body, app secret). No secret (mock) → accept.
 *  Instagram Login webhooks are signed with the *Instagram* app secret (Instagram > API setup with
 *  Instagram login > Business login settings), not the Meta app secret under App settings > Basic. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = v2.igAppSecret();
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const got = Buffer.from(header.slice("sha256=".length));
  return got.length === want.length && timingSafeEqual(got, want);
}

const toMs = (t: unknown, fallback: Ms) => {
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n < 1e12 ? n * 1000 : n; // comment entries carry seconds, messaging carries ms
};

const ATTACHMENT_LABEL: Record<string, string> = {
  image: "[photo]",
  video: "[video]",
  audio: "[voice note]",
  file: "[file]",
  ig_reel: "[shared reel]",
  reel: "[shared reel]",
  ig_post: "[shared post]",
  share: "[shared post]",
  story_mention: "[story mention]",
  animated_image: "[sticker]",
  like_heart: "❤️",
};

const asArr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Normalises an Instagram webhook body into InboundEvents. Our own comments are dropped;
 *  our own DMs come back flagged isEcho (callers skip them). live_comments, reactions, reads
 *  and bare messaging_referral pings (no message) are ignored. */
export function parseWebhook(body: unknown): InboundEvent[] {
  const b = body as any;
  if (!b || b.object !== "instagram") return [];
  const out: InboundEvent[] = [];

  for (const entry of asArr(b.entry)) {
    const igUserId = String(entry?.id ?? "");
    const entryTime = toMs(entry?.time, Date.now());

    for (const ch of asArr(entry?.changes)) {
      if (ch?.field !== "comments") continue;
      const v = ch.value ?? {};
      const fromId = String(v.from?.id ?? "");
      if (!v.id || !fromId || fromId === igUserId) continue;
      out.push({
        kind: "comment",
        igUserId,
        externalId: String(v.id),
        threadKey: String(v.parent_id ?? v.id),
        customer: { igsid: fromId, username: v.from?.username },
        text: String(v.text ?? ""),
        mediaId: v.media?.id ? String(v.media.id) : undefined,
        parentCommentId: v.parent_id ? String(v.parent_id) : undefined,
        timestamp: entryTime,
      });
    }

    for (const m of asArr(entry?.messaging)) {
      const senderId = String(m?.sender?.id ?? "");
      const recipientId = String(m?.recipient?.id ?? "");
      const timestamp = toMs(m?.timestamp, entryTime);

      // Ice-breaker / CTA taps read like the customer typed the button title.
      if (m?.postback && senderId !== igUserId) {
        out.push({
          kind: "dm",
          igUserId,
          externalId: String(m.postback.mid ?? `postback_${senderId}_${timestamp}`),
          threadKey: senderId,
          customer: { igsid: senderId },
          text: String(m.postback.title ?? m.postback.payload ?? ""),
          timestamp,
        });
        continue;
      }

      const msg = m?.message;
      if (!msg?.mid || msg.is_deleted || msg.is_unsupported) continue;
      const isEcho = !!msg.is_echo;
      if (!isEcho && senderId === igUserId) continue;

      const text =
        (typeof msg.text === "string" && msg.text) ||
        asArr(msg.attachments)
          .map((a) => ATTACHMENT_LABEL[a?.type] ?? `[${a?.type ?? "attachment"}]`)
          .join(" ") ||
        "[message]";
      const ref = msg.referral ?? m.referral;
      const mediaId = ref?.ads_context_data?.post_id ?? ref?.post_id ?? ref?.media_id;
      const customerId = isEcho ? recipientId : senderId;

      out.push({
        kind: "dm",
        igUserId,
        externalId: String(msg.mid),
        threadKey: customerId,
        customer: { igsid: customerId },
        text,
        mediaId: mediaId ? String(mediaId) : undefined,
        timestamp,
        ...(isEcho ? { isEcho: true } : {}),
      });
    }
  }
  return out;
}

const FIXTURES = {
  "ig-comment": fxComment,
  "ig-comment-sensitive": fxCommentSensitive,
  "ig-dm": fxDm,
  "ig-dm-echo": fxDmEcho,
  "ig-dm-referral": fxDmReferral,
};
export type IgFixtureName = keyof typeof FIXTURES;

/** A webhook fixture re-stamped to `now`, with fresh ids so the pipeline doesn't dedupe repeats
 *  (pass `fresh: false` to keep the fixture ids). For tests and the "simulate" demo button. */
export function igFixture(name: IgFixtureName, { now = Date.now(), fresh = true } = {}): any {
  const body = structuredClone(FIXTURES[name]) as any;
  const tag = fresh ? `_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}` : "";
  for (const e of body.entry) {
    e.time = e.changes ? Math.floor(now / 1000) : now;
    for (const ch of e.changes ?? []) if (fresh) ch.value.id = `${ch.value.id}${tag}`;
    for (const m of e.messaging ?? []) {
      m.timestamp = now;
      if (fresh && m.message?.mid) m.message.mid = `${m.message.mid}${tag}`;
    }
  }
  return body;
}

// ---- accounts -----------------------------------------------------------------

export interface IgCreds {
  creatorId: Id;
  igUserId: string;
  username?: string;
  token: string;
  tokenExpiresAt?: Ms;
  accountId?: Id; // igAccounts row, when the creds came from the db
  source: "db" | "env";
}

const isMockToken = (t: string) => !t || t.startsWith("mock");

/** Linked account for a creator, token decrypted. Falls back to env IG_USER_ID / IG_ACCESS_TOKEN
 *  (the owner's own tester account) for the creator that account belongs to: the one whose
 *  igUserId matches IG_USER_ID, or Sunita (the demo persona) when nothing matches. */
export async function getAccount(creatorId: Id): Promise<IgCreds | null> {
  const db = getDb();
  const row = await db.findOne("igAccounts", { creatorId });
  const dbCreds: IgCreds | null = row
    ? {
        creatorId,
        igUserId: row.igUserId,
        username: row.username,
        token: decrypt(row.accessToken),
        tokenExpiresAt: row.tokenExpiresAt,
        accountId: row._id,
        source: "db",
      }
    : null;
  if (dbCreds && !isMockToken(dbCreds.token)) return dbCreds;

  const envToken = process.env.IG_ACCESS_TOKEN;
  const envUser = process.env.IG_USER_ID;
  if (envToken) {
    const creator = await db.get("creators", creatorId);
    const owns = creator && (creator.igUserId === envUser || creator.igUserId === SUNITA_IG_USER_ID);
    if (owns) return { creatorId, igUserId: envUser ?? creator.igUserId!, username: creator.igUsername, token: envToken, source: "env" };
  }
  return dbCreds;
}

/** Which creator owns the IG account a webhook arrived for. When the owner tests with their own
 *  account (IG_USER_ID) without going through OAuth, that account maps to Sunita. */
export async function findCreatorByIgUserId(igUserId: string): Promise<Creator | null> {
  const db = getDb();
  const direct = await db.findOne("creators", { igUserId });
  if (direct) return direct;
  const acct = await db.findOne("igAccounts", { igUserId });
  if (acct) return db.get("creators", acct.creatorId);
  if (igUserId && igUserId === process.env.IG_USER_ID) return db.findOne("creators", { igUserId: SUNITA_IG_USER_ID });
  return null;
}

// ---- graph client ---------------------------------------------------------------

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
}

const hostFor = (token: string) => (token.startsWith("EAA") ? FB_HOST : IG_HOST);

async function graph<T = any>(
  token: string,
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown> = {},
  json?: unknown,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.set(k, String(v));
  const q = qs.toString();
  const url = `${path.startsWith("http") ? path : hostFor(token) + path}${q ? `?${q}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || body?.error) {
    const e = body?.error ?? {};
    throw new GraphError(`${method} ${path} → ${res.status} code=${e.code ?? "-"}: ${e.error_user_msg ?? e.message ?? JSON.stringify(body)}`, res.status, e.code, e.error_subcode);
  }
  return body as T;
}

// ---- outbound -------------------------------------------------------------------

type Channel = "ig_comment" | "ig_dm" | "ig_hide" | "ig_publish";
const mockId = (kind: string) => `mock_${kind}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** null → go live. Otherwise the mock result, already audited. */
async function gate(creatorId: Id, channel: Channel, text: string, target: string, kind: string): Promise<SendResult | null> {
  if (v2.instagram() && v2.sendsEnabled()) return null;
  const reason = v2.instagram() ? "sends_disabled" : "no_instagram_keys";
  const externalId = mockId(kind);
  await logEvent(creatorId, "send_blocked", { reason, channel, text, target, externalId, mock: true });
  return { ok: true, mock: true, externalId };
}

async function live(creatorId: Id, op: string, fn: (c: IgCreds) => Promise<string | undefined>): Promise<SendResult> {
  try {
    const creds = await getAccount(creatorId);
    if (!creds || isMockToken(creds.token)) throw new Error("no linked Instagram account");
    return { ok: true, externalId: await fn(creds) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logEvent(creatorId, "error", { op, error, code: (err as GraphError).code });
    return { ok: false, error };
  }
}

/** Public reply under a comment (threads under the root comment). */
export async function replyComment(creator: Creator, commentId: string, text: string): Promise<SendResult> {
  const mock = await gate(creator._id, "ig_comment", text, commentId, "reply");
  if (mock) return mock;
  return live(creator._id, "replyComment", async (c) => {
    const r = await graph<{ id: string }>(c.token, "POST", `/${commentId}/replies`, { message: text });
    return r.id;
  });
}

export async function hideComment(creator: Creator, commentId: string, hide = true): Promise<SendResult> {
  const res =
    (await gate(creator._id, "ig_hide", hide ? "hide" : "unhide", commentId, "hide")) ??
    (await live(creator._id, "hideComment", async (c) => {
      await graph(c.token, "POST", `/${commentId}`, { hide });
      return commentId;
    }));
  if (res.ok) await logEvent(creator._id, "comment_hidden", { commentId, hide, mock: !!res.mock });
  return res;
}

/** DM a customer. Plain DMs need the customer to have messaged us in the last 24 h (Meta's
 *  standard messaging window). With `commentId` it's a private reply to that comment instead:
 *  `recipient: { comment_id }`, allowed once per comment within 7 days of it, no 24 h check. */
export async function sendDM(
  creator: Creator,
  igsid: string,
  text: string,
  opts: { lastInboundAt?: number; commentId?: string } = {},
): Promise<SendResult> {
  const { lastInboundAt, commentId } = opts;
  if (!commentId && lastInboundAt !== undefined && Date.now() - lastInboundAt > DM_WINDOW) {
    await logEvent(creator._id, "send_blocked", { reason: "outside_24h_window", channel: "ig_dm", text, target: igsid, lastInboundAt });
    return { ok: false, blocked: "outside_24h_window" };
  }
  const mock = await gate(creator._id, "ig_dm", text, commentId ? `comment:${commentId}` : igsid, commentId ? "private_reply" : "dm");
  if (mock) return mock;
  return live(creator._id, "sendDM", async (c) => {
    const recipient = commentId ? { comment_id: commentId } : { id: igsid };
    const r = await graph<{ message_id?: string; recipient_id?: string }>(c.token, "POST", `/${c.igUserId}/messages`, {}, { recipient, message: { text } });
    return r.message_id;
  });
}

/** Optional enrichment for DM customers (webhooks only carry the IGSID). Mock / errors → {}. */
export async function fetchProfile(creatorId: Id, igsid: string): Promise<{ username?: string; name?: string }> {
  if (!v2.instagram()) return {};
  try {
    const c = await getAccount(creatorId);
    if (!c || isMockToken(c.token)) return {};
    return await graph(c.token, "GET", `/${igsid}`, { fields: "name,username" });
  } catch {
    return {};
  }
}

// ---- publishing ---------------------------------------------------------------------

export const PUBLISH_POLL = { intervalMs: 5000, attempts: 60 };

const absUrl = (u: string) =>
  /^https?:\/\//.test(u) ? u : `${(process.env.PUBLIC_MEDIA_BASE_URL || v2.appBaseUrl()).replace(/\/$/, "")}${u.startsWith("/") ? "" : "/"}${u}`;

/** Reel: create REELS container → poll status_code until FINISHED → media_publish. The video URL
 *  must be public HTTPS (Meta fetches it). Inserts a posts row and logs ig_publish. Throws on failure. */
export async function publishReel(
  creatorId: Id,
  videoUrl: string,
  caption: string,
): Promise<{ mediaId: string; permalink?: string; mock?: boolean; postId?: Id }> {
  const db = getDb();
  const mock = await gate(creatorId, "ig_publish", caption, videoUrl, "media");
  let mediaId: string;
  let permalink: string | undefined;
  let thumbnailUrl: string | undefined;

  if (mock) {
    mediaId = mock.externalId!;
    permalink = `https://www.instagram.com/reel/${mediaId}/`;
  } else {
    try {
      const c = await getAccount(creatorId);
      if (!c || isMockToken(c.token)) throw new Error("no linked Instagram account");
      const { id: container } = await graph<{ id: string }>(c.token, "POST", `/${c.igUserId}/media`, {
        media_type: "REELS",
        video_url: absUrl(videoUrl),
        caption,
        share_to_feed: true,
      });
      await waitFinished(c.token, container);
      ({ id: mediaId } = await graph<{ id: string }>(c.token, "POST", `/${c.igUserId}/media_publish`, { creation_id: container }));
      const meta = await graph<{ permalink?: string; thumbnail_url?: string }>(c.token, "GET", `/${mediaId}`, { fields: "permalink,thumbnail_url" }).catch(() => ({}) as { permalink?: string; thumbnail_url?: string });
      permalink = meta.permalink;
      thumbnailUrl = meta.thumbnail_url;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await logEvent(creatorId, "error", { op: "publishReel", error, videoUrl });
      throw err;
    }
  }

  const postId = await db.insert("posts", {
    creatorId,
    igMediaId: mediaId,
    kind: "reel",
    caption,
    permalink,
    thumbnailUrl,
    publishedAt: Date.now(),
    insights: { reach: 0, likes: 0, saves: 0, comments: 0, shares: 0, plays: 0 },
  });
  await logEvent(creatorId, "ig_publish", { mediaId, permalink, postId, videoUrl, mock: !!mock });
  return { mediaId, permalink, postId, ...(mock ? { mock: true } : {}) };
}

async function waitFinished(token: string, container: string) {
  for (let i = 0; i < PUBLISH_POLL.attempts; i++) {
    const { status_code, status } = await graph<{ status_code?: string; status?: string }>(token, "GET", `/${container}`, { fields: "status_code,status" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`container ${container} ${status_code}: ${status ?? ""}`);
    await new Promise((r) => setTimeout(r, PUBLISH_POLL.intervalMs));
  }
  throw new Error(`container ${container} not FINISHED in time`);
}

// ---- insights ---------------------------------------------------------------------

const ZERO: PostInsights = { reach: 0, likes: 0, saves: 0, comments: 0, shares: 0, plays: 0 };

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Mock: grows from the stored numbers, fast while the post is fresh, slowly after. */
async function mockInsights(mediaId: string): Promise<PostInsights> {
  const post = await getDb().findOne("posts", { igMediaId: mediaId });
  const base = { ...ZERO, ...post?.insights };
  const ageH = post ? Math.max(0, (Date.now() - post.publishedAt) / HOUR) : 0;
  const rate = 0.02 + 0.25 / (1 + ageH / 12);
  const reach = Math.round(Math.max(base.reach * (1 + rate), base.reach + 40 + (hash(mediaId) % 160)));
  const grow = (cur: number, share: number) => Math.round(Math.max(cur * (1 + rate), reach * share));
  return {
    reach,
    plays: grow(base.plays ?? 0, 1.6),
    likes: grow(base.likes, 0.12),
    saves: grow(base.saves, 0.02),
    comments: grow(base.comments, 0.009),
    shares: grow(base.shares ?? 0, 0.007),
  };
}

/** Lifetime media insights. `views` replaced `plays` for Reels in 2025; we store it as `plays`. */
export async function fetchInsights(creator: Creator, mediaId: string): Promise<PostInsights> {
  if (!v2.instagram() || mediaId.startsWith("mock_")) return mockInsights(mediaId);
  const c = await getAccount(creator._id);
  if (!c || isMockToken(c.token)) return mockInsights(mediaId);
  const r = await graph<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
    c.token,
    "GET",
    `/${mediaId}/insights`,
    { metric: "reach,likes,comments,saved,shares,views" },
  );
  const m = Object.fromEntries(r.data.map((d) => [d.name, Number(d.values?.[0]?.value ?? d.total_value?.value ?? 0)]));
  return { reach: m.reach ?? 0, likes: m.likes ?? 0, comments: m.comments ?? 0, saves: m.saved ?? 0, shares: m.shares ?? 0, plays: m.views ?? 0 };
}

/** Refreshes insights on all of a creator's posts (the nightly cron). Returns how many updated. */
export async function syncInsights(creatorId: Id): Promise<number> {
  const db = getDb();
  const creator = await db.get("creators", creatorId);
  if (!creator) return 0;
  let n = 0;
  for (const post of await db.find("posts", { creatorId })) {
    try {
      await db.patch("posts", post._id, { insights: await fetchInsights(creator, post.igMediaId) });
      n++;
    } catch (err) {
      await logEvent(creatorId, "error", { op: "fetchInsights", mediaId: post.igMediaId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  await logEvent(creatorId, "ig_insights", { updated: n, mock: !v2.instagram() });
  return n;
}

// ---- OAuth (Instagram Login) & tokens ---------------------------------------------------

export const oauthConfigured = () => !!(process.env.IG_APP_ID && v2.igAppSecret());
export const oauthRedirectUri = () => `${v2.appBaseUrl()}/api/ig/oauth/callback`;

export function oauthAuthorizeUrl(state: string): string {
  const qs = new URLSearchParams({
    client_id: process.env.IG_APP_ID ?? "",
    redirect_uri: oauthRedirectUri(),
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
    enable_fb_login: "0",
  });
  return `https://www.instagram.com/oauth/authorize?${qs}`;
}

export interface LinkedAccount {
  igUserId: string;
  username: string;
  token: string;
  tokenExpiresAt: Ms;
  scopes: string[];
}

/** code → short-lived token (api.instagram.com) → 60-day token (ig_exchange_token) → /me. */
export async function exchangeCode(code: string): Promise<LinkedAccount> {
  const form = new URLSearchParams({
    client_id: process.env.IG_APP_ID ?? "",
    client_secret: v2.igAppSecret(),
    grant_type: "authorization_code",
    redirect_uri: oauthRedirectUri(),
    code: code.replace(/#_$/, ""),
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as any;
  const short = body?.data?.[0] ?? body; // current docs wrap it in data[]; older responses were flat
  if (!res.ok || !short?.access_token) throw new Error(`code exchange failed: ${body?.error_message ?? body?.error?.message ?? res.status}`);

  const long = await graph<{ access_token: string; expires_in: number }>(short.access_token, "GET", "https://graph.instagram.com/access_token", {
    grant_type: "ig_exchange_token",
    client_secret: v2.igAppSecret(),
  });
  // user_id is the professional account id that webhooks carry as entry.id; id is app-scoped.
  const me = await graph<{ user_id?: string; id?: string; username: string }>(long.access_token, "GET", "/me", { fields: "user_id,username" });
  const perms = short.permissions;
  return {
    igUserId: String(me.user_id ?? me.id),
    username: me.username,
    token: long.access_token,
    tokenExpiresAt: Date.now() + long.expires_in * 1000,
    scopes: Array.isArray(perms) ? perms : typeof perms === "string" ? perms.split(",") : IG_SCOPES,
  };
}

/** Upserts the igAccounts row (token encrypted) and stamps creators.igUserId/igUsername. */
export async function linkAccount(creatorId: Id, a: LinkedAccount): Promise<Id> {
  const db = getDb();
  const row = { creatorId, igUserId: a.igUserId, username: a.username, accessToken: encrypt(a.token), tokenExpiresAt: a.tokenExpiresAt, scopes: a.scopes };
  const existing = await db.findOne("igAccounts", { creatorId });
  const id = existing ? (await db.patch("igAccounts", existing._id, row), existing._id) : await db.insert("igAccounts", row);
  await db.patch("creators", creatorId, { igUserId: a.igUserId, igUsername: a.username });
  return id;
}

/** Instagram Login apps must subscribe each account to webhook fields (needs a live token). */
export async function subscribeWebhooks(creatorId: Id, fields = ["comments", "messages", "messaging_postbacks"]): Promise<SendResult> {
  if (!v2.instagram() && !oauthConfigured()) return { ok: true, mock: true };
  return live(creatorId, "subscribeWebhooks", async (c) => {
    await graph(c.token, "POST", `/${c.igUserId}/subscribed_apps`, { subscribed_fields: fields.join(",") });
    return c.igUserId;
  });
}

/** 60-day tokens: refresh once they're >24 h old and still valid (ig_refresh_token). Env tokens
 *  are refreshed but can't be persisted, so the new value is only returned. */
export async function refreshToken(creatorId: Id): Promise<{ ok: boolean; mock?: boolean; tokenExpiresAt?: Ms; error?: string }> {
  const db = getDb();
  const c = await getAccount(creatorId);
  if (!c) return { ok: false, error: "no linked Instagram account" };
  if (!v2.instagram() || isMockToken(c.token)) {
    const tokenExpiresAt = Date.now() + 60 * 24 * HOUR;
    if (c.accountId) await db.patch("igAccounts", c.accountId, { tokenExpiresAt });
    return { ok: true, mock: true, tokenExpiresAt };
  }
  try {
    const r = await graph<{ access_token: string; expires_in: number }>(c.token, "GET", "https://graph.instagram.com/refresh_access_token", { grant_type: "ig_refresh_token" });
    const tokenExpiresAt = Date.now() + r.expires_in * 1000;
    if (c.source === "db" && c.accountId) await db.patch("igAccounts", c.accountId, { accessToken: encrypt(r.access_token), tokenExpiresAt });
    return { ok: true, tokenExpiresAt };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logEvent(creatorId, "error", { op: "refreshToken", error });
    return { ok: false, error };
  }
}
