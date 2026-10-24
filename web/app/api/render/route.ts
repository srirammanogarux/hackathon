import path from "node:path";
import { writeFile } from "node:fs/promises";
import { MEDIA_DIR, mediaUrl } from "@/lib/mediaStore";
import { slidesOf, postLang, voiceoverOf, DEMO_REEL } from "@/lib/slides";
import { has, json } from "@/lib/server";

export const maxDuration = 180;

// step "slides": Playwright -> 1080x1350 JPEGs (if Chromium is installed).
// step "reel":   ElevenLabs TTS + ffmpeg -> 9:16 MP4 (if key + ffmpeg). Otherwise a pre-rendered demo reel.
// Every failure falls back, so the client never blocks on rendering.
export async function POST(req: Request) {
  const { post, id = "post", step, slideFiles } = await req.json();
  const lang = postLang(post) as "ta" | "kn" | "te" | "hi" | "en";
  const stamp = `${String(id).replace(/[^a-z0-9]/gi, "")}-${Date.now()}`;

  if (step === "slides") {
    try {
      const { renderCarousel } = await import("@/lib/media/carousel.mjs");
      const files: string[] = await renderCarousel(
        { language: lang, slides: slidesOf(post), brand: { color: "#6A58F5", handle: "@saathi" } },
        { outDir: MEDIA_DIR, prefix: stamp },
      );
      return json({ slides: files.map(mediaUrl), files: files.map((f) => path.basename(f)), source: "playwright" });
    } catch (e) {
      console.error("[render] slides fallback:", e instanceof Error ? e.message : e);
      return json({ slides: null, source: "client" });
    }
  }

  if (step === "reel") {
    if (has.eleven() && slideFiles?.length) {
      try {
        const { ttsWithTimestamps } = await import("@/lib/media/elevenlabs.mjs");
        const { assembleReel } = await import("@/lib/media/reel.mjs");
        const text = voiceoverOf(post);
        const tts = await ttsWithTimestamps({ text, languageCode: lang });
        const audio = path.join(MEDIA_DIR, `${stamp}.mp3`);
        await writeFile(audio, tts.audio);
        const out = path.join(MEDIA_DIR, `${stamp}.mp4`);
        await assembleReel({
          images: slideFiles.map((f: string) => path.join(MEDIA_DIR, path.basename(f))),
          audio, out, language: lang, words: tts.words?.length ? tts.words : undefined, script: text,
        });
        return json({ reel: mediaUrl(out), audio: mediaUrl(audio), source: "elevenlabs" });
      } catch (e) {
        console.error("[render] reel fallback:", e instanceof Error ? e.message : e);
      }
    }
    return json({ reel: DEMO_REEL[lang] ?? DEMO_REEL.hi, source: "demo" });
  }
  return json({ error: "step must be slides|reel" }, 400);
}
