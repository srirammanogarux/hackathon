// End-to-end run for both hero personas. Writes every step to out/<persona>/.
// Live: needs ANTHROPIC_API_KEY (npm run demo). Mock: npm run demo:mock.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interview, nextQuestion, planWeek, makePost, checkBoundaries, reviseByVoice } from "./brain.mjs";
import { isMock, MODEL } from "./llm.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = (f) => readFileSync(path.join(root, "fixtures", f), "utf8");
const only = process.argv[2]; // optional: "arjun" | "lakshmi"

async function run(persona, lang) {
  const dir = path.join(root, "out", persona);
  mkdirSync(dir, { recursive: true });
  const save = (name, data) => writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
  const t0 = Date.now();

  // 1. Interview: the deterministic question flow, then extraction from the full transcript.
  const flow = [];
  let q = nextQuestion(null, { lang });
  while (!q.done) {
    flow.push(q.question);
    q = nextQuestion(null, { lang, asked: flow.map((x) => x.id) });
  }
  save("00-question-flow.json", flow);
  const profile = await interview(fx(`${persona}.transcript.txt`));
  save("01-profile.json", { profile, after_interview: nextQuestion(profile, { asked: flow.map((x) => x.id) }) });

  // 2-3. Plan the week, then make the first post.
  const plan = await planWeek(profile);
  save("02-plan.json", plan);
  const post = await makePost(plan.posts[0], profile);
  save("03-post.json", post);

  // 4. Check the generated post and a deliberately unsafe one, in parallel.
  const unsafe = JSON.parse(fx(`${persona}.unsafe-post.json`));
  const [okCheck, badCheck] = await Promise.all([checkBoundaries(post, profile), checkBoundaries(unsafe, profile)]);
  save("04-check-generated.json", okCheck);
  save("04-check-unsafe.json", badCheck);

  // 5. Voice revision.
  const revised = await reviseByVoice(post, fx(`${persona}.revise.txt`).trim(), profile);
  save("05-revised.json", revised);

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${persona}: profile camera=${profile.camera_level} langs=${profile.languages_out} | plan ${plan.posts.map((p) => p.format).join(",")} | ${plan.ideas_considered} ideas -> ${plan.posts.length} | generated:${okCheck.verdict} unsafe:${badCheck.verdict} (${badCheck.reasons.length} reasons) | ${secs}s`);
}

console.log(isMock() ? "MOCK mode (fixtures)" : `LIVE mode, model ${MODEL}`);
const personas = [["arjun", "kn"], ["lakshmi", "ta"]].filter(([p]) => !only || p === only);
await Promise.all(personas.map(([p, l]) => run(p, l)));
