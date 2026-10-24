// Generate the 6 intro-Reel demo clips through the Gemini API.
// Veo (predictLongRunning) has been retired on this key; video now comes from gemini-omni-1.1-flash via the
// Interactions API (POST /v1beta/interactions, response_modalities ["video"]). Veo is tried only if VEO_MODEL is set.
//   node scripts/gen-footage.mjs            (reads GEMINI_API_KEY from ../.env or .env)
//   VEO_MODEL=veo-3.0-fast-generate-001 node scripts/gen-footage.mjs 4 5   (only shots 4 and 5)
// Output: public/demo/footage/shot-N.mp4, 1080x1920, MUTED (the Reel uses her voiceover + music only).
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { SHOTS } from "../lib/introShots.ts";

for (const f of [path.resolve("..", ".env"), path.resolve(".env")]) if (existsSync(f)) process.loadEnvFile(f);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY not set. Nothing to do.");
  process.exit(2);
}
const API = "https://generativelanguage.googleapis.com/v1beta";
const H = { "x-goog-api-key": KEY, "content-type": "application/json" };
const OUT = path.resolve("public", "demo", "footage");
mkdirSync(OUT, { recursive: true });

const STYLE =
  "Vertical 9:16 handheld smartphone video, realistic, natural colours, Indian home kitchen. Hands only: no faces, no people's heads, no text, no logos, no watermark. Calm, steady, 8 seconds.";
const NEGATIVE = "faces, people's heads, text, captions, subtitles, logos, watermark, cartoon, CGI look";

async function pickModel() {
  if (process.env.VEO_MODEL) return process.env.VEO_MODEL;
  const r = await fetch(`${API}/models?pageSize=200`, { headers: H });
  const j = await r.json();
  if (!r.ok) throw new Error(`models list ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const veo = (j.models ?? []).filter((m) => /veo/.test(m.name) && (m.supportedGenerationMethods ?? []).includes("predictLongRunning")).map((m) => m.name.replace("models/", ""));
  console.log("Veo models available:", veo.join(", ") || "(none)");
  const pref = ["veo-3.1-fast-generate-preview", "veo-3.0-fast-generate-001", "veo-3.1-generate-preview", "veo-3.0-generate-001", "veo-2.0-generate-001"];
  return pref.find((p) => veo.includes(p)) ?? veo[0];
}

async function start(model, prompt, aspectRatio) {
  const body = { instances: [{ prompt }], parameters: { aspectRatio, negativePrompt: NEGATIVE, sampleCount: 1 } };
  const r = await fetch(`${API}/models/${model}:predictLongRunning`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`predictLongRunning ${r.status}: ${JSON.stringify(j).slice(0, 400)}`), { status: r.status });
  return j.name;
}

async function wait(opName) {
  for (let i = 0; i < 90; i++) {
    const r = await fetch(`${API}/${opName}`, { headers: H });
    const j = await r.json();
    if (j.done) {
      if (j.error) throw new Error(`operation error: ${JSON.stringify(j.error).slice(0, 300)}`);
      const s = j.response?.generateVideoResponse?.generatedSamples?.[0] ?? j.response?.generatedVideos?.[0];
      const uri = s?.video?.uri;
      if (!uri) throw new Error(`no video in response: ${JSON.stringify(j.response ?? j).slice(0, 400)}`);
      return uri;
    }
    await new Promise((res) => setTimeout(res, 10_000));
  }
  throw new Error("timed out after 15 min");
}

async function one(model, i) {
  const n = i + 1;
  const prompt = `${SHOTS[i].veo} ${STYLE}`;
  let ar = "9:16";
  let op;
  try {
    op = await start(model, prompt, ar);
  } catch (e) {
    if (e.status !== 400) throw e;
    console.log(`shot ${n}: 9:16 rejected, retrying 16:9 + crop`);
    ar = "16:9";
    op = await start(model, prompt, ar);
  }
  console.log(`shot ${n}: ${op}`);
  const uri = await wait(op);
  const raw = path.join(OUT, `shot-${n}.raw.mp4`);
  const res = await fetch(uri, { headers: { "x-goog-api-key": KEY }, redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  const out = path.join(OUT, `shot-${n}.mp4`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-an", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", out]);
  rmSync(raw);
  console.log(`shot ${n}: saved ${out}`);
}

// Interactions API: one call returns the finished MP4 inline (base64).
async function omni(i) {
  const n = i + 1;
  const model = process.env.VIDEO_MODEL || "gemini-omni-1.1-flash";
  const input = `Generate an 8 second vertical 9:16 video. ${SHOTS[i].veo} ${STYLE}`;
  const r = await fetch(`${API}/interactions`, { method: "POST", headers: H, body: JSON.stringify({ model, input, response_modalities: ["video"] }), signal: AbortSignal.timeout(600_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`interactions ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  const part = (j.steps ?? []).flatMap((st) => st.content ?? []).find((c) => c.type === "video" && c.data);
  if (!part) throw new Error(`no video in response: ${JSON.stringify(j).slice(0, 300)}`);
  const raw = path.join(OUT, `shot-${n}.raw.mp4`);
  writeFileSync(raw, Buffer.from(part.data, "base64"));
  const out = path.join(OUT, `shot-${n}.mp4`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-an", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart", out]);
  rmSync(raw);
  console.log(`shot ${n}: saved ${out} (${model})`);
}

const only = process.argv.slice(2).map(Number).filter(Boolean);
const todo = SHOTS.map((_, i) => i).filter((i) => !only.length || only.includes(i + 1));
const useVeo = !!process.env.VEO_MODEL;
const model = useVeo ? await pickModel() : null;
if (useVeo && !model) {
  console.error("No Veo model available to this key.");
  process.exit(3);
}
console.log("Using", useVeo ? model : process.env.VIDEO_MODEL || "gemini-omni-1.1-flash (Interactions API)");
const results = [];
for (let k = 0; k < todo.length; k += 3) {
  results.push(...(await Promise.allSettled(todo.slice(k, k + 3).map((i) => (useVeo ? one(model, i) : omni(i))))));
}
results.forEach((r, k) => r.status === "rejected" && console.error(`shot ${todo[k] + 1} FAILED: ${r.reason?.message ?? r.reason}`));
process.exit(results.some((r) => r.status === "rejected") ? 1 : 0);
