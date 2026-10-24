// V2 shared contract: "Your Instagram runs your shop" (see .context/prd-v2.md §7–8).
// Owned by A0. Other workstreams import from here and never redefine these shapes.
// Change a type here first, then update convex/schema.ts to match.

export type Id = string;
export type Ms = number; // epoch milliseconds

// ---- creators ---------------------------------------------------------------

export type ReplyLanguage = "hinglish" | "english" | "hindi";

export interface ToneProfile {
  summary: string; // one line, e.g. "Warm didi energy, Hinglish, short sentences, ends with 🙏"
  language: ReplyLanguage; // her default; replies still mirror the customer's language
  formality: "warm" | "casual" | "professional";
  greetings: string[]; // "Haan ji!", "Namaste 🙏"
  signoffs: string[]; // "Thank you ji 🙏"
  emoji: string[]; // emoji she actually uses
  sampleLines: string[]; // real lines from V1 warm-up / voiceover transcripts / her edits
  dos: string[];
  donts: string[];
}

export interface MenuItem {
  name: string;
  price: number; // INR
  unit?: string; // "plate", "box of 10"
  veg?: boolean;
  description?: string;
  available?: boolean;
}

export interface Creator {
  _id: Id;
  name: string;
  email: string;
  businessName: string;
  city?: string;
  igUserId?: string;
  igUsername?: string;
  toneProfile: ToneProfile;
  menu: MenuItem[];
  pricesAllowed: boolean; // may Smiley quote prices without approval
  deliveryAreas: string[];
  hours: string; // "Mon–Sat, orders by 10 am for lunch"
  howToOrder: string; // "DM your order + address, pay by UPI link"
  minOrder?: number;
  deliveryFee?: number;
  neverShow: string[]; // topics never to mention (from V1 onboarding)
  profession?: string; // "home tiffin service", "dentist" → regulated
  waNumber?: string; // owner's WhatsApp, E.164
  ownerEmail?: string;
  upiId?: string;
  autoReplyPaused: boolean; // owner kill switch (§11)
  repliesSentCount: number; // first 20 replies need approval (§6)
}

export interface IgAccount {
  _id: Id;
  creatorId: Id;
  igUserId: string;
  username: string;
  accessToken: string; // encrypted at rest (lib/v2/crypto.ts)
  tokenExpiresAt: Ms;
  scopes: string[];
}

export interface PostInsights {
  reach: number;
  likes: number;
  saves: number;
  comments: number;
  shares?: number;
  plays?: number;
}

export interface Post {
  _id: Id;
  creatorId: Id;
  igMediaId: string;
  kind: "reel" | "carousel" | "image" | "story";
  caption: string;
  permalink?: string;
  thumbnailUrl?: string;
  publishedAt: Ms;
  insights: PostInsights;
}

// ---- conversations ----------------------------------------------------------

export type Channel = "ig_dm" | "ig_comment";

export interface Customer {
  igsid: string; // IG-scoped id (DM) or commenter id (comment)
  username?: string;
  name?: string;
  phone?: string;
}

export type ThreadStatus = "open" | "waiting_owner" | "ordering" | "closed" | "hidden";

export interface Thread {
  _id: Id;
  creatorId: Id;
  channel: Channel;
  externalId: string; // DM: customer igsid · comment: root comment id
  mediaId?: string; // comment threads (and DMs that came from a post referral)
  sourcePostId?: Id; // attribution (§5.4)
  customer: Customer;
  lastMessageAt: Ms;
  lastInboundAt?: Ms; // for the 24-hour DM window
  status: ThreadStatus;
  orderId?: Id; // open order being slot-filled in this thread
}

export type Direction = "in" | "out";
export type SentBy = "customer" | "smiley" | "owner";

export interface Message {
  _id: Id;
  threadId: Id;
  direction: Direction;
  text: string;
  sentBy: SentBy;
  createdAt: Ms;
  externalId?: string; // IG comment id / message mid
}

// ---- brain ------------------------------------------------------------------

export const INTENTS = [
  "greeting",
  "menu",
  "price",
  "timings",
  "delivery_area",
  "how_to_order",
  "thanks",
  "order", // wants to buy / gives order details
  "order_status", // "where is my order", "paid"
  "health_claim", // ingredients, palm oil, sugar-free, allergy
  "complaint",
  "discount", // bulk deal, discount, negotiation
  "professional_advice", // regulated advice (dental, medical)
  "collab", // brand-deal enquiry
  "spam",
  "abuse",
  "other",
] as const;
export type Intent = (typeof INTENTS)[number];

export interface Slots {
  items?: { name: string; qty: number }[];
  date?: string; // ISO date or "tomorrow"
  time?: string; // "1 pm"
  address?: string;
  area?: string;
  name?: string;
  phone?: string;
}

export interface Classification {
  intent: Intent;
  confidence: number; // 0–1
  language: ReplyLanguage; // what the customer wrote in
  slots: Slots;
}

export type Policy = "auto" | "approval" | "skip"; // skip = never reply (spam/abuse → hide)

export interface DraftResult {
  text: string;
  policy: Policy;
  reasons: string[]; // why approval/skip, e.g. "health claim", "first 20 replies"
  hide?: boolean; // comment should be hidden (spam/abuse)
}

export interface OrderExtraction {
  items: OrderItem[]; // priced from the creator's menu
  missing: ("items" | "date" | "time" | "address" | "name")[];
  deliverAt?: string; // human, "Sat 25 Oct, 1 pm"
  address?: string;
  customerName?: string;
  confirmText: string; // the next DM to send: ask for missing slot, or confirm summary
  ready: boolean; // all slots filled and customer confirmed
}

export type DraftStatus = "sent" | "pending" | "rejected" | "skipped";

export interface Draft {
  _id: Id;
  threadId: Id;
  messageId: Id; // the inbound message this replies to
  text: string;
  intent: Intent;
  confidence: number;
  policy: Policy;
  reasons: string[];
  status: DraftStatus;
  createdAt: Ms;
}

// ---- orders & payments ------------------------------------------------------

export interface OrderItem {
  name: string;
  qty: number;
  price: number; // unit price INR
}

export type OrderStatus = "draft" | "confirmed" | "link_sent" | "paid" | "cancelled";

export interface Order {
  _id: Id;
  creatorId: Id;
  threadId: Id;
  sourcePostId?: Id;
  customer: Customer;
  items: OrderItem[];
  total: number; // INR
  deliverAt?: string;
  address?: string;
  notes?: string;
  status: OrderStatus;
  createdAt: Ms;
  updatedAt: Ms;
}

export type PaymentStatus = "created" | "pending" | "paid" | "failed" | "expired";

export interface Payment {
  _id: Id;
  orderId: Id;
  provider: "pinelabs" | "mock";
  linkId: string;
  url: string;
  amount: number; // INR
  status: PaymentStatus;
  rawEvents: unknown[];
  createdAt: Ms;
}

// ---- approvals, alerts, audit -----------------------------------------------

export type ApprovalChannel = "inapp" | "whatsapp" | "email" | "agenticorg";
export type ApprovalStatus = "pending" | "sent" | "edited" | "rejected" | "expired";
export type Decision = "send" | "edit" | "reject";

export interface Approval {
  _id: Id;
  creatorId: Id;
  draftId: Id;
  reason: string;
  channels: ApprovalChannel[]; // where it was raised
  agenticOrgItemId?: string;
  token: string; // one-tap link secret
  status: ApprovalStatus;
  createdAt: Ms;
  decidedAt?: Ms;
  finalText?: string;
}

export type NotifyKind = "new_order" | "paid" | "approval_needed" | "daily_summary";

export interface Notification {
  _id: Id;
  creatorId: Id;
  kind: NotifyKind;
  title: string;
  body: string;
  url?: string;
  channels: ("inapp" | "email" | "whatsapp")[];
  read: boolean;
  createdAt: Ms;
}

export type EventType =
  | "message_in"
  | "message_out"
  | "draft_created"
  | "draft_sent"
  | "draft_skipped"
  | "comment_hidden"
  | "approval_requested"
  | "approval_decided"
  | "order_created"
  | "order_status"
  | "payment_link_created"
  | "payment_event"
  | "notify"
  | "ig_publish"
  | "ig_insights"
  | "send_blocked" // kill switch / 24h window / sends disabled
  | "error";

export interface AuditEvent {
  _id: Id;
  creatorId: Id;
  type: EventType;
  payload: Record<string, unknown>;
  createdAt: Ms;
}

// ---- tables -----------------------------------------------------------------

export interface Tables {
  creators: Creator;
  igAccounts: IgAccount;
  posts: Post;
  threads: Thread;
  messages: Message;
  drafts: Draft;
  orders: Order;
  payments: Payment;
  approvals: Approval;
  notifications: Notification;
  events: AuditEvent;
}
export type Table = keyof Tables;
export type Row<T extends Table> = Tables[T];
export type NewRow<T extends Table> = Omit<Tables[T], "_id">;

// ---- Instagram (A1) ---------------------------------------------------------

/** Normalised inbound webhook item. A1's parseWebhook() returns these; A6's pipeline consumes them. */
export interface InboundEvent {
  kind: "comment" | "dm";
  igUserId: string; // the creator's IG account that received it
  externalId: string; // comment id / message mid (idempotency key)
  threadKey: string; // DM: sender igsid · comment: root comment id
  customer: Customer;
  text: string;
  mediaId?: string; // comment's media, or DM referral's media
  parentCommentId?: string;
  timestamp: Ms;
  isEcho?: boolean; // our own outbound DM echoed back: ignore
}

export interface SendResult {
  ok: boolean;
  externalId?: string;
  mock?: boolean; // true when no keys / sends disabled → recorded in the outbox only
  blocked?: string; // reason when not sent (kill switch, 24h window…)
  error?: string;
}

// ---- contract signatures (§8) -------------------------------------------------
// Implementations live in the owning workstream's files; these types pin the shape.

export type ClassifyFn = (text: string, creator: Creator, history?: Message[]) => Promise<Classification>;
export type DraftReplyFn = (
  thread: Thread,
  creator: Creator,
  c: Classification,
  history: Message[],
) => Promise<DraftResult>;
export type ExtractOrderFn = (thread: Thread, creator: Creator, history: Message[]) => Promise<OrderExtraction>;
export type CreatePaymentLinkFn = (order: Order, creator: Creator) => Promise<{ linkId: string; url: string; provider: Payment["provider"] }>;
export type NotifyOwnerFn = (creatorId: Id, kind: NotifyKind, payload: Record<string, unknown>) => Promise<void>;
export type RequestApprovalFn = (draft: Draft, creator: Creator) => Promise<Id>;
export type DecideFn = (approvalId: Id, decision: Decision, text?: string) => Promise<Approval>;
