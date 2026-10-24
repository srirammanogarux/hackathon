import path from "node:path";
import { startIntroJob } from "@/lib/intro";
import { publicJob } from "@/lib/funnel";
import { MEDIA_DIR } from "@/lib/mediaStore";
import { json, errorJson } from "@/lib/server";

const inMedia = (f: unknown) => (typeof f === "string" && f ? path.join(MEDIA_DIR, path.basename(f)) : null);

// Body: { lines[6], voice: mp3 name | null, clips: (name|null)[6], demo, vibe, never } -> job (poll /api/funnel/status)
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const job = startIntroJob({
      lines: Array.isArray(b.lines) ? b.lines.map(String) : [],
      voice: inMedia(b.voice),
      clips: (b.clips ?? []).map(inMedia),
      demo: !!b.demo,
      vibe: ["warm", "fun", "calm"].includes(b.vibe) ? b.vibe : "warm",
      never: (b.never ?? []).map(String),
      profession: typeof b.profession === "string" ? b.profession : undefined,
      team: b.team ?? null,
    });
    return json(publicJob(job));
  } catch (e) {
    return errorJson(e);
  }
}
