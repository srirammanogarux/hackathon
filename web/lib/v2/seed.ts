// Seed data: Sunita's Kitchen (home tiffins, Aliganj, Lucknow) plus Dr. Arjun (regulated replies).
// `seed(db)` gives the bare creators + posts (what tests want). `seed(db, { history: true })`
// adds a little past activity so the Inbox/Orders/Approvals screens aren't empty in the demo.
import type { Db } from "./db";
import type { Creator, Id, NewRow } from "./types";

export const SUNITA_IG_USER_ID = "17841400000000001";
export const ARJUN_IG_USER_ID = "17841400000000002";
export const SUNITA_REEL_MEDIA_ID = "18000000000000101"; // "Soft till lunch"

export const SUNITA: NewRow<"creators"> = {
  name: "Sunita",
  email: "sunita@example.com",
  businessName: "Sunita's Kitchen",
  city: "Aliganj, Lucknow",
  igUserId: SUNITA_IG_USER_ID,
  igUsername: "sunitas.kitchen.lko",
  toneProfile: {
    summary: "Warm, motherly Hinglish. Short lines, says 'ji' a lot, ends with 🙏 or 😊. Never pushy.",
    language: "hinglish",
    formality: "warm",
    greetings: ["Namaste ji 🙏", "Haan ji!", "Arre wah, thank you ji!"],
    signoffs: ["Thank you ji 🙏", "Khana enjoy karna 😊"],
    emoji: ["🙏", "😊", "🛵", "✅"],
    sampleLines: [
      "Hi, main Sunita. Ghar ka khana, bilkul maa ke haath jaisa.",
      "Roti lunch tak soft rehti hai, promise.",
      "Kal ka menu: dal tadka, aloo gobhi, 4 roti, jeera rice aur salad.",
    ],
    dos: ["mirror the customer's language", "keep replies under 2 lines", "use 'ji'"],
    donts: ["no health or weight-loss claims", "never share home address", "no discounts without asking Sunita"],
  },
  menu: [
    { name: "Veg thali", price: 120, unit: "thali", veg: true, description: "Dal, sabzi, 4 roti, jeera rice, salad", available: true },
    { name: "Extra roti", price: 10, unit: "piece", veg: true, available: true },
    { name: "Mathri box", price: 250, unit: "box of 20", veg: true, description: "Festival special", available: true },
  ],
  pricesAllowed: true,
  deliveryAreas: ["Aliganj", "Gomti Nagar", "Hazratganj", "Indira Nagar", "Mahanagar"],
  hours: "Mon–Sat lunch, order by 10 am. Delivery 12:30–2 pm.",
  howToOrder: "DM your order, time and address. Pay by UPI link and it's confirmed.",
  minOrder: 1,
  deliveryFee: 0,
  neverShow: ["home address", "family members", "her face"],
  profession: "home tiffin service",
  waNumber: "+919800000001",
  ownerEmail: "sunita@example.com",
  upiId: "sunitaskitchen@upi",
  autoReplyPaused: false,
  repliesSentCount: 24, // past the first-20 warm-up, so the demo auto-replies
};

export const ARJUN: NewRow<"creators"> = {
  name: "Dr. Arjun",
  email: "arjun@example.com",
  businessName: "Smile Studio Dental",
  city: "Jayanagar, Bengaluru",
  igUserId: ARJUN_IG_USER_ID,
  igUsername: "smilestudio.blr",
  toneProfile: {
    summary: "Calm, professional English with a friendly line. No medical advice in DMs; invites to book a consult.",
    language: "english",
    formality: "professional",
    greetings: ["Hi! Thanks for reaching out."],
    signoffs: ["Take care, Dr. Arjun"],
    emoji: ["🙂"],
    sampleLines: ["Every smile is different, so let's look at yours in person."],
    dos: ["suggest a consult for anything clinical", "share clinic hours"],
    donts: ["no diagnosis", "no prices for treatments", "no testimonials", "no 'best' or 'painless' claims"],
  },
  menu: [{ name: "Consultation", price: 500, unit: "visit", available: true }],
  pricesAllowed: false,
  deliveryAreas: [],
  hours: "Mon–Sat 10 am–7 pm",
  howToOrder: "Book a consultation by DM with your preferred time.",
  neverShow: ["patient faces", "procedures"],
  profession: "dentist",
  ownerEmail: "arjun@example.com",
  autoReplyPaused: false,
  repliesSentCount: 25,
};

const HOUR = 3600_000;

export async function seed(db: Db, { history = false }: { history?: boolean } = {}): Promise<{ sunitaId: Id; arjunId: Id }> {
  const existing = await db.findOne("creators", { igUserId: SUNITA_IG_USER_ID });
  if (existing) {
    const arjun = await db.findOne("creators", { igUserId: ARJUN_IG_USER_ID });
    return { sunitaId: existing._id, arjunId: arjun?._id ?? "" };
  }

  const sunitaId = await db.insert("creators", SUNITA);
  const arjunId = await db.insert("creators", ARJUN);
  const now = Date.now();

  await db.insert("igAccounts", {
    creatorId: sunitaId,
    igUserId: SUNITA_IG_USER_ID,
    username: SUNITA.igUsername!,
    accessToken: "mock-token",
    tokenExpiresAt: now + 60 * 24 * HOUR,
    scopes: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_messages"],
  });

  const reelId = await db.insert("posts", {
    creatorId: sunitaId,
    igMediaId: SUNITA_REEL_MEDIA_ID,
    kind: "reel",
    caption: "Soft till lunch 🫓 Ghar ka khana, Aliganj se. DM to order!",
    permalink: "https://www.instagram.com/reel/mock-soft-till-lunch/",
    publishedAt: now - 26 * HOUR,
    insights: { reach: 9400, likes: 1248, saves: 210, comments: 86, shares: 64, plays: 15200 },
  });
  await db.insert("posts", {
    creatorId: sunitaId,
    igMediaId: "18000000000000102",
    kind: "reel",
    caption: "Hi, main Sunita 🙏 Meet the kitchen.",
    publishedAt: now - 5 * 24 * HOUR,
    insights: { reach: 3100, likes: 402, saves: 38, comments: 21, plays: 5100 },
  });

  if (history) await seedHistory(db, sunitaId, reelId, now);
  return { sunitaId, arjunId };
}

async function seedHistory(db: Db, creatorId: Id, reelId: Id, now: number) {
  // A paid DM order from Meera, attributed to the reel.
  const meera = { igsid: "6100000000000001", username: "meera.s", name: "Meera S" };
  const t1 = await db.insert("threads", {
    creatorId,
    channel: "ig_dm",
    externalId: meera.igsid,
    sourcePostId: reelId,
    mediaId: SUNITA_REEL_MEDIA_ID,
    customer: meera,
    lastMessageAt: now - 50 * 60_000,
    lastInboundAt: now - 52 * 60_000,
    status: "closed",
  });
  const lines: [("in" | "out"), string, number][] = [
    ["in", "Hazratganj mein deliver hoga? 3 thali chahiye kal", 60],
    ["out", "Haan ji, Hazratganj aate hain 🛵 Kal kitne baje chahiye?", 59],
    ["in", "12:30. Name Meera, 2nd floor, Halwasiya Court", 55],
    ["out", "Done ji ✅ 3 Veg thali, kal 12:30. Total ₹360. Pay here 👇", 54],
    ["in", "Paid!", 52],
    ["out", "Thank you ji 🙏 Kal milte hain!", 50],
  ];
  for (const [direction, text, minsAgo] of lines) {
    await db.insert("messages", {
      threadId: t1,
      direction,
      text,
      sentBy: direction === "in" ? "customer" : "smiley",
      createdAt: now - minsAgo * 60_000,
    });
  }
  const o1 = await db.insert("orders", {
    creatorId,
    threadId: t1,
    sourcePostId: reelId,
    customer: meera,
    items: [{ name: "Veg thali", qty: 3, price: 120 }],
    total: 360,
    deliverAt: "Tomorrow, 12:30 pm",
    address: "2nd floor, Halwasiya Court, Hazratganj",
    status: "paid",
    createdAt: now - 54 * 60_000,
    updatedAt: now - 52 * 60_000,
  });
  await db.insert("payments", {
    orderId: o1,
    provider: "mock",
    linkId: "mock_pl_meera",
    url: "https://pay.mock/reels-magic/mock_pl_meera",
    amount: 360,
    status: "paid",
    rawEvents: [],
    createdAt: now - 54 * 60_000,
  });

  // A comment answered automatically.
  const ankit = { igsid: "6100000000000002", username: "ankit_lko" };
  const t2 = await db.insert("threads", {
    creatorId,
    channel: "ig_comment",
    externalId: "17900000000000201",
    mediaId: SUNITA_REEL_MEDIA_ID,
    sourcePostId: reelId,
    customer: ankit,
    lastMessageAt: now - 2 * HOUR,
    status: "closed",
  });
  await db.insert("messages", { threadId: t2, direction: "in", text: "Price kitna hai?", sentBy: "customer", createdAt: now - 2 * HOUR - 60_000, externalId: "17900000000000201" });
  await db.insert("messages", { threadId: t2, direction: "out", text: "₹120 per thali ji. Dal, sabzi, 4 roti, chawal sab included 😊 DM karo!", sentBy: "smiley", createdAt: now - 2 * HOUR });

  // A sensitive comment waiting for Sunita's OK.
  const neha = { igsid: "6100000000000003", username: "neha.eats" };
  const t3 = await db.insert("threads", {
    creatorId,
    channel: "ig_comment",
    externalId: "17900000000000202",
    mediaId: SUNITA_REEL_MEDIA_ID,
    sourcePostId: reelId,
    customer: neha,
    lastMessageAt: now - 20 * 60_000,
    status: "waiting_owner",
  });
  const m3 = await db.insert("messages", { threadId: t3, direction: "in", text: "Is this made with palm oil?", sentBy: "customer", createdAt: now - 20 * 60_000, externalId: "17900000000000202" });
  const d3 = await db.insert("drafts", {
    threadId: t3,
    messageId: m3,
    text: "Nahi ji, hum sirf sarson ka tel aur desi ghee use karte hain 🙏",
    intent: "health_claim",
    confidence: 0.91,
    policy: "approval",
    reasons: ["ingredient claim"],
    status: "pending",
    createdAt: now - 19 * 60_000,
  });
  await db.insert("approvals", {
    creatorId,
    draftId: d3,
    reason: "Ingredient claim: only you can confirm what oil you use.",
    channels: ["inapp"],
    token: "seed-approval-token",
    status: "pending",
    createdAt: now - 19 * 60_000,
  });
}

export async function getSunita(db: Db): Promise<Creator> {
  const c = await db.findOne("creators", { igUserId: SUNITA_IG_USER_ID });
  if (!c) throw new Error("Sunita not seeded");
  return c;
}
