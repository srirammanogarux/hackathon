// Generic CRUD behind lib/v2/db.ts (V2_STORE=convex). Server code only: these take any
// table, so don't call them from the browser.
// Rows carry `_id` as a plain string on the TS side; Convex ids are strings too.
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

const table = v.union(
  v.literal("creators"),
  v.literal("igAccounts"),
  v.literal("posts"),
  v.literal("threads"),
  v.literal("messages"),
  v.literal("drafts"),
  v.literal("orders"),
  v.literal("payments"),
  v.literal("approvals"),
  v.literal("notifications"),
  v.literal("events"),
);

const strip = (doc: Record<string, unknown>) => {
  const { _id, _creationTime, ...rest } = doc;
  return rest;
};

const createdAtOf = (r: Record<string, unknown>) => Number(r.createdAt ?? r.lastMessageAt ?? r.publishedAt ?? r._creationTime ?? 0);

export const insert = mutation({
  args: { table, doc: v.any() },
  handler: async (ctx, { table, doc }) => ctx.db.insert(table, strip(doc) as never),
});

export const get = query({
  args: { table, id: v.string() },
  handler: async (ctx, { table, id }) => {
    const nid = ctx.db.normalizeId(table, id);
    return nid ? ctx.db.get(nid) : null;
  },
});

export const patch = mutation({
  args: { table, id: v.string(), fields: v.any() },
  handler: async (ctx, { table, id, fields }) => {
    const nid = ctx.db.normalizeId(table, id);
    if (!nid) throw new Error(`patch: bad id ${table}/${id}`);
    await ctx.db.patch(nid, strip(fields) as never);
  },
});

export const remove = mutation({
  args: { table, id: v.string() },
  handler: async (ctx, { table, id }) => {
    const nid = ctx.db.normalizeId(table, id);
    if (nid) await ctx.db.delete(nid);
  },
});

export const find = query({
  args: { table, where: v.any(), limit: v.optional(v.number()) },
  handler: async (ctx, { table, where, limit }) => {
    const entries = Object.entries((where ?? {}) as Record<string, unknown>).filter(([, val]) => val !== undefined);
    const base = ctx.db.query(table);
    const rows = await (entries.length
      ? base.filter((q) => q.and(...entries.map(([k, val]) => q.eq(q.field(k as never), val as never))))
      : base
    ).collect();
    rows.sort((a, b) => createdAtOf(b as never) - createdAtOf(a as never));
    return limit ? rows.slice(0, limit) : rows;
  },
});
