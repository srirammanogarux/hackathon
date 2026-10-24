// A0: the store and seed behave the way every workstream assumes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setDb, logEvent, getDb } from "../../lib/v2/db";
import { seed, getSunita, SUNITA_REEL_MEDIA_ID } from "../../lib/v2/seed";

test("seed is idempotent and Sunita has a menu", async () => {
  const db = setDb();
  const a = await seed(db);
  const b = await seed(db);
  assert.equal(a.sunitaId, b.sunitaId);
  const sunita = await getSunita(db);
  assert.equal(sunita.menu[0].price, 120);
  assert.equal((await db.find("creators")).length, 2);
  assert.ok(await db.findOne("posts", { igMediaId: SUNITA_REEL_MEDIA_ID }));
});

test("find filters by equality and sorts newest first; rows are copies", async () => {
  const db = setDb();
  const { sunitaId } = await seed(db, { history: true });
  const threads = await db.find("threads", { creatorId: sunitaId });
  assert.equal(threads.length, 3);
  assert.ok(threads[0].lastMessageAt >= threads[1].lastMessageAt);
  const pending = await db.find("approvals", { status: "pending" });
  assert.equal(pending.length, 1);
  pending[0].status = "sent";
  assert.equal((await db.find("approvals", { status: "pending" })).length, 1);
  await db.patch("approvals", pending[0]._id, { status: "sent" });
  assert.equal((await db.find("approvals", { status: "pending" })).length, 0);
});

test("logEvent writes to the audit log", async () => {
  setDb();
  await logEvent("c1", "message_in", { text: "hi" });
  const ev = await getDb().find("events", { creatorId: "c1" });
  assert.equal(ev[0].type, "message_in");
});
