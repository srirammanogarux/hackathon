import path from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { startJob, publicJob, type Lang } from "@/lib/funnel";
import { MEDIA_DIR } from "@/lib/mediaStore";
import { json, errorJson } from "@/lib/server";

const LANGS = ["en", "hi", "ta", "kn", "te"];

// Body: { texts: [about, brief], files: [mp3 names from /api/funnel/transcribe], consent, never, langs, source, vibe, photos: dataURL[], samplePhotos: string[] }
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const audio = (b.files ?? [])
      .filter(Boolean)
      .map((f: string) => path.join(MEDIA_DIR, path.basename(f)))
      .filter((f: string) => existsSync(f));
    // Her photos arrive as small JPEG data URLs (downscaled in the browser); store them for the Reel.
    const photos: string[] = [];
    for (const [i, d] of ((b.photos ?? []) as string[]).slice(0, 4).entries()) {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(d));
      if (!m) continue;
      const f = path.join(MEDIA_DIR, `photo-${Date.now()}-${i}.${m[1] === "png" ? "png" : "jpg"}`);
      await writeFile(f, Buffer.from(m[2], "base64"));
      photos.push(f);
    }
    // Demo sample photos (public/demo/photos) can be passed by name.
    for (const n of ((b.samplePhotos ?? []) as string[]).slice(0, 4)) {
      const f = path.join(process.cwd(), "public", "demo", "photos", path.basename(n));
      if (existsSync(f)) photos.push(f);
    }
    const job = startJob({
      vibe: b.vibe,
      photos,
      texts: Array.isArray(b.texts) ? b.texts.map(String) : [],
      audio,
      consent: !!b.consent,
      never: (b.never ?? []).map(String),
      langs: (b.langs ?? ["en"]).filter((l: string) => LANGS.includes(l)) as Lang[],
      source: b.source ?? "mock",
    });
    return json(publicJob(job));
  } catch (e) {
    return errorJson(e);
  }
}
