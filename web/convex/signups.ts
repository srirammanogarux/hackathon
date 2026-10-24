import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: { name: v.string(), email: v.string(), source: v.optional(v.string()), userAgent: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db.query("signups").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (existing) return { id: existing._id, duplicate: true };
    const id = await ctx.db.insert("signups", { ...args, name: args.name.trim(), email });
    return { id, duplicate: false };
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("signups").collect()).length,
});
