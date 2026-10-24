import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CreatorProfile, WeekPlan, Post, BoundaryVerdict, Revision } from "../src/schemas.mjs";
import { ruleCheck } from "../src/rules.mjs";
import { nextQuestion, missingFields } from "../src/questions.mjs";
import { checkBoundaries, planWeek } from "../src/brain.mjs";

const load = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));
const arjun = load("mock/arjun.profile.json");
const lakshmi = load("mock/lakshmi.profile.json");

test("fixtures match schemas", () => {
  for (const p of ["arjun", "lakshmi"]) {
    CreatorProfile.parse(load(`mock/${p}.profile.json`));
    const plan = WeekPlan.parse(load(`mock/${p}.plan.json`));
    assert.equal(plan.posts.length, 5);
    assert.equal(plan.stories.length, 7);
    assert.equal(plan.filtered_out.length, 12);
    assert.deepEqual(new Set(plan.posts.map((x) => x.format)), new Set(["reel", "carousel", "single_image"]));
    Post.parse(load(`mock/${p}.post.json`));
    Post.parse(load(`${p}.unsafe-post.json`));
    BoundaryVerdict.parse(load(`mock/${p}.boundary-flag.json`));
    Revision.parse(load(`mock/${p}.revise.json`));
  }
});

test("plans fit the profile", () => {
  for (const [p, prof] of [["arjun", arjun], ["lakshmi", lakshmi]]) {
    const plan = load(`mock/${p}.plan.json`);
    const total = plan.posts.reduce((s, x) => s + x.effort_minutes, 0) + plan.stories.length * 2;
    assert.ok(total <= prof.time_per_week, `${p} effort ${total} > ${prof.time_per_week}`);
    for (const post of plan.posts) for (const s of post.shot_list) assert.ok(prof.places.includes(s.where), `${p} shot place ${s.where}`);
  }
  // Lakshmi: no non-veg on Friday
  const fri = load("mock/lakshmi.plan.json").posts.filter((x) => x.scheduled_day === "fri");
  assert.ok(fri.every((x) => !/மீன்|சிக்கன்|கறி/.test(x.title)));
});

test("NDC rules flag the unsafe dentist post and pass the good one", () => {
  const hits = ruleCheck(load("arjun.unsafe-post.json"), arjun);
  const ids = new Set(hits.map((h) => h.rule_id));
  for (const id of ["NDC-SUPERIORITY", "NDC-BEFORE-AFTER", "NDC-SOLICIT", "NDC-TESTIMONIAL"]) assert.ok(ids.has(id), id);
  assert.deepEqual(ruleCheck(load("mock/arjun.post.json"), arjun), []);
  assert.deepEqual(ruleCheck(load("mock/arjun.boundary-flag.json").safe_rewrite, arjun), []);
  assert.deepEqual(ruleCheck(load("mock/arjun.revise.json").post, arjun), []);
});

test("NDC rules only apply to dentists", () => {
  assert.equal(ruleCheck(load("arjun.unsafe-post.json"), lakshmi).length, 0);
});

test("camera rule catches a face for a no-face creator", () => {
  const hits = ruleCheck(load("lakshmi.unsafe-post.json"), lakshmi);
  assert.ok(hits.some((h) => h.rule_id === "CAMERA"));
  assert.deepEqual(ruleCheck(load("mock/lakshmi.post.json"), lakshmi), []);
  assert.deepEqual(ruleCheck(load("mock/lakshmi.revise.json").post, lakshmi), []);
});

test("nextQuestion walks <= 8 questions in the user's language, then stops", () => {
  const asked = [];
  let q = nextQuestion(null, { lang: "ta" });
  while (!q.done) {
    assert.match(q.question.text, /[஀-௿]/);
    asked.push(q.question.id);
    q = nextQuestion(null, { lang: "ta", asked });
  }
  assert.equal(asked.length, 8);
  assert.equal(new Set(asked).size, 8);
  for (const l of ["hi", "kn", "te", "en"]) assert.ok(nextQuestion(null, { lang: l }).question.text.length > 10);
});

test("nextQuestion skips what the profile already has", () => {
  const partial = { ...arjun, camera_level: null, time_per_week: null, shoot_slots: [] };
  const q = nextQuestion(partial, { asked: ["intro", "goal", "level"] });
  assert.equal(q.question.id, "camera");
  assert.equal(q.question.lang, "kn");
  assert.deepEqual(missingFields(arjun, ["boundaries"]), []);
  assert.ok(nextQuestion(arjun, { asked: ["boundaries"] }).done);
});

test("checkBoundaries (mock) forces flag on rule hits and passes clean posts", async () => {
  const bad = await checkBoundaries(load("arjun.unsafe-post.json"), arjun);
  assert.equal(bad.verdict, "flag");
  assert.ok(bad.safe_rewrite);
  assert.deepEqual(bad.rewrite_still_flags, []);
  const good = await checkBoundaries(load("mock/arjun.post.json"), arjun);
  assert.equal(good.verdict, "pass");
});

test("planWeek computes ideas_considered", async () => {
  const plan = await planWeek(lakshmi);
  assert.equal(plan.ideas_considered, 17);
});
