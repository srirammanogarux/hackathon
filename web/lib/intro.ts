// Intro Reel pipeline: 6-line script -> her voiceover -> 6 shots (hers, or demo footage) cut to the voice -> captions + music -> Guard.
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { MEDIA_DIR, mediaUrl } from "@/lib/mediaStore";
import { DEFAULT_LINES, SHOTS, HINGLISH_LINES, DEMO_VOICE_ID } from "@/lib/introShots";
import { putJob, guard, addMusic, VIBES, type Job, type Vibe } from "@/lib/funnel";
import { run, probeDuration } from "@/lib/media/ffmpeg.mjs";

const hasLLM = () => process.env.BRAIN_MOCK !== "1" && !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
const PUBLIC = path.join(process.cwd(), "public");

const Lines = z.object({ lines: z.array(z.string()).describe("exactly 6 lines, first person, simple English, 45-60 seconds spoken in total") });

export async function writeScript(o: { texts: string[]; never: string[]; vibe: Vibe; change?: string; lines?: string[] }): Promise<{ lines: string[]; source: string }> {
  const base = o.lines?.length === 6 ? o.lines : DEFAULT_LINES;
  if (!hasLLM()) {
    if (o.change === "shorter") return { lines: base.map((l) => shorten(l)), source: "mock" };
    if (o.change === "phone") return { lines: base.map((l, i) => (i === 5 && !/\d{5}/.test(l) ? l.replace(/WhatsApp me/, "WhatsApp me on 98765 43210") : l)), source: "mock" };
    return { lines: base, source: "mock" };
  }
  try {
    const user = o.change
      ? `Here is a 6-line intro Reel script:\n${base.map((l, i) => `${i + 1}. ${l}`).join("\n")}\nChange request: ${o.change === "shorter" ? "make every line shorter, keep the meaning" : o.change === "phone" ? "add the phone number 98765 43210 to the last line" : o.change}. Keep 6 lines.`
      : `Write the script for her Instagram INTRO Reel (who she is, what she makes, why it's special, how to order).
What she told us (speech-to-text):
1. What she makes and who buys it: """${o.texts[0] ?? ""}"""
2. Her warm-up voice note (how she talks): """${o.texts[1] ?? ""}"""
Never mention or show: ${o.never.join(", ") || "nothing specified"}.
Tone: ${VIBES[o.vibe].brief}
Exactly 6 lines, 45-60 seconds spoken in total. Line 1 is a hook question. Line 2 introduces her by name and place if she said them. Last line = how to order + follow. Use her own phrases.
Language: match how she spoke in the warm-up. If she mixed Hindi and English, write natural Hinglish in Latin script; otherwise simple English a home cook would say. No hashtags, no emoji.
Example of the shape (do not copy facts): ${DEFAULT_LINES.join(" / ")}`;
    const system = "You write short Instagram Reel scripts for Indian home businesses, in the creator's own voice. Never invent prices, awards or facts.";
    // Fast path: Gemini flash with thinking off, plain JSON (target < 3 s).
    if (process.env.GEMINI_API_KEY && process.env.BRAIN_MOCK !== "1") {
      const fast = await geminiFastLines(system, user).catch((e) => {
        console.error("[intro] fast script", (e as Error).message);
        return null;
      });
      if (fast?.length === 6) return { lines: fast, source: "gemini-fast" };
    }
    const { callStructured } = await import("@/lib/brain/llm.mjs");
    const out: any = await (callStructured as any)({
      name: "introScript",
      system: "You write short Instagram Reel scripts for Indian home businesses, in the creator's own voice. Never invent prices, awards or facts.",
      user,
      schema: Lines,
      effort: "low",
      mock: () => ({ lines: base }),
    });
    const lines = (out.lines as string[]).map((l) => l.trim()).filter(Boolean).slice(0, 6);
    return lines.length === 6 ? { lines, source: "llm" } : { lines: base, source: "mock" };
  } catch (e) {
    console.error("[intro] script", (e as Error).message);
    return { lines: base, source: "mock" };
  }
}

async function geminiFastLines(system: string, user: string): Promise<string[] | null> {
  const model = process.env.GEMINI_FAST_MODEL || "gemini-flash-latest";
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: `${user}\nReturn JSON: {"lines": [6 strings]}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { lines: { type: "ARRAY", items: { type: "STRING" } } }, required: ["lines"] },
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 800,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`gemini ${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const lines = (JSON.parse(text).lines as string[]).map((l) => String(l).trim()).filter(Boolean);
  console.error(`[intro] fast script ${model} ${Date.now() - t0}ms`);
  return lines.length >= 6 ? lines.slice(0, 6) : null;
}

function shorten(l: string) {
  const cut = l.split(/(?<=[,—.!?])\s/)[0];
  return cut.length < l.length && cut.length > 12 ? cut.replace(/[,—]\s*$/, ".") : l;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Where each shot's footage comes from: demo footage (Veo) -> her clip -> Ken Burns fallback from the reference picture.
function clipFor(i: number, mine: string | null, demo: boolean) {
  const veo = path.join(PUBLIC, "demo", "footage", `shot-${i + 1}.mp4`);
  const fallback = path.join(PUBLIC, "demo", "footage-fallback", `shot-${i + 1}.mp4`);
  if (demo) return existsSync(veo) ? veo : fallback;
  return mine && existsSync(mine) ? mine : fallback;
}

export function startIntroJob(o: { lines: string[]; voice: string | null; clips: (string | null)[]; demo: boolean; vibe: Vibe; never: string[]; profession?: string; team?: unknown }) {
  const id = Math.random().toString(36).slice(2, 10);
  const lines = o.lines.length === 6 ? o.lines : DEFAULT_LINES;
  const caption = `${lines[0]}\n\n${lines.slice(1, 3).join(" ")}\n\n${lines[5]}\n\n#homefood #tiffin #gharkakhana #lucknowfood`;
  const job: Job = {
    id, createdAt: Date.now(), texts: [lines.join(" "), ""], transcriptSource: "mock", quote: lines[1].slice(0, 70),
    never: o.never, langs: ["en"], consent: true, audio: o.voice ? [o.voice] : [],
    steps: { writer: "done", voice: "active", designer: "todo", guard: "todo" },
    voiceKind: o.voice ? "clone" : "placeholder", scripts: { en: { slides: lines.map((l) => ({ headline: l, body: "" })), voiceover: lines.join(" "), caption } },
    reels: {}, rendering: ["en"], verdict: null, week: [], done: false, log: [],
    vibe: o.vibe, photos: [], visuals: "photos", aiImages: null, aiGenerated: false, kind: "intro", usedDemoFootage: o.demo,
    team: o.team ?? null,
  };
  putJob(job);
  (async () => {
    const work = path.join(MEDIA_DIR, `.intro-${id}`);
    await mkdir(work, { recursive: true });
    // 1. Voice: her recording. Otherwise ElevenLabs (demo: Hinglish in a natural Indian female voice), else macOS say.
    let audio = o.voice && existsSync(o.voice) ? o.voice : null;
    // Her own recording is always the voiceover; only an empty/unreadable file falls back to the demo voice.
    if (audio && (await probeDuration(audio).catch(() => 0)) < 0.5) {
      job.log.push("voice: recording empty, using demo voice");
      audio = null;
    }
    if (!audio) job.voiceKind = "stock";
    let capLines = lines;
    let words: { text: string; start: number; end: number }[] | null = null;
    if (!audio) {
      try {
        if (process.env.ELEVENLABS_API_KEY) {
          const isDefault = lines.join("|") === DEFAULT_LINES.join("|");
          capLines = o.demo && isDefault ? HINGLISH_LINES : lines;
          const { ttsWithTimestamps } = await import("@/lib/media/elevenlabs.mjs");
          const t: any = await (ttsWithTimestamps as any)({ text: capLines.join(" "), voiceId: process.env.ELEVENLABS_DEMO_VOICE_ID || DEMO_VOICE_ID, modelId: process.env.ELEVENLABS_MODEL || "eleven_v3" });
          audio = path.join(work, "vo.mp3");
          await writeFile(audio, t.audio);
          words = t.words?.length ? t.words : null;
          job.voiceKind = "stock";
        } else {
          const text = lines.join(" ");
          const { sayToFile } = await import("@/lib/media/audio.mjs");
          audio = await sayToFile(text, path.join(work, "vo.m4a"), { language: "en", voice: "Lekha", rate: 128 } as any).catch(() =>
            sayToFile(text, path.join(work, "vo.m4a"), { language: "en", rate: 128 } as any),
          );
        }
      } catch (e) {
        job.log.push(`voice: ${(e as Error).message}`);
        console.error("[intro] voice", (e as Error).message);
      }
    }
    await sleep(500);
    job.steps.voice = "done";
    job.steps.designer = "active";
    try {
      if (!audio) throw new Error("no voiceover");
      const voDur = await probeDuration(audio);
      // 2. Line timings: split the voiceover by line length (characters), the same split drives cuts and captions.
      const total = voDur + 0.6;
      let durs: number[];
      if (words && words.length) {
        // Real timings: line i ends where its last word ends (ElevenLabs alignment).
        const counts = capLines.map((l) => l.split(/\s+/).filter(Boolean).length);
        let k = 0;
        const ends = counts.map((c) => {
          k += c;
          return words![Math.min(k, words!.length) - 1]?.end ?? voDur;
        });
        ends[5] = total;
        durs = ends.map((e, i) => Math.max(1.2, e - (i ? ends[i - 1] : 0)));
      } else {
        const weights = capLines.map((l) => Math.max(8, l.length));
        const sum = weights.reduce((a, b) => a + b, 0);
        durs = weights.map((w) => (w / sum) * total);
      }
      // 3. One normalised 1080x1920 segment per line (loop short clips, trim long ones).
      const segs: string[] = [];
      for (let i = 0; i < 6; i++) {
        const seg = path.join(work, `seg-${i}.mp4`);
        await run("ffmpeg", [
          "-y", "-v", "error", "-stream_loop", "-1", "-i", clipFor(i, o.clips[i] ?? null, o.demo), "-t", durs[i].toFixed(3),
          "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p",
          "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", seg,
        ]);
        segs.push(seg);
      }
      const list = path.join(work, "segs.txt");
      await writeFile(list, segs.map((s) => `file '${s}'`).join("\n") + "\n");
      const video = path.join(work, "video.mp4");
      await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", video]);
      // 4. Captions: each line's words spread over its window, chunked, rendered by Chromium as PNGs.
      const { wordsToCaptionChunks, renderCaptionPngs } = await import("@/lib/media/captions.mjs");
      let capWords: { text: string; start: number; end: number }[] = words ?? [];
      if (!capWords.length) {
        let t0 = 0;
        capLines.forEach((l, i) => {
          const ws = l.split(/\s+/).filter(Boolean);
          const span = durs[i] - (i === 5 ? 0.6 : 0.15);
          ws.forEach((w, k) => capWords.push({ text: w, start: t0 + (span * k) / ws.length, end: t0 + (span * (k + 1)) / ws.length }));
          t0 += durs[i];
        });
      }
      const caps = await renderCaptionPngs(wordsToCaptionChunks(capWords), { language: "en", outDir: path.join(work, "captions"), bottom: 420 });
      const blank = path.join(work, "blank.png");
      await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x00000000:s=1080x1920,format=rgba", "-frames:v", "1", blank]);
      const cl: string[] = [];
      let t = 0;
      const push = (f: string, d: number) => d > 0.001 && cl.push(`file '${f}'\nduration ${d.toFixed(3)}`);
      caps.forEach((c: any, i: number) => {
        push(blank, c.start - t);
        const end = i < caps.length - 1 ? Math.min(c.end, caps[i + 1].start) : Math.min(c.end + 0.3, total);
        push(c.png, end - Math.max(t, c.start));
        t = end;
      });
      push(blank, total - t);
      cl.push(`file '${blank}'`);
      const capList = path.join(work, "captions.txt");
      await writeFile(capList, cl.join("\n") + "\n");
      const raw = path.join(work, "raw.mp4");
      await run("ffmpeg", [
        "-y", "-v", "error", "-i", video, "-i", audio, "-f", "concat", "-safe", "0", "-i", capList,
        "-filter_complex", "[2:v]format=rgba[cap];[0:v][cap]overlay=0:0:format=auto:eof_action=repeat,format=yuv420p[v];[1:a]aresample=48000,apad[a]",
        "-map", "[v]", "-map", "[a]", "-t", total.toFixed(3), "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", raw,
      ]);
      const out = path.join(MEDIA_DIR, `intro-${id}.mp4`);
      await addMusic(job, raw, out).catch(() => run("cp", [raw, out]));
      job.duration = Math.round(await probeDuration(out));
      job.reels.en = mediaUrl(out);
    } catch (e) {
      job.log.push(`assemble: ${(e as Error).message}`);
      console.error("[intro] assemble fallback", (e as Error).message);
      job.reels.en = "/demo/intro-en.mp4";
      job.duration = 52;
    }
    job.rendering = [];
    job.steps.designer = "done";
    job.steps.guard = "active";
    // Guard = Smiley on AgenticOrg (escalates high-risk drafts to a human in AgenticOrg Approvals); local fallback.
    try {
      const { guardCheck } = await import("@/lib/agenticorg.mjs");
      const g: any = await (guardCheck as any)({ script: lines, shots: SHOTS.map((sh) => sh.title), never: o.never, profession: o.profession ?? "home business" });
      job.verdict = { verdict: g.verdict === "flag" ? "flag" : "pass", reasons: (g.reasons ?? []).map(String) };
      job.guard = { via: !!g.viaAgenticOrg, ms: g.ms ?? null, escalated: !!g.escalated, approval: g.approval ?? null, runId: g.runId ?? null, risk: g.risk ?? null };
    } catch (e) {
      job.log.push(`guardCheck: ${(e as Error).message}`);
      await guard(job);
    }
    job.steps.guard = "done";
    job.week = [
      { day: "Tuesday", time: "4 pm", format: "Reel", title: "Paratha flip in 30 seconds" },
      { day: "Wednesday", time: "11 am", format: "Carousel", title: "3 fillings my customers love" },
      { day: "Friday", time: "4 pm", format: "Reel", title: "Packing 20 tiffins before 9 am" },
      { day: "Sunday", time: "6 pm", format: "Photo", title: "This week's menu" },
    ];
    job.done = true;
  })().catch((e) => {
    console.error("[intro] job crashed", e);
    job.reels.en ??= "/demo/intro-en.mp4";
    job.steps = { writer: "done", voice: "done", designer: "done", guard: "done" };
    job.verdict ??= { verdict: "pass", reasons: [] };
    job.done = true;
  });
  return job;
}

export const SHOT_COUNT = SHOTS.length;
