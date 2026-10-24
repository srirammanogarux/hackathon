// Core demo funnel pipeline: her two spoken answers -> script in her words -> her cloned voice -> 9:16 Reel per language.
// Every step falls back (stock voice -> macOS say -> pre-rendered demo reel) so the stage never sees an error.
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { MEDIA_DIR, mediaUrl } from "@/lib/mediaStore";
import { DEMO_REEL as OLD_DEMO } from "@/lib/slides";

// Pre-rendered fallbacks of the default paratha story (English/Hindi); other languages use the older demo reels.
const DEMO_REEL: Record<string, string> = { ...OLD_DEMO, en: "/demo/funnel-en.mp4", hi: "/demo/funnel-hi.mp4" };
import { run } from "@/lib/media/ffmpeg.mjs";

export type Lang = "en" | "hi" | "ta" | "kn" | "te";
export type Vibe = "warm" | "fun" | "calm";

// Reel vibe: pacing (say rate), music bed (generated sine pad, royalty-free), caption style, card colours.
export const VIBES: Record<Vibe, { brief: string; caption: string; rate: number; tones: number[]; trem: string; bg: string; ink: string }> = {
  warm: { brief: "Warm & homely: gentle pace, like talking to a neighbour.", caption: "warm, homely, 1-2 emoji", rate: 172, tones: [220, 277.18, 329.63], trem: "f=0.5:d=0.35", bg: "linear-gradient(165deg,#FFF1DC 0%,#FFD29A 55%,#F7A65A 100%)", ink: "#3B2410" },
  fun: { brief: "Fun & fast: punchy short lines, energetic.", caption: "playful, punchy, 3-4 emoji", rate: 198, tones: [392, 493.88, 587.33], trem: "f=4:d=0.85", bg: "linear-gradient(165deg,#E3F1FF 0%,#8CC8FF 55%,#1E8BFF 100%)", ink: "#06243F" },
  calm: { brief: "Calm & helpful: steady, clear, informative.", caption: "calm, helpful, no emoji", rate: 160, tones: [196, 293.66], trem: "f=0.2:d=0.3", bg: "linear-gradient(165deg,#EAF8F0 0%,#BDE9CF 55%,#6CC596 100%)", ink: "#0F3322" },
};
export type StepState = "todo" | "active" | "done";
export type Script = { slides: { headline: string; body: string }[]; voiceover: string; caption: string };
export type Draft = { day: string; time: string; format: string; title: string };

export type Job = {
  id: string;
  createdAt: number;
  texts: string[];
  transcriptSource: "elevenlabs" | "typed" | "mock";
  quote: string;
  never: string[];
  langs: Lang[];
  consent: boolean;
  audio: string[]; // mp3 paths of her answers
  steps: Record<"writer" | "voice" | "designer" | "guard", StepState>;
  voiceKind: "clone" | "stock" | "placeholder" | "demo";
  voiceId?: string;
  vibe: Vibe;
  photos: string[]; // her uploaded photos (paths)
  visuals: "photos" | "ai" | "cards" | null; // what the Reel is made of
  aiImages: string[] | null; // Gemini-generated visuals (paths), shared across languages
  aiGenerated: boolean; // Instagram is_ai_generated
  duration?: number; // seconds, intro Reel
  kind?: "first" | "intro";
  usedDemoFootage?: boolean;
  guard?: { via: boolean; ms: number | null; escalated: boolean; approval: unknown; runId: string | null; risk: string | null } | null; // AgenticOrg Guard
  team?: unknown; // AgenticOrg Scout/Writer/Editor timings from the script step
  scripts: Partial<Record<Lang, Script>>;
  reels: Partial<Record<Lang, string>>;
  rendering: Lang[];
  verdict: { verdict: "pass" | "flag"; reasons: string[] } | null;
  week: Draft[];
  done: boolean;
  log: string[];
};

const jobs: Map<string, Job> = ((globalThis as any).__saathiFunnel ??= new Map());
export const getJob = (id: string) => jobs.get(id) ?? null;
export const putJob = (job: Job) => jobs.set(job.id, job);

const has = {
  eleven: () => !!process.env.ELEVENLABS_API_KEY,
  llm: () => process.env.BRAIN_MOCK !== "1" && !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY),
};
const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi", ta: "Tamil", kn: "Kannada", te: "Telugu" };

export const MOCK_TALK = [
  "I make soft aloo parathas and fresh tiffin at home. Office people near my house order every morning.",
  "Tell people my parathas taste just like their mom's cooking. Soft, not oily, and delivered before 9 every morning.",
];

const MOCK_SCRIPTS: Record<Lang, Script> = {
  en: {
    slides: [
      { headline: "Tastes just like Mom's cooking", body: "That's what my customers tell me." },
      { headline: "Rolled by hand, every morning", body: "Soft aloo parathas, made fresh at home." },
      { headline: "Packed hot, before 9", body: "Straight into your office tiffin." },
      { headline: "Soft till lunch. Real ghar ka khana.", body: "Message me to order for tomorrow." },
    ],
    voiceover: "My parathas taste just like your mom's cooking. Rolled by hand, fresh every morning. Packed hot in your tiffin, delivered before nine. Soft till lunch. Real ghar ka khana. Message me to order for tomorrow!",
    caption: "Tastes just like Mom's cooking 🫓 Soft aloo parathas, rolled by hand every morning and packed hot before 9. Soft till lunch. Real ghar ka khana.\n\nMessage me to order for tomorrow!\n\n#homefood #aloparatha #tiffin #gharkakhana",
  },
  hi: {
    slides: [
      { headline: "बिल्कुल माँ के हाथ जैसा", body: "मेरे customers यही कहते हैं।" },
      { headline: "नरम आलू पराठे", body: "हर सुबह घर पर ताज़ा बने।" },
      { headline: "कम तेल, हमेशा टाइम पर", body: "ऑफिस का लंच, बिना टेंशन।" },
      { headline: "कल के लिए ऑर्डर करें", body: "रात 9 बजे से पहले मैसेज करें।" },
    ],
    voiceover: "मेरे customers कहते हैं, बिल्कुल माँ के हाथ जैसा स्वाद। मैं हर सुबह घर पर नरम आलू पराठे बनाती हूँ। कम तेल, और हमेशा टाइम पर। कल के लिए चाहिए? आज रात नौ बजे से पहले मैसेज कीजिए।",
    caption: "\"बिल्कुल माँ के हाथ जैसा\" 🫓 हर सुबह ताज़ा आलू पराठे। रात 9 बजे से पहले मैसेज करें!\n\n#homefood #आलूपराठा #tiffin",
  },
  ta: {
    slides: [
      { headline: "அம்மா கை பக்குவம்", body: "என் customers இதையே சொல்றாங்க." },
      { headline: "மிருதுவான ஆலு பராட்டா", body: "தினமும் காலையில வீட்டுல புதுசா." },
      { headline: "எண்ணெய் குறைவு, நேரம் தவறாது", body: "ஆபீஸ் லஞ்ச், கவலை இல்ல." },
      { headline: "நாளைக்கு ஆர்டர் பண்ணுங்க", body: "இன்னைக்கு ராத்திரி 9 மணிக்குள்ள மெசேஜ் பண்ணுங்க." },
    ],
    voiceover: "என் customers சொல்றாங்க, அம்மா கை பக்குவம் மாதிரியே இருக்குன்னு. தினமும் காலையில வீட்டுல மிருதுவான ஆலு பராட்டா செய்யறேன். எண்ணெய் குறைவு, நேரம் தவறாது. நாளைக்கு வேணுமா? இன்னைக்கு ராத்திரி ஒன்பது மணிக்குள்ள மெசேஜ் பண்ணுங்க.",
    caption: "\"அம்மா கை பக்குவம்\" 🫓 தினமும் புதுசா ஆலு பராட்டா. ராத்திரி 9 மணிக்குள்ள மெசேஜ் பண்ணுங்க!\n\n#homefood #tiffin",
  },
  kn: {
    slides: [
      { headline: "ಅಮ್ಮನ ಕೈರುಚಿ", body: "ನನ್ನ customers ಇದನ್ನೇ ಹೇಳ್ತಾರೆ." },
      { headline: "ಮೃದುವಾದ ಆಲೂ ಪರೋಟ", body: "ಪ್ರತಿದಿನ ಬೆಳಿಗ್ಗೆ ಮನೆಯಲ್ಲೇ ಫ್ರೆಶ್." },
      { headline: "ಕಡಿಮೆ ಎಣ್ಣೆ, ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ", body: "ಆಫೀಸ್ ಲಂಚ್, ಟೆನ್ಷನ್ ಇಲ್ಲ." },
      { headline: "ನಾಳೆಗೆ ಆರ್ಡರ್ ಮಾಡಿ", body: "ಇವತ್ತು ರಾತ್ರಿ 9ರೊಳಗೆ ಮೆಸೇಜ್ ಮಾಡಿ." },
    ],
    voiceover: "ನನ್ನ customers ಹೇಳ್ತಾರೆ, ಅಮ್ಮನ ಕೈರುಚಿ ಹಾಗೇ ಇದೆ ಅಂತ. ಪ್ರತಿದಿನ ಬೆಳಿಗ್ಗೆ ಮನೆಯಲ್ಲೇ ಮೃದುವಾದ ಆಲೂ ಪರೋಟ ಮಾಡ್ತೀನಿ. ಕಡಿಮೆ ಎಣ್ಣೆ, ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ. ನಾಳೆಗೆ ಬೇಕಾ? ಇವತ್ತು ರಾತ್ರಿ ಒಂಬತ್ತು ಗಂಟೆಯೊಳಗೆ ಮೆಸೇಜ್ ಮಾಡಿ.",
    caption: "\"ಅಮ್ಮನ ಕೈರುಚಿ\" 🫓 ಪ್ರತಿದಿನ ಫ್ರೆಶ್ ಆಲೂ ಪರೋಟ. ರಾತ್ರಿ 9ರೊಳಗೆ ಮೆಸೇಜ್ ಮಾಡಿ!\n\n#homefood #tiffin",
  },
  te: {
    slides: [
      { headline: "అమ్మ చేతి రుచి", body: "నా customers ఇదే అంటారు." },
      { headline: "మెత్తటి ఆలూ పరాటా", body: "ప్రతి ఉదయం ఇంట్లోనే ఫ్రెష్‌గా." },
      { headline: "తక్కువ నూనె, టైమ్‌కి", body: "ఆఫీస్ లంచ్, టెన్షన్ లేదు." },
      { headline: "రేపటికి ఆర్డర్ చేయండి", body: "ఈ రాత్రి 9 లోపు మెసేజ్ చేయండి." },
    ],
    voiceover: "నా customers అంటారు, అమ్మ చేతి రుచిలా ఉందని. ప్రతి ఉదయం ఇంట్లోనే మెత్తటి ఆలూ పరాటాలు చేస్తాను. తక్కువ నూనె, ఎప్పుడూ టైమ్‌కి. రేపు కావాలా? ఈ రాత్రి తొమ్మిది లోపు మెసేజ్ చేయండి.",
    caption: "\"అమ్మ చేతి రుచి\" 🫓 ప్రతి ఉదయం ఫ్రెష్ ఆలూ పరాటా. రాత్రి 9 లోపు మెసేజ్ చేయండి!\n\n#homefood #tiffin",
  },
};

const MOCK_WEEK: Draft[] = [
  { day: "Tuesday", time: "4 pm", format: "Reel", title: "Paratha flip in 30 seconds" },
  { day: "Wednesday", time: "11 am", format: "Carousel", title: "3 fillings my customers love" },
  { day: "Friday", time: "4 pm", format: "Reel", title: "Packing 20 tiffins before 9 am" },
  { day: "Sunday", time: "6 pm", format: "Photo", title: "This week's menu" },
];

const sentences = (t: string) => t.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);
const words = (s: string, n: number) => s.replace(/[.!?।]+$/, "").split(/\s+/).slice(0, n).join(" ");

export function quoteOf(texts: string[]) {
  return clip(sentences(texts[0] || MOCK_TALK[0])[0] ?? texts[0], 70);
}

// No LLM: English script stitched from her own sentences; other languages use the demo translation.
function mockScript(lang: Lang, texts: string[]): Script {
  const isMock = texts.join(" ").trim() === MOCK_TALK.join(" ");
  if (lang !== "en" || isMock) return MOCK_SCRIPTS[lang];
  // texts[1] is her brief ("What should your first Reel say?"): it leads, in her words.
  const brief = sentences(texts[1] || "");
  const about = sentences(texts[0] || "");
  const hook = brief[0] ?? about[0] ?? "Made with love";
  const slides = [
    { headline: words(hook, 8), body: brief[1] ?? "" },
    { headline: words(about[0] ?? hook, 7), body: about[1] ?? "" },
    { headline: words(brief[2] ?? brief[1] ?? "Made fresh, every day", 7), body: "Made by hand, with care." },
    { headline: "Want to try it?", body: "Message me to order. Save this for later!" },
  ];
  return { slides, voiceover: [...brief.slice(0, 3), ...about.slice(0, 1), "Message me to order."].join(" "), caption: `${hook}\n\n${texts[0]}\n\nMessage me to order!` };
}

const ScriptSchema = z.object({
  slides: z.array(z.object({ headline: z.string(), body: z.string() })).describe("4-5 slides; slide 1 = hook taken from what customers love"),
  voiceover: z.string().describe("15-25 seconds when spoken, first person, her words, spoken register"),
  caption: z.string().describe("Instagram caption, 30-80 words, hook first line, 3-6 hashtags"),
});
const BuildSchema = z.object({
  quote: z.string().describe("a short verbatim phrase from her first answer, under 12 words"),
  scripts: z.array(ScriptSchema.extend({ lang: z.enum(["en", "hi", "ta", "kn", "te"]) })),
  week: z
    .array(z.object({ day: z.string(), time: z.string(), format: z.enum(["Reel", "Carousel", "Photo"]), title: z.string().describe("English, under 7 words") }))
    .describe("exactly 4 next posts for this week, doable with no face and in under 20 minutes"),
});

const SYSTEM = `You write Instagram Reels for Indian home businesses and first-time creators, using the creator's OWN words.
Keep her phrases, her claims and her tone. Never invent prices, awards or facts she didn't say.
Write each language in its native script, in the spoken register people actually use (Hindi may mix common English words). Short sentences a TTS voice can read.`;

async function llm<T>(name: string, schema: z.ZodType<T>, user: string): Promise<T> {
  const { callStructured } = await import("@/lib/brain/llm.mjs");
  return (callStructured as any)({ name, system: SYSTEM, user, schema, effort: "low", mock: () => { throw new Error("mock"); } });
}

async function writeAll(job: Job) {
  if (!has.llm()) {
    for (const l of job.langs) job.scripts[l] = mockScript(l, job.texts);
    job.week = MOCK_WEEK;
    return;
  }
  const out = await llm("funnelWrite", BuildSchema, `Her answers (speech-to-text):
1. What she makes and who buys it: """${job.texts[0]}"""
2. HER BRIEF, what her first Reel should say: """${job.texts[1]}"""
Follow her brief closely and quote her own phrases; the first line (first 2 seconds) is the hook from her brief.
Reel vibe: ${VIBES[job.vibe].brief}
Never show in posts: ${job.never.join(", ") || "nothing specified"}.
Write one Reel script per language: ${job.langs.map((l) => `${l} (${LANG_NAME[l]})`).join(", ")}. 20-30 seconds of voiceover. Caption style: ${VIBES[job.vibe].caption}.
Also plan 4 more posts for this week.`);
  job.quote = clip(out.quote, 70);
  for (const s of out.scripts) if (job.langs.includes(s.lang)) job.scripts[s.lang] = { slides: s.slides, voiceover: s.voiceover, caption: s.caption };
  for (const l of job.langs) job.scripts[l] ??= mockScript(l, job.texts);
  job.week = out.week.slice(0, 4).length === 4 ? out.week.slice(0, 4) : MOCK_WEEK;
}

async function scriptFor(job: Job, lang: Lang): Promise<Script> {
  if (job.scripts[lang]) return job.scripts[lang]!;
  if (has.llm()) {
    try {
      const base = job.scripts[job.langs[0]];
      const s = await llm("funnelTranslate", ScriptSchema, `Rewrite this Reel script in ${LANG_NAME[lang]} (native script, spoken register). Keep meaning and her voice.\n${JSON.stringify(base)}`);
      return (job.scripts[lang] = s);
    } catch (e) {
      job.log.push(`translate ${lang}: ${(e as Error).message}`);
    }
  }
  return (job.scripts[lang] = mockScript(lang, job.texts));
}

async function cloneVoice(job: Job) {
  if (!has.eleven()) return (job.voiceKind = "placeholder");
  if (job.consent && job.audio.length) {
    try {
      const { createInstantVoiceClone } = await import("@/lib/media/elevenlabs.mjs");
      const r = await createInstantVoiceClone({ name: `instabud-${job.id}`, files: job.audio, description: "Reels Magic creator voice (consented)" });
      job.voiceId = r.voice_id;
      return (job.voiceKind = "clone");
    } catch (e) {
      job.log.push(`clone: ${(e as Error).message}`);
    }
  }
  job.voiceKind = "stock";
}

const esc = (t = "") => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function iconFor(texts: string[]) {
  const t = texts.join(" ").toLowerCase();
  if (/paratha|roti|chapati|bread|dosa|naan/.test(t)) return "flatbread";
  if (/tooth|teeth|dental|dentist/.test(t)) return "tooth";
  if (/saree|sari|dress|boutique/.test(t)) return "sari";
  if (/shop|store|kirana/.test(t)) return "bags";
  return "cooking";
}

// 1080x1920 text card: the hook (always card 0) and, with no photos/AI images, every slide.
async function renderCard(job: Job, lang: Lang, slide: { headline: string; body: string }, i: number, total: number, file: string) {
  const { fontFaceCss, fontStack } = await import("@/lib/media/fonts.mjs");
  const { screenshotHtml } = await import("@/lib/media/browser.mjs");
  const { readFile } = await import("node:fs/promises");
  const v = VIBES[job.vibe];
  const icon = await readFile(path.join(process.cwd(), "public", "3d", `${iconFor(job.texts)}.png`)).then((b) => `data:image/png;base64,${b.toString("base64")}`).catch(() => "");
  const hook = i === 0;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss()}
*{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px}
body{font-family:${fontStack(lang)};background:${v.bg};color:${v.ink};display:flex;flex-direction:column;padding:200px 96px 560px}
.top{display:flex;justify-content:space-between;font:600 34px 'NotoLatin',sans-serif;opacity:.7}
.main{flex:1;display:flex;flex-direction:column;justify-content:center;gap:48px}
img{width:${hook ? 360 : 280}px;height:${hook ? 360 : 280}px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.18))}
h1{font-size:${hook ? 112 : 92}px;line-height:1.18;font-weight:800;letter-spacing:-.02em;text-wrap:balance}
p{font-size:52px;line-height:1.45;font-weight:500;opacity:.85;text-wrap:pretty}</style></head><body>
<div class="top"><span>@reelsmagic</span><span>${i + 1}/${total}</span></div>
<div class="main">${icon ? `<img src="${icon}">` : ""}<h1>${esc(slide.headline)}</h1>${slide.body ? `<p>${esc(slide.body)}</p>` : ""}</div></body></html>`;
  await screenshotHtml(html, { width: 1080, height: 1920, path: file, type: "jpeg", quality: 90 });
  return file;
}

// Gemini image generation (same GEMINI_API_KEY). Returns null on any failure so the caller falls back to cards.
async function geminiImage(prompt: string, file: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`gemini image ${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (!part) throw new Error("no image in response");
    await writeFile(file, Buffer.from(part.inlineData.data, "base64"));
    return file;
  } catch (e) {
    console.error("[funnel] gemini image", (e as Error).message);
    return null;
  }
}

async function prepareVisuals(job: Job) {
  if (job.visuals) return;
  if (job.photos.length) {
    job.visuals = "photos";
    return;
  }
  const script = job.scripts[job.langs[0]] ?? MOCK_SCRIPTS.en;
  const avoid = job.never.length ? ` Do not show: ${job.never.map((n) => n.toLowerCase()).join(", ")}; no people's faces.` : " No people's faces.";
  const shots = script.slides.slice(0, 3).map(
    (sl, i) => `Vertical 9:16 warm, natural phone-photo style image for an Instagram Reel by a small Indian home business. ${job.texts[0]} Scene ${i + 1}: ${sl.headline}. ${sl.body}. Indian home kitchen or shop setting, soft window light, appetizing, no text, no logos.${avoid}`,
  );
  const imgs = await Promise.all(shots.map((p, i) => geminiImage(p, path.join(MEDIA_DIR, `funnel-${job.id}-ai-${i}.png`))));
  const ok = imgs.filter(Boolean) as string[];
  if (ok.length >= 2) {
    job.aiImages = ok;
    job.visuals = "ai";
    job.aiGenerated = true;
  } else {
    job.visuals = "cards";
  }
}

// Mix a soft generated music bed under the voice (royalty-free: sine pad + tremolo per vibe).
export async function addMusic(job: Job, input: string, out: string) {
  const { probeDuration } = await import("@/lib/media/ffmpeg.mjs");
  const dur = await probeDuration(input);
  const v = VIBES[job.vibe];
  const args = ["-y", "-v", "error", "-i", input];
  for (const f of v.tones) args.push("-f", "lavfi", "-t", String(dur), "-i", `sine=frequency=${f}:sample_rate=48000`);
  const n = v.tones.length;
  const ins = v.tones.map((_, i) => `[${i + 1}:a]`).join("");
  const fade = Math.max(0, dur - 1.5).toFixed(2);
  args.push(
    "-filter_complex",
    `${ins}amix=inputs=${n}:normalize=1,tremolo=${v.trem},lowpass=f=1400,volume=0.07,afade=t=in:d=1,afade=t=out:st=${fade}:d=1.5[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out,
  );
  await run("ffmpeg", args);
  return out;
}

async function renderLang(job: Job, lang: Lang) {
  if (job.reels[lang] || job.rendering.includes(lang)) return;
  job.rendering.push(lang);
  const stamp = `funnel-${job.id}-${lang}`;
  try {
    const script = await scriptFor(job, lang);
    const audioPath = path.join(MEDIA_DIR, `${stamp}.${has.eleven() ? "mp3" : "m4a"}`);
    let words: { text: string; start: number; end: number }[] | undefined;
    if (has.eleven()) {
      const { ttsWithTimestamps } = await import("@/lib/media/elevenlabs.mjs");
      const t = await ttsWithTimestamps({ text: script.voiceover, voiceId: job.voiceId, languageCode: lang } as any);
      await writeFile(audioPath, t.audio);
      words = t.words?.length ? t.words : undefined;
    } else {
      const { sayToFile } = await import("@/lib/media/audio.mjs");
      await sayToFile(script.voiceover, audioPath, { language: lang, rate: VIBES[job.vibe].rate });
    }
    await prepareVisuals(job);
    const total = job.visuals === "cards" ? script.slides.length : 1 + (job.visuals === "photos" ? job.photos.length : job.aiImages!.length);
    const hook = await renderCard(job, lang, script.slides[0], 0, total, path.join(MEDIA_DIR, `${stamp}-card-0.jpg`));
    let images = [hook];
    if (job.visuals === "photos") images.push(...job.photos);
    else if (job.visuals === "ai") images.push(...job.aiImages!);
    else for (let i = 1; i < script.slides.length; i++) images.push(await renderCard(job, lang, script.slides[i], i, total, path.join(MEDIA_DIR, `${stamp}-card-${i}.jpg`)));
    const { assembleReel } = await import("@/lib/media/reel.mjs");
    const raw = path.join(MEDIA_DIR, `${stamp}-raw.mp4`);
    await assembleReel({ images, audio: audioPath, out: raw, language: lang, words, script: script.voiceover, fit: "cover", workDir: path.join(MEDIA_DIR, `.work-${stamp}`) });
    const out = path.join(MEDIA_DIR, `${stamp}.mp4`);
    await addMusic(job, raw, out).catch((e) => {
      job.log.push(`music: ${(e as Error).message}`);
      return run("cp", [raw, out]);
    });
    job.reels[lang] = mediaUrl(out);
  } catch (e) {
    job.log.push(`render ${lang}: ${(e as Error).message}`);
    console.error("[funnel] render fallback", lang, (e as Error).message);
    job.scripts[lang] ??= MOCK_SCRIPTS[lang];
    job.reels[lang] = DEMO_REEL[lang] ?? DEMO_REEL.en;
    if (job.voiceKind === "placeholder") job.voiceKind = "demo";
  } finally {
    job.rendering = job.rendering.filter((l) => l !== lang);
  }
}

export async function guard(job: Job) {
  try {
    const { checkBoundaries } = await import("@/lib/brain/brain.mjs");
    const lang = job.langs[0];
    const s = job.scripts[lang]!;
    const post = {
      plan_id: "first", format: "reel", languages_out: job.langs, carousel: null, single_image: null,
      reel: { duration_s: 20, voiceover_lang: lang, lines: s.slides.map((sl, i) => ({ t_start: i * 5, t_end: i * 5 + 5, voiceover: sl.body, on_screen_text: sl.headline, shot: "Animated text slide, no person visible" })) },
      caption: [{ lang, text: s.caption }], hashtags: [], story_text: { lang, text: s.slides[0].headline },
    };
    const profile = {
      name: null, profession: "home food business", city: null, language_in: lang, languages_out: job.langs,
      camera_level: job.never.includes("Face") ? 2 : 4,
      boundaries: { personal: job.never.map((n) => `never show ${n.toLowerCase()}`), cultural: [], professional: [] },
    };
    const v: any = await (checkBoundaries as any)(post, profile);
    job.verdict = { verdict: v.verdict, reasons: (v.reasons ?? []).map((r: any) => r.rule) };
  } catch (e) {
    job.log.push(`guard: ${(e as Error).message}`);
    job.verdict = { verdict: "pass", reasons: [] };
  }
}

async function stt(file: string): Promise<string | null> {
  if (!has.eleven()) return null;
  const { readFile } = await import("node:fs/promises");
  const body = new FormData();
  body.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
  body.append("file", new Blob([await readFile(file)]), path.basename(file));
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }, body });
  if (!res.ok) throw new Error(`stt ${res.status}`);
  return (await res.json()).text ?? null;
}

export async function transcribeBlob(blob: Blob, name: string): Promise<{ text: string | null; file: string }> {
  // iPhone Safari records audio/mp4 (AAC), Chrome audio/webm (Opus): keep the right extension, convert to mp3.
  const ext = /mp4|aac|m4a/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
  const raw = path.join(MEDIA_DIR, `${name}.${ext}`);
  await writeFile(raw, Buffer.from(await blob.arrayBuffer()));
  let mp3 = path.join(MEDIA_DIR, `${name}.mp3`);
  const ok = await run("ffmpeg", ["-y", "-v", "error", "-i", raw, "-ac", "1", "-ar", "44100", mp3]).then(() => true).catch(() => false);
  if (!ok) mp3 = raw;
  let text: string | null = null;
  try {
    text = await stt(mp3);
  } catch (e) {
    console.error("[funnel] stt", (e as Error).message);
  }
  return { text, file: mp3 };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startJob(input: { texts: string[]; audio: string[]; consent: boolean; never: string[]; langs: Lang[]; source: Job["transcriptSource"]; vibe?: Vibe; photos?: string[] }) {
  const id = Math.random().toString(36).slice(2, 10);
  const texts = input.texts.map((t, i) => (t?.trim() ? t.trim() : MOCK_TALK[i]));
  const job: Job = {
    id, createdAt: Date.now(), texts, transcriptSource: input.source, quote: quoteOf(texts),
    never: input.never, langs: input.langs.length ? input.langs : ["en"], consent: input.consent, audio: input.audio,
    steps: { writer: "active", voice: "todo", designer: "todo", guard: "todo" },
    voiceKind: "placeholder", scripts: {}, reels: {}, rendering: [], verdict: null, week: [], done: false, log: [],
    vibe: input.vibe && VIBES[input.vibe] ? input.vibe : "warm", photos: input.photos ?? [], visuals: null, aiImages: null, aiGenerated: false,
  };
  jobs.set(id, job);
  (async () => {
    try {
      await writeAll(job);
    } catch (e) {
      job.log.push(`writer: ${(e as Error).message}`);
      for (const l of job.langs) job.scripts[l] ??= mockScript(l, job.texts);
      if (!job.week.length) job.week = MOCK_WEEK;
    }
    job.steps.writer = "done";
    job.steps.voice = "active";
    await cloneVoice(job).catch(() => (job.voiceKind = "stock"));
    await sleep(400);
    job.steps.voice = "done";
    job.steps.designer = "active";
    await renderLang(job, job.langs[0]);
    job.steps.designer = "done";
    job.steps.guard = "active";
    await guard(job);
    job.steps.guard = "done";
    job.done = true;
    for (const l of job.langs.slice(1)) await renderLang(job, l);
  })().catch((e) => {
    console.error("[funnel] job crashed", e);
    for (const l of job.langs) job.reels[l] ??= DEMO_REEL[l] ?? DEMO_REEL.en;
    job.scripts[job.langs[0]] ??= MOCK_SCRIPTS[job.langs[0]];
    job.week = job.week.length ? job.week : MOCK_WEEK;
    job.steps = { writer: "done", voice: "done", designer: "done", guard: "done" };
    job.verdict ??= { verdict: "pass", reasons: [] };
    job.done = true;
  });
  return job;
}

export function requestLang(job: Job, lang: Lang) {
  if (!job.reels[lang]) void renderLang(job, lang);
}

export function publicJob(job: Job) {
  const { audio, log, photos, aiImages, usedDemoFootage, ...rest } = job;
  return { ...rest, captions: Object.fromEntries(Object.entries(job.scripts).map(([l, s]) => [l, s?.caption ?? ""])) };
}
