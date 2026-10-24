// V2 data access. One interface, two stores:
//   memory (default): in-process, seeded with Sunita. Used by mock mode, tests and `next dev`.
//   convex (V2_STORE=convex): the same calls go to convex/v2/crud.ts on NEXT_PUBLIC_CONVEX_URL.
// Every workstream reads and writes through getDb(); nobody imports a store directly.
import type { AuditEvent, EventType, Id, NewRow, Row, Table } from "./types";

export type Where<T extends Table> = Partial<Row<T>>;

export interface Db {
  insert<T extends Table>(table: T, doc: NewRow<T>): Promise<Id>;
  get<T extends Table>(table: T, id: Id): Promise<Row<T> | null>;
  patch<T extends Table>(table: T, id: Id, fields: Partial<NewRow<T>>): Promise<void>;
  /** Equality match on top-level fields, newest first. */
  find<T extends Table>(table: T, where?: Where<T>, opts?: { limit?: number }): Promise<Row<T>[]>;
  findOne<T extends Table>(table: T, where: Where<T>): Promise<Row<T> | null>;
  remove<T extends Table>(table: T, id: Id): Promise<void>;
}

const matches = (row: Record<string, unknown>, where: Record<string, unknown> = {}) =>
  Object.entries(where).every(([k, v]) => v === undefined || row[k] === v);

const createdAtOf = (row: Record<string, unknown>) =>
  Number(row.createdAt ?? row.lastMessageAt ?? row.publishedAt ?? 0);

export function createMemoryDb(): Db & { dump(): Record<string, unknown[]>; reset(): void } {
  let tables = new Map<string, Map<Id, Record<string, unknown>>>();
  let seq = 0;
  const t = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  return {
    async insert(table, doc) {
      const _id = `${table}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      t(table).set(_id, structuredClone({ ...doc, _id }));
      return _id;
    },
    async get(table, id) {
      const row = t(table).get(id);
      return row ? (structuredClone(row) as never) : null;
    },
    async patch(table, id, fields) {
      const row = t(table).get(id);
      if (!row) throw new Error(`patch: ${table}/${id} not found`);
      t(table).set(id, structuredClone({ ...row, ...fields, _id: id }));
    },
    async find(table, where, opts) {
      const rows = [...t(table).values()]
        .filter((r) => matches(r, where as Record<string, unknown>))
        .sort((a, b) => createdAtOf(b) - createdAtOf(a));
      return structuredClone(opts?.limit ? rows.slice(0, opts.limit) : rows) as never;
    },
    async findOne(table, where) {
      const row = [...t(table).values()].find((r) => matches(r, where as Record<string, unknown>));
      return row ? (structuredClone(row) as never) : null;
    },
    async remove(table, id) {
      t(table).delete(id);
    },
    dump() {
      return Object.fromEntries([...tables].map(([k, m]) => [k, [...m.values()]]));
    },
    reset() {
      tables = new Map();
    },
  };
}

function createConvexDb(url: string): Db {
  // Imported lazily so the memory path (tests, mock mode) never needs the convex package.
  // anyApi avoids depending on codegen for convex/v2/crud.ts.
  const load = async () => {
    const [{ ConvexHttpClient }, { anyApi }] = await Promise.all([import("convex/browser"), import("convex/server")]);
    return { client: new ConvexHttpClient(url), crud: anyApi.v2.crud };
  };
  let ready: ReturnType<typeof load> | undefined;
  const c = () => (ready ??= load());

  return {
    async insert(table, doc) {
      const { client, crud } = await c();
      return client.mutation(crud.insert, { table, doc });
    },
    async get(table, id) {
      const { client, crud } = await c();
      return client.query(crud.get, { table, id });
    },
    async patch(table, id, fields) {
      const { client, crud } = await c();
      await client.mutation(crud.patch, { table, id, fields });
    },
    async find(table, where, opts) {
      const { client, crud } = await c();
      return client.query(crud.find, { table, where: where ?? {}, limit: opts?.limit });
    },
    async findOne(table, where) {
      const { client, crud } = await c();
      const rows = await client.query(crud.find, { table, where, limit: 1 });
      return rows[0] ?? null;
    },
    async remove(table, id) {
      const { client, crud } = await c();
      await client.mutation(crud.remove, { table, id });
    },
  };
}

// One store per process; globalThis keeps it across Next dev hot reloads.
const g = globalThis as unknown as { __v2db?: Db; __v2seeded?: Promise<void> };

export function getDb(): Db {
  if (g.__v2db) return g.__v2db;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  g.__v2db = process.env.V2_STORE === "convex" && url ? createConvexDb(url) : createMemoryDb();
  return g.__v2db;
}

/** Swap the store (tests). Pass nothing to get a fresh memory store. */
export function setDb(db?: Db): Db {
  g.__v2db = db ?? createMemoryDb();
  g.__v2seeded = undefined;
  return g.__v2db;
}

/** Seeds Sunita (and friends) once per store, with demo history unless V2_SEED_HISTORY=0. No-op when already seeded. */
export async function ensureSeeded(): Promise<void> {
  g.__v2seeded ??= import("./seed").then(({ seed }) =>
    seed(getDb(), { history: process.env.V2_SEED_HISTORY !== "0" }).then(() => undefined),
  );
  return g.__v2seeded;
}

/** Audit log (§11: every message, draft, decision and payment event lands here). */
export async function logEvent(creatorId: Id, type: EventType, payload: Record<string, unknown> = {}): Promise<Id> {
  const doc: Omit<AuditEvent, "_id"> = { creatorId, type, payload, createdAt: Date.now() };
  return getDb().insert("events", doc);
}
