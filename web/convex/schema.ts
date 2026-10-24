import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// V2 tables mirror lib/v2/types.ts (the contract). Nested shapes are validated in TS, so
// they're v.any() here to keep the two from drifting.
const customer = v.object({
  igsid: v.string(),
  username: v.optional(v.string()),
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
});

export default defineSchema({
  signups: defineTable({
    name: v.string(),
    email: v.string(),
    source: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_email", ["email"]),

  creators: defineTable({
    name: v.string(),
    email: v.string(),
    businessName: v.string(),
    city: v.optional(v.string()),
    igUserId: v.optional(v.string()),
    igUsername: v.optional(v.string()),
    toneProfile: v.any(),
    menu: v.array(v.any()),
    pricesAllowed: v.boolean(),
    deliveryAreas: v.array(v.string()),
    hours: v.string(),
    howToOrder: v.string(),
    minOrder: v.optional(v.number()),
    deliveryFee: v.optional(v.number()),
    neverShow: v.array(v.string()),
    profession: v.optional(v.string()),
    waNumber: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    upiId: v.optional(v.string()),
    autoReplyPaused: v.boolean(),
    repliesSentCount: v.number(),
  }).index("by_igUserId", ["igUserId"]),

  igAccounts: defineTable({
    creatorId: v.string(),
    igUserId: v.string(),
    username: v.string(),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
    scopes: v.array(v.string()),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_igUserId", ["igUserId"]),

  posts: defineTable({
    creatorId: v.string(),
    igMediaId: v.string(),
    kind: v.string(),
    caption: v.string(),
    permalink: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    publishedAt: v.number(),
    insights: v.any(),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_igMediaId", ["igMediaId"]),

  threads: defineTable({
    creatorId: v.string(),
    channel: v.union(v.literal("ig_dm"), v.literal("ig_comment")),
    externalId: v.string(),
    mediaId: v.optional(v.string()),
    sourcePostId: v.optional(v.string()),
    customer,
    lastMessageAt: v.number(),
    lastInboundAt: v.optional(v.number()),
    status: v.string(),
    orderId: v.optional(v.string()),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_externalId", ["externalId"]),

  messages: defineTable({
    threadId: v.string(),
    direction: v.union(v.literal("in"), v.literal("out")),
    text: v.string(),
    sentBy: v.union(v.literal("customer"), v.literal("smiley"), v.literal("owner")),
    createdAt: v.number(),
    externalId: v.optional(v.string()),
  })
    .index("by_threadId", ["threadId"])
    .index("by_externalId", ["externalId"]),

  drafts: defineTable({
    threadId: v.string(),
    messageId: v.string(),
    text: v.string(),
    intent: v.string(),
    confidence: v.number(),
    policy: v.string(),
    reasons: v.array(v.string()),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_threadId", ["threadId"]),

  orders: defineTable({
    creatorId: v.string(),
    threadId: v.string(),
    sourcePostId: v.optional(v.string()),
    customer,
    items: v.array(v.object({ name: v.string(), qty: v.number(), price: v.number() })),
    total: v.number(),
    deliverAt: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_threadId", ["threadId"]),

  payments: defineTable({
    orderId: v.string(),
    provider: v.string(),
    linkId: v.string(),
    url: v.string(),
    amount: v.number(),
    status: v.string(),
    rawEvents: v.array(v.any()),
    createdAt: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_linkId", ["linkId"]),

  approvals: defineTable({
    creatorId: v.string(),
    draftId: v.string(),
    reason: v.string(),
    channels: v.array(v.string()),
    agenticOrgItemId: v.optional(v.string()),
    token: v.string(),
    status: v.string(),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
    finalText: v.optional(v.string()),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_token", ["token"]),

  notifications: defineTable({
    creatorId: v.string(),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    channels: v.array(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_creatorId", ["creatorId"]),

  events: defineTable({
    creatorId: v.string(),
    type: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_creatorId", ["creatorId"]),
});
